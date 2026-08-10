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
VERBATIM = {".woff2": "font/woff2", ".webp": "image/webp"}

table, raw, enc = {}, 0, 0
for dirpath, _, files in os.walk(os.path.join(ROOT, "assets")):
    for fn in sorted(files):
        ext = os.path.splitext(fn)[1].lower()
        path = os.path.join(dirpath, fn)
        key = os.path.relpath(path, ROOT).replace(os.sep, "/")
        if ext in VERBATIM:
            data = open(path, "rb").read()
            raw += len(data)
            enc += len(data)
            uri = "data:%s;base64,%s" % (VERBATIM[ext], base64.b64encode(data).decode())
        elif ext in (".png", ".jpg", ".jpeg"):
            im = Image.open(path)
            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=90, method=6)
            raw += os.path.getsize(path)
            enc += buf.tell()
            uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
        else:
            continue
        table[key] = uri
        if key.lower() != key:
            table[key.lower()] = uri

game = open(os.path.join(ROOT, "game.js"), encoding="utf-8").read()
game = game.replace("</script", "<\\/script")

rows = ",\n".join('"%s":"%s"' % (k, v) for k, v in table.items())

# No <meta>/<title> here: the host wraps this file in its own <head>, and the
# game installs its own viewport meta on coarse-pointer devices.
html = """<style>
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
  #game-container { position:relative; line-height:0; border:4px solid var(--frame); }
  canvas {
    /* not `pixelated` — BUZZ is hand-drawn art, and the canvas is almost
       never displayed at an integer multiple of its width */
    image-rendering: auto;
    width: min(calc(100vw - 8px), calc((100vh - 12px) * 2.4));
    height: auto;
  }
  #game { display:block; }
  #hud  { position:absolute; left:0; bottom:0; width:100%%; }
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
  // Sample .wav files aren't in the repo, so every one of these requests is a
  // guaranteed miss. Fail them here instead of firing them at a host that will
  // block them anyway — the game already falls back to its synthesised kit.
  // (When the samples land, inline them into __ASSETS and this serves them.)
  var f = window.fetch;
  window.fetch = function (u) {
    var s = typeof u === "string" ? u : (u && u.url) || "";
    var i = s.indexOf("assets/");
    if (i >= 0) {
      var hit = window.__ASSETS[s.slice(i)];
      if (hit) return f(hit);
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
print("images %d  png %.1fMB -> webp %.1fMB" % (len(table), raw / 1e6, enc / 1e6))
print("bundle %s  %.1fMB" % (OUT, os.path.getsize(OUT) / 1e6))
