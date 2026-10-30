"""Reuse a published ZIP prefix; append updated entries and a unique directory.

Run package-game.py first, then pass the previous published download manifest.
The browser still verifies and downloads one ordinary, complete ZIP archive.
"""
from pathlib import Path
import hashlib
import io
import json
import re
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
out = root / 'downloads'
baseline = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
chunks = []
for part in baseline['parts']:
    assert re.fullmatch(r'mind-quest-[a-f0-9]{12}-\d{2}\.part', part['file'])
    data = (out / part['file']).read_bytes()
    assert len(data) == part['bytes']
    assert hashlib.sha256(data).hexdigest() == part['sha256']
    chunks.append(data)
prefix = b''.join(chunks)
assert len(prefix) == baseline['size']
assert hashlib.sha256(prefix).hexdigest() == baseline['sha256']
with zipfile.ZipFile(out / 'mind-quest-offline.zip') as fresh:
    assert len(fresh.namelist()) == len(set(fresh.namelist()))
    wanted = {name: fresh.read(name) for name in fresh.namelist()}
with zipfile.ZipFile(io.BytesIO(prefix)) as previous:
    assert len(previous.namelist()) == len(set(previous.namelist()))
    keep = {info.filename: info for info in previous.infolist()
            if info.filename in wanted and previous.read(info.filename) == wanted[info.filename]}

stream = io.BytesIO(prefix)
stream.seek(len(prefix))
with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    # Reuse unchanged local records. Only the final directory is authoritative;
    # each filename occurs once, so ordinary extractors never prompt to overwrite.
    archive.filelist.extend(keep.values())
    archive.NameToInfo.update(keep)
    for name, data in wanted.items():
        if name not in keep:
            archive.writestr(name, data)
data = stream.getvalue()
assert data[:len(prefix)] == prefix
assert len(data) <= 32_000_000
with zipfile.ZipFile(io.BytesIO(data)) as verify:
    assert len(verify.namelist()) == len(set(verify.namelist())) == len(wanted)
    assert verify.testzip() is None
    assert all(verify.read(name) == value for name, value in wanted.items())

digest = hashlib.sha256(data).hexdigest()
parts = list(baseline['parts'])
tail = data[len(prefix):]
assert len(parts) + (len(tail) + 2_999_999) // 3_000_000 <= 16
for start in range(0, len(tail), 3_000_000):
    chunk = tail[start:start+3_000_000]
    name = f'mind-quest-{digest[:12]}-{len(parts)+1:02d}.part'
    (out / name).write_bytes(chunk)
    parts.append({'file': name, 'bytes': len(chunk), 'sha256': hashlib.sha256(chunk).hexdigest()})
manifest = dict(version=1, filename='mind-quest-offline.zip', size=len(data), sha256=digest, parts=parts)
(out / 'mind-quest-offline.zip').write_bytes(data)
(out / 'mind-quest-offline.manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'unchangedEntries': len(keep), 'updatedEntries': len(wanted)-len(keep),
                  'newBytesToUpload': len(tail), 'archiveBytes': len(data), 'uniqueEntries': len(wanted)}))
