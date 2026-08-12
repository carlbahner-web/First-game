#!/usr/bin/env python3
"""Bundle the game into ONE self-contained HTML file.

The published page can't fetch anything from another host, so every image is
re-encoded to WebP and inlined as a data URI, and game.js is inlined verbatim.
A tiny shim rewrites `img.src = "assets/..."` through the inlined table, so the
game's own loading code is untouched — the bundle stays a build artifact and
never leaks back into the source.
"""
import base64, io, os, sys
from PIL import Image

ROOT = "/home/user/First-game"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/live/groove-goblins.html"

# Files that are already in their final form. Re-encoding a .woff2 as WebP would
# be nonsense, and the grain tile is a hand-tuned WebP whose mark size is the
# whole point — a second lossy pass is exactly what it must not get.
#
# .wav joins them for the drum kit. It is NOT re-encoded: MP3 carries an
# encoder delay of ~576 samples, which is 13ms of silence welded to the front
# of every hit — inaudible in a music player and completely unacceptable in a
# game where the whole point is that the drum lands on the beat. Opus solves
# the delay but is not safe across every browser this has to run in. Lossless
# it is; the kit is 345KB, which is affordable.
VERBATIM = {".woff2": "font/woff2", ".webp": "image/webp", ".wav": "audio/wav"}

# Counted per kind, because one "images" total that silently includes the drum
# kit is how you stop noticing that audio is now most of the growth.
table, raw, enc = {}, 0, 0
tally = {"image": [0, 0, 0], "audio": [0, 0, 0], "font": [0, 0, 0]}   # n, raw, encoded
for dirpath, _, files in os.walk(os.path.join(ROOT, "assets")):
    for fn in sorted(files):
        ext = os.path.splitext(fn)[1].lower()
        path = os.path.join(dirpath, fn)
        key = os.path.relpath(path, ROOT).replace(os.sep, "/")
        kind = ("audio" if ext == ".wav" else "font" if ext == ".woff2" else "image")
        if ext in VERBATIM:
            data = open(path, "rb").read()
            raw += len(data)
            enc += len(data)
            tally[kind][0] += 1; tally[kind][1] += len(data); tally[kind][2] += len(data)
            uri = "data:%s;base64,%s" % (VERBATIM[ext], base64.b64encode(data).decode())
        elif ext in (".png", ".jpg", ".jpeg"):
            im = Image.open(path)
            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=90, method=6)
            raw += os.path.getsize(path)
            enc += buf.tell()
            tally[kind][0] += 1; tally[kind][1] += os.path.getsize(path); tally[kind][2] += buf.tell()
            uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
        else:
            continue
        table[key] = uri
        if key.lower() != key:
            table[key.lower()] = uri

game = open(os.path.join(ROOT, "game.js"), encoding="utf-8").read()
game = game.replace("</script", "<\\/script")

rows = ",\n".join('"%s":"%s"' % (k, v) for k, v in table.items())

# No <title> here: the host wraps this file in its own <head>, and the game
# installs its own viewport meta on coarse-pointer devices.
#
# The charset IS declared, though, and it must not be left to the wrapper. This
# file is UTF-8 and carries ~445 non-ASCII characters — 403 em-dashes, the door
# arrow, the switchboard's ≡, the ▲◀▶▼ touch d-pad. Served anywhere that does not
# put a charset in the Content-Type header, the browser guesses a legacy encoding
# and every one of them mojibakes. The artifact host happens to declare utf-8 in
# its own head so the published page is fine, but that made a locally-served
# bundle render differently from the one that ships — which is how a real defect
# gets missed. The encoding sniffer reads the first 1024 bytes regardless of
# element nesting, so first line is enough; the host's own declaration precedes
# this one and they agree.
html = """<meta charset="utf-8">
<style>
  /* One committed visual world: charcoal ink on BUZZ's off-white paper.
     No theme switch — the game's own palette is the page's palette. */
  :root { --ground:#232321; --frame:#2C2C2A; --paper:#fcf7e8; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { height:100%%; }
  body {
    background: var(--ground);
    color: var(--paper);
    display:flex; align-items:center; justify-content:center;
    overflow:hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    -webkit-tap-highlight-color: transparent;
  }
  /* the HUD overlays the room's wall band, so the page only fits the room */
  /* No frame: the play area meets the letterbox directly, as the coaster's does. */
  #game-container { position:relative; line-height:0; }
  canvas {
    /* not `pixelated` — BUZZ is hand-drawn art, and the canvas is almost
       never displayed at an integer multiple of its width */
    image-rendering: auto;
    width: min(calc(100vw - 8px), calc((100vh - 12px) * 2.0));
    height: auto;
  }
  #game { display:block; }
  #hud  { position:absolute; left:0; bottom:0; width:100%%; pointer-events:none; }
  /* Paper grain: its own canvas, sized to its CSS box and filled 1:1, so the
     pattern is never stretched. See the note in game.js. */
  #grain { position:absolute; left:0; top:0; width:100%%; height:100%%; pointer-events:none; }
  @media (prefers-reduced-motion: reduce) { canvas { transition:none; } }
</style>
<div id="game-container">
  <canvas id="game"></canvas>
  <canvas id="hud"></canvas>
  <canvas id="grain"></canvas>
</div>
<script>
window.__ASSETS = {
%s
};
(function () {
  var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get: function () { return d.get.call(this); },
    set: function (v) {
      var s = String(v), i = s.indexOf("assets/");
      if (i >= 0) {
        var k = s.slice(i);
        var hit = window.__ASSETS[k] || window.__ASSETS[k.toLowerCase()];
        if (hit) { d.set.call(this, hit); return; }
      }
      d.set.call(this, v);
    }
  });
  // The drum kit is bundled, and it is served WITHOUT going near the network.
  //
  // The obvious version of this returned f(dataUri) — hand the data URI back to
  // real fetch and let it resolve. That works everywhere except the one place
  // this file actually ships: the artifact host sets a Content-Security-Policy,
  // and while `img.src = "data:..."` is governed by img-src (which allows data:),
  // `fetch("data:...")` is governed by CONNECT-SRC, which does not. So every
  // image loaded fine and every drum sample was blocked, silently, and the game
  // fell back to its synthesised kit exactly as if the samples were missing.
  // Nothing threw; a rejected fetch is indistinguishable from a 404 to the
  // loader. It only reproduces under a CSP, which a plain local server has not
  // got — which is why it passed every test until one was served with one.
  //
  // Decoding the base64 here sidesteps the question entirely: no request is
  // made, so no policy applies.
  var f = window.fetch;
  window.fetch = function (u) {
    var s = typeof u === "string" ? u : (u && u.url) || "";
    var i = s.indexOf("assets/");
    if (i >= 0) {
      var hit = window.__ASSETS[s.slice(i)] || window.__ASSETS[s.slice(i).toLowerCase()];
      if (hit) {
        var bin = atob(hit.slice(hit.indexOf(",") + 1));
        var bytes = new Uint8Array(bin.length);
        for (var j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
        return Promise.resolve(new Response(bytes.buffer, { status: 200 }));
      }
      return Promise.reject(new Error("not bundled: " + s.slice(i)));
    }
    return f.apply(this, arguments);
  };
})();
</script>
<script>
%s
</script>
""" % (rows, game)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(html)
for kind, (n, r, e) in tally.items():
    if n:
        print("%-6s %3d files  %6.0f KB -> %6.0f KB inlined" % (kind, n, r / 1e3, e / 1e3))
print("bundle %s  %.1fMB" % (OUT, os.path.getsize(OUT) / 1e6))
