# Cut the plaque off its background and MEASURE its three wells.
#
#   python3 tools/cut-scoreboard.py <source.png> [assets/room/props/scoreboard.png]
#
# Paste the fractions it prints into the biome's `scoreboard.wells`.
#
# The wells are cream on a cream plate — only their dark outlines separate them
# — so no colour key can find them. What does: the outlines SEAL them. Flood the
# non-dark pixels from the image border and you reach the teal ground only;
# every other non-dark region is walled in by ink. Label those regions and the
# wells fall out as the three big cream rectangles inside the plate.
from PIL import Image
from collections import deque
import os, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "scoreboard_source.png"
OUT = sys.argv[2] if len(sys.argv) > 2 else "assets/room/props/scoreboard.png"

im = Image.open(SRC).convert("RGB")
W, H = im.size
px = im.load()
bg = px[5, 5]
print("background", bg, (W, H))

def near(a, b, tol):
    return abs(a[0]-b[0]) + abs(a[1]-b[1]) + abs(a[2]-b[2]) <= tol

# --- 1. transparency: flood the background in from every edge --------------
rgba = im.convert("RGBA")
ap = rgba.load()
seen = bytearray(W * H)
q = deque()
for x in range(W):
    for y in (0, H-1):
        q.append((x, y)); seen[y*W+x] = 1
for y in range(H):
    for x in (0, W-1):
        if not seen[y*W+x]: q.append((x, y)); seen[y*W+x] = 1
while q:
    x, y = q.popleft()
    r, g, b, _ = ap[x, y]
    if not near((r, g, b), bg, 60):
        continue
    ap[x, y] = (r, g, b, 0)
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx, ny = x+dx, y+dy
        if 0 <= nx < W and 0 <= ny < H and not seen[ny*W+nx]:
            seen[ny*W+nx] = 1; q.append((nx, ny))

box = rgba.getbbox()
print("plaque bbox", box)
cut = rgba.crop(box)
# The plaque draws at roughly 380 device pixels wide. Shipping five times that
# is a megabyte of PNG, inlined into a single file people open on a phone, for
# detail no screen will ever show. Cap it at a comfortable multiple instead.
MAXW = 1095
if cut.width > MAXW:
    cut = cut.resize((MAXW, round(cut.height * MAXW / cut.width)), Image.LANCZOS)
cut.save(OUT)
print("saved", OUT, cut.size)

# --- 2. the wells ----------------------------------------------------------
cw, ch = cut.size
cp = cut.load()
INK_MAX = 150            # anything this dark is outline
def is_ink(p):
    return p[3] > 40 and (p[0]+p[1]+p[2]) / 3 < INK_MAX

lab = [[0]*ch for _ in range(cw)]
regions = []
cur = 0
for sx in range(cw):
    for sy in range(ch):
        if lab[sx][sy] or is_ink(cp[sx, sy]) or cp[sx, sy][3] <= 40:
            continue
        cur += 1
        dq = deque([(sx, sy)]); lab[sx][sy] = cur
        x0=x1=sx; y0=y1=sy; n=0; rs=gs=bs=0
        while dq:
            x, y = dq.popleft(); n += 1
            c = cp[x, y]; rs+=c[0]; gs+=c[1]; bs+=c[2]
            if x<x0: x0=x
            if x>x1: x1=x
            if y<y0: y0=y
            if y>y1: y1=y
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x+dx, y+dy
                if 0<=nx<cw and 0<=ny<ch and not lab[nx][ny] \
                   and cp[nx,ny][3] > 40 and not is_ink(cp[nx,ny]):
                    lab[nx][ny] = cur; dq.append((nx, ny))
        w, h = x1-x0+1, y1-y0+1
        regions.append(dict(box=(x0,y0,x1+1,y1+1), n=n, fill=n/(w*h),
                            col=(rs//n, gs//n, bs//n), w=w, h=h))

wells = [r for r in regions
         if r["fill"] > 0.93 and r["n"] > (cw*ch) * 0.004
         and min(r["col"]) > 190 and r["w"] > r["h"]]
wells.sort(key=lambda r: r["box"][0])
print("\ncandidate wells (left to right):")
for r in wells:
    x0,y0,x1,y1 = r["box"]
    print("  box=(%4d,%4d,%4d,%4d)  %3dx%3d  fill=%.2f  col=%s"
          % (x0,y0,x1,y1,r["w"],r["h"],r["fill"],r["col"]))
    print("     as fractions of the sprite: x %.4f..%.4f  y %.4f..%.4f"
          % (x0/cw, x1/cw, y0/ch, y1/ch))
