# Tutorial & Intro Scene Analysis

## Overview

The game has a multi-layered tutorial system consisting of:
1. **Title Screen** — Live gameplay preview with the DJ, dancers, and beat grid
2. **4-Scene Animated Intro Cutscene** — Narrative setup before gameplay begins
3. **Level 1 In-Game Tutorial** — Controls overlay + objective hint during actual gameplay

---

## Title Screen (`renderTitleScreen`, line 8186)

**Purpose:** Show the game world in its ideal state before the story begins.

**Visual elements:**
- Full club venue: floor, walls, DJ booth with all equipment (turntable, mixer, subwoofers, light rig, disco ball)
- Animated string lights with color chase effect
- 16-dancer crowd (9 back row + 7 front row) with beat-synced bobbing animation using smooth sine waves
- 4x16 beat grid displaying `INTRO_BEAT` pattern with animated playhead
- Beat pulse background overlay
- Title text with entrance animation

**Audio:** Title drums play at 110 BPM (kick, snare, hi-hat, open hat pattern).

**Transition:** On Enter, fades out and switches to `gameState = "intro"`, Scene 0.

---

## Intro Cutscene Scenes (`renderIntro`, line 8768)

### Scene 0: "The Good Times" (7 seconds, 420 frames)

**Narrative:** *"Every Friday night, the underground came alive."*

**Visuals:** Identical to title screen — full club scene at its peak. DJ behind the booth bobbing to the beat, 16 dancers on the floor, perfect beat grid, animated string lights, disco ball, light rig. Caption fades in after 1 second.

**Purpose:** Establishes the setting and what the player is fighting to restore. The venue is complete, the beat is perfect, everyone is dancing.

**Audio:** Intro drums continue from title (110 BPM kick/snare/hat pattern).

---

### Scene 1 (1A): "The Earthquake" (8 seconds, 480 frames)

**Narrative:** *"Then the ground shook..."* transitioning to *"Something was watching..."*

**Two phases:**

**Phase 1 (frames 0-180):**
- Screen shake ramps up over 2 seconds (`shakeAmt = Math.min(1, t / 120)`)
- Venue darkens as power fades — floor/wall colors dim by 50%
- String lights die sequentially: outer lights first, center lights last
  - Each bulb has a unique `dieFrame` based on distance from center
  - Lights sputter irregularly for 40 frames before dying (using overlapping sine waves)
- Dancers stumble with earthquake shake, then flee off-screen starting at frame 210
  - Each dancer has a unique flee direction (dx/dy) for variety
  - Staggered flee start (8 frames apart per dancer)
- DJ looks confused (alternating left/right facing), then ducks behind booth at frame 240

**Phase 2 (frames 150-480):**
- Cracks radiate outward from 3 cave locations (staggered reveal, 60 frames apart)
- Cave entrances open with expanding dark holes + stone frame borders
- Falling rubble particles during cave reveal
- Glowing green eyes appear in each cave entrance (`#39FF14`, pulsing alpha)
- DJ booth sparks every 12 frames after caves open

**Beat grid:** Mutable `introGridState` initialized (copy of `INTRO_BEAT`), displayed but not yet corrupted.

**Audio:** Earthquake rumble (low-frequency oscillator at 30Hz + noise through lowpass filter at 200Hz).

---

### Scene 2 (1B): "Goblin Emergence + Attack" (11 seconds, 660 frames)

**Narrative:** Captions change with scene progress (not fully shown in the code excerpt read).

**Three phases:**

**Phase 1 (frames 0-180): Goblin Emergence**
- 6 goblins spawn from caves, staggered 30 frames apart
- Cave assignment cycles: right(0), top(1), left(2), right(0), left(2), top(1)
- 5 green goblins + 1 elite goblin (index 5)
- Green goblins walk toward the beat grid and sabotage cells
  - They flip cells deterministically using pre-computed `introCorruptOrder`
  - Each corrupted cell gets a 30-frame green flash overlay (`#39FF14`)
  - Goblins navigate the grid picking random target cells
- Progressive corruption: 64 cells flip over 300 frames based on sorted seed order
- Glowing cave eyes fade as goblins emerge

**Phase 2 (frames 200-260): Elite Tackle**
- Elite goblin charges from top cave and tackles the DJ
- Booth explodes on impact at frame 260 (`playBoothExplosion()`)
- Debris particles spawn from 6 equipment piece origins (speakers, turntable, mixer, light rig, disco ball)

