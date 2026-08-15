# Take the EMPLOYEES ONLY plate off the door sprite.
#
#   python3 tools/strip-door-sign.py [assets/room/props/door.png]
#
# The same sprite is the rear wall's door AND both side doors, so the sign was
# appearing three times in one room and reading as the room's only text. Carl
# asked for it gone.
#
# It is patched rather than painted: a block of plain door face is copied over
# the plate, which keeps the paper grain and the door's own shading instead of
# leaving a flat rectangle where the sign was. The source block is chosen by
# MEASURING flatness down the door rather than by picking a y that looks right —
# standard deviation under 2 means nothing but face in it.
from PIL import Image
import statistics, sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "assets/room/props/door.png"
SIGN = (112, 162, 246, 237)          # the plate, with a little margin

im = Image.open(PATH).convert("RGBA")
px = im.convert("RGB").load()
w, h = SIGN[2] - SIGN[0], SIGN[3] - SIGN[1]

best, bestSd = None, 1e9
for y0 in range(0, im.height - h):
    if abs(y0 - SIGN[1]) < h:        # not the sign itself, or anything touching it
        continue
    vals = [px[x, y][1] for y in range(y0, y0 + h, 3) for x in range(SIGN[0], SIGN[2], 3)]
    sd = statistics.pstdev(vals)
    if sd < bestSd:
        bestSd, best = sd, y0
print("flattest run of door face starts at y=%d (sd %.2f)" % (best, bestSd))
if bestSd > 2:
    sys.exit("no plain patch found — the door art has changed shape, check SIGN")

patch = im.crop((SIGN[0], best, SIGN[2], best + h))
im.paste(patch, (SIGN[0], SIGN[1]))
im.save(PATH)
print("patched", PATH, im.size)
