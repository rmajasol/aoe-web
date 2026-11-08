"""Servidor local sin caché para desarrollar: python serve.py  ->  http://localhost:8765"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


if __name__ == '__main__':
    print('Reinos en Guerra en http://localhost:8765')
    ThreadingHTTPServer(('', 8765), NoCache).serve_forever()
