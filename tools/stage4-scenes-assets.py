#!/usr/bin/env python3
"""Re-encode reviewed scene masters without redrawing, resizing or moving pixels.

python tools/stage4-scenes-assets.py --manifest /path/to/scenes-rebuild.json --repo .
Add --check to rebuild in memory and compare all recorded runtime hashes.
Input paths are relative to the supplied manifest; output paths are relative to
the repository. No network, credentials, saves or private management tools.
"""
import argparse
import hashlib
import io
import json
import os
import tempfile
from pathlib import Path

from PIL import Image, __version__ as pillow_version, features


def digest(data):
    return hashlib.sha256(data).hexdigest()


def within(root, value):
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Path outside its declared root: " + value)
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    recipe = json.loads(args.manifest.read_text(encoding="utf-8"))
    result = {"pillow": pillow_version, "webp": features.version("webp"), "files": []}
    for item in recipe["assets"]:
        source = within(args.manifest.parent, item["master"])
        raw = source.read_bytes()
        if digest(raw) != item["masterSHA256"]:
            raise ValueError("Master SHA256 mismatch: " + item["master"])
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        if list(image.size) != item["dimensions"]:
            raise ValueError("Unexpected native size: " + item["master"])
        data = io.BytesIO()
        image.save(data, "WEBP", quality=92, method=6)
        encoded = data.getvalue()
        if digest(encoded) != item["runtimeSHA256"]:
            raise ValueError("Runtime differs; check documented Pillow/libwebp version: " + item["runtime"])
        output = within(args.repo, item["runtime"])
        if args.check:
            if output.read_bytes() != encoded:
                raise ValueError("Installed runtime differs: " + item["runtime"])
        else:
            output.parent.mkdir(parents=True, exist_ok=True)
            # Encode before opening the destination. Publish a complete file in
            # one rename so another worktree/browser never observes a zero-byte
            # image while an encoder or workspace sync is still writing.
            with tempfile.NamedTemporaryFile(dir=output.parent, suffix='.tmp', delete=False) as temporary:
                temporary.write(encoded)
                temporary.flush()
                os.fsync(temporary.fileno())
                temporary_name = temporary.name
            os.replace(temporary_name, output)
        result["files"].append({"path": item["runtime"], "bytes": len(encoded), "sha256": digest(encoded), "pass": True})
    result["mode"] = "check" if args.check else "rebuild"
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
