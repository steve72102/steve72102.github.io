"""Render actual painted-avatar plans into repeatable equipment contact sheets.

Run export-professor-qa-plans.cjs first. This is a local QA tool and never
writes game assets or player state. Uses Pillow and NumPy; no paid API.
"""
from collections import defaultdict
from pathlib import Path
import argparse
import json
import numpy as np
from PIL import Image, ImageDraw

CELL = (256, 384)
ORDER = [(direction, sheet, frame)
         for direction in ("down", "up", "left", "right")
         for sheet in ("actions", "run") for frame in range(8)]


def local_file(game_root, url):
    if not url.startswith("./assets/painted-avatar/") or ".." in url[2:].split("/"):
        raise ValueError(f"Unapproved source URL: {url}")
    return game_root / url[2:]


def edge_metrics(tile):
    a = np.asarray(tile.getchannel("A"))
    opaque = a > 16
    if not opaque.any():
        return {"opaquePx": 0, "edgePx": 0, "speckPx": 0, "lightNeutralEdgePx": 0}
    neighbors = np.zeros_like(opaque)
    neighbors[1:] |= opaque[:-1]
    neighbors[:-1] |= opaque[1:]
    neighbors[:, 1:] |= opaque[:, :-1]
    neighbors[:, :-1] |= opaque[:, 1:]
    # Erosion identifies sparse single-pixel fragments; it is a screening
    # signal, not a semantic proof that cloth pieces are connected.
    four = opaque.copy()
    four[1:] &= opaque[:-1]
    four[:-1] &= opaque[1:]
    four[:, 1:] &= opaque[:, :-1]
    four[:, :-1] &= opaque[:, 1:]
    speck = opaque & ~neighbors
    border = np.zeros_like(opaque)
    border[:2] = True
    border[-2:] = True
    border[:, :2] = True
    border[:, -2:] = True
    rgb = np.asarray(tile.convert("RGB")).astype(np.int16)
    light = (rgb.min(axis=2) > 145) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 36)
    inner_edge = opaque & ~four
    return {"opaquePx": int(opaque.sum()),
            "edgePx": int((opaque & border).sum()),
            "speckPx": int(speck.sum()),
            "lightNeutralEdgePx": int((inner_edge & light).sum())}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("plans", type=Path)
    p.add_argument("--game-root", type=Path, default=Path(__file__).resolve().parents[2] / "game")
    p.add_argument("--output", type=Path, default=Path(__file__).resolve().parent / ".qa")
    args = p.parse_args()
    data = json.loads(args.plans.read_text(encoding="utf8"))
    args.output.mkdir(parents=True, exist_ok=True)
    by_layout = defaultdict(dict)
    for cell in data["cells"]:
        by_layout[cell["layout"]][(cell["direction"], cell["sheet"], cell["frame"])] = cell
    atlas_cache = {}
    metrics_cache = {}
    issues = []
    summaries = []
    for layout, matrix in by_layout.items():
        sheet_image = Image.new("RGB", (8 * 132, 8 * 204 + 24), (241, 244, 235))
        draw = ImageDraw.Draw(sheet_image)
        draw.text((6, 5), f"{layout}: actions 0-7 then RUN8, down/up/left/right", fill=(26, 55, 52))
        rendered = 0
        for pos, key in enumerate(ORDER):
            cell = matrix.get(key)
            if not cell or cell.get("error"):
                issues.append({"layout": layout, "cell": key, "reason": cell.get("error") if cell else "missing-plan"})
                continue
            frame = Image.new("RGBA", CELL)
            for part in cell["passes"]:
                url = part["url"]
                source = local_file(args.game_root, url)
                if not source.exists():
                    issues.append({"layout": layout, "cell": key, "pass": part["id"], "reason": "source-missing", "url": url})
                    continue
                try:
                    if url not in atlas_cache:
                        atlas_cache[url] = Image.open(source).convert("RGBA")
                    atlas = atlas_cache[url]
                    if atlas.size != (part["sourceWidth"], part["sourceHeight"]):
                        raise ValueError(f"size {atlas.size} != {part['sourceWidth']}x{part['sourceHeight']}")
                    x, y = cell["frame"] % 4 * CELL[0], cell["frame"] // 4 * CELL[1]
                    tile = atlas.crop((x, y, x + CELL[0], y + CELL[1]))
                    mk = (url, cell["frame"])
                    if mk not in metrics_cache:
                        metrics_cache[mk] = edge_metrics(tile)
                    metric = metrics_cache[mk]
                    for field in ("edgePx", "speckPx"):
                        if metric[field]:
                            issues.append({"layout": layout, "cell": key, "pass": part["id"], "reason": field, "value": metric[field]})
                    if part["ownerSlot"] in ("shirt", "pants", "jacket") and metric["lightNeutralEdgePx"] > 16:
                        issues.append({"layout": layout, "cell": key, "pass": part["id"], "reason": "light-neutral-edge", "value": metric["lightNeutralEdgePx"]})
                    frame.alpha_composite(tile)
                except Exception as exc:
                    issues.append({"layout": layout, "cell": key, "pass": part["id"], "reason": "decode-failed", "detail": str(exc)})
            bg = Image.new("RGB", CELL, (241, 244, 235))
            bg.paste(frame, (0, 0), frame)
            thumb = bg.resize((128, 192), Image.Resampling.LANCZOS)
            col, row = pos % 8, pos // 8
            sheet_image.paste(thumb, (col * 132, row * 204 + 24))
            draw.text((col * 132 + 4, row * 204 + 216), f"{key[0][0]} {key[1][0]}{key[2]}", fill=(31, 59, 55))
            rendered += 1
        dest = args.output / f"{layout}-contact.png"
        sheet_image.save(dest)
        summaries.append({"layout": layout, "renderedCells": rendered, "contactSheet": str(dest)})
    report = {"schema": 1, "plans": str(args.plans), "sourceImages": len(atlas_cache),
              "cells": sum(s["renderedCells"] for s in summaries), "layouts": summaries,
              "standalone": data["standalone"], "issues": issues,
              "note": "Automated pixel heuristics are screening only; collar/cuff/cloth identity and real-game movement require visual review."}
    report_file = args.output / "professor-qa-report.json"
    report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps({"report": str(report_file), "sourceImages": len(atlas_cache),
                      "renderedCells": report["cells"], "issues": len(issues), "layouts": len(summaries)}))


if __name__ == "__main__":
    main()
