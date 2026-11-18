"""Write source and candidate byte/hash/CRC provenance without editing originals."""
from pathlib import Path
import hashlib
import json
import zlib

repo = Path(__file__).resolve().parents[2]
root = repo / "game/assets/painted-avatar"
pending = root / "professor-crossline-pending-v2"
files = []
for direction in ("down", "up", "left", "right"):
    for sheet in ("actions", "run"):
        files.append(root / "professor-v1" / f"{direction}-{sheet}-shirt.webp")
        files.extend((root / "professor-crossline-common-v1").glob(
            f"professor-{direction}-{sheet}-pants-candidate-v*.png"))
files.extend(pending.glob("*.png"))
files.extend((repo / "tools/outfit-recipe/qa-evidence-20261118").glob("*.png"))
entries = []
for file in sorted(set(files)):
    data = file.read_bytes()
    entries.append({"path": file.relative_to(repo).as_posix(), "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "crc32": f"{zlib.crc32(data) & 0xffffffff:08x}"})
out = pending / "CANDIDATE_PROVENANCE.json"
out.write_text(json.dumps({"schema": 1, "status": "pending-art-not-released",
                           "entries": entries}, indent=2) + "\n", encoding="utf8")
print(f"{out}: {len(entries)} files")
