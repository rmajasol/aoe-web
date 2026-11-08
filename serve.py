"""Servidor local sin caché para desarrollar: python serve.py  ->  http://localhost:8765"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8765))
    print(f'Reinos en Guerra en http://localhost:{port}')
    ThreadingHTTPServer(('', port), NoCache).serve_forever()
