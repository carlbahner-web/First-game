# A contact sheet of every sprite the set dresser can place, captioned with the
# exact name you type — the `art` value in game.js and the label in the panel's
# dropdown. The point is to be able to SAY "put the music stand by the door"
# without either of us guessing which drawing that is.
#
# Cells are sized by the tallest sprite in each row so nothing is stretched, and
# every sprite sits on the SAME baseline within its row: these are objects that
# stand on a floor, and a contact sheet that centres them vertically quietly
# lies about which ones are tall.
#
#   python3 tools/prop-sheet.py [out.png]
import os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "prop-sheet.png")

# The game's display face, unpacked from the woff2 the browser uses so the sheet
# is titled in the game's own lettering rather than something approximate. It is
# a nicety, not a dependency: no fontTools, no problem — DejaVu stands in and the
# sheet is identical apart from the two headings.
def game_font():
    try:
        import tempfile
        from fontTools.ttLib import TTFont
        f = TTFont(os.path.join(ROOT, "assets", "shared", "dwfairfield.woff2"))
        f.flavor = None
        p = os.path.join(tempfile.gettempdir(), "dwfairfield-sheet.ttf")
        f.save(p)
        return p
    except Exception:
        return None

DISPLAY = game_font()

# The room's own ink, so the sheet reads as part of the game rather than as a
# spreadsheet about it.
PAPER    = (252, 247, 232)
CHARCOAL = (44, 44, 42)
MINT     = (206, 222, 214)
MUSTARD  = (246, 204, 96)
RULE     = (44, 44, 42, 38)

COLS = 5
CELL_W = 300
ART_H = 300           # tallest a sprite may be drawn
PAD = 34
LABEL_H = 74
MARGIN = 60

def font(size, fallback):
    try:
        return ImageFont.truetype(DISPLAY, size)
    except Exception:
        return ImageFont.truetype(fallback, size)

F_TITLE = font(62, "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf")
F_HEAD  = font(34, "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf")
F_NAME  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 25)
F_NOTE  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 21)

# Section -> (folder, blurb, to_scale). Order matches the dropdown.
#
# `to_scale` decides whether a row shares one scale factor. The floor props do:
# they are all objects of roughly furniture size, and seeing the mug against the
# kick drum is the useful part. The wall props do NOT — a door is 698px and a
# light switch is 59, so one shared factor renders the switch as a speck and
# tells you nothing except that doors are bigger than switches, which you knew.
SECTIONS = [
    ("FLOOR PROPS", "set",
     "stand on the floor in the top row · sized in TILES · can react to a drum row",
     True),
    ("WALL PROPS", "props",
     "hang on the back wall · sized as a fraction of the wall’s height"
     " · shown at readable size, NOT to each other’s scale",
     False),
]

def load(folder):
    d = os.path.join(ROOT, "assets", "room", folder)
    names = sorted(n[:-4] for n in os.listdir(d) if n.endswith(".png"))
    return [(n, Image.open(os.path.join(d, n + ".png")).convert("RGBA")) for n in names]

groups = [(title, blurb, load(folder), to_scale)
          for title, folder, blurb, to_scale in SECTIONS]

# ---- measure ------------------------------------------------------------
# Each row is as tall as it needs to be. Within a to_scale row every sprite is
# multiplied by the SAME factor, so relative size is honest; across rows it is
# not, because a sheet where the mug is 12px tall tells you nothing about the
# mug. Nothing is ever enlarged past 3x — past that a 40px switch is not more
# legible, only softer.
MAX_UP = 3.0

rows = []
for title, blurb, items, to_scale in groups:
    rows.append(("head", title, blurb, None, None))
    for i in range(0, len(items), COLS):
        rows.append(("row", None, None, items[i:i + COLS], to_scale))

def fit(im):
    return min(MAX_UP, (CELL_W - PAD * 2) / im.width, ART_H / im.height)

def row_metrics(items, to_scale):
    if to_scale:
        s = min(fit(im) for _, im in items)
        scales = [s] * len(items)
    else:
        scales = [fit(im) for _, im in items]
    h = max(int(im.height * s) for (_, im), s in zip(items, scales))
    return scales, h

H = MARGIN + 96
plan = []
for kind, title, blurb, items, to_scale in rows:
    if kind == "head":
        plan.append((kind, title, blurb, None, None, 0))
        H += 108
    else:
        scales, h = row_metrics(items, to_scale)
        plan.append((kind, None, None, items, scales, h))
        H += h + LABEL_H + 26
H += MARGIN

W = MARGIN * 2 + CELL_W * COLS
img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img, "RGBA")

# ---- draw ---------------------------------------------------------------
d.text((MARGIN, MARGIN - 12), "THE SET", font=F_TITLE, fill=CHARCOAL)
tw = d.textlength("THE SET", font=F_TITLE)
d.text((MARGIN + tw + 22, MARGIN + 22),
       "every sprite the set dresser can place, by the name you type",
       font=F_NOTE, fill=(44, 44, 42, 150))

y = MARGIN + 96
for kind, title, blurb, items, scales, h in plan:
    if kind == "head":
        d.rectangle([MARGIN, y + 14, W - MARGIN, y + 62], fill=MINT)
        d.text((MARGIN + 16, y + 20), title, font=F_HEAD, fill=CHARCOAL)
        d.text((MARGIN + 16, y + 70), blurb, font=F_NOTE, fill=(44, 44, 42, 155))
        y += 108
        continue

    base = y + h                      # the shared floor line for this row
    for i, (name, im) in enumerate(items):
        cx = MARGIN + i * CELL_W + CELL_W // 2
        scale = scales[i]
        w2, h2 = max(1, int(im.width * scale)), max(1, int(im.height * scale))
        s = im.resize((w2, h2), Image.LANCZOS)
        img.paste(s, (cx - w2 // 2, base - h2), s)
        # A hairline under each sprite: it reads as the floor they stand on and
        # it stops a pale sprite (the mug) floating in cream nothing.
        d.line([cx - CELL_W // 2 + 26, base + 9, cx + CELL_W // 2 - 26, base + 9],
               fill=RULE, width=2)
        nw = d.textlength(name, font=F_NAME)
        d.text((cx - nw / 2, base + 26), name, font=F_NAME, fill=CHARCOAL)
        # the source dimensions, for judging how much detail is really there
        dim = f"{im.width}×{im.height}"
        dw = d.textlength(dim, font=F_NOTE)
        d.text((cx - dw / 2, base + 52), dim, font=F_NOTE, fill=(44, 44, 42, 120))
    y = base + LABEL_H + 26

img.save(OUT)
print(f"{OUT}  {W}x{H}  "
      + "  ".join(f"{t.lower()}={len(i)}" for t, _, i, _s in groups))
