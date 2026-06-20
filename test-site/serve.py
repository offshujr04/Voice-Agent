"""
Minimal static server for the Flowstack demo site with clean URLs.

Maps /pricing -> pricing.html, / -> index.html, etc., so the paths match the
voice agent's site index (which uses /pricing, /product, ...). This lets the
widget's redirect navigate to real pages on this origin.

Run:  python serve.py [port]   (default 8080)
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.abspath(__file__))


class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        # Strip query/fragment.
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean in ("", "/"):
            clean = "/index.html"
        elif not os.path.splitext(clean)[1]:
            # Extensionless route like /pricing -> /pricing.html
            candidate = clean.rstrip("/") + ".html"
            if os.path.exists(os.path.join(ROOT, candidate.lstrip("/"))):
                clean = candidate
        return super().translate_path(clean)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), CleanURLHandler) as httpd:
        print(f"Flowstack demo site on http://localhost:{PORT}")
        httpd.serve_forever()
