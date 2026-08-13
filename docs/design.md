# StudioLand design rules

The shared visual world behind BUZZ's Coaster Run, BUZZ's Rhythm Rampage and
the pinball game. Written to be copied into any of them.

---

## How to use this document

**These are starting points, not laws.** They are the defaults that make three
different games look like one world, and they exist so nobody has to re-derive
them. They are not a reason to make a game worse.

**Carl decides when to depart from them.** If a rule is costing gameplay,
clarity or feel, say so plainly, explain the trade, and do what he directs. A
departure he has approved is not a violation — it is the design working. What
is not acceptable is quietly drifting away from a rule because it was
inconvenient, or holding to one against his direction because the doc says so.

**Record departures.** The last section of this file lists where Rhythm Rampage
already differs and why. Add to it. A departure with a reason is precedent; a
departure without one is a bug nobody has noticed yet.

**One rule is not negotiable**, and it is called out where it appears.

---

## Palette

Charcoal ink on off-white paper. Flat fills, hard edges, no gradients — the look
is a print, not a render.

| | | |
|---|---|---|
| `#fcf7e8` | paper | BUZZ off-white, the ground for everything |
| `#2C2C2A` | charcoal | all linework and type. Never pure black |
| `#F6CC60` | mustard | Midway Mustard — the action colour |
| `#3A6168` | teal | Harbor Teal |
| `#BFCDC0` | mint | Foggy Mint |
| `#BF7538` | rust | Rusty Turnstile |
| `#c05838` | red | decorative red |
| `#50ad33` | green | |
| `#FE3636` | **alert red** | **DEADLY ONLY** |

**Alert red `#FE3636` is reserved for things that can kill the player. It is
never decorative, at any opacity, in any game.** This is the one rule in this
document that is not a starting point. If red is wanted for anything else, the
decorative red `#c05838` or the rust are what to reach for.

Neutrals are warm — biased toward the paper, never a pure grey. Mix toward
`paper` or `charcoal` rather than introducing a new value.

## The line boil

Hand-inked work is redrawn on a three-phase clock so the linework breathes, the
way a hand re-inking each cel would.

- **Three baked variants, cycled `[0, 1, 2, 1]`.** A ping-pong, not a count.
  Counting `0,1,2,0,1,2` makes the wobble crawl in one direction, which is the
  tell that it is a loop. Bouncing off the end is how boil is held on paper.
- **~130ms a phase**, about 7.7 re-inks a second.
- **Not boiling means STRAIGHT, not frozen mid-wobble.** A dead line takes no
  displacement at all. Holding a resting bend reads as a wonky line nobody drew.
- **Boil the lines, not the fills.** Flat washes and paper grain stay still.
  Everything moving at once is too much, and dense repeating marks boiling in
  lockstep read as strobe rather than as drawing.
- **Step the noise by more than its own wavelength between samples**, or
  consecutive points sit on the same hump and the line slides smoothly instead
  of bending.

## Type

**Hierarchy comes from size and face, not colour.** One display face, one body
face, roughly three sizes. Adding a fourth thing at the same size and colour as
an existing one is how a readout stops being scannable.

- Display: **DWFairfield**. Body: **TAYWingman**. Both partial character sets —
  DWFairfield has no apostrophe or `×`; TAYWingman has no dashes or `×`. Check
  before setting copy in them, or you get a silent fallback mid-word.
- **A hard offset shadow, never a blur.** A second printing pass slightly out of
  register. It is also what keeps type legible over a backdrop that moves.
- Uppercase labels get letter-spacing. Running text stays near 65 characters.

## Surfaces

- **A flat wash, textured by the paper grain that already covers the screen** —
  not by per-surface noise. Procedural blobs and cracks read as smudge at the
  size things are actually displayed.
- **Mark size is what makes a texture subtle, not ink coverage.** 1px marks
  disappear; 4–20px marks announce themselves.
- **Never scale the grain at fill time.** A squeezed pattern reads as
  pixelation. Give it its own surface at its true size and fill 1:1.
- Beware per-tile edge bevels: they draw the seam between tiles and turn a
  continuous surface into a row of bricks.

## Motion and impact

- **Falloff belongs on the DISPLACEMENT, not on the alpha.** What gives a
  localised effect away as a shape is a discontinuity in *motion*. Fading its
  opacity at the edge does not help.
- **Decay across the effect's own lifetime.** Full strength every frame followed
  by a hard stop is white noise with a cut — the harshest shape available.
- **Do not put the transition on the panel; put it on the exit.** A thing that
  is in the room was already there when you walked in. Sliding it into place on
  first paint is the giveaway.

## Geometry

- **Fixed internal resolution, CSS scaling only.** Draw at one size forever and
  let the page fit it to the window. Never position against the display size.
- **Work in logical units, not device pixels.** One conversion at draw time.
- **Art and code must agree by construction, not by measurement.** If a drawn
  asset defines a position, that position should come from the asset, not from
  someone measuring a PNG.

## Working method

- **Measure, do not eyeball.** Contrast with the WCAG formula. Motion with frame
  diffs against a same-conditions noise floor. Performance back-to-back against
  the previous commit, never against a number from an hour ago on a differently
  loaded machine.
- **A test that does not exercise the real path proves nothing.** Calling an
  internal by hand, or re-running a pipeline stage out of order, will keep
  passing after the thing it tests has moved.
- **Harnesses go stale silently.** One that restates the game's own formula
  keeps confidently reporting the shape the game no longer has.

---

## Where Rhythm Rampage departs, and why

Precedent, not apology. Each of these was a deliberate call.

**The level ends the instant the pattern lands.** There was an exit door to walk
to; getting the pattern right was the achievement, and walking across the room
afterwards was a chore between the achievement and the reward — it also left the
best moment in the game happening somewhere the player was not looking. The door,
its bars, the thief's slam and the walk-to-exit check all went.

**The title card has no structure.** The billboard doc specifies legs, gooseneck
lamps and a maintenance catwalk, all of which were built. All of it came off:
the artwork did not need the help, and what is left — the card and its offset
shadow — reads better. The shadow stayed because without it the card looks like
a hole cut in the floor.

**BUZZ holds still while the room shakes.** A contact shake is applied before he
is drawn, so the floor, the sequencer and the Donks take it and he does not. It
reads as him hitting the room rather than the camera being knocked about.
Whole-screen shakes (dying, a boulder landing) still move him, because those are
not his doing.

**Punching a pad plays that pad's drum**, replacing a square-wave blip. Partly
correct feedback, partly accessibility: it is the only thing in the game that
distinguishes the six rows for anyone who cannot separate their colours.

**The boil is set per source, and most sources are off.** Room, HUD and text are
deliberately still; only the sequencer's lattice and the characters breathe.
With grain on and linework boiling, everything moving at once was too much. The
lattice boils only where the pattern is *wrong*, so the ink is alive exactly
where there is work to do and the field goes quiet as you fix it.

**The score is centred, not top-right** as the HUD doc has it.

### Open, not yet decided

**The score is accumulated, not derived.** `score += n` in several places. The
HUD doc argues for a function of state, so the readout cannot drift from what it
reports and a restart just changes the inputs. Not yet done.

**The groove bonuses are still synthesised.** "In the pocket" and the crowd
"yeah" fall back to synth stabs because no samples exist for them.
