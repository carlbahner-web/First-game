# Deep-dive brief — BUZZ's Rhythm Rampage

**Read §0 before anything else.** The first version of this document sent a
session down the wrong road for a day, and §0 is the correction.

Everything numeric here was measured against the running game, not remembered.
Where something is opinion it says so.

---

## 0. What this document got wrong

The first version of this brief argued that the game's central problem was that
**"you can play this with the sound off and lose nothing"** — that the audio was
decoration, that the drum kit was the biggest unexploited asset, and that the
question worth answering was *"what is the version where listening does real
work?"* It also stated that the look was settled and **"not where the problem
is."**

Carl has since read it and played against it. **Both claims were wrong**, and
they were wrong in the most expensive way available: they pointed at the part of
the game that already works and away from the parts he actually wants improved.

**In his words: the musical gameplay is the part that works best. It is the most
fun and the most unique mechanic. Leave it alone.**

Two specific corrections, because they cost real time:

**The randomness is the point, not noise.** The first brief measured the
authored difference between one level's groove and the next, found it was 16% of
the work on average and 11% by level 29, and concluded the random scramble was
burying the musical signal. That measured the destination. The *journey* is the
music: a sixteen-step pattern flipped 40% at random and played at tempo is a
mutating groove, and the Donks keep mutating it while you are inside it. Carl's
words: *"the randomness is the whole fun. It's turning chaos into order, but
also as musicians it's unique to hear things constantly changing."* Removing the
roll would remove the game.

**Do not gate the input on the beat.** This was tried, twice — first requiring
the punch to land on the punched cell's own step, then loosening it to any
eighth, with grace windows, a PERFECT tier and a streak multiplier. Both
versions were less fun, and the reason is not tuning. Carl: *"it's too much to
think about instead of just enjoying the puzzle... focusing on the timing
actually made me not enjoy or even notice the parts that actually make it fun
and special."* Timing demands put the player's attention on their own hands.
The pleasure here is listening to the groove change while you sculpt it, and
those two compete for the same channel. See the commits on
`claude/deep-dive-brief-review-h5who2` if the details are ever wanted; they are
not recommended.

**The rule that came out of it:** the loop already works. Improvements should
ride on top of it for free. Prefer changes to what the player *perceives* over
changes to what the player must *do*.

---

## 1. What is actually being asked for

Three things, in Carl's priority order:

1. **The visuals** — specifically whether this should become 2.5D.
2. **The scoring system** — it is not tuned, and it pays for the wrong things.
3. **The difficulty curve** — it is not tuned, and what scales is not what
   makes it hard.

The gameplay loop is **not** on this list. That is deliberate.

---

## 2. What the game is

Top-down room, 20 × 10 tiles. A sixteen-step drum sequencer lies across the
middle as a grid of pads — four rows for levels 1–10, five for 11–20, six for
21–30. Each level's board opens as the *previous* level's completed groove; a
thief runs through flipping cells at random; the sequencer plays the resulting
mutation on a loop, audibly. You walk BUZZ to a wrong pad and punch it to
toggle it, which also plays that row's drum. Donks wander in and re-flip cells
behind you. Restore the pattern and the level ends on that beat.

Thirty levels, six biomes of five, 90 → 180 BPM. Controls are arrows, Space,
Escape. The only failure is the clock.

## 3. Scoring, measured

| source | value | where |
|---|---|---|
| time remaining | **10 per second** — up to 1500 on a 150s level | `triggerLevelComplete` |
| kill a Donk | 50 | punch resolution |
| kill an elite | 150 | punch resolution |
| "YEAH" — correct toggle on a quarter note | 25 | `triggerYeah` |
| "IN THE POCKET" — correct toggle on the cell's own step | 100 | `triggerPocketHit` |

- **The time bonus dwarfs everything else.** Finishing a level with two minutes
  left pays 1200. Every groove bonus in that level put together will not come
  close. The economy pays you to rush past the most interesting thing in the
  game.
- **Fixing a cell — the actual verb — pays nothing.** You are paid for time and
  for violence. Not for the thing the level is about.
- **The score is accumulated, not derived.** `score += n` in four places, and
  it is inconsistent: the two groove bonuses clamp to 99999, the kill bounty
  and the time bonus do not. The HUD pads to five digits, so a long run can
  overflow the centred field.

## 4. Difficulty, measured

What the level table scales, per level index:

| | L1 | L10 | L20 | L29 |
|---|---|---|---|---|
| rows / cells | 4 / 64 | 4 / 64 | 5 / 80 | 6 / 96 |
| scramble chance | 12% | 28% | 46% | 61% |
| expected wrong at start | 13.8 | 20.1 | 37.5 | 55.3 |
| timer | 150s | 150s | 135s | 115s |
| tempo | 90 BPM | 100 | 128.6 | 180 |
| Donk speed | 0 | 0.53 | 0.64 | 0.80 |

And what that actually produces:

