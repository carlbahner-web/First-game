# BUZZ's Rhythm Rampage — how this game is put together

Game-specific reference. The shared visual rules are in `design.md`; this is the
geometry, the audio, and the decisions that would look arbitrary without their
reasoning.

Everything here was read off the running game rather than off the constants.
Those have disagreed before.

---

## What the game is

A top-down room with a 16-step drum sequencer laid across it. The Donks scramble
your pattern; you walk up and punch pads to put it back. Restore the pattern and
the level ends on that beat. Thirty levels across six biomes, five levels each.

## Geometry

All values are device pixels on the canvas the game draws at.

| | size | at |
|---|---|---|
| `#game` canvas | 1600 × 800 | 0, 0 |
| `#hud` canvas | 1600 × 80 | 0, 720 |
| Top / left / right wall band | 40 | — |
| Bottom wall band (HUD prints on it) | 80 | 0, 720 |
| Play area — floor inside the bands | 1520 × 680 | 40, 40 |
| Walkable box — where anything can stand | 1440 × 640 | 80, 80 |
| **Block grid** | **1280 × 320/400/480** | **160, 160** |
| One grid cell | 80 × 80 | — |

**Everything divides by 80** because the game never works in pixels: it
positions in logical units and multiplies by `SCALE` at draw time. `TILE` is 16
units, `SCALE` is 5 px, so a tile is 80 px and the room is a 20 × 10 board.

**The grid is top-anchored** at 160, 160 on every level. Only its bottom edge
moves: 480 / 560 / 640 for 4 / 5 / 6 rows (levels 1–10, 11–20, 21–30).
Horizontally it is centred with 160 px of floor each side, fixed at 16 steps.

**There is floor you can see but cannot stand on.** The walkable box is inset 40
px from the wall face on the left, right and top. Everything moves on the tile
lattice, so a clamp has to land on a whole tile while the bands are half a tile
deep. That strip is walked over, not stood on.

**1600 × 800 is internal only.** CSS scales the canvas to fit; a ruler on screen
will not read 1600. `#grain` is the exception — sized to its CSS box × dpr and
filled 1:1 on purpose, so it follows the window, not the room. Never position
anything against it.

## Room art

A biome can supply a drawn room instead of the procedural cave, via `ROOM_ART`.
Drop a 1600 × 800 PNG at `assets/room/<slug>.png` and add `art: "<slug>"` to the
biome. Biomes without one stay caves; they degrade correctly as art arrives.

The art is the floor plus the top and side walls. Where it exists, the
procedural floor tiles, those three bands, their boiling ink edges, the
stalagmites, the ceiling lights and the spawn-cave mouths are all suppressed.

**The bottom band is NOT the art's job.** The HUD prints there, and its
legibility was measured against a pale wall — 7.66:1 under LEVEL. Measured
against dark floor it was 1.30:1. So the game paints its own bottom band unless
the art supplies a pale one, and the HUD's baseline drops to 14.5 on a drawn
room because the drawn band starts 7.4 units down the 16-unit lane.

**The art defines where things are.** The warm-up room cuts doorways into its
side walls at tile rows 1.7–4.0, so the Donks spawn at row 3 to arrive inside
them. If the art moves, the spawn row moves.

**The room does not boil.** It is one image copied into all three phases. Supply
three variants and it would breathe like everything else — the three-phase
machinery is already there.

## Audio

Six voices, one per sequencer row. Each holds a list of takes.

| row | folder | takes | trim |
|---|---|---|---|
| open hat | `openhat/` | 4 | **0.5** (−6 dB) |
| closed hat | `hihat/` | 4 | 1.0 |
| snare | **`block/`** | 3 | 1.0 |
| kick | `kick/` | 4 | 1.0 |
| B row | **`snare/`** | 1 | 1.0 |
| tom | `tom/` | 3 | 1.0 |

**Voice and folder are kept apart** — a voice is a row whose name is fixed by
the code that triggers it, a folder is named for the sound in it. That is why
the snare row playing woodblocks is one line rather than a directory called
`snare` full of blocks.

**Takes are picked at random from the ones NOT just played — deliberately not a
round-robin.** These patterns loop on 16 steps, so cycling a fixed order of N
takes against a hit every M steps beats out a super-pattern of its own: three
blocks against a hit every 4 steps gives an audible 12-step cycle. Same reason
the boil ping-pongs. Measured over 4000 hits a voice: flat to within a point,
zero back-to-back repeats.

**Trim is a mixer fader, not a re-render.** Samples keep the level they were
mixed at. Files are 16-bit — the browser decodes to float32 either way.

**Punching a pad plays that row's drum**, 1.0 switching on and 0.3 switching
off. No synth on that path at all.

## Level flow

Thief scrambles the pattern → you punch it back → **the level ends on the beat
it lands**. `renderLevelComplete` holds the finished room for 45 frames before
it starts fading, then the panel fades up on that same post-hold clock.

Levels 1–2 have no Donks. Level 30 has no pattern — it is freeplay, and its
timer expiry triggers the ending rather than a game over. Milestone levels
(5, 10, 15, 20, 25, 30) award a DJ setup piece.

## Building and publishing

`tools/build-live.py` inlines every asset as a data URI into one self-contained
HTML file. Images become WebP; `.woff2`, `.webp` and `.wav` go in verbatim.

**Audio is deliberately not re-encoded.** MP3 carries ~576 samples of encoder
delay — 13ms welded to the front of every hit. Inaudible in a music player,
disqualifying in a rhythm game.

**Test the bundle under a CSP.** `tools/csp-serve.py` exists for this. The
shim used to resolve assets by handing the data URI to `fetch`, which works
everywhere except where this ships: `img.src = "data:..."` is governed by
`img-src` (allows `data:`), `fetch("data:...")` by `connect-src` (does not). So
every image loaded and every drum sample was blocked — silently, because a
rejected fetch is indistinguishable from a 404 to the loader. It now decodes the
base64 itself and makes no request.

## Harnesses

In the session scratchpad, not the repo — worth rebuilding if they matter.
`headless-path-test` (title → playing), `headless-biome-test` (all six biomes),
`finish` (pattern completes → celebration), `endgame` (curtain call → high
score), `kitlive` (sample vs synth per voice, run it under the CSP server),
`shakeperf` (fps with a shake held on).

**They go stale silently.** Ones that hard-coded `24*16`, asserted on removed
state, restated the game's own formula, or probed a pipeline stage out of order
all kept passing while measuring nothing. When a harness disagrees with what you
see, suspect the harness first.
