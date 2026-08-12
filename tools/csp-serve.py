# Serve the bundle under a CSP shaped like the artifact host's: inline script and
# data: images are fine, but connect-src does NOT include data:. That is exactly
# the asymmetry — img.src to a data URI is img-src, fetch() to one is connect-src.
import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Content-Security-Policy",
            "default-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
            "font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'")
        super().end_headers()
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
socketserver.TCPServer(("", int(sys.argv[1])), H).serve_forever()
