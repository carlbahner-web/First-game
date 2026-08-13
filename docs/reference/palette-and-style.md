# Colour and style — the system, and why each choice was made

The palette, the contrast rules, and the visual grammar shared by both StudioLand games.
Written so the same look can be built in a new game without re-deriving it.

Every contrast figure below was **measured** with the WCAG relative-luminance formula, not
copied from a comment. The five figures already recorded in the source were re-derived and all
five match exactly.

---

## 1. The palette

Nine colours. That is the whole vocabulary.

| var | hex | luminance | what it is |
|---|---|---|---|
| `--charcoal` | `#2C2C2A` | 0.025 | **all ink.** Every outline, every stroke, all body text |
| `--teal` | `#3A6168` | 0.105 | the cool structural colour — sign frames, distance |
| `--red` | `#c05838` | 0.185 | the *other* red: the wipeout panel's field |
| `--ctared` | `#FE3636` | 0.240 | **alert red. Reserved. Deadly only.** |
| `--rust` | `#BF7538` | 0.241 | warm accent — labels, kickers, secondary type |
| `--green` | `#50ad33` | 0.318 | good news — the NEW BEST badge |
| `--mint` | `#BFCDC0` | 0.585 | cool pale — panel fills, sage foliage |
| `--mustard` | `#F6CC60` | 0.636 | **the action colour.** Primary buttons, highlights |
| `--cream` | `#fcf7e8` | 0.930 | the paper. Page background and light text |

```css
:root{
  --charcoal:#2C2C2A; --cream:#fcf7e8; --teal:#3A6168; --rust:#BF7538;
  --mustard:#F6CC60; --mint:#BFCDC0; --red:#c05838; --green:#50ad33; --ctared:#FE3636;
}
```

**The mental model is screen-printing on paper.** Cream is the paper stock, charcoal is the key
plate, and the rest are spot inks. That single idea decides most of what follows: why there is
exactly one ink colour, why fills are flat, why shadows are hard-edged offsets rather than
blurs, and why nothing has a gradient except deliberate light.

**Nothing outside `:root` may hardcode a tone.** Derived colours come from `mixC(a,b,t)` at
runtime, so a palette change propagates instead of leaving orphans behind.

---

## 2. The one reserved colour

> **Alert red `#FE3636` means deadly, and only deadly.** Anything wearing it must be able to
> kill the player; anything that cannot must not wear it. Decorative red is a bug.

This is the palette's only piece of reserved vocabulary, and it is worth more than any contrast
rule — it means a player can learn *one* colour and read every hazard on sight.

It has been enforced against real temptation, twice:

- **The continue panel's token charge is `--red`, not `--ctared`.** A debit is not a hazard.
- **The NEW BEST badge is `--green`.** It stops a good-news badge borrowing the colour that
  means death.

Because `--ctared` is reserved, the palette needs a *second* red for non-lethal warm fields —
that is what `--red #c05838` exists for, and it is what the wipeout panel is painted with.

---

## 3. Contrast, measured

### The pairings that ship

| ratio | pairing | verdict | where |
|---|---|---|---|
| **13.07:1** | charcoal on cream | AA | all body text |
| **13.07:1** | cream on charcoal | AA | the curtain, letterbox |
| **9.14:1** | charcoal on mustard | AA | every primary button label |
| **8.47:1** | charcoal on mint | AA | panel fills |
| **6.35:1** | cream on teal | AA | the billboard credit plate |
| **6.35:1** | teal on cream | AA | headings, structure |
| **4.91:1** | charcoal on green | AA | *the NEW BEST alternative* |
| **4.18:1** | cream on red | AA large / UI | wipeout panel kicker |
| **3.86:1** | ctared on charcoal | AA large / UI | hazards on dark |
| **3.38:1** | ctared on cream | AA large / UI | hazards on paper |
| **3.37:1** | rust on cream | AA large / UI | `#lvl`, `.kicker` |
| **3.13:1** | red on charcoal | AA large / UI | continue-panel charge |
| **2.66:1** | cream on green | **fails 3:1** | NEW BEST **as shipped** |

The core of the system is extremely safe — the charcoal-on-cream spine is 13:1. The interesting
cases are all at the edges.

### Two open items, stated honestly

**The NEW BEST badge is cream on green at 2.66:1**, below the 3:1 floor. Charcoal on the same
green measures **4.91:1**. This is a known, recorded, unresolved item — the badge is large
display type so it reads in practice, but it is the weakest text on any screen and swapping the
label to charcoal fixes it at no cost to the design.

**`rust` on `cream` is 3.37:1**, which clears the 3:1 large-text floor but not the 4.5:1 needed
for normal-size text — and it is used on `#lvl` and `.kicker`, which are **13px** uppercase. By
the project's own standard (the one that flagged NEW BEST) these are under-contrast. They are
letterspaced small caps, so they read better than the number suggests, but the number is what it
is. Nobody has ruled on it.

### The rejections are the useful part

| ratio | what was tried | why it died |
|---|---|---|
| **1.00:1** | `--ctared` on `--rust` | *identical* luminance — invisible in greyscale |
| **1.23:1** | `--ctared` on `--red` | the badge went silent exactly when it should shout |
| **1.24:1** | `--rust` on `--red` | the gameover kicker vanished; now cream |
| **~2:1** | charcoal at 55% on rust | unreadable |

---

## 4. The greyscale trap, and it is the single most useful thing here

**`--ctared` and `--rust` have the same relative luminance** — 0.2398 and 0.2408. They measure
**1.00:1** against each other. Two of the most-used warm colours in this palette are, to any
luminance-based measure, *the same colour*.

