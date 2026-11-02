#!/usr/bin/env python3
"""Pack authored RGBA poses without synthesising animation.

Input is the production generation-manifest.json shipped with the art masters.
Only source cropping, a declared isotropic scale, and integer translation are
allowed. Frames from one sheet share a scale; a separately drawn correction may
override its source and calibration scale. No mirror, mesh warp, rotation,
generated in-between or alpha removal is performed. Pillow is a build-time
dependency; the game only serves the WebPs.

Example (from the repository root):
  python tools/build-native-assets.py --manifest ../stage3-production/generation-manifest.json --repo .
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, features


DIRECTIONS = {"down", "up", "left", "right"}
ACTION_SETS = {"run", "actions"}
ACTION_NAMES = ["idle", "start", "stop", "turn", "rise", "apex", "fall", "land"]
SOURCE_METADATA = ["sourceFormat", "originalGeneratedPngSha256", "originalGeneratedPngBytes", "originalGeneratedPngDimensions", "decodedRGBASha256"]
CELL = (256, 384)
GRID = (4, 2)
ANCHOR = (128, 372)
SIZE = (CELL[0] * GRID[0], CELL[1] * GRID[1])


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_source(root: Path, path: str) -> Path:
    source = (root / path).resolve()
    if not source.is_relative_to(root.resolve()):
        raise ValueError("Source must be inside the master manifest directory: " + path)
    if not source.is_file():
        raise ValueError("Missing source master: " + path)
    return source


def bounds(image: Image.Image, threshold: int = 0):
    alpha = image.getchannel("A")
    if threshold:
        alpha = alpha.point(lambda value: 255 if value > threshold else 0)
    box = alpha.getbbox()
    return list(box) if box else None


def verify_frame(frame: Image.Image, name: str, index: int) -> dict:
    full_box = bounds(frame)
    box = bounds(frame, 16)
    if box is None:
        raise ValueError(f"{name} frame {index} has no visible pixels")
    if box[0] < 2 or box[1] < 2 or box[2] > CELL[0] - 2 or box[3] > CELL[1] - 2:
        raise ValueError(f"{name} frame {index} touches its output cell edge: {box}")
    if full_box[0] < 1 or full_box[1] < 1 or full_box[2] > CELL[0] - 1 or full_box[3] > CELL[1] - 1:
        raise ValueError(f"{name} frame {index} has nonzero alpha at its cell border: {full_box}")
    alpha = frame.getchannel("A")
    histogram = alpha.histogram()
    if histogram[0] == 0:
        raise ValueError(f"{name} frame {index} lost its transparent background")
    return {
        "rgbaSha256": digest(frame.tobytes()),
        "alphaSha256": digest(alpha.tobytes()),
        "visibleBoundsAlpha16": box,
        "alphaBounds": full_box,
        "transparentPixels": histogram[0],
        "alphaRange": list(alpha.getextrema()),
    }


def build_sheet(spec: dict, source_root: Path, output_root: Path, inspection: Path | None):
    view = spec["direction"]
    kind = spec["actionSet"]
    if view not in DIRECTIONS or kind not in ACTION_SETS:
        raise ValueError("Unsupported direction or action sheet")
    name = view + "-" + kind
    if spec.get("sourceMethod", "authored-frame") != "authored-frame":
        raise ValueError("This packer accepts separately authored poses only")
    frames = spec["frames"]
    if len(frames) != 8 or sorted(frame["index"] for frame in frames) != list(range(8)):
        raise ValueError(name + " requires exactly the eight explicit source poses")
    scale = spec["scale"]
    if not isinstance(scale, (int, float)) or not math.isfinite(scale) or not 0 < scale <= 1:
        raise ValueError(name + " requires a finite isotropic downscale (0,1]")
    source_path = safe_source(source_root, spec["source"])
    source_bytes = source_path.read_bytes()
    source_hash = digest(source_bytes)
    if source_hash != spec["sourceSha256"]:
        raise ValueError(name + " source SHA256 does not match the production manifest")
    image = Image.open(source_path)
    image.load()
    if image.mode != "RGBA":
        raise ValueError(name + " source must already have an authored RGBA alpha channel")

    atlas = Image.new("RGBA", SIZE)
    records = []
    for entry in sorted(frames, key=lambda frame: frame["index"]):
        index = entry["index"]
        frame_image = image
        frame_source = spec["source"]
        frame_source_hash = source_hash
        frame_scale = entry.get("scale", scale)
        if not isinstance(frame_scale, (int, float)) or not math.isfinite(frame_scale) or not 0 < frame_scale <= 1:
            raise ValueError(name + " frame requires a finite isotropic downscale (0,1]")
        if "source" in entry:
            frame_source = entry["source"]
            frame_bytes = safe_source(source_root, frame_source).read_bytes()
            frame_source_hash = digest(frame_bytes)
            if frame_source_hash != entry.get("sourceSha256"):
                raise ValueError(name + " independent frame master SHA256 does not match")
            frame_image = Image.open(safe_source(source_root, frame_source))
            frame_image.load()
            if frame_image.mode != "RGBA":
                raise ValueError(name + " independent frame must already be authored RGBA")
        elif frame_scale != scale:
            raise ValueError(name + " frames from the same master must use the same scale")
        x, y, width, height = entry["crop"]
        if any(not isinstance(value, int) for value in (x, y, width, height)):
            raise ValueError(name + " crop must use source integer pixels")
        if min(x, y) < 0 or min(width, height) <= 0 or x + width > frame_image.width or y + height > frame_image.height:
            raise ValueError(name + " crop lies outside the master")
        anchor_x, anchor_y = entry["sourceAnchor"]
        if not all(isinstance(value, (float, int)) and math.isfinite(value) for value in (anchor_x, anchor_y)):
            raise ValueError(name + " requires a finite explicit ground anchor")
        crop = frame_image.crop((x, y, x + width, y + height))
        resized = crop.resize((round(width * frame_scale), round(height * frame_scale)), Image.Resampling.LANCZOS)
        # Ground is shared across a source row. An airborne authored foot can be
        # above it; never squash that pose or force its sole to the baseline.
        offset_x = round(ANCHOR[0] + (x - anchor_x) * frame_scale)
        offset_y = round(ANCHOR[1] + (y - anchor_y) * frame_scale)
        if offset_x < 0 or offset_y < 0 or offset_x + resized.width > CELL[0] or offset_y + resized.height > CELL[1]:
            raise ValueError(f"{name} frame {index} would clip after packing; adjust only its declared crop/anchor/scale")
        packed = Image.new("RGBA", CELL)
        packed.alpha_composite(resized, (offset_x, offset_y))
        details = verify_frame(packed, name, index)
        atlas.alpha_composite(packed, ((index % GRID[0]) * CELL[0], (index // GRID[0]) * CELL[1]))
        records.append({
            "index": index,
            "pose": "run" if kind == "run" else ACTION_NAMES[index],
            "source": frame_source,
            "sourceSha256": frame_source_hash,
            "sourceDimensions": list(frame_image.size),
            **{key: entry.get(key, spec.get(key)) for key in SOURCE_METADATA if key in entry or key in spec},
            "sourceCrop": [x, y, width, height],
            "sourceAnchor": [anchor_x, anchor_y],
            "outputOffset": [offset_x, offset_y],
            "isotropicScale": frame_scale,
            "sourceCanvasEdgeContact": entry.get("sourceCanvasEdgeContact", []),
            **({"sourceReplacementReason": entry["sourceReplacementReason"]} if "sourceReplacementReason" in entry else {}),
            **details,
        })
    if len({record["rgbaSha256"] for record in records}) != 8:
        raise ValueError(name + " contains duplicate packed images; pixel uniqueness alone is not animation QA")

    output_path = output_root / (name + ".webp")
    # Lossless web delivery preserves the cropped and downscaled pixels. Masters
    # remain unchanged PNGs in the separate production archive.
    atlas.save(output_path, "WEBP", lossless=True, quality=100, method=6)
    decoded = Image.open(output_path).convert("RGBA")
    if decoded.size != SIZE:
        raise ValueError(name + " encoded dimensions changed")
    for index in range(8):
        box = ((index % 4) * CELL[0], (index // 4) * CELL[1], (index % 4 + 1) * CELL[0], (index // 4 + 1) * CELL[1])
        check = verify_frame(decoded.crop(box), name, index)
        if check["alphaSha256"] != records[index]["alphaSha256"]:
            raise ValueError(name + " encoded alpha changed")

    if inspection:
        inspection.mkdir(parents=True, exist_ok=True)
        canvas = Image.new("RGBA", SIZE, "#e7ece8")
        canvas.alpha_composite(decoded)
        canvas.convert("RGB").save(inspection / (name + "-inspection.png"))

    return {
        "path": "./assets/native-avatar/pineapple-doctor/" + output_path.name,
        "direction": view,
        "actionSet": kind,
        "sourceMethod": "authored-frame",
        "source": spec["source"],
        "sourceBytes": len(source_bytes),
        "sourceSha256": source_hash,
        "sourceDimensions": list(image.size),
        **{key: spec[key] for key in SOURCE_METADATA if key in spec},
        "runtimeBytes": output_path.stat().st_size,
        "runtimeSha256": digest(output_path.read_bytes()),
        "runtimeDimensions": list(SIZE),
        "frames": records,
        "validation": {
            "allFramesHaveAlpha": True,
            "allFramesHaveVisiblePadding": True,
            "encodedAlphaMatchesPackedAlpha": True,
            "uniquePackedFrames": 8,
            "uniquenessDoesNotProveCorrectGait": True,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--inspection-dir", type=Path)
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    document = json.loads(manifest_path.read_text(encoding="utf-8"))
    if document.get("schemaVersion") != 1 or document.get("assetId") != "pineapple-doctor":
        raise ValueError("Unsupported production manifest")
    output = args.repo.resolve() / "game/assets/native-avatar/pineapple-doctor"
    output.mkdir(parents=True, exist_ok=True)
    keys = [(sheet["direction"], sheet["actionSet"]) for sheet in document["sheets"]]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate sheet direction/actionSet")
    results = [build_sheet(sheet, manifest_path.parent, output, args.inspection_dir) for sheet in document["sheets"]]
    result = {
        "schemaVersion": 1,
        "assetId": "pineapple-doctor",
        "baselineCommit": "8685f199810150c8e5ef478de2dfe5cccee93522",
        "scope": "doctor wearing all eight canonical fruit-pineapple equipment slots; other loadouts use the established renderer",
        "completeCardinalSet": set(keys) == {(view, kind) for view in DIRECTIONS for kind in ACTION_SETS},
        "authoredFrameCount": len(results) * 8,
        "layout": {"columns": 4, "rows": 2, "frameWidth": CELL[0], "frameHeight": CELL[1], "anchor": list(ANCHOR)},
        "pipeline": {
            "operations": ["explicit crop", "isotropic Lanczos downscale", "integer translation", "transparent atlas packing", "lossless WebP"],
            "noMirroring": True, "noMeshWarp": True, "noSynthesisedPoses": True,
            "pillowVersion": Image.__version__, "webpVersion": features.version("webp"),
        },
        "sourceManifestSha256": digest(manifest_path.read_bytes()),
        "sheets": results,
        "notes": ["Original PNG pixels are retained in the separately delivered masters.", "Any source edge contact is disclosed per frame; packing cannot restore missing original pixels.", "Pose anatomy, leading foot and hand consistency require visual review in addition to this file validation."],
    }
    (output / "manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(output / "manifest.json"), "sheets": [{"path": item["path"], "bytes": item["runtimeBytes"], "sha256": item["runtimeSha256"]} for item in results]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
