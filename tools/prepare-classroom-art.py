"""Encode original generated assets for the game; do not redraw or crop them."""
import json
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parent.parent
assets = root / 'game' / 'assets' / 'academy'
source = Path('C:/Users/PC/.codex/generated_images/01a120b3-58b0-7db1-9606-669a44415dcd')
manifest = json.loads((assets / 'classroom-art.json').read_text(encoding='utf-8'))
for item in manifest['files']:
    with Image.open(source / item['source']) as image:
        assert image.size == (1536, 1024), image.size
        image.save(assets / item['asset'], format='WEBP', quality=90, method=6)
    print(item['asset'], (assets / item['asset']).stat().st_size)