The consequences are not obvious and they are both real:

1. **A contrast ratio cannot tell you these are different.** Put one on the other and every
   automated check reports catastrophe, correctly — but so would putting rust on rust, and the
   eye can distinguish red from rust instantly. Luminance is blind to hue.
2. **Which means the inverse is also true**: a pairing that separates only on hue will fail every
   greyscale test, and *should*, because a colourblind player or a monochrome screen genuinely
   cannot read it.

So the working rule that came out of this:

> **Never let hue carry information alone.** If two things must be told apart, separate them by
> **luminance** — then use hue as reinforcement. The NEW BEST badge went green not because green
> is prettier but because green is a *luminance* step (0.318) away from the red field (0.185),
> and the hue difference rides along on top.

The cheap test: screenshot the screen, desaturate it, and check you can still read it. If the
distinction disappears, the design was leaning on hue.

---

## 5. The visual grammar

Five conventions do most of the work. They are more of the look than the colours are.

**One ink colour.** Every outline in both games is `--charcoal`. Nothing is outlined in its own
darker shade. That is what makes a screen read as printed rather than rendered.

**Hard offset shadows, never blurs.** A solid charcoal copy offset down-right, no feathering:

```css
box-shadow:5px 5px 0 var(--charcoal);      /* buttons */
box-shadow:8px 10px 0 rgba(44,44,42,.85);  /* panels and the billboard */
box-shadow:3px 3px 0 rgba(44,44,42,.5);    /* art frames */
```

A blurred shadow implies a light source and soft focus; a hard offset implies a second printing
pass slightly out of register. Only *actual light* gets a blur — the billboard floodlights use
`feGaussianBlur stdDeviation="6"`, because a beam with a clean edge reads as a shape.

**Chunky borders in a small set of widths** — `1.5 / 2.5 / 3 / 4 px`, always
`solid var(--charcoal)`. Weight signals hierarchy: 4px for the billboard's frame, 3px for
buttons, 2.5px for inline art and chips.

**Generous radii, and `999px` for pills.** `16px` on panels, `10px` on framed art, `999px` on
every chip and badge.

**Everything ink boils.** All linework is redrawn on a ~130 ms three-phase clock so it breathes
like hand-inked cel animation. It is not decoration — it is what stops flat vector fills reading
as flat vector fills. Canvas linework goes through a boiling proxy; DOM and SVG get
`feTurbulence` + `feDisplacementMap` with the seed driven from the render loop.

**Two things deliberately never boil**, and the reasoning generalises:

- **The ball, in pinball.** A polished steel ball is not ink, and a wobbling ball is unreadable
  in a game about tracking one.
- **Labels.** The billboard credit is crisp. It is a label, and labels stay legible.

Everything that *does* boil must be registered, or it ships as a still frame sitting next to
everything that moves — a dead giveaway.

---

## 6. Two colour modes

`applyPalette(m)` owns every derived tone; `'calm'` and `'vivid'`.

**Gameplay is identical in both — only the backdrop restyles.** That is the constraint that
makes the split safe.

```js
if(m==='vivid'){
  SKY_SHEET='#c7e0e4';   // robin's-egg blue
  FAR_C='#9fbc85'; MID_C='#7fa763';
  EDGE_MIX=0.40;
}else{
  SKY_SHEET=COL.cream;   // identical to the page background
  FAR_C=mixC(COL.teal,COL.cream,0.74);
  MID_C=mixC(mixC(COL.teal,COL.mint,0.45),COL.cream,0.30);
  EDGE_MIX=0.14;
}
```

Two calibrations there are worth stealing outright:

- **Depth is a luminance STEP, and the step size is the thing to hold constant.** Calm's
  sky→far gap is ~0.17 luminance, and that gap is what makes the distant trees read. Vivid's
  first attempt had 0.08 — Carl: *"the contrast is barely existent."* The fix was not new hues,
  it was putting each vivid layer the *same* 0.17 below its sky.
- **A saturated fill swallows a whisper outline.** Calm inks its linework at a 0.14 charcoal mix
  and relies on the depth blur; on vivid's saturated greens that vanished — *"the contrast
  between lines and fill is too small"* — so vivid inks nearly **3× deeper** at 0.40. Outline
  weight is not a constant; it is a function of what it sits on.

A third, from the same family: **effects may legitimately be tuned per mode.** The coaster's oil
wash runs 0.3 in calm against 0.5 in vivid.

---

## 7. Setting this up in a new game

1. **Copy the nine `:root` vars verbatim.** They are a tuned set; picking "similar" colours
   loses the luminance relationships that everything else depends on.
2. **Pick your reserved colour and enforce it from day one.** It is nearly impossible to
   reclaim later, because by then several harmless things are wearing it.
3. **One ink colour for every outline.** Charcoal.
4. **Hard offset shadows. Blur only for real light.**
5. **Route every derived tone through a `mixC`-style helper**, so no tone is orphaned when the
   palette moves.
6. **Check contrast on the pairings you actually ship**, and record the number next to the
   choice — those recorded figures are what let the rejected options above stay rejected instead
   of being re-tried.
7. **Desaturate a screenshot and check it still reads.** That is how the rust/alert-red
   luminance collision was found, and it is a thirty-second test.
8. If you take the boil: **register every inked surface**, and decide deliberately what does
   *not* boil.

Full context: `games/CLAUDE.md` ("The visual system"), `games/src/coaster-run.md`, and
`games/start-billboard.md` for how this palette is applied to a whole screen.
