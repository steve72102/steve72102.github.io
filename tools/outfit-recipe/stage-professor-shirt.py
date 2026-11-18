"""Stage the professor's existing painted blouse as a clean underlayer candidate.

This does not create a new shirt design. It provides a versioned transparent
reference and alpha mask for checking coat contamination before new art is made.
"""
from pathlib import Path
import argparse
from PIL import Image


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--mask-output", type=Path, required=True)
    args = p.parse_args()
    art = Image.open(args.source).convert("RGBA")
    if art.size != (1024, 768):
        raise ValueError(f"Expected 1024x768 atlas, got {art.size}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.mask_output.parent.mkdir(parents=True, exist_ok=True)
    art.save(args.output)
    art.getchannel("A").save(args.mask_output)
    print(args.output)


if __name__ == "__main__":
    main()
