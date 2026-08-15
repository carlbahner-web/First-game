# Cut a green-screen sheet into individual transparent sprites.
#
#   python3 tools/cut-sprite-sheet.py <sheet.png> <out-dir> [name1 name2 ...]
#
# Two passes, the same shape as the wall-prop extractor. First find WHERE the
# objects are, by labelling everything that is not chroma and letting the blobs
# declare their own bounding boxes — hand-typed crops go stale the moment the
# sheet is redrawn. Then cut each one out and flood the chroma away from the
# crop's edges rather than keying it globally, so a green pixel INSIDE an object
# survives.
#
# The key is measured off the sheet's own corner, not assumed, and the tolerance
# is generous because these are painted edges with a green fringe on them: a
# tight key leaves a halo, which on this art reads as a bad cut-out.
from PIL import Image
from collections import deque
import os, sys

SRC = sys.argv[1]
OUT = sys.argv[2]
NAMES = sys.argv[3:]
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGB")
W, H = im.size
key = im.getpixel((4, 4))
print("sheet %dx%d  chroma %s" % (W, H, key))

def isKey(p, tol):
    return abs(p[0]-key[0]) + abs(p[1]-key[1]) + abs(p[2]-key[2]) <= tol

# --- pass 1: where are they -------------------------------------------------
K = 6
sw, sh = W // K, H // K
small = im.resize((sw, sh), Image.BILINEAR)
ink = [[not isKey(small.getpixel((x, y)), 150) for y in range(sh)] for x in range(sw)]
seen = [[False]*sh for _ in range(sw)]
boxes = []
for x in range(sw):
    for y in range(sh):
        if not ink[x][y] or seen[x][y]:
            continue
        q = deque([(x, y)]); seen[x][y] = True
        x0=x1=x; y0=y1=y; n=0
        while q:
            cx, cy = q.popleft(); n += 1
            x0=min(x0,cx); x1=max(x1,cx); y0=min(y0,cy); y1=max(y1,cy)
            for dx in (-1,0,1):
                for dy in (-1,0,1):
                    nx, ny = cx+dx, cy+dy
                    if 0<=nx<sw and 0<=ny<sh and ink[nx][ny] and not seen[nx][ny]:
                        seen[nx][ny] = True; q.append((nx, ny))
        if n >= 300:                      # ignore speckle and stray fringe
            boxes.append([x0*K, y0*K, (x1+1)*K, (y1+1)*K, n])

# reading order: top row left-to-right, then the next
boxes.sort(key=lambda b: (round(b[1] / (H / 3)), b[0]))
print("objects found:", len(boxes))

# --- pass 2: cut them out ---------------------------------------------------
for i, (x0, y0, x1, y1, n) in enumerate(boxes):
    pad = 10
    crop = im.crop((max(0,x0-pad), max(0,y0-pad), min(W,x1+pad), min(H,y1+pad))).convert("RGBA")
    cw, ch = crop.size
    px = crop.load()
    q = deque(); seenC = [[False]*ch for _ in range(cw)]
    for x in range(cw):
        for y in (0, ch-1):
            q.append((x, y)); seenC[x][y] = True
    for y in range(ch):
        for x in (0, cw-1):
            if not seenC[x][y]: q.append((x, y)); seenC[x][y] = True
    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        if not isKey((r, g, b), 150):
            continue
        px[x, y] = (r, g, b, 0)
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x+dx, y+dy
            if 0<=nx<cw and 0<=ny<ch and not seenC[nx][ny]:
                seenC[nx][ny] = True; q.append((nx, ny))
    # The flood only reaches chroma connected to the outside, and a tripod's legs
    # enclose triangles of it. None of these objects contain green, so anything
    # still keyed anywhere in the crop is background the flood could not get to.
    for x in range(cw):
        for y in range(ch):
            if px[x, y][3] and isKey(px[x, y][:3], 150):
                px[x, y] = (0, 0, 0, 0)

    # ...and keep only THIS object. The boxes are close enough on a packed sheet
    # that a crop catches its neighbour's elbow, which would otherwise ride along
    # as a stray limb in the corner of the sprite.
    lab = [[0]*ch for _ in range(cw)]
    comps = []
    for sx0 in range(cw):
        for sy0 in range(ch):
            if lab[sx0][sy0] or px[sx0, sy0][3] == 0: continue
            dq = deque([(sx0, sy0)]); lab[sx0][sy0] = 1; cells = []
            while dq:
                x, y = dq.popleft(); cells.append((x, y))
                for dx in (-1,0,1):
                    for dy in (-1,0,1):
                        nx, ny = x+dx, y+dy
                        if 0<=nx<cw and 0<=ny<ch and not lab[nx][ny] and px[nx, ny][3]:
                            lab[nx][ny] = 1; dq.append((nx, ny))
            comps.append(cells)
    if comps:
        comps.sort(key=len, reverse=True)
        keep = set(comps[0])
        # a sprite can legitimately be in pieces (a cymbal above its stand), so
        # keep anything within a third of the main mass, drop the rest
        for c in comps[1:]:
            if len(c) > len(comps[0]) * 0.33: keep |= set(c)
        for c in comps:
            for x, y in c:
                if (x, y) not in keep: px[x, y] = (0, 0, 0, 0)

    # de-fringe: anything still greener than it is anything else, on a pixel that
    # touches transparency, is spill from the key rather than paint
    for _ in range(2):
        edge = []
        for x in range(cw):
            for y in range(ch):
                if px[x, y][3] == 0: continue
                r, g, b, a = px[x, y]
                if g > r * 1.25 and g > b * 1.25:
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        nx, ny = x+dx, y+dy
                        if 0<=nx<cw and 0<=ny<ch and px[nx, ny][3] == 0:
                            edge.append((x, y)); break
        for x, y in edge: px[x, y] = (0, 0, 0, 0)
    bbox = crop.getbbox()
    if bbox: crop = crop.crop(bbox)
    # These arrive around 1000px and will be drawn at a fraction of that. Capping
    # here keeps a set of a dozen from putting megabytes into a single-file build
    # that people open on a phone. 512 is still several times any plausible
    # on-screen size; re-cut with a bigger cap if that ever stops being true.
    MAXD = 512
    if max(crop.size) > MAXD:
        f = MAXD / max(crop.size)
        crop = crop.resize((max(1, round(crop.width*f)), max(1, round(crop.height*f))), Image.LANCZOS)
    name = NAMES[i] if i < len(NAMES) else ("obj%d" % i)
    crop.save(os.path.join(OUT, name + ".png"))
    print("  %-14s %4dx%-4d" % (name, crop.size[0], crop.size[1]))
