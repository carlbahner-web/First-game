# Audit brief — BUZZ's Rhythm Rampage

For a fresh reviewer. You are being asked to **audit the design and help make
the game better**, not to implement anything yet.

Written by an agent that just spent a long session in this codebase. Everything
numeric here was measured, not remembered; where something is opinion it says
so.

Companion docs: `design.md` (the shared StudioLand rules, and what may be
departed from), `rhythm-rampage.md` (how the thing is built),
`reference/` (the sibling game's design write-ups this look came from).

---

## 1. What the game is

Top-down room. A 16-step drum sequencer is laid across the middle of it as a
grid of pads. The Donks scramble your pattern; you walk up to a pad and punch it
to toggle it. Restore the pattern and the level ends on that beat.

Thirty levels, six biomes of five. It is a **puzzle game wearing a music game's
clothes** — see §4, which is the single thing I would most like a second opinion
on.

## 2. The loop, moment to moment

1. Level opens. A thief sprints across the grid flipping cells, then bolts out.
2. The sequencer plays your (now wrong) pattern on a loop, audibly.
3. You walk BUZZ to a wrong pad and press Space. It toggles, plays that row's
   drum, and the lattice around it stops boiling — the ink is alive only where
   the pattern is still wrong, so the field goes quiet as you fix it.
4. Donks wander in through the side doorways and re-flip cells behind you.
   Punching one kills it. They respawn.
5. Get every cell right and the level ends instantly — a 45-frame hold on the
   finished room, then a fade to the level-complete panel.
6. Run out of time and it is game over.

**Controls:** arrows to move (tile by tile), Space to punch the tile you face,
Escape to pause. That is all of them.

## 3. The difficulty curve, measured

There is no authored scramble past level 1. Every cell gets an independent flip
roll at `0.12 + (level / 30) * 0.53`.

| lvl | rows | cells | flip % | expected wrong | secs | **secs per fix** | Donk speed |
|---|---|---|---|---|---|---|---|
| 1 | 4 | 64 | 12% | 7.7 | 150 | 19.5 | 0 |
| 5 | 4 | 64 | 19% | 12.2 | 150 | 12.3 | 0.47 |
| 10 | 4 | 64 | 28% | 17.9 | 150 | 8.4 | 0.53 |
| 15 | 5 | 80 | 37% | 29.4 | 135 | 4.6 | 0.58 |
| 20 | 5 | 80 | 46% | 36.5 | 135 | 3.7 | 0.64 |
| 25 | 6 | 96 | 54% | 52.2 | 130 | 2.5 | 0.73 |
| 29 | 6 | 96 | 61% | **59.0** | 115 | **1.9** | 0.80 |

Every fix costs a walk. And the Donks are re-scrambling the whole time.

Two things I would push on:

- **The curve scales volume, not interest.** Late levels are the same task
  sixty times instead of eight. Nothing new is asked of the player after about
  level 10 except speed.
- **61% flipped is worse than random.** A coin-flip board would be 50% wrong.
  Past the halfway point the scramble is closer to an inversion than a
  disturbance, and "restore the pattern" becomes "rebuild the board" — which may
  be a different, less interesting verb.

## 4. The thing I would most like a second opinion on

**You can play this game with the sound off and lose nothing.**

The target pattern is shown visually: pads that need turning ON get a pulsing
outline with a dot, pads that need turning OFF get a pulsing X. So the win
condition is fully specified on screen, and the audio is confirmation rather
than information. It is a match-the-diagram puzzle with a drum machine attached.

There is one seed of the other thing: punching a pad **on the beat** triggers a
groove bonus ("in the pocket", or a crowd "yeah" on a quarter-note). That is the
only mechanic where the ear does anything, and it only affects score.

For a game called Rhythm Rampage, with a sampled kit and a sequencer, that seems
like the biggest unexploited asset in the design. But removing the visual hints
outright would probably just make it frustrating. **What is the version where
listening matters and the game is still playable?** That is the question I most
want answered by someone who has not been staring at this.

## 5. What is deliberate — please do not "fix" these

Each of these was decided on purpose. Argue with them if you disagree, but know
they are choices, not oversights.

- **The level ends the instant the pattern lands.** There used to be an exit
  door to walk to. Getting it right was the achievement; walking afterwards was
  a chore between the achievement and the reward.
- **BUZZ holds still while the room shakes** on a punch. It reads as him hitting
  the room rather than the camera being knocked about.
- **Only the wrong pads boil.** The lattice's wobble is a hint system — it is
  alive exactly where there is work to do.
- **Most boil sources are off.** Room, HUD and text are deliberately still. With
  grain on and linework boiling, everything moving at once was too much.
- **Alert red `#FE3636` means deadly, only.** Never decorative. This is the one
  hard rule in `design.md`.
- **The title card has no legs, lamps or frame.** It had all three; the artwork
  did not need the help.
- **Levels 1–2 have no Donks**, as a runway.

## 6. Where I think it is weak

Opinion, ordered by how much I would want it looked at.

1. **Movement is transport, not gameplay.** Walking to a pad is pure overhead —
   the only decision is routing, and routing is trivial on an open floor. Most
   of the late-game difficulty is walking distance.
2. **The audio is decoration** (§4).
3. **The Donks are an interruption, not an opponent.** They flip cells
   semi-randomly and can be punched out. There is no read, no tell, no counter-
   play beyond noticing and walking over.
4. **Nothing new arrives after level 10.** Rows go 4 → 5 → 6, biomes change
   palette, one enemy type is added. The verb never changes.
5. **Six rows are told apart by colour alone.** Partly mitigated now that
   punching a pad plays that row's drum, but the visual field still relies on
   hue. A per-row mark inside the cell is the obvious fix and does not exist.
6. **Score is accumulated, not derived** — `score += n` in several places, so
   the readout can drift from the state it reports.
7. **The groove bonus is invisible if you are not looking for it.** It is the
   most interesting mechanic in the game and it is nearly unadvertised.

## 7. Questions I would like answered

1. What is the version of this where the ear matters? (§4)
2. Should the scramble be authored rather than rolled? Hand-built scrambles
   could teach patterns — a level whose wrong cells form a recognisable shape,
   or that turns one groove into another.
3. Is "restore the pattern" the right verb for thirty levels, or should the
   later game ask something else — build a pattern to a spec, match a pattern
   you only heard, keep a pattern alive against faster sabotage?
4. Does the timer earn its place, given the Donks already supply pressure?
5. What would make walking interesting, or should it be reduced?

## 8. Running it

```
python3 -m http.server 8123      # then open index.html
python3 tools/build-live.py out.html   # one self-contained file
python3 tools/csp-serve.py 8127        # serve the bundle under a CSP
```

**Test the bundle under the CSP server.** `img.src = "data:..."` is governed by
`img-src` and `fetch("data:...")` by `connect-src`; that asymmetry silently
blocked the entire drum kit once, with nothing thrown and nothing logged.

Useful hooks from the console: `advanceLevel()`, `currentLevel`, `grid`,
`LEVELS[n].pattern`, `getActiveRows()`, `levelTimer`, `BOIL`, `AUDIO_KIT`.

## 9. Map of the code

`game.js` is ~10,000 lines, one file, no modules. Rough order:

| lines | what |
|---|---|
| 1–200 | constants, INK palette, boil engine |
| 185–690 | LEVELS data — 30 entries, patterns as boolean grids |
| 690–800 | audio: kit map, take picker, `playSample` |
| 800–1150 | procedural texture generation |
| 1000–1150 | BIOMES — six palettes |
| 1198–1450 | ROOM_ART, room texture build, the three boil phases |
| 1600–1950 | synthesised drum voices, `drumFns`, `ROW_VOICE` |
| 2500–2700 | input and state machine |
| 2884–3600 | `update()` — player, punch resolution, Donk AI |
| 4800–5600 | `render()` — room, grid, characters, shake |
| 4780–4900 | `applyLocalShake` — the ring/blur impact |
| 5600–8000 | sprite drawing, BUZZ's rig |
| 8000–8300 | title card |
| 8400–9500 | level complete, ending, high scores, sabotage animation |
| 9600–10000 | grain, touch controls, game loop |

## 10. What you cannot see from here

- **The commit messages are the real design record.** 222 of them, most
  carrying the reasoning and the measurement behind a change. `git log` is worth
  more than reading the code cold.
- **It has never been played by a human for more than a few minutes.** Every
  claim in §3 is arithmetic on the level data, not observed play. If you can get
  Carl to play levels 15–29 and report what it *feels* like, that is worth more
  than anything in this document.
- **The look is settled and Carl is happy with it.** The audit that would help
  is about play, structure and depth. Visual suggestions are welcome but that is
  not where the problem is.
