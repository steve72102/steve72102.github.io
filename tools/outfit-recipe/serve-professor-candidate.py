"""Serve the real game with isolated professor art overrides and an in-memory save.

No repository source, production save, or Firebase rule is modified. Use a new
localhost port for each QA run to avoid service-worker cache reuse.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import re


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    p.add_argument("--fallback", type=Path, required=True)
    p.add_argument("--port", type=int, default=8767)
    args = p.parse_args()
    root = args.repo.resolve()
    fallback = args.fallback.resolve()
    pending = root / "game/assets/painted-avatar/professor-crossline-pending-v2"
    fixture = root / "tools/outfit-recipe/professor-river-game-seed.js"

    class Handler(SimpleHTTPRequestHandler):
        def translate_path(self, path):
            rel = unquote(urlsplit(path).path).lstrip("/")
            if rel == "game/professor-river-game-seed.js":
                return str(fixture)
            match = re.fullmatch(
                r"game/assets/painted-avatar/professor-crossline-common-v1/"
                r"professor-(down|up|left|right)-(actions|run)-(shirt|pants)-candidate-v[12]\.png", rel)
            if match:
                direction, sheet, slot = match.groups()
                return str(pending / f"professor-{direction}-{sheet}-{slot}-isolated-v2.png")
            if ".." in Path(rel).parts:
                return str(root / "__invalid_path__")
            primary = root / rel
            return str(primary if primary.is_file() else fallback / rel)

        def do_GET(self):
            rel = unquote(urlsplit(self.path).path)
            if rel == "/game/sw.js":
                self.send_error(404, "Service worker disabled for isolated QA")
                return
            if rel in ("/game/", "/game/index.html"):
                html = (root / "game/index.html").read_text(encoding="utf8")
                needle = '<script defer src="./crossline-app-start.js'
                if html.count(needle) != 1:
                    self.send_error(500, "QA fixture insertion point missing")
                    return
                html = html.replace(needle, '<script defer src="./professor-river-game-seed.js"></script>\n  ' + needle)
                body = html.encode("utf8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

    print(f"Isolated professor QA: http://127.0.0.1:{args.port}/game/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
