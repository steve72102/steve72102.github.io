"""Non-destructive candidate mask for the professor COMMON trouser atlases.

The source PNGs are never written. This heuristic removes surrounding coat
tails by retaining the two longest brown trouser runs on each scanline. Its
output remains a candidate until all 64 cells receive visual review.
"""
from pathlib import Path
import argparse
import numpy as np
from PIL import Image

W, H = 256, 384


def row_runs(xs):
    if len(xs) == 0:
        return []
    cuts = np.where(np.diff(xs) > 1)[0] + 1
    return [(int(run[0]), int(run[-1])) for run in np.split(xs, cuts)]


def clean_cell(cell):
    src = np.asarray(cell.convert("RGBA")).copy()
    rgb = src[:, :, :3].astype(np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    alpha = src[:, :, 3]
    brown = (alpha > 24) & (r > 25) & (r < 150) & (r - g > 8) & (g - b > -7) & (g - b < 35)
    left = np.full(H, np.nan)
    right = np.full(H, np.nan)
    for y in range(H):
        runs = [v for v in row_runs(np.flatnonzero(brown[y])) if v[1] - v[0] >= 8]
        if not runs:
            continue
        runs = sorted(runs, key=lambda v: v[1] - v[0], reverse=True)[:2]
        left[y] = min(v[0] for v in runs)
        right[y] = max(v[1] for v in runs) - 2
    valid = np.flatnonzero(np.isfinite(left))
    if len(valid) < 25:
        raise ValueError("No substantial trouser core found in cell")
    yy = np.arange(H)
    left = np.interp(yy, valid, left[valid])
    right = np.interp(yy, valid, right[valid])
    # Smooth the row-derived outline so the cut edge does not follow individual
    # highlights or turn into a staircase at game size.
    for arr in (left, right):
        kernel_x = np.arange(-15, 16)
        kernel = np.exp(-0.5 * (kernel_x / 7) ** 2)
        kernel /= kernel.sum()
        arr[:] = np.convolve(np.pad(arr, (15, 15), mode="edge"), kernel, mode="valid")
    waist = np.clip((230 - yy) / 20, 0, 1)
    left -= 7 * waist
    right += 7 * waist
    xx = np.arange(W)[None, :]
    edge = np.minimum(xx - left[:, None], right[:, None] - xx)
    feather = np.clip((edge + 1) / 3, 0, 1)
    neutral_fringe = (r > 135) & (np.abs(r - g) < 28) & (np.abs(g - b) < 32)
    stray = neutral_fringe
    keep = (edge >= -1) & ~stray
    src[:, :, 3] = np.where(keep, np.round(alpha * feather), 0).astype(np.uint8)
    return Image.fromarray(src, "RGBA")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--mask-output", type=Path)
    args = p.parse_args()
    source = Image.open(args.source).convert("RGBA")
    if source.size != (W * 4, H * 2):
        raise ValueError(f"Expected 1024x768 atlas, got {source.size}")
    result = Image.new("RGBA", source.size)
    for frame in range(8):
        x, y = (frame % 4) * W, (frame // 4) * H
        result.paste(clean_cell(source.crop((x, y, x + W, y + H))), (x, y))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output)
    if args.mask_output:
        args.mask_output.parent.mkdir(parents=True, exist_ok=True)
        result.getchannel("A").save(args.mask_output)
    print(args.output)


if __name__ == "__main__":
    main()