- **The clock is not a constraint.** A punch is 12 frames with movement locked,
  a tile step is 9.5 frames. A full serpentine sweep of the level-29 board,
  punching all ~55 wrong cells, is **31.9 seconds of a 115-second timer — 28%**.
  L20 is 18%, L10 is 11%. There is roughly 3.5× slack at the hardest level.
- **Donk pressure is flat, and it peaks at level 5.** Simulated against the real
  AI over each level's real duration: 0.63 flips/sec at L5, 0.47 at L10, 0.53 at
  L20, 0.60 at L29. Bigger grids mean longer trips, and the `moveSteps > 5`
  retarget means a Donk with a distant target abandons it before arriving. The
  one system that could supply escalating pressure supplies a constant tax.
- **The Donks repair the board as often as they break it.** They toggle a random
  cell, not a *correct* one. On an L29 board that opens 57% wrong, a flip has a
  57% chance of fixing something. Their expected damage is proportional to how
  close you are to finishing, so they do almost nothing for the first 80% of a
  level and then bite. All the tension is in the last few cells, and it is RNG
  rather than skill.
- **Nothing can kill you.** There is no health and there are no lives. An elite's
  punch is a 60-frame stun; the catapult is a 10-second freeze. Both are
  denominated in time, and time has 3.5× slack — so the dangerous-looking
  enemies cost about a hundred points.
- **Difficulty scales volume, not kind.** More cells, faster tempo, same task.
- **A single clock expiry costs the whole run.** Game over sets `currentLevel =
  0`. Reaching level 25 is ~40 minutes; losing there returns you to level 1 with
  no continue and no level select.

## 5. Visuals — what the pipeline allows

Relevant to the 2.5D question:

- Everything is drawn top-down and axis-aligned into a fixed 1600 × 800 canvas,
  positioned in logical units and multiplied by `SCALE` at draw time.
- **The pads are pre-baked 80 × 80 canvases** (`TEX_GRID_ON[variant][row]`,
  `TEX_GRID_OFF[variant]`), blitted one `drawImage` each. Anything baked into
  those tiles — an extruded side face, a lip, a shadow — costs nothing per
  frame. Per-cell `shadowBlur` was tried and removed as a large per-frame cost;
  bake, do not draw.
- The room is a pre-rendered background per boil phase, or a drawn 1600 × 800
  PNG via `ROOM_ART`. **A projection change invalidates any drawn room**, which
  is the real cost of the ambitious option.
- Depth cues that exist today: one flat shadow rectangle under BUZZ. That is all.
- Characters are drawn procedurally by a rig, not blitted, so they can take a
  vertical offset and a real contact shadow cheaply.

## 6. Decisions already made, and their reasoning

Not a fence. Argue with the reasoning rather than rediscovering the problem.

- **The level ends the instant the pattern lands.** There used to be an exit door
  to walk to; the walk was a chore between the achievement and the reward.
- **The win now holds for a full bar with the drums still running.** It used to
  hold 45 frames with the sequencer stopped and a synth arpeggio over the
  silence — the reward for restoring a groove was that the groove went away.
- **BUZZ holds still while the room shakes** on a punch. He hit the room; the
  camera was not knocked about.
- **Only the wrong pads boil.** The lattice is alive exactly where there is work
  to do, and the field goes quiet as you fix it. This is the model for any
  further "show me the chaos resolving" idea.
- **Alert red `#FE3636` means deadly, only.** The one hard rule in `design.md`.
- **Levels 1–2 have no Donks**, as a runway.

## 7. Running it

```
python3 -m http.server 8123      # then open index.html
python3 tools/build-live.py out.html   # one self-contained file
python3 tools/csp-serve.py 8127        # serve the bundle under a CSP
```

**Test the bundle under the CSP server.** `img.src = "data:..."` is governed by
`img-src` and `fetch("data:...")` by `connect-src`; that asymmetry silently
blocked the entire drum kit once, with nothing thrown and nothing logged.

Console hooks: `advanceLevel()`, `jumpToLevel(n)`, `currentLevel`, `grid`,
`LEVELS[n].pattern`, `getActiveRows()`, `levelTimer`, `BOIL`, `AUDIO_KIT`.

Playwright with the bundled Chromium drives the real game end to end — boot,
key or touch input, level transitions — and is how every number in §3 and §4
was taken. It is worth rebuilding a harness rather than reasoning about the
code cold.

## 8. What you cannot see from here

- **The commit messages are the real design record.** Most carry the reasoning
  and the measurement behind a change. `git log` is worth more than reading the
  code cold.
- **Carl is a music producer who reads code well and writes it rarely.** Single
  file, vanilla JS, no build step beyond the Python bundler. It must publish as
  one self-contained HTML file. A stack he cannot own is not an upgrade.
- **Ask him to play it, and believe what he says.** Every number in this
  document is arithmetic and simulation. The three most valuable findings in the
  session that produced it all came from him playing for five minutes and
  reporting that something was not fun.
