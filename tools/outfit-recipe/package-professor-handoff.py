"""Create small, verified ZIPs for the professor equipment repair handoff.

All inputs are explicit repository files. No game source, save, or manifest is
rewritten. Re-running replaces only the generated ZIPs and PACKAGE_INDEX.json.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile
import zlib

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "handoff/professor-pipeline-20261118"
ART = REPO / "game/assets/painted-avatar"
MAX_ZIP = 1_800_000
RAW_GROUP_LIMIT = 1_500_000


def digest(data):
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
            "crc32": f"{zlib.crc32(data) & 0xffffffff:08x}"}


def paths(*names):
    return [REPO / name for name in names]


code = paths(
    "handoff/professor-pipeline-20261118/HANDOFF_TO_GPT.md",
    "handoff/professor-pipeline-20261118/QA_BEFORE.json",
    "handoff/professor-pipeline-20261118/QA_CANDIDATE.json",
    "handoff/professor-pipeline-20261118/painted-avatar-exact-loadout.patch",
    "tools/outfit-recipe/QA_STATUS_20261118.md",
    "tools/outfit-recipe/PROFESSOR_PIPELINE_STATUS.md",
    "tools/outfit-recipe/professor-loadout.test.cjs",
    "tools/outfit-recipe/clean-professor-pants.py",
    "tools/outfit-recipe/stage-professor-shirt.py",
    "tools/outfit-recipe/export-professor-qa-plans.cjs",
    "tools/outfit-recipe/render-professor-qa.py",
    "tools/outfit-recipe/hash-professor-candidate.py",
    "tools/outfit-recipe/serve-professor-candidate.py",
    "tools/outfit-recipe/professor-river-game-seed.js",
    "tools/outfit-recipe/package-professor-handoff.py",
    ".agents/skills/game-wearable-batch/SKILL.md",
    "game/painted-avatar.js",
    "game/painted-crossline-common.js",
    "game/assets/painted-avatar/professor-v1/manifest.json",
    "game/assets/painted-avatar/professor-crossline-common-v1/manifest.json",
    "game/assets/painted-avatar/professor-river-coat-v1/manifest.json",
)
original = []
for direction in ("down", "up", "left", "right"):
    for sheet in ("actions", "run"):
        original.append(ART / "professor-v1" / f"{direction}-{sheet}-shirt.webp")
        original.extend((ART / "professor-crossline-common-v1").glob(
            f"professor-{direction}-{sheet}-shirt-candidate-v*.png"))
        original.extend((ART / "professor-crossline-common-v1").glob(
            f"professor-{direction}-{sheet}-pants-candidate-v*.png"))
        original.append(ART / "professor-crossline-common-v1" /
                        f"professor-{direction}-{sheet}-jacket-clean-v1.png")
        original.append(ART / "professor-river-coat-v1" /
                        f"professor-{direction}-{sheet}-river-jacket-v1.png")
candidate = list((ART / "professor-crossline-pending-v2").glob("*.png"))
candidate.append(ART / "professor-crossline-pending-v2/CANDIDATE_PROVENANCE.json")
evidence = list((REPO / "tools/outfit-recipe/qa-evidence-20261118").glob("*.png"))


def groups(files):
    current, size = [], 0
    for file in sorted(set(files)):
        if not file.is_file():
            raise FileNotFoundError(file)
        n = file.stat().st_size
        if n > RAW_GROUP_LIMIT:
            raise ValueError(f"Single file exceeds safe per-package size: {file}")
        if current and size + n > RAW_GROUP_LIMIT:
            yield current
            current, size = [], 0
        current.append(file)
        size += n
    if current:
        yield current


def build_zip(name, files):
    dest = OUT / name
    records = []
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for file in files:
            rel = file.relative_to(REPO).as_posix()
            data = file.read_bytes()
            info = zipfile.ZipInfo(rel, date_time=(2026, 11, 18, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            records.append({"path": rel, **digest(data)})
    blob = dest.read_bytes()
    if len(blob) >= MAX_ZIP:
        raise ValueError(f"Package exceeds {MAX_ZIP} bytes: {dest} ({len(blob)})")
    with zipfile.ZipFile(dest) as z:
        if z.testzip() is not None:
            raise ValueError(f"CRC failure: {dest}")
        for entry in records:
            if digest(z.read(entry["path"])) != {k: entry[k] for k in ("bytes", "sha256", "crc32")}:
                raise ValueError(f"Entry mismatch: {dest}:{entry['path']}")
    return {"file": name, **digest(blob), "entries": records}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("professor-*.zip"):
        old.unlink()
    packages = []
    for kind, files in (("code", code), ("original", original),
                        ("candidate", candidate), ("evidence", evidence)):
        for i, batch in enumerate(groups(files), 1):
            packages.append({"kind": kind, **build_zip(f"professor-{kind}-{i:02}.zip", batch)})
    branch = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip()
    index = {"schema": 1, "status": "pending-art-not-released", "branchCommit": branch,
             "maxZipBytesExclusive": MAX_ZIP, "packages": packages}
    (OUT / "PACKAGE_INDEX.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"packages": len(packages), "files": sum(len(p["entries"]) for p in packages),
                      "largestZipBytes": max(p["bytes"] for p in packages), "output": str(OUT)}))


if __name__ == "__main__":
    main()
