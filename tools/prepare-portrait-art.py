"""Copy imagegen masters and encode deployment images without changing alpha or dimensions."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil

root = Path(__file__).resolve().parents[1]
assets = root / 'game/assets/academy'
sources = json.loads((root / 'tools/cast-portrait-sources.json').read_text(encoding='utf-8'))
assert len(sources) == 10
record_path = assets / 'art-prompts-cast10-portraits.json'
record = json.loads(record_path.read_text(encoding='utf-8'))
assert set(sources) == {p['id'] for p in record['characters']}
manifest_path = assets / 'runtime-assets.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
static = {'campus-taiwan.webp', 'hall-ntu.webp', 'hall-nthu.webp', 'hall-ncku.webp',
          'beaker.webp', 'flask.webp', 'cylinder.webp', 'mortar.webp'}
manifest['assets'] = [a for a in manifest['assets'] if a['file'] in static]
for person in record['characters']:
    source = Path(sources[person['id']])
    assert source.is_file() and source.suffix.lower() == '.png'
    master = assets / person['master']
    shutil.copyfile(source, master)
    im = Image.open(master).convert('RGBA')
    alpha = im.getchannel('A')
    assert alpha.getextrema()[0] == 0 and alpha.getextrema()[1] > 200
    dest = assets / person['runtime']
    im.save(dest, 'WEBP', quality=90, method=6, alpha_quality=100, exact=True)
    actual = Image.open(dest).convert('RGBA')
    assert actual.size == im.size
    assert actual.getchannel('A').tobytes() == alpha.tobytes()
    sha = hashlib.sha256(dest.read_bytes()).hexdigest()
    manifest['assets'].append(dict(file=dest.name, width=im.width, height=im.height,
        sourceBytes=master.stat().st_size, webpBytes=dest.stat().st_size,
        alphaPreserved=True, sha256=sha))
    person['sourceOutput'] = source.name
    person['runtimeSHA256'] = sha
    print(person['id'], im.size, dest.stat().st_size, 'alpha preserved', flush=True)
assert len(manifest['assets']) == 18
manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