**Phase 3 (frames 260+): Equipment Theft**
- All 6 goblins grab equipment pieces and flee back to caves
- Each goblin carries one piece (indexed by `pieceIndex`)
- They return to their assigned `targetCave`

**Venue state:** Dark (`#161615` floor), dead string lights, dimmed walls. Residual earthquake shake fading out.

**Audio:** Goblin cackle (ascending square-wave notes 300-620Hz), intro drums fade to 15% volume.

---

### Scene 3: "Call to Action" (7 seconds, 420 frames)

**Narrative:**
- *"But the DJ didn't run."*
- *"Alone in the wreckage, something stirred."*
- *"A rhythm, deep in the chest, that refused to die."*
- *"Two fists. One beat. That's all it would take."*

**Visual phases:**

**Crawl (frames 0-120):**
- DJ crawls from Scene 2 landing position (center dance floor) upward toward gameplay start position
- `crawlEndX` and `crawlEndY` align exactly with Level 1 player start coordinates
- Slow crawl animation (frame change every 10 frames), facing up

**Rise (frames 120+):**
- DJ stands up in place, turns to face the camera (direction 0 = down)
- Rise progress over 90 frames

**Fist Clench (frames 240+):**
- Raised fists drawn above DJ head (expanding circles)
- 6 determination sparkles orbit around the DJ, gold and cream colors

**Environment:** Near-black (`#0a0a0a`) with radial spotlight following DJ position. Spotlight gradient from warm brown center to black edges.

**Text:** Fades in at frame 180, second line at frame 270. Red emphasis text at bottom.

**Audio:** Intro drums stop at scene transition (`stopIntroDrums()`).

**Prompt:** "PRESS ENTER TO BEGIN" appears after story beats complete.

---

## Level 1 In-Game Tutorial (during gameplay)

### Controls Overlay (line 6401)

**Displayed:** Only during Level 1 (`currentLevel === 0`).

**Layout:** Semi-transparent box (`#1a0e08`, 65% opacity) positioned below the active grid area.
- Gold border (`#efac28`, 40% opacity)
- Left section: "MOVE" label + arrow key caps (up/down/left/right in cross layout)
- Right section: "PUNCH" label + spacebar key cap

**Key lighting system:**
- Keys light up when pressed or held (warm gold `#efac28`)
- Flash timer per key: 10 frames on press, decays each frame
- Brightness scales from dim (`#2a1a10`) to full gold based on flash/hold state
- Labels change from muted (`#8a6a4a`) to white when lit
- Supports both Arrow keys and WASD (mapped in `flashKeys`)

### Tutorial Objective Hint (line 6477)

**Displayed:** Only during Level 1.

**Two lines:**
1. **"PUNCH cells to match the beat pattern!"** — Always shown, gold text with black drop shadow
2. **"Dotted outlines show what needs toggling."** — Only shown before first cell toggle, cream text

**Fade behavior:**
- Fades in over 0.5 seconds (30 frames)
- Fades out over 1 second (60 frames) after player's first cell toggle
- Uses `tutorialFirstToggle` flag and `tutorialFirstToggleFrame` for timing

### Narrative Breadcrumbs (line 10069)

**Displayed:** On level complete screen, after 90 frames.

**Content by level:**
- Level 1: *"The rhythm returns..."*
- Level 2: *"The beat grows stronger."*
- Milestone levels (5, 10, 15, 20, 25, 30): Equipment recovery count or flavor text
- Between milestones: Equipment count if any pieces recovered

---

## Scene Flow Summary

```
Title Screen → [Enter] → Scene 0: The Good Times (7s)
                          → [Enter] → Scene 1: Earthquake (8s)
                          → [Enter] → Scene 2: Goblin Attack (11s)
                          → [Enter] → Scene 3: Call to Action (7s)
                          → [Enter] → Level 1 Gameplay (with controls overlay + tutorial hint)
```

**Total intro duration:** ~33 seconds if played without skipping. Each scene is skippable with Enter after a "PRESS ENTER" prompt appears (60 frames after the last story beat).

---

## Technical Notes

- All scenes share a simulated beat at 110 BPM (`INTRO_BEAT_FRAMES = 8.2` frames per 16th note)
- Scene transitions use iris wipe effect (`sceneTransition` object)
- Grid position uses `GRID_Y_OFFSET = 14` pixel offset consistent across intro and gameplay
- DJ final position in Scene 3 precisely matches Level 1 player spawn for seamless transition
- 6 equipment pieces (2 speakers, turntable, mixer, light rig, disco ball) serve as collectible motivation throughout the game
- Dev scene labels exist in HUD during intro (line 10916) — noted as "remove before launch"
