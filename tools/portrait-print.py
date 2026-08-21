# A photograph, put into the room's print language.
#
# A raw photo dropped into a flat-ink room reads as a collage mistake: it is
# continuous tone with its own lighting and its own colour temperature, sitting
# in a picture that has hard keylines and five colours. The fix is not to soften
# the room, it is to print the photo — the same thing a gig poster or a
# newspaper does, which is why a halftoned face looks at home on a screen-printed
# wall.
#
# Three treatments, because the right one is a judgement call and judgement
# calls want to be looked at, not argued about:
#
#   duotone    luminance mapped onto ink -> paper. Smooth, closest to the photo.
#   halftone   the same ramp, but rendered as a rotated dot screen.
#   poster     four flat tones plus a charcoal keyline, so it reads as drawn.
#
# THE SCREEN IS SIZED FOR THE FINAL SIZE. A halftone made at 512px and shrunk to
# 96 turns to mush — the dots have to be big enough to survive at the size the
# sprite is actually drawn, so this takes the output height as an argument and
# screens to it.
#
#   python3 tools/portrait-print.py cutout.png outdir [height]
import os, sys, math
from PIL import Image, ImageDraw, ImageFilter, ImageOps

PAPER = (252, 247, 232)
CHARCOAL = (44, 44, 42)
TEAL = (58, 97, 104)
MUSTARD = (246, 204, 96)


def prepare(src, height):
    """Cutout -> a normalised greyscale at the target height, plus its alpha."""
    im = src.copy()
    w = max(1, round(im.width * height / im.height))
    im = im.resize((w, height), Image.LANCZOS)
    alpha = im.getchannel("A")
    grey = ImageOps.grayscale(im.convert("RGB"))
    # Stretch to the full range using the SUBJECT only — a portrait shot against
    # a bright wall is mid-grey everywhere once the wall is gone, and
    # autocontrast on the whole frame would be judging it against transparency.
    px = [g for g, a in zip(grey.getdata(), alpha.getdata()) if a > 128]
    if px:
        lo, hi = min(px), max(px)
        if hi > lo:
            # Stretched, then held off both ends. Pure black and pure white are
            # both places a printed portrait loses information — the shadows fill
            # in and the highlights blow out — so the ramp lands at 6%..97% and
            # a gamma lifts the midtones back up.
            def m(v):
                t = (v - lo) / (hi - lo)
                t = max(0.0, min(1.0, t)) ** 0.86
                return int(round(255 * (0.06 + 0.91 * t)))
            grey = grey.point(m)
    return grey, alpha


def ramp(c0, c1):
    """256-entry ink->paper lookup between two colours."""
    return [tuple(round(c0[k] + (c1[k] - c0[k]) * i / 255) for k in range(3))
            for i in range(256)]


def duotone(grey, alpha, dark=CHARCOAL, light=PAPER):
    lut = ramp(dark, light)
    out = Image.new("RGBA", grey.size)
    out.putdata([lut[v] + (a,) for v, a in zip(grey.getdata(), alpha.getdata())])
    return out


def halftone(grey, alpha, cell=5, angle=27, dark=CHARCOAL, light=PAPER):
    """A rotated dot screen. Drawn at 4x and shrunk, which is the cheapest
    antialiasing there is and the only reason the dots do not crawl."""
    SS = 4
    w, h = grey.size
    big = Image.new("RGB", (w * SS, h * SS), light)
    d = ImageDraw.Draw(big)
    g = grey.filter(ImageFilter.GaussianBlur(0.6))
    rad = math.radians(angle)
    ca, sa = math.cos(rad), math.sin(rad)
    # Walk the screen in ITS OWN rotated frame so the dot lattice is straight and
    # the image is what is at an angle — a rotated bitmap of dots would alias.
    diag = int(math.hypot(w, h) / cell) + 2
    for j in range(-diag, diag):
        for i in range(-diag, diag):
            # cell centre, rotated back into image space
            cx = (i + 0.5) * cell * ca - (j + 0.5) * cell * sa + w / 2
            cy = (i + 0.5) * cell * sa + (j + 0.5) * cell * ca + h / 2
            if not (0 <= cx < w and 0 <= cy < h):
                continue
            if alpha.getpixel((int(cx), int(cy))) < 40:
                continue
            v = g.getpixel((int(cx), int(cy)))
            # Area of the dot is proportional to darkness, so radius is its
            # root. Coverage is capped below 1: a real press has a maximum ink
            # density, and without the cap the dark half of any photo plugs into
            # a solid black blob — which is exactly what the first pass did to a
            # charcoal sweater.
            cov = min(0.86, max(0.0, 1 - v / 255))
            r = (cell * SS * 0.70) * math.sqrt(cov)
            if r < 0.35:
                continue
            x, y = cx * SS, cy * SS
            d.ellipse([x - r, y - r, x + r, y + r], fill=dark)
    small = big.resize((w, h), Image.LANCZOS)
    out = small.convert("RGBA")
    out.putalpha(alpha)
    return out


def poster(grey, alpha, levels=4, dark=CHARCOAL, light=PAPER, keyline=True):
    lut_steps = []
    for i in range(256):
        step = min(levels - 1, int(i * levels / 256))
        t = step / (levels - 1)
        lut_steps.append(tuple(round(dark[k] + (light[k] - dark[k]) * t) for k in range(3)))
    flat = Image.new("RGBA", grey.size)
    flat.putdata([lut_steps[v] + (a,) for v, a in zip(grey.getdata(), alpha.getdata())])
    if keyline:
        # An outline around the SILHOUETTE, the way every drawn object in this
        # room has one. Without it the flat tones float; with it they read as
        # something that was drawn rather than something that was filtered.
        edge = alpha.filter(ImageFilter.MaxFilter(3))
        ring = Image.new("RGBA", grey.size, CHARCOAL + (0,))
        ring.putalpha(Image.eval(edge, lambda v: v).point(
            lambda v: 255 if v > 128 else 0))
        base = Image.new("RGBA", grey.size, (0, 0, 0, 0))
        base.paste(ring, (0, 0), ring)
        base.paste(flat, (0, 0), flat)
        flat = base
    return flat


TREATMENTS = {
    "duotone": lambda g, a, h: duotone(g, a),
    "halftone": lambda g, a, h: halftone(g, a, cell=max(3, round(h / 55))),
    "poster": lambda g, a, h: poster(g, a),
}

if __name__ == "__main__":
    src = Image.open(sys.argv[1]).convert("RGBA")
    outdir = sys.argv[2] if len(sys.argv) > 2 else "."
    height = int(sys.argv[3]) if len(sys.argv) > 3 else 240
    os.makedirs(outdir, exist_ok=True)
    grey, alpha = prepare(src, height)
    for name, fn in TREATMENTS.items():
        im = fn(grey, alpha, height)
        p = os.path.join(outdir, f"{name}-{height}.png")
        im.save(p)
        print(p, im.size)
