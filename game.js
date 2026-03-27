// ============================================================
// ATTACK OF THE GROOVE GOBLINS - A 16-bit Zelda-style drum sequencer game
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---- Constants ----
const TILE = 16;
const SCALE = 3;
const COLS = 22;           // room width in tiles
const ROWS = 18;           // room height in tiles
const GRID_COLS = 16;      // sequencer steps
const GRID_ROWS = 6;       // max drum channels (O, H, S, K, B, T)
const GRID_X = 3;          // grid start tile-x
const GRID_Y = 5;          // grid start tile-y
const GRID_Y_OFFSET = 14;  // pixel offset to push grid below booth (matches intro scenes)
// (gap row after kick removed)
// Tempo is set per level using frames-per-16th-note at 60fps
// Gradual curve across 30 levels:
// L1-5: 10 frames (90 BPM), L6-14: 9 (100), L15-18: 8 (112.5),
// L19-26: 7 (128.6), L27-28: 6 (150), L29-30: 5 (180)
let stepMs = 10 * (1000 / 60); // default: 10 frames per 16th at 60fps

function setLevelTempo(levelIndex) {
    const framesPerSixteenth = [
        10,10,10,10,10,  // L1-5:   90 BPM — learnable
         9, 9, 9, 9, 9,  // L6-10:  100 BPM — slight bump
         9, 9, 9, 9,     // L11-14: 100 BPM — plateau for cowbell
         8, 8, 8, 8,     // L15-18: 112.5 BPM — moderate
         7, 7, 7, 7,     // L19-22: 128.6 BPM — getting faster
         7, 7, 7, 7,     // L23-26: 128.6 BPM — plateau for tom
         6, 6,           // L27-28: 150 BPM — fast
         5, 5,           // L29-30: 180 BPM — maximum
    ][levelIndex] || 7;
    stepMs = framesPerSixteenth * (1000 / 60);
}

// ---- Level Definitions (30 levels) ----
const LEVELS = [
    // ---- ROCK FUNDAMENTALS (Levels 1-10) — 4 rows: O,H,S,K ----
    // Levels 1-2 are practice (no goblins)

    // L1: Basic rock — 8th-note hats, backbeat snare, simple kick
    {
        name: "Level 1",
        activeRows: 4,
        startPattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // H
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S
            [true, false,false,false, false,false,false,false, true, false,false,false, false,false,false,false], // K
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // B
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // T
        ],
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // H — steady 8ths
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S — backbeat 2&4
            [true, false,false,false, false,false,false,false, true, false,false,false, false,false,false,false], // K — beats 1&3
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0,
        timerSeconds: 99,
    },
    // L2: Pop variation — add open hat accent, kick gets syncopated
    {
        name: "Level 2",
        activeRows: 4,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,true, false, false,false,false,false], // O — open hat on beat 3-and
            [true, false,true, false, true, false,true, false, true, false,false,false, true, false,true, false], // H — gap where O plays
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S — backbeat
            [true, false,false,false, false,false,true, false, false,false,false,false, false,false,false,false], // K — kick anticipation
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0,
        timerSeconds: 99,
    },
    // L3: Driving rock — busier kick pattern (goblins start here!)
    {
        name: "Level 3",
        activeRows: 4,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,true, false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,false,false, true, false,true, false], // H
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S
            [true, false,false,false, false,false,true, false, true, false,false,false, false,false,false,false], // K — added 3rd kick
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.45,
        timerSeconds: 99,
    },
    // L4: Add a 4th kick, driving feel
    {
        name: "Level 4",
        activeRows: 4,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,true, false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,false,false, true, false,true, false], // H
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S
            [true, false,false,false, false,false,true, false, true, false,false,false, false,false,true, false], // K — 4 kicks
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.46,
        timerSeconds: 99,
    },
    // L5: Offbeat open hats — hats thin out for open hat accents
    {
        name: "Level 5",
        activeRows: 4,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O — offbeat open hats
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H — gaps for O
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S
            [true, false,false,false, false,false,true, false, true, false,false,false, false,false,true, false], // K
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.47,
        timerSeconds: 99,
    },
    // L6: Snare ghost note — add ghost before beat 4
    {
        name: "Level 6",
        activeRows: 4,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H
            [false,false,false,false, true, false,false,false, false,false,false,true,  true, false,false,false], // S — ghost before 4
            [true, false,false,false, false,false,true, false, true, false,false,false, false,false,true, false], // K
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.48,
        timerSeconds: 99,
    },
    // L7: Syncopated kick — displaced kicks (pink goblins start here!)
    {
        name: "Level 7",
        activeRows: 4,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H
            [false,false,false,false, true, false,false,false, false,false,false,true,  true, false,false,false], // S
            [true, false,false,false, false,false,false,false, true, false,false,false, false,false,false,true ], // K — anticipation into 1
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.50,
        timerSeconds: 99,
    },
    // L8: More open hat variety
    {
        name: "Level 8",
        activeRows: 4,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S — ghost before 2 AND 4
            [true, false,false,false, false,false,false,false, true, false,false,false, false,false,false,true ], // K
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.51,
        timerSeconds: 99,
    },
    // L9: Complex kick+hat interplay
    {
        name: "Level 9",
        activeRows: 4,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,true, false, false,false,false,false], // O — two open hats
            [true, false,true, false, true, false,false,false, true, false,false,false, true, false,true, false], // H — gaps for O
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S
            [true, false,false,false, false,false,false,true,  false,false,false,false, false,false,false,true ], // K — syncopated
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.52,
        timerSeconds: 99,
    },
    // L10: Rock mastery — full complexity with 4 rows
    {
        name: "Level 10",
        activeRows: 4,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,true, false, false,false,true, false], // O — three open hats
            [true, false,true, false, true, false,false,false, true, false,false,false, true, false,false,false], // H — gaps for O
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S
            [true, false,false,false, false,false,false,true,  true, false,false,false, false,true, false,false], // K — busy syncopation
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.53,
        timerSeconds: 99,
    },

    // ---- FUNK & SOUL (Levels 11-20) — 5 rows: +Cowbell ----

    // L11: Funk intro — stripped back + quarter-note cowbell (cowbell introduced!)
    {
        name: "Level 11",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O — clean
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // H — steady 8ths
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S — simple backbeat
            [true, false,false,false, false,false,false,false, true, false,false,false, false,false,false,false], // K — simple
            [true, false,false,false, true, false,false,false, true, false,false,false, true, false,false,false], // B — quarter-note cowbell
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.54,
        timerSeconds: 95,
    },
    // L12: Offbeat cowbell
    {
        name: "Level 12",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // H
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S
            [true, false,false,false, false,false,true, false, true, false,false,false, false,false,false,false], // K — syncopated
            [false,false,true, false, false,false,true, false, false,false,true, false, false,false,true, false], // B — offbeat cowbell
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.55,
        timerSeconds: 95,
    },
    // L13: Funky kick + cowbell
    {
        name: "Level 13",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // H
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S
            [true, false,false,false, false,false,false,true,  false,false,true, false, false,false,false,false], // K — funky syncopation
            [false,false,true, false, false,false,true, false, false,false,true, false, false,false,true, false], // B
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.56,
        timerSeconds: 95,
    },
    // L14: Ghost snare notes + funk kick
    {
        name: "Level 14",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // H
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S — ghost before backbeat
            [true, false,false,false, false,false,false,true,  false,false,true, false, false,false,false,false], // K
            [false,false,true, false, false,false,true, false, false,false,true, false, false,false,true, false], // B
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.57,
        timerSeconds: 95,
    },
    // L15: Tresillo cowbell (catapult goblins start here!)
    {
        name: "Level 15",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // H
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S
            [true, false,false,false, false,false,false,true,  false,false,true, false, false,false,false,false], // K
            [true, false,false,true,  false,false,true, false, true, false,false,true,  false,false,true, false], // B — tresillo
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.58,
        timerSeconds: 90,
    },
    // L16: Open hat accents return
    {
        name: "Level 16",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O — offbeat accents
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H — gaps for O
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S
            [true, false,false,false, false,false,false,true,  false,false,true, false, false,false,false,false], // K
            [true, false,false,true,  false,false,true, false, true, false,false,true,  false,false,true, false], // B
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.59,
        timerSeconds: 90,
    },
    // L17: Syncopated everything — James Brown feel
    {
        name: "Level 17",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H
            [false,false,false,false, true, false,false,true,  false,false,false,false, true, false,false,false], // S — ghost on and-of-2
            [true, false,false,false, false,false,false,false, false,true, false,false, false,false,true, false], // K — displaced
            [true, false,false,true,  false,false,true, false, true, false,false,true,  false,false,true, false], // B
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.60,
        timerSeconds: 90,
    },
    // L18: Disco-style — 4-on-the-floor with busy hats
    {
        name: "Level 18",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,false,false], // O — single accent
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,true, false], // H
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,true ], // S — ghost on and-of-4
            [true, false,false,true,  false,false,false,false, true, false,false,false, false,true, false,false], // K — syncopated
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // B — 8th-note cowbell
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.61,
        timerSeconds: 90,
    },
    // L19: Latin-influenced — cowbell drives, kick sparse
    {
        name: "Level 19",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H
            [false,false,false,false, true, false,false,true,  false,false,false,false, true, false,false,true ], // S — ghost notes
            [true, false,false,false, false,false,false,false, false,false,true, false, false,false,false,false], // K — sparse
            [true, false,false,true,  false,true, false,false, true, false,false,true,  false,true, false,false], // B — Latin pattern
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.63,
        timerSeconds: 90,
    },
    // L20: Funk mastery — full complexity with 5 rows
    {
        name: "Level 20",
        activeRows: 5,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S
            [true, false,false,false, false,false,false,true,  false,false,true, false, false,false,false,true ], // K — displaced syncopation
            [false,true, false,false, false,true, false,false, false,true, false,false, false,true, false,false], // B — offbeat pulse
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.64,
        timerSeconds: 90,
    },

    // ---- BREAKBEATS & BEYOND (Levels 21-30) — 6 rows: +Tom ----

    // L21: Hip-hop boom bap — stripped back, toms add flavor (tom introduced!)
    {
        name: "Level 21",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O — clean
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // H — steady 8ths
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S — boom bap snare
            [true, false,false,false, false,false,false,false, false,false,true, false, false,false,false,false], // K — classic boom bap
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // B — no cowbell
            [false,false,false,false, false,false,false,true,  false,false,false,false, false,false,false,true ], // T — tom fills
        ],
        goblinSpeed: 0.65,
        timerSeconds: 85,
    },
    // L22: Offbeat toms
    {
        name: "Level 22",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // H
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S
            [true, false,false,false, false,false,true, false, false,false,true, false, false,false,false,false], // K — syncopated
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // B
            [false,false,false,true,  false,false,false,false, false,false,false,true,  false,false,false,false], // T — offbeat accents
        ],
        goblinSpeed: 0.67,
        timerSeconds: 85,
    },
    // L23: Add cowbell back with toms
    {
        name: "Level 23",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,true, false, true, false,true, false], // H
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // S
            [true, false,false,false, false,false,true, false, false,false,true, false, false,false,false,false], // K
            [true, false,false,false, true, false,false,false, true, false,false,false, true, false,false,false], // B — quarter-note cowbell
            [false,false,false,true,  false,false,false,false, false,false,false,true,  false,false,false,false], // T
        ],
        goblinSpeed: 0.69,
        timerSeconds: 85,
    },
    // L24: Breakbeat snare — off-grid snare hits
    {
        name: "Level 24",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,false,false], // O — accent
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,true, false], // H
            [false,false,false,false, true, false,false,false, false,true, false,false, true, false,false,false], // S — off-grid snare
            [true, false,false,false, false,false,false,false, true, false,false,false, false,false,false,true ], // K — kick anticipation
            [true, false,false,false, true, false,false,false, true, false,false,false, true, false,false,false], // B
            [false,false,false,true,  false,false,false,false, false,false,false,true,  false,false,false,false], // T
        ],
        goblinSpeed: 0.71,
        timerSeconds: 85,
    },
    // L25: Complex kick+tom interplay
    {
        name: "Level 25",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,false,false], // O
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,true, false], // H
            [false,false,false,false, true, false,false,false, false,true, false,false, true, false,false,false], // S
            [true, false,false,false, false,false,false,true,  false,false,false,false, false,false,false,true ], // K — syncopated
            [false,false,true, false, false,false,true, false, false,false,true, false, false,false,true, false], // B — offbeat
            [false,false,false,false, false,false,false,false, false,false,false,true,  false,false,false,false], // T — accent
        ],
        goblinSpeed: 0.73,
        timerSeconds: 85,
    },
    // L26: D&B half-time — fast hats, syncopated snare, rolling toms
    {
        name: "Level 26",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,true, false, false,false,false,false], // O — single accent
            [true, false,true, false, true, false,true, false, true, false,false,false, true, false,true, false], // H — gap for O
            [false,false,false,false, false,false,false,false, true, false,false,false, false,false,true, false], // S — half-time snare
            [true, false,false,false, false,true, false,false, false,false,false,false, false,false,false,false], // K — sparse with anticipation
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // B — sparse cowbell
            [false,false,false,true,  false,false,false,true,  false,false,false,true,  false,false,false,false], // T — rolling offbeat toms
        ],
        goblinSpeed: 0.75,
        timerSeconds: 80,
    },
    // L27: Rolling toms — busier tom pattern
    {
        name: "Level 27",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,true, false, false,false,false,false], // O
            [true, false,true, false, true, false,true, false, true, false,false,false, true, false,true, false], // H
            [false,false,false,false, false,false,false,false, true, false,false,false, false,false,true, false], // S
            [true, false,false,false, false,true, false,false, false,false,false,false, false,false,false,false], // K
            [false,false,false,false, true, false,false,false, false,false,false,false, true, false,false,false], // B
            [false,false,false,true,  false,false,false,true,  false,false,false,true,  false,false,false,true ], // T — 4 rolling toms
        ],
        goblinSpeed: 0.77,
        timerSeconds: 80,
    },
    // L28: Syncopated chaos — everything displaced
    {
        name: "Level 28",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O — offbeat open hats
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H — gaps for O
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S — ghost + backbeat
            [true, false,false,false, false,false,false,true,  false,false,true, false, false,false,false,false], // K — displaced
            [true, false,false,true,  false,false,true, false, true, false,false,true,  false,false,true, false], // B — tresillo
            [false,false,false,false, false,false,false,false, false,false,false,false, true, false,true, false], // T — tom break at end
        ],
        goblinSpeed: 0.79,
        timerSeconds: 80,
    },
    // L29: Everything together — near-maximum complexity
    {
        name: "Level 29",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S
            [true, false,false,false, false,false,false,true,  false,false,true, false, false,false,false,true ], // K — busy syncopation
            [false,true, false,false, false,true, false,false, false,true, false,false, false,true, false,false], // B — offbeat cowbell pulse
            [false,false,false,true,  false,false,false,true,  false,false,false,true,  false,false,false,false], // T — rolling toms
        ],
        goblinSpeed: 0.80,
        timerSeconds: 75,
    },
    // L30: Grand finale — syncopated chaos, everything locks in
    {
        name: "Level 30",
        activeRows: 6,
        pattern: [
            [false,false,false,false, false,false,true, false, false,false,false,false, false,false,true, false], // O — offbeat open hats
            [true, false,true, false, true, false,false,false, true, false,true, false, true, false,false,false], // H — gaps for O
            [false,false,false,true,  true, false,false,false, false,false,false,true,  true, false,false,false], // S — ghost + backbeat
            [true, false,false,false, false,false,false,true,  false,false,true, false, false,false,false,true ], // K — displaced syncopation
            [false,true, false,false, false,true, false,false, false,true, false,false, false,true, false,false], // B — offbeat cowbell pulse
            [false,false,false,false, false,false,false,false, false,false,false,false, true, false,true, false], // T — tom break at end
        ],
        goblinSpeed: 0.82,
        timerSeconds: 75,
    },
];

canvas.width = COLS * TILE * SCALE;
canvas.height = ROWS * TILE * SCALE;
ctx.imageSmoothingEnabled = true;

// ---- HUD canvas (below game canvas) ----
const hudCanvas = document.getElementById("hud");
const hudCtx = hudCanvas.getContext("2d");
const HUD_H = 2 * TILE; // logical height for HUD strip
hudCanvas.width = COLS * TILE * SCALE;
hudCanvas.height = HUD_H * SCALE;
hudCtx.imageSmoothingEnabled = true;

// ---- Image Asset Preloader (hybrid sprite system) ----
// Loads PNG sprites from assets/ folder. If a PNG is missing, IMAGES[key] = null
// and the original procedural drawing code runs as fallback.
const IMAGES = {};
const _ROW_IDS = ["O", "H", "S", "K", "B", "T"];
const _DIR_NAMES = ["down", "up", "left", "right"];

function loadImage(key, src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { IMAGES[key] = img; resolve(); };
        img.onerror = () => { IMAGES[key] = null; resolve(); }; // graceful fallback
        img.src = src;
    });
}

const ASSET_LIST = [
    // Backgrounds
    ["cave_bg",    "assets/bg/cave-bg.png"],
    ["grid_wall",  "assets/grid/grid-wall.png"],
    ["hud_bg",     "assets/hud/hud-bg.png"],
    // Grid cells (1 off + 6 on colors)
    ["grid_off",   "assets/grid/grid-off.png"],
    ..._ROW_IDS.map(r => ["grid_on_" + r, "assets/grid/grid-on-" + r + ".png"]),
    // Player (4 dirs × 2 walk frames + 4 punch poses = 12)
    ..._DIR_NAMES.flatMap(d => [0, 1].map(f =>
        ["player_" + d + "_" + f, "assets/player/player-" + d + "-" + f + ".png"]
    )),
    ..._DIR_NAMES.map(d => ["player_punch_" + d, "assets/player/player-punch-" + d + ".png"]),
    // Goblins (3 types × 4 dirs × 2 frames = 24 + 1 catapult frame)
    ...["goblin", "elite", "catapult"].flatMap(t =>
        _DIR_NAMES.flatMap(d => [0, 1].map(f =>
            [t + "_" + d + "_" + f, "assets/goblins/" + t + "-" + d + "-" + f + ".png"]
        ))
    ),
    ["catapult_frame", "assets/goblins/catapult-frame.png"],
    // Dancers (6 color variants × 2 poses = 12)
    ...[0,1,2,3,4,5].flatMap(i => [
        ["dancer_" + i,          "assets/dancers/dancer-" + i + ".png"],
        ["dancer_" + i + "_up",  "assets/dancers/dancer-" + i + "-up.png"],
    ]),
    // DJ equipment (6 pieces)
    ["speaker_left",  "assets/dj/speaker-left.png"],
    ["speaker_right", "assets/dj/speaker-right.png"],
    ["turntable",     "assets/dj/turntable.png"],
    ["mixer",         "assets/dj/mixer.png"],
    ["light_rig",     "assets/dj/light-rig.png"],
    ["disco_ball",    "assets/dj/disco-ball.png"],
    // Cave entrance
    ["cave_entrance", "assets/cave/cave-entrance.png"],
];

let assetsReady = false;
Promise.all(ASSET_LIST.map(([key, src]) => loadImage(key, src))).then(() => {
    assetsReady = true;
    if (typeof startGame === "function") startGame();
});

// ---- Grain texture overlay (screen-print / block-print effect) ----
const grainCanvas = document.createElement('canvas');
grainCanvas.width = COLS * TILE * SCALE;
grainCanvas.height = ROWS * TILE * SCALE;
const grainCtx = grainCanvas.getContext('2d');
(function generateGrain() {
    const w = grainCanvas.width, h = grainCanvas.height;
    const imageData = grainCtx.createImageData(w, h);
    const data = imageData.data;
    let seed = 42;
    for (let i = 0; i < w * h; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        if (seed / 233280 < 0.08) { // ~8% of pixels get a grain dot
            const idx = i * 4;
            seed = (seed * 9301 + 49297) % 233280;
            const dark = seed / 233280 > 0.5;
            data[idx]     = dark ? 0 : 255;
            data[idx + 1] = dark ? 0 : 255;
            data[idx + 2] = dark ? 0 : 255;
            data[idx + 3] = dark ? 18 : 10; // subtle alpha
        }
    }
    grainCtx.putImageData(imageData, 0, 0);
})();

const hudGrainCanvas = document.createElement('canvas');
hudGrainCanvas.width = COLS * TILE * SCALE;
hudGrainCanvas.height = HUD_H * SCALE;
const hudGrainCtx = hudGrainCanvas.getContext('2d');
(function generateHudGrain() {
    const w = hudGrainCanvas.width, h = hudGrainCanvas.height;
    const imageData = hudGrainCtx.createImageData(w, h);
    const data = imageData.data;
    let seed = 7777;
    for (let i = 0; i < w * h; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        if (seed / 233280 < 0.08) {
            const idx = i * 4;
            seed = (seed * 9301 + 49297) % 233280;
            const dark = seed / 233280 > 0.5;
            data[idx]     = dark ? 0 : 255;
            data[idx + 1] = dark ? 0 : 255;
            data[idx + 2] = dark ? 0 : 255;
            data[idx + 3] = dark ? 18 : 10;
        }
    }
    hudGrainCtx.putImageData(imageData, 0, 0);
})();

// ============================================================
// PROCEDURAL TEXTURE GENERATION SYSTEM
// Pre-renders detailed textures to off-screen canvases at startup
// ============================================================

// Seeded PRNG for deterministic texture generation
function texRNG(seed) {
    let s = seed;
    return function() {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

// Helper: parse hex color to [r,g,b]
function hexToRGB(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Helper: blend two colors
function blendColor(c1, c2, t) {
    const a = hexToRGB(c1), b = hexToRGB(c2);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
}

// Generate a single stone tile texture (TILE*SCALE x TILE*SCALE pixels)
function generateStoneTile(seed, baseColor, darkColor, highlightColor, opts) {
    const o = opts || {};
    const size = TILE * SCALE; // 48x48 pixels
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const rng = texRNG(seed);

    // Base fill
    g.fillStyle = baseColor;
    g.fillRect(0, 0, size, size);

    // Stone grain — varied patches of slightly different shades
    for (let i = 0; i < 18; i++) {
        const px = Math.floor(rng() * (size - 8));
        const py = Math.floor(rng() * (size - 8));
        const pw = 4 + Math.floor(rng() * 12);
        const ph = 4 + Math.floor(rng() * 12);
        const bright = rng() > 0.5;
        g.fillStyle = bright ? highlightColor : darkColor;
        g.globalAlpha = 0.15 + rng() * 0.2;
        g.fillRect(px, py, pw, ph);
    }
    g.globalAlpha = 1;

    // Large stone patches (creates mottled look)
    for (let i = 0; i < 5; i++) {
        const cx = rng() * size;
        const cy = rng() * size;
        const cr = 6 + rng() * 14;
        g.fillStyle = rng() > 0.5 ? darkColor : highlightColor;
        g.globalAlpha = 0.08 + rng() * 0.12;
        g.beginPath();
        g.arc(cx, cy, cr, 0, Math.PI * 2);
        g.fill();
    }
    g.globalAlpha = 1;

    // Crack lines (2-5 per tile)
    const numCracks = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < numCracks; i++) {
        const x1 = rng() * size;
        const y1 = rng() * size;
        const segments = 2 + Math.floor(rng() * 3);
        g.strokeStyle = darkColor;
        g.globalAlpha = 0.3 + rng() * 0.4;
        g.lineWidth = 0.5 + rng() * 1;
        g.beginPath();
        g.moveTo(x1, y1);
        let cx = x1, cy = y1;
        for (let s = 0; s < segments; s++) {
            cx += (rng() - 0.5) * 18;
            cy += (rng() - 0.5) * 18;
            g.lineTo(cx, cy);
        }
        g.stroke();
        // Highlight edge along crack (depth effect)
        g.strokeStyle = highlightColor;
        g.globalAlpha = 0.15;
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(x1 + 1, y1 + 1);
        cx = x1 + 1; cy = y1 + 1;
        for (let s = 0; s < segments; s++) {
            cx += (rng() - 0.5) * 18;
            cy += (rng() - 0.5) * 18;
            g.lineTo(cx, cy);
        }
        g.stroke();
    }
    g.globalAlpha = 1;

    // Moss / mineral spots
    if (!o.noMoss) {
        const numSpots = Math.floor(rng() * 4);
        for (let i = 0; i < numSpots; i++) {
            const mx = rng() * size;
            const my = rng() * size;
            const mr = 2 + rng() * 4;
            g.fillStyle = o.mossColor || "#2a4a2a";
            g.globalAlpha = 0.15 + rng() * 0.2;
            g.beginPath();
            g.arc(mx, my, mr, 0, Math.PI * 2);
            g.fill();
        }
        g.globalAlpha = 1;
    }

    // Edge bevels — subtle 3D effect
    // Top/left highlight
    g.fillStyle = highlightColor;
    g.globalAlpha = 0.12;
    g.fillRect(0, 0, size, 2);
    g.fillRect(0, 0, 2, size);
    // Bottom/right shadow
    g.fillStyle = darkColor;
    g.globalAlpha = 0.2;
    g.fillRect(0, size - 2, size, 2);
    g.fillRect(size - 2, 0, 2, size);
    g.globalAlpha = 1;

    // Pixel noise for roughness
    const imgData = g.getImageData(0, 0, size, size);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const noise = (rng() - 0.5) * 12;
        d[i] = Math.max(0, Math.min(255, d[i] + noise));
        d[i+1] = Math.max(0, Math.min(255, d[i+1] + noise));
        d[i+2] = Math.max(0, Math.min(255, d[i+2] + noise));
    }
    g.putImageData(imgData, 0, 0);

    return c;
}

// Generate stone tile for the grid (darker, more uniform)
function generateGridStoneTile(seed) {
    return generateStoneTile(seed, "#1a2820", "#0d150d", "#2a3a2a", { mossColor: "#1a3a2a" });
}

// Generate an active/glowing grid tile overlay
function generateGlowTile(seed, glowColor) {
    const size = TILE * SCALE;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const rng = texRNG(seed);
    const [gr, gg, gb] = hexToRGB(glowColor);

    // Dark stone base
    g.fillStyle = "#1a2820";
    g.fillRect(0, 0, size, size);

    // Glow fill (inner area)
    const innerPad = 3;
    g.fillStyle = glowColor;
    g.globalAlpha = 0.7;
    g.beginPath();
    g.roundRect(innerPad, innerPad, size - innerPad * 2, size - innerPad * 2, 3);
    g.fill();
    g.globalAlpha = 1;

    // Energy vein network (branching cracks that glow)
    const numVeins = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < numVeins; i++) {
        const x1 = innerPad + rng() * (size - innerPad * 2);
        const y1 = innerPad + rng() * (size - innerPad * 2);
        const segments = 2 + Math.floor(rng() * 3);
        // Bright core
        g.strokeStyle = `rgba(255,255,255,0.6)`;
        g.lineWidth = 0.5 + rng() * 1;
        g.beginPath();
        g.moveTo(x1, y1);
        let vx = x1, vy = y1;
        for (let s = 0; s < segments; s++) {
            vx += (rng() - 0.5) * 20;
            vy += (rng() - 0.5) * 20;
            g.lineTo(vx, vy);
        }
        g.stroke();
        // Outer glow around vein
        g.strokeStyle = glowColor;
        g.globalAlpha = 0.4;
        g.lineWidth = 2 + rng() * 2;
        g.beginPath();
        g.moveTo(x1, y1);
        vx = x1; vy = y1;
        for (let s = 0; s < segments; s++) {
            vx += (rng() - 0.5) * 20;
            vy += (rng() - 0.5) * 20;
            g.lineTo(vx, vy);
        }
        g.stroke();
        g.globalAlpha = 1;
    }

    // Hot spots (brighter concentration points)
    for (let i = 0; i < 3; i++) {
        const hx = innerPad + rng() * (size - innerPad * 2);
        const hy = innerPad + rng() * (size - innerPad * 2);
        const hr = 3 + rng() * 6;
        const grad = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
        grad.addColorStop(0, `rgba(255,255,255,0.5)`);
        grad.addColorStop(0.5, `rgba(${gr},${gg},${gb},0.4)`);
        grad.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
        g.fillStyle = grad;
        g.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
    }

    // Inner highlight (top edge shine)
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(innerPad, innerPad, size - innerPad * 2, 2);

    // Edge bevel
    g.fillStyle = "#0d150d";
    g.globalAlpha = 0.3;
    g.fillRect(0, size - 2, size, 2);
    g.fillRect(size - 2, 0, 2, size);
    g.globalAlpha = 1;

    return c;
}

// Generate cave wall tile (rougher, more variation)
function generateCaveWallTile(seed, variant) {
    const colors = [
        { base: "#1e2e1e", dark: "#0a0f0a", hi: "#2a3a2a" },
        { base: "#1a2a1a", dark: "#080d08", hi: "#243024" },
        { base: "#162616", dark: "#060b06", hi: "#1e3e1e" },
    ];
    const pal = colors[variant % 3];
    return generateStoneTile(seed, pal.base, pal.dark, pal.hi, { mossColor: "#1a3a1a" });
}

// Generate cave floor tile (dark, with subtle variation)
function generateFloorTile(seed) {
    return generateStoneTile(seed, "#0d150d", "#050a05", "#152015", { mossColor: "#0a1a0a" });
}

// ---- Pre-generate texture atlas at startup ----
// Floor tiles (ROWS x COLS grid — one per tile position)
const TEX_FLOOR = [];
for (let r = 0; r < ROWS; r++) {
    TEX_FLOOR[r] = [];
    for (let c = 0; c < COLS; c++) {
        TEX_FLOOR[r][c] = generateFloorTile(r * 1000 + c * 37 + 5555);
    }
}

// Wall tiles (top, bottom, left, right walls)
const TEX_WALL_TOP = [];
const TEX_WALL_BOT = [];
const TEX_WALL_LEFT = [];
const TEX_WALL_RIGHT = [];
for (let c = 0; c < COLS; c++) {
    TEX_WALL_TOP[c] = generateCaveWallTile(c * 73 + 111, (c * 7 + 3) % 3);
    TEX_WALL_BOT[c] = generateCaveWallTile(c * 91 + 222, (c * 11 + 5) % 3);
}
for (let r = 0; r < ROWS; r++) {
    TEX_WALL_LEFT[r] = generateCaveWallTile(r * 67 + 333, (r * 7) % 3);
    TEX_WALL_RIGHT[r] = generateCaveWallTile(r * 83 + 444, (r * 11) % 3);
}

// Grid stone tiles (inactive blocks — unique per cell position)
const TEX_GRID_OFF = [];
for (let r = 0; r < 6; r++) {
    TEX_GRID_OFF[r] = [];
    for (let c = 0; c < GRID_COLS; c++) {
        TEX_GRID_OFF[r][c] = generateGridStoneTile(r * 100 + c * 17 + 9999);
    }
}

// Grid glow tiles (active blocks — per row color, multiple variants per row)
const GLOW_COLORS = ["#44ff44", "#88ee22", "#ee8822", "#ff6611", "#ff4400", "#33dd88"];
const TEX_GRID_ON = [];
for (let r = 0; r < 6; r++) {
    TEX_GRID_ON[r] = [];
    for (let c = 0; c < GRID_COLS; c++) {
        TEX_GRID_ON[r][c] = generateGlowTile(r * 100 + c * 17 + 7777, GLOW_COLORS[r]);
    }
}

// Grid wall background texture (stone slab behind the grid)
const TEX_GRID_WALL = (function() {
    // This is a larger texture for the wall behind the grid
    const maxAR = 6;
    const w = (GRID_COLS * TILE + 4) * SCALE;
    const h = (maxAR * TILE + 4) * SCALE;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const rng = texRNG(88888);

    // Base stone slab
    g.fillStyle = "#1a2820";
    g.beginPath();
    g.roundRect(0, 0, w, h, 3);
    g.fill();

    // Large mottled patches
    for (let i = 0; i < 30; i++) {
        const px = rng() * w;
        const py = rng() * h;
        const pr = 10 + rng() * 30;
        g.fillStyle = rng() > 0.5 ? "#0d150d" : "#243024";
        g.globalAlpha = 0.06 + rng() * 0.1;
        g.beginPath();
        g.arc(px, py, pr, 0, Math.PI * 2);
        g.fill();
    }
    g.globalAlpha = 1;

    // Stone texture cracks
    for (let i = 0; i < 40; i++) {
        const x1 = 8 + rng() * (w - 16);
        const y1 = 8 + rng() * (h - 16);
        const segments = 2 + Math.floor(rng() * 4);
        g.strokeStyle = "rgba(15,25,15,0.6)";
        g.lineWidth = 0.5 + rng() * 1;
        g.beginPath();
        g.moveTo(x1, y1);
        let cx = x1, cy = y1;
        for (let s = 0; s < segments; s++) {
            cx += (rng() - 0.5) * 25;
            cy += (rng() - 0.5) * 25;
            g.lineTo(cx, cy);
        }
        g.stroke();
    }

    // Mortar lines (horizontal and vertical grid)
    g.strokeStyle = "#0d150d";
    g.lineWidth = 1;
    for (let r = 0; r <= maxAR; r++) {
        const ly = 2 * SCALE + r * TILE * SCALE;
        g.beginPath();
        g.moveTo(0, ly);
        g.lineTo(w, ly);
        g.stroke();
    }
    for (let c = 0; c <= GRID_COLS; c++) {
        const lx = 2 * SCALE + c * TILE * SCALE;
        g.beginPath();
        g.moveTo(lx, 0);
        g.lineTo(lx, h);
        g.stroke();
    }

    // Pixel noise
    const imgData = g.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const noise = (rng() - 0.5) * 8;
        d[i] = Math.max(0, Math.min(255, d[i] + noise));
        d[i+1] = Math.max(0, Math.min(255, d[i+1] + noise));
        d[i+2] = Math.max(0, Math.min(255, d[i+2] + noise));
    }
    g.putImageData(imgData, 0, 0);

    return c;
})();

// Pre-render static cave background (floor + walls + stalactites + stalagmites)
const TEX_CAVE_BG = (function() {
    const w = COLS * TILE * SCALE;
    const h = ROWS * TILE * SCALE;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');

    // Dark base fill
    g.fillStyle = "#0a0f0a";
    g.fillRect(0, 0, w, h);

    // Draw floor tiles
    for (let r = 0; r < ROWS; r++) {
        for (let col = 0; col < COLS; col++) {
            g.drawImage(TEX_FLOOR[r][col], col * TILE * SCALE, r * TILE * SCALE);
        }
    }

    // Top wall tiles
    for (let col = 0; col < COLS; col++) {
        g.drawImage(TEX_WALL_TOP[col], col * TILE * SCALE, 0);
    }
    // Bottom wall tiles
    for (let col = 0; col < COLS; col++) {
        g.drawImage(TEX_WALL_BOT[col], col * TILE * SCALE, (ROWS - 1) * TILE * SCALE);
    }
    // Left wall tiles
    for (let r = 0; r < ROWS; r++) {
        g.drawImage(TEX_WALL_LEFT[r], 0, r * TILE * SCALE);
    }
    // Right wall tiles
    for (let r = 0; r < ROWS; r++) {
        g.drawImage(TEX_WALL_RIGHT[r], (COLS - 1) * TILE * SCALE, r * TILE * SCALE);
    }

    // Stalactites (triangular, textured)
    const stalactitePositions = [2, 4, 7, 9, 12, 14, 17, 19];
    const stRNG = texRNG(54321);
    for (const sc of stalactitePositions) {
        if (sc >= COLS) continue;
        const stH = 3 + (sc * 7) % 5;
        const stX = sc * TILE + TILE / 2;
        const stCol = (sc * 3) % 2 === 0 ? "#1e2e1e" : "#243024";
        // Main stalactite body
        g.fillStyle = stCol;
        g.beginPath();
        g.moveTo((stX - 4) * SCALE, TILE * SCALE);
        g.lineTo((stX + 4) * SCALE, TILE * SCALE);
        g.lineTo((stX + 1) * SCALE, (TILE + stH) * SCALE);
        g.lineTo((stX - 1) * SCALE, (TILE + stH + 2) * SCALE);
        g.closePath();
        g.fill();
        // Highlight edge
        g.fillStyle = "#2a4a2a";
        g.globalAlpha = 0.3;
        g.beginPath();
        g.moveTo((stX - 2) * SCALE, TILE * SCALE);
        g.lineTo((stX) * SCALE, TILE * SCALE);
        g.lineTo((stX - 0.5) * SCALE, (TILE + stH) * SCALE);
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
        // Drip highlight
        g.fillStyle = "rgba(80,180,80,0.2)";
        g.beginPath();
        g.arc((stX) * SCALE, (TILE + stH + 2) * SCALE, 1.5 * SCALE, 0, Math.PI * 2);
        g.fill();
    }

    // Stalagmites on floor
    const stalagmitePositions = [3, 6, 10, 15, 18];
    for (const sm of stalagmitePositions) {
        if (sm >= COLS) continue;
        const smH = 2 + (sm * 5) % 4;
        const smX = sm * TILE + TILE / 2;
        const smBaseY = (ROWS - 1) * TILE;
        g.fillStyle = (sm * 3) % 2 === 0 ? "#1e2e1e" : "#1a2a1a";
        g.beginPath();
        g.moveTo((smX - 3) * SCALE, smBaseY * SCALE);
        g.lineTo((smX + 3) * SCALE, smBaseY * SCALE);
        g.lineTo((smX) * SCALE, (smBaseY - smH) * SCALE);
        g.closePath();
        g.fill();
        // Highlight
        g.fillStyle = "#2a4a2a";
        g.globalAlpha = 0.25;
        g.beginPath();
        g.moveTo((smX - 1) * SCALE, smBaseY * SCALE);
        g.lineTo((smX + 1) * SCALE, smBaseY * SCALE);
        g.lineTo((smX) * SCALE, (smBaseY - smH) * SCALE);
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
    }

    return c;
})();

// ============================================================
// END PROCEDURAL TEXTURE GENERATION
// ============================================================

// ---- Colors (dark cave palette — bioluminescent greens + lava oranges) ----
// Cave stone: dark gray-greens. Active grid: green energy / orange lava
const PAL = {
    bg:        "#0a0f0a",
    wall:      "#1a2a1a",
    wallTop:   "#1e2e1e",
    floor:     "#0d150d",
    floorAlt:  "#111911",
    gridOff:   "#1a2820",
    gridOn:    ["#44ff44", "#88ee22", "#ee8822", "#ff6611", "#ff4400", "#33dd88"], // per-row colors (O,H,S,K,B,T): green→orange→teal
    gridX:     ["#ff4400", "#331a0a", "#44ff44", "#88ee22", "#44ff44", "#ff4400"], // bright X indicators
    gridBorder:"#2a3a2a",
    playhead:  "#44ff44",
    player:    "#efd8a1",
    playerDark:"#927e6a",
    punch:     "#44ff44",
    punchGlow: "#226622",
    shadow:    "rgba(0,0,0,0.4)",
    startBtn:  "#44ff44",
    stopBtn:   "#661100",
    labelText: "#88cc88",
    titleText: "#44ff44",
};

const DRUM_LABELS = ["OPEN-HH", "HI-HAT", "SNARE", "KICK", "COWBELL", "TOM"];

// ---- Audio Engine (Web Audio API with synthesized drums) ----
let audioCtx = null;

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
}

function playKick(time) {
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.3);
}

function playSnare(time) {
    const ctx = audioCtx;
    // noise burst
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 1000;
    noise.connect(filt);
    filt.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(time);
    // body
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.08);
    oscGain.gain.setValueAtTime(0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.1);
}

function playHihat(time, open) {
    const ctx = audioCtx;
    const bufferSize = ctx.sampleRate * (open ? 0.25 : 0.06);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    const decay = open ? 0.25 : 0.06;
    gain.gain.setValueAtTime(open ? 0.3 : 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = open ? 8000 : 10000;
    filt.Q.value = 1.0;
    noise.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    noise.start(time);
}

function playCowbell(time) {
    const ctx = audioCtx;
    // Two detuned square oscillators for metallic tone
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    osc1.type = "square";
    osc2.type = "square";
    osc1.frequency.value = 560;
    osc2.frequency.value = 845;
    filt.type = "bandpass";
    filt.frequency.value = 800;
    filt.Q.value = 3;
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc1.connect(filt);
    osc2.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(time); osc1.stop(time + 0.15);
    osc2.start(time); osc2.stop(time + 0.15);
}

function playTom(time) {
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.15);
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.25);
}

function playDonk(time) {
    const ctx = audioCtx;
    // Low thud — like bonking a coconut
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.15);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.2);
    // High click on top for the "donk" attack
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(800, time);
    osc2.frequency.exponentialRampToValueAtTime(300, time + 0.05);
    gain2.gain.setValueAtTime(0.15, time);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(time);
    osc2.stop(time + 0.08);
}

function playWarningDonk(time) {
    const ctx = audioCtx;
    // "Dun dun dunnnnn" — three ominous descending notes
    function playNote(freq, start, duration, vol, sustained) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, start);
        if (sustained) {
            // Long sustain then fade for the final "dunnnnn"
            osc.frequency.exponentialRampToValueAtTime(freq * 0.85, start + duration);
            gain.gain.setValueAtTime(vol, start);
            gain.gain.setValueAtTime(vol * 0.8, start + duration * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        } else {
            gain.gain.setValueAtTime(vol, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        }
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
        // Add a sub-bass layer for weight
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = "sine";
        sub.frequency.setValueAtTime(freq * 0.5, start);
        subGain.gain.setValueAtTime(vol * 0.4, start);
        subGain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        sub.connect(subGain);
        subGain.connect(ctx.destination);
        sub.start(start);
        sub.stop(start + duration);
    }
    // Dun (high)
    playNote(220, time, 0.15, 0.4, false);
    // Dun (mid)
    playNote(185, time + 0.18, 0.15, 0.45, false);
    // Dunnnnn (low, sustained)
    playNote(130, time + 0.36, 0.5, 0.5, true);
}

function playSabotageSound(time) {
    const ctx = audioCtx;
    if (!ctx) return;
    // Dissonant buzz: two detuned square waves
    [200, 213].forEach((freq) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, time);
        g.gain.setValueAtTime(0.12, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(time); osc.stop(time + 0.1);
    });
}

function playCatapultLaunch(time) {
    const ctx = audioCtx;
    if (!ctx) return;
    // Low frequency sweep with noise burst
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + 0.2);
    g.gain.setValueAtTime(0.3, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(time); osc.stop(time + 0.25);
    // Creak/wood noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.15, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass"; filt.frequency.value = 400; filt.Q.value = 5;
    noise.connect(filt); filt.connect(ng); ng.connect(ctx.destination);
    noise.start(time);
}

function playCatapultImpact(time) {
    const ctx = audioCtx;
    if (!ctx) return;
    // Deep boom
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(50, time);
    osc.frequency.exponentialRampToValueAtTime(20, time + 0.4);
    g.gain.setValueAtTime(0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(time); osc.stop(time + 0.4);
    // Crash noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 600;
    noise.connect(filt); filt.connect(ng); ng.connect(ctx.destination);
    noise.start(time);
}

function playClang(time) {
    const ctx = audioCtx;
    if (!ctx) return;
    // High metallic ping
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(600, time + 0.1);
    g.gain.setValueAtTime(0.15, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(time); osc.stop(time + 0.12);
    // Second harmonic for metallic quality
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(1200, time);
    g2.gain.setValueAtTime(0.06, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc2.connect(g2); g2.connect(ctx.destination);
    osc2.start(time); osc2.stop(time + 0.08);
}

const drumFns = [
    (t) => playHihat(t, true),   // 0: Open Hat
    (t) => playHihat(t, false),  // 1: Closed Hat
    (t) => playSnare(t),         // 2: Snare
    (t) => playKick(t),          // 3: Kick
    (t) => playCowbell(t),       // 4: Cowbell (Bell)
    (t) => playTom(t),           // 5: Tom
];

// ---- Sequencer State ----
const grid = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(false));
// Starter beat: kick on 1,9 and snare on 5,13 (0-indexed: row 3=kick, row 2=snare)
// Load level 1 starting pattern
if (LEVELS[0] && LEVELS[0].startPattern) {
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            grid[r][c] = LEVELS[0].startPattern[r][c];
}
const playing = true;
let currentStep = 0;
let lastStepTime = 0;

// ---- Kill Counter & Dancers ----
let killCount = 0;
let score = 0;
let lastTimeBonus = 0;
const dancers = [];
const DANCER_PALETTES = [
    { _index: 0, body: "#ef3a0c", dark: "#9b1a0a", head: "#efb775", hair: "#724113" },
    { _index: 1, body: "#3c9f9c", dark: "#276468", head: "#efb775", hair: "#2a1d0d" },
    { _index: 2, body: "#efac28", dark: "#a58c27", head: "#efb775", hair: "#ab5c1c" },
    { _index: 3, body: "#39571c", dark: "#1f240a", head: "#efb775", hair: "#efac28" },
    { _index: 4, body: "#ab5c1c", dark: "#773421", head: "#efb775", hair: "#2a1d0d" },
    { _index: 5, body: "#ef692f", dark: "#a56243", head: "#efb775", hair: "#392a1c" },
];

// ---- Player State ----
const player = {
    x: (GRID_X + 7) * TILE,   // current position (smooth, pixel-level)
    y: (GRID_Y + LEVELS[0].activeRows + 1) * TILE + GRID_Y_OFFSET,
    destX: (GRID_X + 7) * TILE, // movement destination
    destY: (GRID_Y + LEVELS[0].activeRows + 1) * TILE + GRID_Y_OFFSET,
    w: TILE,
    h: TILE,
    dir: 0,        // 0=down, 1=up, 2=left, 3=right
    turnDelay: 0,  // frames to wait after turning before moving
    frame: 0,
    frameTimer: 0,
    attacking: false,
    attackTimer: 0,
    attackDuration: 12,
    punchHit: false, // did this swing already toggle a block?
    speed: 2.0, // pixels per frame at 60fps — snappy tile-to-tile glide
    blinkTimer: 0, // counts up each frame, blinks at 180
};

// ---- Caves (goblin spawn points) ----
const CAVES = [
    { tileX: COLS - 1, tileY: GRID_Y + 3 },   // right wall
    { tileX: Math.floor(COLS / 2), tileY: 0 }, // top wall (moved from bottom)
    { tileX: 0, tileY: GRID_Y + 1 },           // left wall
];

// ---- Multiple Goblin System ----
// Max concurrent goblins scales with level: 1 for L3-9, 2 for L10-19, 3 for L20+
function getMaxGoblins() {
    if (currentLevel < 6) return 2;   // L3-6
    if (currentLevel < 13) return 3;  // L7-13
    if (currentLevel < 19) return 4;  // L14-19
    return 5;                         // L20-30
}

// Sabotage flip chance scales with level (used during level-start scramble)
function getSabotageFlipChance() {
    // Starts at 12%, gradually increases to 30% by level 30
    return 0.12 + (currentLevel / LEVELS.length) * 0.18;
}

// Elite weighting: random chance that increases with level (max 1 elite alive at a time)
function shouldBeElite() {
    if (currentLevel < 6) return false;
    // Only allow one elite goblin at a time
    if (goblins.some(g => !g.dead && g.elite)) return false;
    // Base 25% chance, increases to ~50% by late levels
    const weight = 0.25 + (currentLevel / LEVELS.length) * 0.25;
    return Math.random() < weight;
}

function createGoblin(caveIndex) {
    const cave = CAVES[caveIndex];
    const spawnX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
    const spawnY = cave.tileY === 0 ? TILE * 2 : cave.tileY === ROWS - 1 ? (ROWS - 2) * TILE : cave.tileY * TILE;
    return {
        x: spawnX, y: spawnY,
        destX: spawnX, destY: spawnY,
        w: TILE, h: TILE,
        dir: 0, frame: 0, frameTimer: 0,
        speed: 0.5,
        dead: true,
        respawnTimer: 300,
        respawnDelay: 600,
        spawnCave: caveIndex,
        targetRow: -1, targetCol: -1,
        sabotageTimer: 0,
        moveSteps: 0,
        elite: false,
        hp: 1,
        hurtTimer: 0,
        deathAnimTimer: 0,
        deathAnimActive: false,
        deathAnimElite: false,
    };
}

// Goblins array — up to 5 concurrent goblins
let goblins = [createGoblin(0), createGoblin(2), createGoblin(1), createGoblin(0), createGoblin(2)];
// Backward compat: `goblin` is an alias for goblins[0] (used by legacy rendering code)
let goblin = goblins[0];

// Death particles
let deathParticles = [];
let deathText = null; // {x, y, timer, text, color, scale}
let screenFlash = 0; // white flash frames remaining

// Screen shake & hit freeze (juice)
let hitFreeze = 0;        // frames to skip update() but still render
let screenShake = 0;      // frames of screen shake remaining
let shakeIntensity = 0;   // pixel magnitude of shake offset
let pendingShake = false;  // triggers shake after freeze ends
let pendingShakeElite = false;

// Sabotage flash — per-cell timer for red flash overlay
const cellFlash = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(0));
// ---- Catapult Goblin State ----
let catapultGoblin = null; // null when inactive
let catapultSpawnedThisCycle = false; // prevents re-spawning catapult after it finishes
let catapultSequenceCount = 0; // how many catapults have fired in current sequence (max 3)
// When active: { x, y, destX, destY, dir, frame, frameTimer, speed,
//   phase, phaseTimer, caveIndex, targetRow, targetCol,
//   boulder: null | { startX, startY, targetX, targetY, progress } }

// Tomato projectiles (dancers throw at goblins — purely cosmetic)
let tomatoes = []; // { x, y, targetX, targetY, speed, life }
let tomatoSplats = []; // { x, y, timer }

let gameState = "title"; // "title", "intro", "playing", "gameover", "highscore", "levelcomplete", "enemywarning-intro", "enemywarning", "newinstrument", "sabotage-anim", "cave-return", "minigame", "paused"
let gameMode = "thrill"; // "thrill" = full game with goblins, "chill" = no goblins during gameplay
let pausedFromState = "playing";   // gameState to restore on unpause
let pausedFromMinigame = "none";   // minigameState to restore on unpause

// --- Visual Improvement State ---
// Block toggle animation (pop/glow when punched)
const blockToggleAnim = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(0));
// Beat pulse: tracks which rows triggered on the current step (for string lights + column pulse)
const rowTrigger = new Array(GRID_ROWS).fill(0); // countdown frames per row
// Scene transition effect
let sceneTransition = { active: false, from: null, to: null, progress: 0, duration: 20 };
// Title text entrance/exit animation
let titleEntrancePhase = 0; // frames since title screen entered
let titleFadingOut = false;  // true when transitioning title→intro
let titleFadeTimer = 0;      // frames since fade-out started
const TITLE_FADE_DURATION = 20; // frames for title text to fade out
// Firework system for level complete
let fireworks = []; // { x, y, vx, vy, life, maxLife, color, exploded, particles: [] }
// Screen crack effect for game over
// Enemy warning zoom state
let enemyWarningZoom = 0; // 0→1 zoom-in progress
let enemyWarningType = null;   // "elite" or "catapult"
let enemyWarningShown = { normal: false, elite: false, catapult: false }; // track which warnings have been shown
let enemyWarningBlink = 0;     // blink timer for "PRESS ENTER"
let enemyWarningIntroTimer = 0; // transition timer before warning popup
let currentLevel = 0;
let levelTimer = LEVELS[0].timerSeconds * 90; // countdown in frames (seconds * 90)
let levelComplete = false;
let patternMatched = false; // pattern correct but goblins may still be alive
let levelCelebrateTimer = 0;
let levelCelebrateDisplayScore = 0; // for count-up animation
let titleBlink = 0; // blink timer for "PRESS ENTER"
// Controls overlay — stays visible all of level 1 with per-key light-up on press
let controlsKeyFlash = {};          // per-key flash timers (key code → frames remaining)
// Tutorial hint for level 1 — explains pattern matching objective
let tutorialHintTimer = 0;          // counts up each frame during level 1
let tutorialFirstToggle = false;    // true once player toggles their first cell
let tutorialFirstToggleFrame = 0;   // frame when first toggle happened

// ---- Animated Intro Cutscene State ----
let introScene = 1;         // current scene index (0-3)
let introTimer = 0;         // frame counter within current scene
let introGlobalTimer = 0;   // total frames since intro started
let introBeatStep = 0;      // simulated sequencer step for the intro beat
let introBeatTimer = 0;     // frame counter for beat stepping
let introSkipHeld = 0;      // frames Enter is held for skip
let introKickPump = 0;      // 0-1 speaker pump intensity on kick hits
// Intro earthquake goblins — emerge from caves and flip grid cells
let introGoblins = [];      // [{x, y, destX, destY, dir, frame, frameTimer, caveIdx, targetRow, targetCol, emerged, speed}]
let introGridState = null;  // mutable copy of INTRO_BEAT patterns for goblin flipping
let introGridFlash = null;  // flash timers per cell [row][col]
let introCorruptOrder = [];  // pre-sorted cell coords for Scene 2 progressive corruption
let introCorruptedSoFar = 0; // how many cells Scene 2 has flipped so far
let introBoothDebris = [];   // [{pieceIndex, x, y, vx, vy, landed, carriedBy}] — 6 pieces during explosion
let introDrumGain = null;   // audio gain node for intro drums
let introDrumStarted = false;
let introDrumTimer = null;
// Intro beat pattern (funky groove the DJ is playing)
const INTRO_BEAT = {
    K: [1,0,0,0,1,0,0,1,0,0,1,0,0,0,0,0],
    S: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    H: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    O: [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],
};
const INTRO_SCENE_DURATIONS = [
    420,  // Scene 0: The Good Times (7s)
    480,  // Scene 1 (1A): Earthquake + Caves + Eyes (8s)
    660,  // Scene 2 (1B): Goblin Emergence + Attack + Aftermath (11s)
    420,  // Scene 3: Call to Action — DJ crawls to center + rises (7s)
];
let newInstrumentType = null;   // "cowbell" or "tom"
let newInstrumentTimer = 0;     // animation timer for new instrument popup
let newInstrumentIntroTimer = 0; // transition timer before instrument popup
let newInstrumentShown = { cowbell: false, tom: false }; // track which popups have been shown


// Sabotage animation state (goblin zigzags across grid scrambling cells)
let sabotageAnimTimer = 0;
let sabotageNextState = "playing";
let sabotageCells = [];              // [{r, c, flip: bool}] in zigzag order
let sabotageFlipIndex = 0;
const SABOTAGE_FRAMES_PER_CELL = 2;  // 2 frames/cell at 90fps

// ---- High Score System ----
let highScores = []; // Array of { name: "AAA", score: 0 }, max 5, sorted desc
let initialsEntry = ["A", "A", "A"];
let initialsPos = 0;       // which letter slot is active (0-2)
let initialsBlink = 0;     // blink timer for active letter
let finalScore = 0;        // killCount captured at game over

// ---- Minigame (Cave Beat 'Em Up) State ----
const MINIGAME_LEVELS = [4, 9, 14, 19, 24, 29]; // trigger after levels 5,10,15,20,25,30 (0-indexed)
const MINIGAME_BASE_TIME = 20 * 60; // 20 seconds at 60fps
const CAVE_COLS = 22; // same as world
const CAVE_ROWS = 18;
const CAVE_TILE = TILE;

// DJ Setup pieces earned from minigames (6 total)
const DJ_SETUP_PIECES = [
    "left speaker",
    "right speaker",
    "turntable",
    "mixer",
    "light rig",
    "disco ball",
];
let djSetupEarned = []; // pieces earned so far

// Minigame state
let minigameActive = false;
let minigameTimer = 0; // countdown in frames
let minigameState = "none"; // "none", "kidnap", "instructions", "playing", "rescue", "reward"
let minigameInstructionsTimer = 0;
let minigameKidnapTimer = 0;
let minigameKidnapPhase = 0; // 0=goblins appear, 1=flank DJ, 2=escort to cave
let minigameRescueTimer = 0;
let minigameRescuePhase = 0; // 0=wall bursts, 1=dancers enter, 2=celebration
let minigameRewardTimer = 0;
let allPiecesJustCompleted = false;
let minigamePendingAfterLevel = -1; // which level triggered the minigame

// ---- Ending Scene State ----
let endingPhase = 0;           // 0=rebuild, 1=first beat, 2=crowd, 3=missing, 4=cave rave, 5=score
let endingTimer = 0;           // frame counter within current phase
let endingGlobalTimer = 0;     // total frames since ending started
let endingPiecesPlaced = 0;    // 0-6, tracks which pieces have landed on booth
let endingDJX = 0;             // DJ position during ending
let endingDJY = 0;
let endingDancers = [];        // surface dancers for phases 0-3
let endingCavePartygoers = []; // mixed dancers + goblins for cave rave
let endingKickPump = 0;        // speaker pump animation
let endingBeatStep = 0;        // sequencer step for ending beat
let endingBeatTimer = 0;       // frame counter for beat stepping
let endingDrumGain = null;
let endingDrumStarted = false;
let endingDrumTimer = null;

// Cave arena entities
let caveGoblins = []; // goblins in the cave arena
let caveBoulders = []; // active boulders from catapult goblins
let caveCatapult = null; // catapult goblin in cave
let caveClockPickups = []; // +5s clock pickups dropped by elite kills
let caveDeathParticles = [];
let caveDeathText = null;
let caveScreenShake = 0;
let caveShakeIntensity = 0;
let caveHitFreeze = 0;
let cavePendingShake = false;
let caveScreenFlash = 0;
let caveBoulderImpacts = []; // dust cloud rings from boulder landings
let caveKillCount = 0;
let caveCatapultKillCount = 0; // kills toward next catapult spawn

// Cave player state (reuses main player object but with cave-specific position)
let cavePlayerDead = false;

// Boarded-up cave entrances state (top wall)
let caveBoardedUp = false; // true after goblins board up the entrances
let boardedEntrances = []; // {x, w} positions of the 3 boarded openings at top
let boardProgress = 0; // 0→1 during boarding animation
let rescueWallCracks = []; // generated crack lines (now on boarded entrances)
let rescueWallDust = []; // dust particles falling from boards
let rescueWallProgress = 0; // 0→1 based on timer progress

// Boarding phase state
let boardingGoblins = []; // goblins that nail boards
let boardingTimer = 0;
let boardingPhase = 0;

// Rescue board-breaking state
let rescueBoardBreakPhase = 0;
let rescueBrokenEntrances = [false, false, false];

// Kidnap cutscene positions
let kidnapGoblin1 = { x: 0, y: 0, dir: 0, frame: 0, frameTimer: 0 };
let kidnapGoblin2 = { x: 0, y: 0, dir: 0, frame: 0, frameTimer: 0 };
let kidnapDJPos = { x: 0, y: 0 };
let kidnapTargetY = 0; // y position of the cave entrance

// Rescue dancers with torches
let rescueDancers = [];

// Track which minigames have been completed (prevent re-triggering)
let minigamesCompleted = [];

// Cave-return animation state (dancers + DJ emerge from top cave after rescue)
let caveReturnTimer = 0;
let caveReturnPhase = 0; // 0=dancers emerge, 1=DJ emerges, 2=done
let caveReturnDancerCount = 0; // how many dancers have been spawned so far
let caveReturnDJVisible = false;

// Minigame music state
let minigameMusicGain = null;
let minigameMusicOscs = [];
let minigameMusicInterval = null;

function loadHighScores() {
    try {
        const data = JSON.parse(localStorage.getItem("grooveGoblinsHighScores"));
        if (Array.isArray(data)) highScores = data.slice(0, 5);
        else highScores = [];
    } catch (e) { highScores = []; }
}

function saveHighScores() {
    localStorage.setItem("grooveGoblinsHighScores", JSON.stringify(highScores));
}

function scoreQualifies(score) {
    return score > 0 && (highScores.length < 5 || score > highScores[highScores.length - 1].score);
}

function enterHighScoreState() {
    gameState = "highscore";
    initialsEntry = ["A", "A", "A"];
    initialsPos = 0;
    initialsBlink = 0;
    startStoryDrums();
}

function confirmHighScore() {
    stopStoryDrums();
    const name = initialsEntry.join("");
    highScores.push({ name: name, score: finalScore });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > 5) highScores.length = 5;
    saveHighScores();
    resetGame();
    gameState = "title";
    startTitleDrums();
}


// ---- Pixel-art digit bitmaps (3 wide × 5 tall) ----
const DIGIT_BITMAPS = [
    [0b111, 0b101, 0b101, 0b101, 0b111], // 0
    [0b010, 0b110, 0b010, 0b010, 0b111], // 1
    [0b111, 0b001, 0b111, 0b100, 0b111], // 2
    [0b111, 0b001, 0b111, 0b001, 0b111], // 3
    [0b101, 0b101, 0b111, 0b001, 0b001], // 4
    [0b111, 0b100, 0b111, 0b001, 0b111], // 5
    [0b111, 0b100, 0b111, 0b101, 0b111], // 6
    [0b111, 0b001, 0b010, 0b010, 0b010], // 7
    [0b111, 0b101, 0b111, 0b101, 0b111], // 8
    [0b111, 0b101, 0b111, 0b001, 0b111], // 9
];

function drawPixelDigits(num, cx, cy, color, pixelSize) {
    const str = String(num);
    const digitW = 3 * pixelSize + pixelSize; // digit width + spacing
    const totalW = str.length * digitW - pixelSize; // no trailing space
    let startX = cx - totalW / 2;
    for (let d = 0; d < str.length; d++) {
        const bitmap = DIGIT_BITMAPS[parseInt(str[d])];
        const dx = startX + d * digitW;
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 3; col++) {
                if (bitmap[row] & (1 << (2 - col))) {
                    drawRect(dx + col * pixelSize, cy + row * pixelSize, pixelSize, pixelSize, color);
                }
            }
        }
    }
}

// ---- Input ----
// Check for pending feature screens (instruments, enemy warnings) at level transitions.
// Returns true if a screen was shown (caller should return), false if nothing pending.
function checkPendingFeatureScreens() {
    const nextLevel = currentLevel + 1;
    if (nextLevel >= LEVELS.length) return false;
    const prevRows = LEVELS[currentLevel].activeRows;
    const newRows = LEVELS[nextLevel].activeRows;

    // New instrument screens
    if (newRows > prevRows && newRows === 5 && !newInstrumentShown.cowbell) {
        newInstrumentType = "cowbell";
        newInstrumentShown.cowbell = true;
        newInstrumentTimer = 0;
        gameState = "newinstrument";
        startStoryDrums();
        return true;
    }
    if (newRows > prevRows && newRows === 6 && !newInstrumentShown.tom) {
        newInstrumentType = "tom";
        newInstrumentShown.tom = true;
        newInstrumentTimer = 0;
        gameState = "newinstrument";
        startStoryDrums();
        return true;
    }

    // Enemy warning screens (skip in chill mode — no goblins)
    if (gameMode === "chill") return false; // new instruments already handled above
    if (nextLevel === 2 && !enemyWarningShown.normal) {
        enemyWarningType = "normal";
        enemyWarningShown.normal = true;
        enemyWarningBlink = 0;
        enemyWarningIntroTimer = 0;
        gameState = "enemywarning-intro";
        startStoryDrums();
        if (audioCtx) playWarningDonk(audioCtx.currentTime);
        return true;
    }
    if (nextLevel === 6 && !enemyWarningShown.elite) {
        enemyWarningType = "elite";
        enemyWarningShown.elite = true;
        enemyWarningBlink = 0;
        enemyWarningIntroTimer = 0;
        gameState = "enemywarning-intro";
        startStoryDrums();
        if (audioCtx) playWarningDonk(audioCtx.currentTime);
        return true;
    }
    if (nextLevel === 14 && !enemyWarningShown.catapult) {
        enemyWarningType = "catapult";
        enemyWarningShown.catapult = true;
        enemyWarningBlink = 0;
        enemyWarningIntroTimer = 0;
        gameState = "enemywarning-intro";
        startStoryDrums();
        if (audioCtx) playWarningDonk(audioCtx.currentTime);
        return true;
    }

    return false;
}

const keys = {};
let spaceJustPressed = false;

// Debug level skip: type "$levelNN" (e.g. "$level01") at any time
let cheatBuffer = "";
let cheatTimer = 0;
function handleCheatCode(key) {
    // Reset buffer if too much time passes between keystrokes
    const now = performance.now();
    if (now - cheatTimer > 2000) cheatBuffer = "";
    cheatTimer = now;

    cheatBuffer += key.toLowerCase();
    // Keep buffer trimmed to max expected length ("$level" + 2 digits = 8)
    if (cheatBuffer.length > 8) cheatBuffer = cheatBuffer.slice(-8);

    const match = cheatBuffer.match(/\$level(\d{2})$/);
    if (match) {
        const targetLevel = parseInt(match[1], 10) - 1; // $level01 = index 0
        if (targetLevel >= 0 && targetLevel < LEVELS.length) {
            cheatBuffer = "";
            // Reset game state cleanly then jump to target level
            resetGame();
            currentLevel = targetLevel;
            // Load the correct starting pattern for this level
            const startPat = targetLevel === 0 ? LEVELS[0].startPattern
                : LEVELS[targetLevel - 1].pattern;
            if (startPat) {
                for (let r = 0; r < GRID_ROWS; r++)
                    for (let c = 0; c < GRID_COLS; c++)
                        grid[r][c] = startPat[r][c];
            }
            levelTimer = LEVELS[currentLevel].timerSeconds * 90;
            player.y = (gridBottomTileY() + 1) * TILE + GRID_Y_OFFSET;
            player.destY = player.y;
            setLevelTempo(currentLevel);
            ensureAudio();
            gameState = "playing";
            lastStepTime = performance.now();
            console.log("DEBUG: Jumped to level " + (targetLevel + 1));
        }
    }
}

window.addEventListener("keydown", (e) => {
    // Feed single-char keys into cheat code buffer
    if (e.key.length === 1) handleCheatCode(e.key);

    if (e.code === "Space") {
        e.preventDefault();
        if (gameState === "enemywarning" || gameState === "enemywarning-intro") return; // ignore Space on warning screen
        if (gameState === "newinstrument") return; // ignore Space on instrument screen
        if (gameState === "sabotage-anim" || gameState === "cave-return") return; // ignore input during animations
        if (minigameState === "kidnap" || minigameState === "boarding" || minigameState === "rescue" || minigameState === "reward") return; // ignore during minigame cutscenes
        if (!keys[e.code]) spaceJustPressed = true; // only on initial press
    }
    keys[e.code] = true;

    // Controls overlay: flash key indicators on press during level 1
    if (gameState === "playing" && currentLevel === 0) {
        const flashKeys = {
            "ArrowUp": "UP", "ArrowDown": "DOWN", "ArrowLeft": "LEFT", "ArrowRight": "RIGHT",
            "KeyW": "UP", "KeyS": "DOWN", "KeyA": "LEFT", "KeyD": "RIGHT",
            "Space": "SPACE"
        };
        if (flashKeys[e.code]) controlsKeyFlash[flashKeys[e.code]] = 10;
    }

    // Pause toggle (Escape key during gameplay or minigame)
    if (e.code === "Escape") {
        if (gameState === "paused") {
            gameState = pausedFromState;
            if (pausedFromMinigame !== "none") minigameState = pausedFromMinigame;
            return;
        } else if (gameState === "playing" || (gameState === "minigame" && minigameState === "playing")) {
            pausedFromState = gameState;
            pausedFromMinigame = gameState === "minigame" ? minigameState : "none";
            gameState = "paused";
            return;
        }
    }

    // High score initials entry input
    if (gameState === "highscore") {
        e.preventDefault();
        if (e.code === "ArrowUp" || e.code === "KeyW") {
            const c = initialsEntry[initialsPos].charCodeAt(0);
            initialsEntry[initialsPos] = String.fromCharCode(c >= 90 ? 65 : c + 1); // A-Z wrap
        } else if (e.code === "ArrowDown" || e.code === "KeyS") {
            const c = initialsEntry[initialsPos].charCodeAt(0);
            initialsEntry[initialsPos] = String.fromCharCode(c <= 65 ? 90 : c - 1); // Z-A wrap
        } else if (e.code === "Enter") {
            if (initialsPos < 2) {
                initialsPos++; // lock in letter, move to next
            } else {
                confirmHighScore(); // all 3 locked, submit
            }
        }
        return;
    }

    // Ending scene input
    if (gameState === "ending" && e.code === "Enter") {
        if (endingPhase === 5 && endingTimer > 90) {
            stopEndingDrums();
            if (scoreQualifies(finalScore)) {
                enterHighScoreState();
            } else {
                resetGame();
                gameState = "title";
                startTitleDrums();
            }
        }
        return;
    }

    // Toggle game mode on title screen with left/right arrows
    if (gameState === "title" && !titleFadingOut) {
        if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
            gameMode = gameMode === "thrill" ? "chill" : "thrill";
        }
    }

    if (e.code === "Enter") {
        e.preventDefault();
        if (gameState === "sabotage-anim" || gameState === "cave-return") return; // ignore input during animations
        if (minigameState === "kidnap" || minigameState === "boarding") return; // no skipping kidnap/boarding cutscene
        const rewardDismissThreshold = allPiecesJustCompleted ? 180 : 140;
        if (minigameState === "reward" && minigameRewardTimer > rewardDismissThreshold) {
            // Player dismisses reward screen — continue to next level
            endMinigame();
            return;
        }
        if (minigameState === "reward") return; // let reward play
        if (gameState === "enemywarning") {
            // Check if there's another warning or instrument screen queued
            sceneTransition = { active: true, from: "enemywarning", to: "playing", progress: 0, duration: 18 };
            if (checkPendingFeatureScreens()) return;
            advanceLevel();
            return;
        }
        if (gameState === "newinstrument") {
            // Check if there's an enemy warning queued for the next level
            sceneTransition = { active: true, from: "newinstrument", to: "playing", progress: 0, duration: 18 };
            if (checkPendingFeatureScreens()) return;
            advanceLevel();
            return;
        }
        if (gameState === "title") {
            if (titleFadingOut) return; // already transitioning
            ensureAudio();
            if (gameMode === "chill") {
                // Chill mode: skip the goblin intro cutscene — go straight to playing
                stopTitleDrums();
                resetGame();
                spawnDancers(6);
                gameState = "playing";
                sceneTransition = { active: true, from: "title", to: "playing", progress: 0, duration: 20 };
                return;
            }
            // Start fading title text — state change happens when fade completes
            titleFadingOut = true;
            titleFadeTimer = 0;
            return;
        }
        if (gameState === "intro") {
            // Advance to next scene (or finish intro if on last scene)
            advanceIntroScene();
            return;
        }
        if (gameState === "levelcomplete" && levelCelebrateTimer > 120) {
            // Check if this is a minigame milestone level (not already completed)
            if (MINIGAME_LEVELS.includes(currentLevel) && !minigamesCompleted.includes(currentLevel)) {
                startMinigameKidnap();
                return;
            }
            // Show all feature screens (instruments + enemy warnings) before advancing
            if (checkPendingFeatureScreens()) return;
            advanceLevel();
            return;
        }
        if (gameState === "levelcomplete") return; // let celebration play
        if (gameState === "gameover" && gameOverTimer > 180) {
            // Let player skip the rest of the sad song
            if (scoreQualifies(finalScore)) {
                enterHighScoreState();
            } else {
                resetGame();
                gameState = "title";
                startTitleDrums();
            }
            return;
        }
        if (gameState === "gameover") return; // let the cinematic play
        if (gameState === "minigame") return;
    }
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

// ---- Helper: get punch hitbox ----
function getPunchBox() {
    const p = player;
    const px = p.x, py = p.y;
    const sw = 6, sh = 14;
    const progress = 1 - (p.attackTimer / p.attackDuration);
    switch (p.dir) {
        case 0: return { x: px - 1, y: py + p.h - 2, w: sh, h: sw + 4 };
        case 1: return { x: px - 1, y: py - sw - 4, w: sh, h: sw + 4 };
        case 2: return { x: px - sw - 6, y: py, w: sw + 6, h: sh };
        case 3: return { x: px + p.w, y: py, w: sw + 6, h: sh };
    }
}

// ---- Helper: active rows for current level ----
function getActiveRows() {
    return currentLevel < LEVELS.length ? LEVELS[currentLevel].activeRows : 6;
}

// ---- Helper: pixel Y for a grid row ----
function rowPixelY(r) {
    return (GRID_Y + r) * TILE + GRID_Y_OFFSET;
}

// ---- Helper: tile Y of the bottom of the active grid ----
function gridBottomTileY() {
    return GRID_Y + getActiveRows();
}

// ---- Helper: convert tile Y back to grid row (inverse of rowPixelY) ----
function tileYToRow(tileY) {
    return tileY - GRID_Y - Math.round(GRID_Y_OFFSET / TILE);
}

// ---- Helper: check if a tile is occupied by a dancer ----
function isTileOccupiedByDancer(tileX, tileY) {
    for (const d of dancers) {
        const dx = Math.round(d.x / TILE);
        const dy = Math.round(d.y / TILE);
        if (tileX === dx && tileY === dy) return true;
    }
    return false;
}

// ---- Helper: AABB collision ----
function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---- Helper: spawn dancer fans from the edges ----
function spawnDancers(count) {
    const edges = [0, 1, 2]; // left, right, bottom
    for (let i = edges.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [edges[i], edges[j]] = [edges[j], edges[i]];
    }
    // Build list of occupied zones (check pixel proximity, not just tile)
    const occupiedPositions = [];
    for (const dd of dancers) {
        occupiedPositions.push({
            x: dd.targetX ?? dd.x,
            y: dd.targetY ?? dd.y
        });
    }
    const MIN_DIST = 14; // minimum pixel distance between dancer targets
    for (let di = 0; di < count; di++) {
        const palette = DANCER_PALETTES[dancers.length % DANCER_PALETTES.length];
        // Dancer area: rows 11-16, cols 2-17, with sub-tile pixel offsets
        const minPxX = 2 * TILE + 2;
        const maxPxX = (COLS - 3) * TILE - 2;
        const minPxY = 11 * TILE;
        const maxPxY = (ROWS - 1) * TILE - TILE;
        let targetX, targetY, attempts = 0;
        let valid = false;
        do {
            // Random pixel position within the dancer area (not grid-locked)
            targetX = minPxX + Math.random() * (maxPxX - minPxX);
            targetY = minPxY + Math.random() * (maxPxY - minPxY);
            // Round to nearest pixel (not tile)
            targetX = Math.round(targetX);
            targetY = Math.round(targetY);
            const tileX = Math.floor(targetX / TILE);
            const tileY = Math.floor(targetY / TILE);
            attempts++;
            // Check distance from other dancers
            const tooClose = occupiedPositions.some(p =>
                Math.abs(p.x - targetX) < MIN_DIST && Math.abs(p.y - targetY) < MIN_DIST
            );
            // Check cave proximity
            const nearCave = CAVES.some(c =>
                Math.abs(c.tileX - tileX) <= 1 && Math.abs(c.tileY - tileY) <= 1
            );
            valid = !tooClose && !nearCave;
        } while (!valid && attempts < 80);
        if (!valid) continue; // skip this dancer if no valid spot found
        occupiedPositions.push({ x: targetX, y: targetY });
        const edge = edges[di % edges.length];
        let startX, startY;
        if (edge === 0) { startX = -TILE; startY = targetY; }
        else if (edge === 1) { startX = COLS * TILE; startY = targetY; }
        else { startX = targetX; startY = ROWS * TILE; }
        dancers.push({
            x: startX, y: startY,
            targetX: targetX, targetY: targetY,
            walkingIn: true,
            palette: palette,
            phase: Math.floor(Math.random() * 16),
        });
    }
}

// ---- Helper: get block rect for grid cell ----
function getBlockRect(row, col) {
    return {
        x: (GRID_X + col) * TILE,
        y: rowPixelY(row),
        w: TILE,
        h: TILE,
    };
}

// ---- Sequencer tick (extracted so it can run during sabotage-anim too) ----
function tickSequencer() {
    if (playing) {
        if (!lastStepTime) lastStepTime = performance.now();
        const now = performance.now();
        const elapsed = now - lastStepTime;
        if (elapsed > stepMs * 2) {
            lastStepTime = now;
        }
        if (now - lastStepTime >= stepMs) {
            lastStepTime = now;
            ensureAudio();
            const t = audioCtx ? audioCtx.currentTime : 0;
            if (audioCtx) {
                const ar = getActiveRows();
                for (let r = 0; r < ar; r++) {
                    if (grid[r][currentStep]) {
                        drumFns[r](t);
                        rowTrigger[r] = 8; // pulse for 8 frames
                    }
                }
            }
            currentStep = (currentStep + 1) % GRID_COLS;
        }
    }
}

// ---- Update ----
function update(dt) {
    // Controls overlay — decay per-key flash timers
    for (const k in controlsKeyFlash) {
        if (controlsKeyFlash[k] > 0) controlsKeyFlash[k]--;
    }

    // Decay visual effect timers
    for (let r = 0; r < GRID_ROWS; r++) {
        if (rowTrigger[r] > 0) rowTrigger[r]--;
        for (let c = 0; c < GRID_COLS; c++) {
            if (blockToggleAnim[r][c] > 0) blockToggleAnim[r][c]--;
        }
    }

    // Level countdown timer
    if (levelTimer > 0) {
        levelTimer--;
        if (levelTimer <= 0) {
            triggerGameOver();
            return;
        }
    }

    // Hit freeze: skip update but keep rendering for dramatic pause
    if (hitFreeze > 0) {
        hitFreeze--;
        if (hitFreeze === 0 && pendingShake) {
            screenShake = pendingShakeElite ? 10 : 6;
            shakeIntensity = pendingShakeElite ? 4 : 2;
            pendingShake = false;
        }
        return;
    }

    // Decrement screen shake
    if (screenShake > 0) screenShake--;

    const p = player;

    // Boulder launch animation — skip all player input during flight
    if (playerLaunch.active) {
        playerLaunch.timer++;
        if (playerLaunch.timer >= playerLaunch.duration) {
            // Landing — snap to destination and resume control
            playerLaunch.active = false;
            p.x = playerLaunch.endX;
            p.y = playerLaunch.endY;
            p.destX = p.x;
            p.destY = p.y;
            p.attacking = false;
            p.attackTimer = 0;
            screenShake = 6;
            shakeIntensity = 3;
            // Dust particles on landing
            for (let i = 0; i < 10; i++) {
                deathParticles.push({
                    x: p.x + p.w / 2, y: p.y + p.h,
                    vx: (Math.random() - 0.5) * 2.5,
                    vy: -Math.random() * 1.5,
                    life: 15 + Math.random() * 15,
                    color: Math.random() > 0.5 ? "#8B7355" : "#6B5335",
                    size: 2 + Math.random() * 2,
                    sparkle: false,
                });
            }
        }
        spaceJustPressed = false;
        // Still update goblins/sequencer during flight (skip to goblin update below)
    }

    // Attack (single press only) — skip during boulder launch
    if (!playerLaunch.active && spaceJustPressed && !p.attacking) {
        p.attacking = true;
        p.attackTimer = p.attackDuration;
        p.punchHit = false;
        ensureAudio();
        // play a punchy impact sound
        if (audioCtx) {
            const now = audioCtx.currentTime;
            // Low thump
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
            g.gain.setValueAtTime(0.15, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(g); g.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.1);
            // Noise burst for impact texture
            const bufLen = audioCtx.sampleRate * 0.04;
            const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
            const noise = audioCtx.createBufferSource();
            noise.buffer = buf;
            const ng = audioCtx.createGain();
            ng.gain.setValueAtTime(0.06, now);
            ng.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            noise.connect(ng); ng.connect(audioCtx.destination);
            noise.start(now); noise.stop(now + 0.04);
        }

        // Determine target tile directly in front of player
        const playerTileX = Math.round(p.x / TILE);
        const playerTileY = Math.round(p.y / TILE);
        let targetTileX = playerTileX, targetTileY = playerTileY;
        switch (p.dir) {
            case 0: targetTileY += 1; break; // down
            case 1: targetTileY -= 1; break; // up
            case 2: targetTileX -= 1; break; // left
            case 3: targetTileX += 1; break; // right
        }
        const col = targetTileX - GRID_X;
        const row = tileYToRow(targetTileY);

        // Check goblin hit first — if we hit a goblin, skip block toggle
        const punchBox = getPunchBox();
        let hitAnyGoblin = false;
        for (const hitGob of goblins) {
            const gobBox = { x: hitGob.x, y: hitGob.y, w: hitGob.w, h: hitGob.h };
            if (!hitGob.dead && aabb(punchBox, gobBox)) {
                hitAnyGoblin = true;
                p.punchHit = true;
                hitGob.hp--;

                if (hitGob.hp > 0) {
                    hitGob.hurtTimer = 12;
                    const baseSpd = currentLevel < LEVELS.length ? LEVELS[currentLevel].goblinSpeed : 0.5;
                    hitGob.speed = baseSpd * (hitGob.hp === 2 ? 1.3 : 1.4);

                    hitFreeze = 2;
                    pendingShake = true;
                    pendingShakeElite = false;

                    const knockDx = gobTileX - Math.round(p.x / TILE);
                    const knockDy = gobTileY - Math.round(p.y / TILE);
                    const knockX = hitGob.x + Math.sign(knockDx) * TILE;
                    const knockY = hitGob.y + Math.sign(knockDy) * TILE;
                    hitGob.destX = Math.max(TILE, Math.min((COLS - 2) * TILE, knockX));
                    hitGob.destY = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, knockY));

                    for (let i = 0; i < 8; i++) {
                        deathParticles.push({
                            x: hitGob.x + hitGob.w / 2,
                            y: hitGob.y + hitGob.h / 2,
                            vx: (Math.random() - 0.5) * 2,
                            vy: (Math.random() - 0.5) * 2 - 0.5,
                            life: 15 + Math.random() * 15,
                            color: hitGob.hp === 2 ? "#FF00FF" : "#39FF14",
                            size: 2 + Math.random() * 2,
                            sparkle: false,
                        });
                    }

                    const owTexts = ["OW MY SPLEEN!", "OW MY WEENIS!", "OW MY SKULL!", "OW MY FACE!", "OW MY EVERYTHING!"];
                    const ht = owTexts[Math.floor(Math.random() * owTexts.length)];
                    const htCol = hitGob.hp === 2 ? "#FF88FF" : "#88FF88";
                    deathText = { x: hitGob.x - 20, y: hitGob.y - 8, timer: 40, text: ht, color: htCol, scale: 4 };

                    if (audioCtx) {
                        const now = audioCtx.currentTime;
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = "square";
                        const startFreq = hitGob.hp === 2 ? 500 : 700;
                        osc.frequency.setValueAtTime(startFreq, now);
                        osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
                        gain.gain.setValueAtTime(0.12, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                        osc.connect(gain); gain.connect(audioCtx.destination);
                        osc.start(now); osc.stop(now + 0.15);
                    }
                } else {
                    // Lethal hit — start poof animation, then full death
                    const wasElite = hitGob.elite;
                    hitGob.deathAnimActive = true;
                    hitGob.deathAnimTimer = 24;
                    hitGob.deathAnimElite = wasElite;
                    hitGob.dead = true;
                    hitGob.respawnTimer = 600;

                    const deathOwTexts = ["OW MY SPLEEN!", "OW MY WEENIS!", "OW MY SKULL!", "OW MY FACE!", "OW MY EVERYTHING!"];
                    const deathOw = deathOwTexts[Math.floor(Math.random() * deathOwTexts.length)];
                    deathText = wasElite
                        ? { x: hitGob.x - 40, y: hitGob.y - 12, timer: 120, text: "bro why you gotta stab me?", color: "#00FFFF", scale: 4 }
                        : { x: hitGob.x - 20, y: hitGob.y - 8, timer: 60, text: deathOw, color: "#FF0044", scale: 5 };

                    if (wasElite) screenFlash = 15;

                    hitFreeze = wasElite ? 5 : 3;
                    pendingShake = true;
                    pendingShakeElite = wasElite;

                    if (audioCtx) {
                        const now = audioCtx.currentTime;
                        if (wasElite) {
                            const notes = [523, 659, 784, 988, 1047, 1319, 1568, 1976, 2093];
                            notes.forEach((freq, i) => {
                                const osc = audioCtx.createOscillator();
                                const gain = audioCtx.createGain();
                                osc.type = "triangle";
                                osc.frequency.setValueAtTime(freq, now + i * 0.07);
                                gain.gain.setValueAtTime(0.15 - i * 0.015, now + i * 0.07);
                                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.35);
                                osc.connect(gain); gain.connect(audioCtx.destination);
                                osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.35);
                            });
                            const shimmer = audioCtx.createOscillator();
                            const sg = audioCtx.createGain();
                            shimmer.type = "sine";
                            shimmer.frequency.setValueAtTime(2093, now + 0.49);
                            shimmer.frequency.linearRampToValueAtTime(2637, now + 0.8);
                            sg.gain.setValueAtTime(0.08, now + 0.49);
                            sg.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
                            shimmer.connect(sg); sg.connect(audioCtx.destination);
                            shimmer.start(now + 0.49); shimmer.stop(now + 1.0);
                            [523, 659, 784].forEach((freq) => {
                                const osc = audioCtx.createOscillator();
                                const gain = audioCtx.createGain();
                                osc.type = "triangle";
                                osc.frequency.setValueAtTime(freq, now + 0.49);
                                gain.gain.setValueAtTime(0.06, now + 0.49);
                                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
                                osc.connect(gain); gain.connect(audioCtx.destination);
                                osc.start(now + 0.49); osc.stop(now + 1.2);
                            });
                        } else {
                            const osc = audioCtx.createOscillator();
                            const gain = audioCtx.createGain();
                            osc.type = "square";
                            osc.frequency.setValueAtTime(600, now);
                            osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
                            gain.gain.setValueAtTime(0.15, now);
                            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                            osc.connect(gain); gain.connect(audioCtx.destination);
                            osc.start(now); osc.stop(now + 0.3);
                        }
                    }

                    killCount++;
                    score += hitGob.elite ? 150 : 50;
                    catapultSpawnedThisCycle = false;

                    if (patternMatched && !areGoblinsAlive()) {
                        triggerLevelComplete();
                    }
                } // end else (lethal hit)
                break; // only hit one goblin per attack
            }
        }

        // Check catapult goblin hit — invincible! Clang + knockback
        if (catapultGoblin) {
            const cgBox = { x: catapultGoblin.x, y: catapultGoblin.y, w: catapultGoblin.w, h: catapultGoblin.h };
            if (aabb(punchBox, cgBox)) {
                p.punchHit = true;
                ensureAudio();
                if (audioCtx) playClang(audioCtx.currentTime);
                // Spark particles
                for (let i = 0; i < 8; i++) {
                    deathParticles.push({
                        x: catapultGoblin.x + catapultGoblin.w / 2,
                        y: catapultGoblin.y + catapultGoblin.h / 2,
                        vx: (Math.random() - 0.5) * 4,
                        vy: (Math.random() - 0.5) * 4 - 1,
                        life: 10 + Math.random() * 10,
                        color: Math.random() > 0.5 ? "#00FFFF" : "#ffffff",
                        size: 1 + Math.random() * 2,
                        sparkle: true,
                    });
                }
                // Knockback player 2 tiles away from catapult goblin
                const dx = p.x - catapultGoblin.x;
                const dy = p.y - catapultGoblin.y;
                const kbDirX = Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0;
                const kbDirY = Math.abs(dx) >= Math.abs(dy) ? 0 : Math.sign(dy);
                // Try 2 tiles back, fall back to 1, fall back to none
                let kbDist = 0;
                for (let d = 2; d >= 1; d--) {
                    let tryX = p.x + kbDirX * d * TILE;
                    let tryY = p.y + kbDirY * d * TILE;
                    tryX = Math.max(TILE, Math.min((COLS - 2) * TILE, tryX));
                    tryY = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, tryY));
                    const ttx = Math.round(tryX / TILE);
                    const tty = Math.round(tryY / TILE);
                    let gobBlocked = false;
                    for (const gg of goblins) {
                        if (!gg.dead && tryX === Math.round(gg.x / TILE) * TILE && tryY === Math.round(gg.y / TILE) * TILE) {
                            gobBlocked = true; break;
                        }
                    }
                    const blocked = isTileOccupiedByDancer(ttx, tty)
                        || gobBlocked;
                    if (!blocked) { kbDist = d; break; }
                }
                if (kbDist > 0) {
                    let kbX = p.x + kbDirX * kbDist * TILE;
                    let kbY = p.y + kbDirY * kbDist * TILE;
                    kbX = Math.max(TILE, Math.min((COLS - 2) * TILE, kbX));
                    kbY = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, kbY));
                    p.destX = kbX;
                    p.destY = kbY;
                }
                // Screen shake for impact feel
                screenShake = 8;
                shakeIntensity = 3;
                // "WHAT THE...?" floating text above player
                deathText = { x: p.x - 16, y: p.y - 14, timer: 50, text: "WHAT THE...?", color: "#FFFFFF", scale: 3 };
            }
        }

        // Check dancer hit — donk + knockback one tile
        for (const d of dancers) {
            const dTileX = Math.round(d.x / TILE);
            const dTileY = Math.round(d.y / TILE);
            if (targetTileX === dTileX && targetTileY === dTileY) {
                p.punchHit = true;
                if (audioCtx) {
                    playDonk(audioCtx.currentTime);
                }
                // Knock dancer back one tile away from player
                const knockDx = dTileX - Math.round(p.x / TILE);
                const knockDy = dTileY - Math.round(p.y / TILE);
                const newX = d.x + Math.sign(knockDx) * TILE;
                const newY = d.y + Math.sign(knockDy) * TILE;
                const clampedX = Math.max(TILE, Math.min((COLS - 2) * TILE, newX));
                const clampedY = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, newY));
                d.targetX = clampedX;
                d.targetY = clampedY;
                d.walkingIn = true;
                break;
            }
        }

        // Toggle block only if no goblin was hit
        if (!hitAnyGoblin && row >= 0 && row < getActiveRows() && col >= 0 && col < GRID_COLS) {
            grid[row][col] = !grid[row][col];
            blockToggleAnim[row][col] = 12; // trigger pop animation
            if (currentLevel === 0 && !tutorialFirstToggle) {
                tutorialFirstToggle = true;
                tutorialFirstToggleFrame = tutorialHintTimer;
            }
            p.punchHit = true;
            // play a toggle blip
            if (audioCtx) {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = "square";
                osc.frequency.value = grid[row][col] ? 880 : 440;
                g.gain.setValueAtTime(0.1, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                osc.connect(g); g.connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.06);
            }
            // Check if level pattern is now complete
            tryCompleteLevelOrWait();
        }
    }
    spaceJustPressed = false;

    if (p.attacking) {
        p.attackTimer--;
        if (p.attackTimer <= 0) p.attacking = false;
    }

    // Movement (smooth pixel-by-pixel, destination-based) — skip during boulder launch
    const atDest = Math.abs(p.x - p.destX) < 0.5 && Math.abs(p.y - p.destY) < 0.5;

    if (!playerLaunch.active && atDest && !p.attacking) {
        // Snap to destination
        p.x = p.destX;
        p.y = p.destY;

        let wantDir = -1;
        if (keys["ArrowLeft"]  || keys["KeyA"])  wantDir = 2;
        else if (keys["ArrowRight"] || keys["KeyD"]) wantDir = 3;
        else if (keys["ArrowUp"]    || keys["KeyW"]) wantDir = 1;
        else if (keys["ArrowDown"]  || keys["KeyS"]) wantDir = 0;

        if (wantDir >= 0) {
            if (p.dir !== wantDir) {
                // Turn only, don't move
                p.dir = wantDir;
                p.turnDelay = 3;
            } else if (p.turnDelay > 0) {
                // Wait after turning before allowing movement
                p.turnDelay--;
            } else {
            // Already facing this way — move one tile
            let nx = p.x, ny = p.y;
            switch (wantDir) {
                case 0: ny = Math.min((ROWS - 2) * TILE, p.y + TILE); break;
                case 1: ny = Math.max(TILE * 2, p.y - TILE); break;
                case 2: nx = Math.max(TILE, p.x - TILE); break;
                case 3: nx = Math.min((COLS - 2) * TILE, p.x + TILE); break;
            }
            // Check collisions
            const ntx = Math.round(nx / TILE);
            const nty = Math.round(ny / TILE);
            const cgRoundX = catapultGoblin ? Math.round(catapultGoblin.x / TILE) * TILE : -999;
            const cgRoundY = catapultGoblin ? Math.round(catapultGoblin.y / TILE) * TILE : -999;
            let goblinBlocks = false;
            for (const gg of goblins) {
                if (!gg.dead && nx === Math.round(gg.x / TILE) * TILE && ny === Math.round(gg.y / TILE) * TILE) {
                    goblinBlocks = true; break;
                }
            }
            const blocked = goblinBlocks
                || (catapultGoblin && nx === cgRoundX && ny === cgRoundY)
                || isTileOccupiedByDancer(ntx, nty);
            if (!blocked) {
                p.destX = nx;
                p.destY = ny;
            }
            }
        } else {
            p.frame = 0;
        }
    }

    // Move toward destination smoothly (skip during launch)
    if (!playerLaunch.active && !atDest) {
        const dx = p.destX - p.x;
        const dy = p.destY - p.y;
        if (Math.abs(dx) > 0.5) {
            p.x += Math.sign(dx) * Math.min(p.speed, Math.abs(dx));
        }
        if (Math.abs(dy) > 0.5) {
            p.y += Math.sign(dy) * Math.min(p.speed, Math.abs(dy));
        }
        // Walk animation
        p.frameTimer++;
        if (p.frameTimer >= 6) {
            p.frameTimer = 0;
            p.frame = (p.frame + 1) % 4;
        }
    }

    // Player blink timer
    p.blinkTimer++;
    if (p.blinkTimer >= 186) p.blinkTimer = 0; // 180 open + 6 closed

    // Update all goblins (multiple concurrent)
    const maxGobs = getMaxGoblins();
    for (let gi = 0; gi < goblins.length; gi++) {
        const gob = goblins[gi];
        // Only allow spawning for goblins within the current max count
        if (gi >= maxGobs) {
            if (!gob.dead) { /* already alive, let them finish */ }
            else { gob.respawnTimer = 300; continue; }
        }

    if (gob.dead) {
        // No goblins in chill mode or on practice levels (1-2)
        if (gameMode === "chill" || currentLevel < 2) {
            gob.respawnTimer = 300;
            continue;
        }
        // Don't respawn if pattern is already matched
        else if (patternMatched) {
            gob.respawnTimer = 300;
        }
        gob.respawnTimer--;
        if (gob.respawnTimer <= 0) {
            // Every 6th goblin is a catapult goblin instead of normal/elite (from L15+)
            if (killCount % 6 === 5 && !catapultGoblin && !catapultSpawnedThisCycle && currentLevel >= 14) {
                catapultSequenceCount = 0;
                spawnCatapultGoblin();
                catapultSpawnedThisCycle = true;
                gob.respawnTimer = 300; // wait until catapult goblin finishes
            } else if (catapultGoblin) {
                gob.respawnTimer = 60;
            } else {
            gob.dead = false;
            gob.deathAnimActive = false;
            gob.deathAnimTimer = 0;
            // Elite determination: random with weighting (increases with level)
            gob.elite = shouldBeElite();
            gob.hp = gob.elite ? 3 : 1;
            const baseSpeed = currentLevel < LEVELS.length ? LEVELS[currentLevel].goblinSpeed : 0.5;
            gob.speed = gob.elite ? baseSpeed * 1.25 : baseSpeed;
            // Spawn from any cave — pick one not occupied by another alive goblin
            const availableCaves = [0, 1, 2].filter(ci => {
                for (const og of goblins) {
                    if (og !== gob && !og.dead && og.spawnCave === ci) return false;
                }
                return true;
            });
            gob.spawnCave = availableCaves.length > 0
                ? availableCaves[Math.floor(Math.random() * availableCaves.length)]
                : Math.floor(Math.random() * 3);
            const cave = CAVES[gob.spawnCave];
            const spawnX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
            const spawnY = cave.tileY === 0 ? TILE * 2 : cave.tileY === ROWS - 1 ? (ROWS - 2) * TILE : cave.tileY * TILE;
            gob.x = spawnX;
            gob.y = spawnY;
            gob.destX = spawnX;
            gob.destY = spawnY;
            gob.targetRow = -1;
            gob.moveSteps = 0;

            // Danger chord! Dissonant stinger on spawn
            ensureAudio();
            if (audioCtx) {
                const now = audioCtx.currentTime;
                if (gob.elite) {
                    const freqs = [110, 131, 165, 208];
                    freqs.forEach((f, i) => {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = "sawtooth";
                        osc.frequency.setValueAtTime(f, now);
                        osc.frequency.linearRampToValueAtTime(f * 0.95, now + 0.4);
                        gain.gain.setValueAtTime(0.12, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                        osc.connect(gain); gain.connect(audioCtx.destination);
                        osc.start(now + i * 0.03); osc.stop(now + 0.5);
                    });
                    const sub = audioCtx.createOscillator();
                    const sg = audioCtx.createGain();
                    sub.type = "sine";
                    sub.frequency.setValueAtTime(55, now);
                    sg.gain.setValueAtTime(0.2, now);
                    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    sub.connect(sg); sg.connect(audioCtx.destination);
                    sub.start(now); sub.stop(now + 0.6);
                } else {
                    const freqs = [220, 262, 330];
                    freqs.forEach((f, i) => {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = "square";
                        osc.frequency.setValueAtTime(f, now);
                        gain.gain.setValueAtTime(0.08, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                        osc.connect(gain); gain.connect(audioCtx.destination);
                        osc.start(now + i * 0.02); osc.stop(now + 0.3);
                    });
                }
            }
        }
        } // end else (non-catapult spawn)
    } else {
        // Smooth pixel movement toward destination
        const dx = gob.destX - gob.x;
        const dy = gob.destY - gob.y;
        const dist = Math.abs(dx) + Math.abs(dy);

        if (dist < gob.speed) {
            gob.x = gob.destX;
            gob.y = gob.destY;

            // Check if on a grid cell to sabotage
            const gc = Math.round(gob.x / TILE) - GRID_X;
            const gr = tileYToRow(Math.round(gob.y / TILE));
            if (gr >= 0 && gr < getActiveRows() && gc >= 0 && gc < GRID_COLS) {
                if (gc === gob.targetCol && gr === gob.targetRow) {
                    grid[gr][gc] = !grid[gr][gc];
                    cellFlash[gr][gc] = 30;
                    if (audioCtx) playSabotageSound(audioCtx.currentTime);
                    gob.targetRow = -1;
                    if (patternMatched && !checkLevelComplete()) {
                        patternMatched = false;
                    }
                    tryCompleteLevelOrWait();
                }
            }

            // Pick next destination tile
            gob.moveSteps++;
            if (gob.targetRow < 0 || gob.moveSteps > 5) {
                gob.targetRow = Math.floor(Math.random() * getActiveRows());
                gob.targetCol = Math.floor(Math.random() * GRID_COLS);
                gob.moveSteps = 0;
            }

            const goalX = (GRID_X + gob.targetCol) * TILE;
            const goalY = rowPixelY(gob.targetRow);
            const gdx = goalX - gob.x;
            const gdy = goalY - gob.y;

            let nx = gob.x, ny = gob.y;
            if (Math.abs(gdx) > Math.abs(gdy)) {
                nx += Math.sign(gdx) * TILE;
                gob.dir = gdx > 0 ? 3 : 2;
            } else if (gdy !== 0) {
                ny += Math.sign(gdy) * TILE;
                gob.dir = gdy > 0 ? 0 : 1;
            }

            nx = Math.max(TILE, Math.min((COLS - 2) * TILE, nx));
            ny = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, ny));

            // Don't walk into player, other goblins, or solid objects; push dancers aside
            const cgBlockX = catapultGoblin ? Math.round(catapultGoblin.x / TILE) * TILE : -999;
            const cgBlockY = catapultGoblin ? Math.round(catapultGoblin.y / TILE) * TILE : -999;
            const isGobTileBlocked = (tx, ty) => {
                const ttx = Math.round(tx / TILE);
                const tty = Math.round(ty / TILE);
                if (tx === p.x && ty === p.y) return true;
                if (catapultGoblin && tx === cgBlockX && ty === cgBlockY) return true;
                // Check other alive goblins
                for (const og of goblins) {
                    if (og === gob || og.dead) continue;
                    if (Math.round(og.x / TILE) * TILE === tx && Math.round(og.y / TILE) * TILE === ty) return true;
                }
                return false;
            };
            const pushDancerAt = (tx, ty, moveDirX, moveDirY, depth) => {
                if (depth > 5) return false;
                const ttx = Math.round(tx / TILE);
                const tty = Math.round(ty / TILE);
                for (const d of dancers) {
                    const dtx = Math.round(d.x / TILE);
                    const dty = Math.round(d.y / TILE);
                    if (dtx === ttx && dty === tty) {
                        let pushX = 0, pushY = 0;
                        if (moveDirX !== 0) {
                            pushY = (d.y >= gob.y) ? 1 : -1;
                        } else {
                            pushX = (d.x >= gob.x) ? 1 : -1;
                        }
                        for (const sign of [1, -1]) {
                            const px = pushX * sign, py = pushY * sign;
                            let newX = d.x + px * TILE;
                            let newY = d.y + py * TILE;
                            newX = Math.max(TILE, Math.min((COLS - 2) * TILE, newX));
                            newY = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, newY));
                            const ntx = Math.round(newX / TILE);
                            const nty = Math.round(newY / TILE);
                            if (ntx === Math.round(p.x / TILE) && nty === Math.round(p.y / TILE)) continue;
                            if (isTileOccupiedByDancer(ntx, nty)) {
                                if (!pushDancerAt(newX, newY, px * TILE, py * TILE, depth + 1)) continue;
                            }
                            d.targetX = newX;
                            d.targetY = newY;
                            d.walkingIn = true;
                            return true;
                        }
                        return false;
                    }
                }
                return true;
            };
            if (!isGobTileBlocked(nx, ny)) {
                const moveDirX = nx - gob.x;
                const moveDirY = ny - gob.y;
                if (isTileOccupiedByDancer(Math.round(nx / TILE), Math.round(ny / TILE))) {
                    pushDancerAt(nx, ny, moveDirX, moveDirY, 0);
                }
                gob.destX = nx;
                gob.destY = ny;
            } else {
                let ax = gob.x, ay = gob.y;
                if (nx !== gob.x) {
                    if (gdy !== 0) {
                        ay += Math.sign(gdy) * TILE;
                        gob.dir = gdy > 0 ? 0 : 1;
                    }
                } else {
                    if (gdx !== 0) {
                        ax += Math.sign(gdx) * TILE;
                        gob.dir = gdx > 0 ? 3 : 2;
                    }
                }
                ax = Math.max(TILE, Math.min((COLS - 2) * TILE, ax));
                ay = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, ay));
                if ((ax !== gob.x || ay !== gob.y) && !isGobTileBlocked(ax, ay)) {
                    const aDirX = ax - gob.x;
                    const aDirY = ay - gob.y;
                    if (isTileOccupiedByDancer(Math.round(ax / TILE), Math.round(ay / TILE))) {
                        pushDancerAt(ax, ay, aDirX, aDirY, 0);
                    }
                    gob.destX = ax;
                    gob.destY = ay;
                }
            }
        } else {
            if (Math.abs(dx) > 0) {
                gob.x += Math.sign(dx) * Math.min(gob.speed, Math.abs(dx));
            }
            if (Math.abs(dy) > 0) {
                gob.y += Math.sign(dy) * Math.min(gob.speed, Math.abs(dy));
            }
            gob.frameTimer++;
            if (gob.frameTimer >= 8) {
                gob.frameTimer = 0;
                gob.frame = (gob.frame + 1) % 4;
            }
        }
    }

    // Decrement goblin hurt flash timer
    if (gob.hurtTimer > 0) gob.hurtTimer--;

    // Update goblin death poof animation
    if (gob.deathAnimActive) {
        gob.deathAnimTimer--;
        const progress = 1 - gob.deathAnimTimer / 24;
        const wasElite = gob.deathAnimElite;
        if (gob.deathAnimTimer % 2 === 0) {
            const burstCount = wasElite ? 5 : 3;
            for (let i = 0; i < burstCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 0.5 + progress * 2;
                const isSparkle = wasElite && Math.random() > 0.5;
                deathParticles.push({
                    x: gob.x + gob.w / 2 + (Math.random() - 0.5) * 10,
                    y: gob.y + gob.h / 2 + (Math.random() - 0.5) * 10,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 0.5,
                    life: wasElite ? 40 + Math.random() * 30 : 20 + Math.random() * 20,
                    color: wasElite
                        ? (isSparkle ? "#00FFFF" : Math.random() > 0.3 ? "#FF00FF" : "#FF44FF")
                        : (Math.random() > 0.3 ? "#39FF14" : "#00CC00"),
                    size: 1 + Math.random() * 2,
                    sparkle: isSparkle,
                });
            }
        }
        if (gob.deathAnimTimer <= 0) {
            gob.deathAnimActive = false;
            const particleCount = wasElite ? 45 : 22;
            const spreadMul = wasElite ? 3.5 : 2.6;
            for (let i = 0; i < particleCount; i++) {
                const isSparkle = wasElite && Math.random() > 0.5;
                const brightVar = 0.85 + Math.random() * 0.3; // brightness variation
                deathParticles.push({
                    x: gob.x + gob.w / 2,
                    y: gob.y + gob.h / 2,
                    vx: (Math.random() - 0.5) * spreadMul,
                    vy: (Math.random() - 0.5) * spreadMul - 1.2,
                    life: wasElite ? 50 + Math.random() * 50 : 30 + Math.random() * 30,
                    color: wasElite
                        ? (isSparkle ? "#00FFFF" : Math.random() > 0.3 ? "#FF00FF" : "#FF44FF")
                        : (Math.random() > 0.5 ? "#39FF14" : Math.random() > 0.3 ? "#00CC00" : "#66FF44"),
                    size: wasElite ? 2 + Math.random() * 4 : 2 + Math.random() * 3,
                    sparkle: isSparkle,
                });
            }
        }
    }

    } // end for each goblin

    // Update catapult goblin
    if (catapultGoblin) updateCatapultGoblin();

    // Update death particles
    deathParticles = deathParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        if (p.sparkle) p.vx *= 0.98; // sparkles float more
        p.life--;
        return p.life > 0;
    });
    if (deathText) {
        deathText.y -= 0.3;
        deathText.timer--;
        if (deathText.timer <= 0) deathText = null;
    }
    if (screenFlash > 0) screenFlash--;

    // Update dancers walking in from border
    for (const d of dancers) {
        if (d.walkingIn) {
            const dx = d.targetX - d.x;
            const dy = d.targetY - d.y;
            const walkSpeed = 0.6;
            if (Math.abs(dx) > 0.5) d.x += Math.sign(dx) * Math.min(walkSpeed, Math.abs(dx));
            if (Math.abs(dy) > 0.5) d.y += Math.sign(dy) * Math.min(walkSpeed, Math.abs(dy));
            if (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) {
                d.x = d.targetX;
                d.y = d.targetY;
                d.walkingIn = false;
            }
        }
    }

    // Dancers throw tomatoes at nearby goblins (cosmetic only)
    // Find nearest alive goblin for each dancer
    for (const d of dancers) {
        if (d.walkingIn) continue;
        // Find closest alive goblin
        let nearestGob = null;
        let nearestDist = Infinity;
        for (const gg of goblins) {
            if (gg.dead) continue;
            const ddx = Math.abs(d.x - gg.x);
            const ddy = Math.abs(d.y - gg.y);
            const dist = ddx + ddy;
            if (ddx <= 3 * TILE && ddy <= 3 * TILE && dist < nearestDist) {
                nearestGob = gg;
                nearestDist = dist;
            }
        }
        if (nearestGob) {
            if (d.throwDelay === undefined) d.throwDelay = Math.floor(Math.random() * 30);
            if (d.throwDelay > 0) { d.throwDelay--; continue; }
            if (!d.throwCooldown) d.throwCooldown = 0;
            if (d.throwCooldown > 0) { d.throwCooldown--; continue; }
            if (Math.random() < 0.015) {
                d.throwCooldown = 90 + Math.floor(Math.random() * 60);
                const tdx = nearestGob.x + 8 - (d.x + 8);
                const tdy = nearestGob.y + 4 - (d.y + 4);
                const tDist = Math.sqrt(tdx * tdx + tdy * tdy);
                tomatoes.push({
                    x: d.x + 8, y: d.y + 4,
                    targetX: nearestGob.x + 8, targetY: nearestGob.y + 4,
                    speed: 1.0,
                    progress: 0,
                    totalDist: tDist,
                    spin: 0,
                    targetGoblin: nearestGob, // track which goblin to follow
                });
            }
        } else {
            d.throwDelay = undefined;
        }
    }

    // Update tomato projectiles
    tomatoes = tomatoes.filter(t => {
        const dx = t.targetX - t.x;
        const dy = t.targetY - t.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < t.speed + 1) {
            // Splat!
            tomatoSplats.push({ x: t.targetX, y: t.targetY, timer: 25 });
            return false;
        }
        t.x += (dx / dist) * t.speed;
        t.y += (dy / dist) * t.speed;
        t.progress = Math.min(1, t.progress + t.speed / t.totalDist);
        t.spin++;
        // Update target to track the target goblin's current position
        if (t.targetGoblin && !t.targetGoblin.dead) {
            t.targetX = t.targetGoblin.x + 8;
            t.targetY = t.targetGoblin.y + 4;
            t.totalDist = Math.max(t.totalDist, dist);
        }
        return true;
    });

    // Update splats
    tomatoSplats = tomatoSplats.filter(s => {
        s.timer--;
        return s.timer > 0;
    });

    // Sequencer step
    tickSequencer();
}

// ---- Boulder Launch (comical knockback — replaces death) ----
let playerLaunch = {
    active: false,
    timer: 0,           // frame counter for animation
    duration: 70,       // total frames of flight
    startX: 0, startY: 0,
    endX: 0, endY: 0,
};

// ---- Game Over ----
let gameOverTimer = 0; // counts up for animation timing
let sadSongStarted = false;
let playerDeathAnim = {
    active: false,
    collapseProgress: 0,   // 0→1 player squishes flat
    soulY: 0,              // soul float offset (pixels upward)
    soulAlpha: 1,          // soul fade
    soulWobble: 0,         // wobble phase
    flashTimer: 0,         // red flash on hit
    bounceCount: 0,        // player body bounce count
    bounceVel: 0,          // vertical bounce velocity
    bounceY: 0,            // vertical bounce offset
};

function triggerGameOver() {
    gameState = "gameover";
    gameOverTimer = 0;
    sadSongStarted = false;
    finalScore = score;

    // Start player death animation
    playerDeathAnim.active = true;
    playerDeathAnim.collapseProgress = 0;
    playerDeathAnim.soulY = 0;
    playerDeathAnim.soulAlpha = 0;
    playerDeathAnim.soulWobble = 0;
    playerDeathAnim.flashTimer = 8;
    playerDeathAnim.bounceCount = 0;
    playerDeathAnim.bounceVel = -3;
    playerDeathAnim.bounceY = 0;

    // Initial hit freeze + shake
    screenShake = 15;
    shakeIntensity = 6;
    hitFreeze = 10; // dramatic pause

    // Impact thud sound
    ensureAudio();
    if (audioCtx) {
        const now = audioCtx.currentTime;
        // Heavy impact
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.5);

        // Ghostly ascending tone for soul departure (delayed ~0.5s)
        const ghost = audioCtx.createOscillator();
        const gg = audioCtx.createGain();
        ghost.type = "sine";
        ghost.frequency.setValueAtTime(300, now + 0.5);
        ghost.frequency.exponentialRampToValueAtTime(1200, now + 2.0);
        gg.gain.setValueAtTime(0.06, now + 0.5);
        gg.gain.linearRampToValueAtTime(0.08, now + 1.0);
        gg.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
        ghost.connect(gg); gg.connect(audioCtx.destination);
        ghost.start(now + 0.5); ghost.stop(now + 2.5);
        // Ethereal harmony
        const ghost2 = audioCtx.createOscillator();
        const gg2 = audioCtx.createGain();
        ghost2.type = "sine";
        ghost2.frequency.setValueAtTime(450, now + 0.7);
        ghost2.frequency.exponentialRampToValueAtTime(1800, now + 2.2);
        gg2.gain.setValueAtTime(0.03, now + 0.7);
        gg2.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
        ghost2.connect(gg2); gg2.connect(audioCtx.destination);
        ghost2.start(now + 0.7); ghost2.stop(now + 2.5);
    }
}

function playSadSong() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // A slow, melancholy melody — Am pentatonic, sparse and lonely
    // Each note is a simple triangle wave with long decay
    const melody = [
        // [freq, startTime, duration, gain]
        [440, 0.0, 2.0, 0.12],     // A4
        [392, 1.5, 1.5, 0.10],     // G4
        [330, 2.8, 2.0, 0.12],     // E4
        [294, 4.5, 1.5, 0.10],     // D4
        [262, 5.8, 2.5, 0.12],     // C4
        [294, 7.5, 1.0, 0.08],     // D4 (brief)
        [262, 8.2, 2.5, 0.10],     // C4
        [220, 9.5, 3.0, 0.12],     // A3 (resolve down)
    ];
    melody.forEach(([freq, start, dur, vol]) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + start);
        // Gentle vibrato
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = 4.5;
        lfoGain.gain.value = 3;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(now + start); lfo.stop(now + start + dur);
        g.gain.setValueAtTime(0.001, now + start);
        g.gain.linearRampToValueAtTime(vol, now + start + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now + start); osc.stop(now + start + dur + 0.1);
    });

    // Underneath: very quiet low pad for atmosphere
    const pad = audioCtx.createOscillator();
    const padG = audioCtx.createGain();
    pad.type = "sine";
    pad.frequency.setValueAtTime(110, now); // A2
    padG.gain.setValueAtTime(0.001, now);
    padG.gain.linearRampToValueAtTime(0.06, now + 1);
    padG.gain.setValueAtTime(0.06, now + 8);
    padG.gain.exponentialRampToValueAtTime(0.001, now + 11);
    pad.connect(padG); padG.connect(audioCtx.destination);
    pad.start(now); pad.stop(now + 11);

    // Second pad note for minor feel
    const pad2 = audioCtx.createOscillator();
    const pad2G = audioCtx.createGain();
    pad2.type = "sine";
    pad2.frequency.setValueAtTime(131, now); // C3
    pad2G.gain.setValueAtTime(0.001, now);
    pad2G.gain.linearRampToValueAtTime(0.04, now + 1.5);
    pad2G.gain.setValueAtTime(0.04, now + 8);
    pad2G.gain.exponentialRampToValueAtTime(0.001, now + 11);
    pad2.connect(pad2G); pad2G.connect(audioCtx.destination);
    pad2.start(now); pad2.stop(now + 11);
}

function resetGame() {
    stopIntroDrums();
    stopEndingDrums();
    // Load starting pattern for current level (or empty if none)
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            grid[r][c] = false;
    if (LEVELS[0] && LEVELS[0].startPattern) {
        for (let r = 0; r < GRID_ROWS; r++)
            for (let c = 0; c < GRID_COLS; c++)
                grid[r][c] = LEVELS[0].startPattern[r][c];
    }

    // Reset player (currentLevel is set to 0 below, so use level 0 activeRows)
    player.x = (GRID_X + 7) * TILE;
    player.y = (GRID_Y + LEVELS[0].activeRows + 1) * TILE + GRID_Y_OFFSET;
    player.destX = player.x;
    player.destY = player.y;
    player.dir = 0;
    player.turnDelay = 0;
    player.frame = 0;
    player.attacking = false;
    player.attackTimer = 0;
    player.punchHit = false;
    player.blinkTimer = 0;

    // Reset controls overlay and tutorial
    controlsKeyFlash = {};
    tutorialHintTimer = 0;
    tutorialFirstToggle = false;
    tutorialFirstToggleFrame = 0;

    // Reset enemies
    killCount = 0;
    score = 0;
    lastTimeBonus = 0;
    for (const g of goblins) {
        g.dead = true;
        g.deathAnimActive = false;
        g.deathAnimTimer = 0;
        g.respawnTimer = 300;
    }
    catapultGoblin = null;
    catapultSpawnedThisCycle = false;
    catapultSequenceCount = 0;
    enemyWarningShown = { normal: false, elite: false, catapult: false };
    newInstrumentShown = { cowbell: false, tom: false };
    levelTimer = LEVELS[0].timerSeconds * 90;

    // Clear dancers and effects
    dancers.length = 0;
    deathParticles = [];
    tomatoes = [];
    tomatoSplats = [];
    deathText = null;
    screenFlash = 0;
    screenShake = 0;
    hitFreeze = 0;
    titleEntrancePhase = 0;
    fireworks = [];
    playerDeathAnim.active = false;
    playerLaunch.active = false;
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            cellFlash[r][c] = 0;

    // Reset sequencer and frame timing
    currentStep = 0;
    lastStepTime = performance.now();
    lastTime = 0;
    frameAccum = 0;

    // Reset level progression
    currentLevel = 0;
    levelComplete = false;
    patternMatched = false;
    levelCelebrateTimer = 0;
    levelCelebrateDisplayScore = 0;

    // Reset minigame state
    minigameState = "none";
    minigameActive = false;
    minigameTimer = 0;
    caveGoblins = [];
    caveBoulders = [];
    caveCatapult = null;
    caveClockPickups = [];
    caveDeathParticles = [];
    cavePlayerDead = false;
    djSetupEarned = [];
    minigamesCompleted = [];
    stopMinigameMusic();

    // Set tempo for level 0
    setLevelTempo(0);
}

// ---- Level Progression ----
function checkLevelComplete() {
    if (currentLevel >= LEVELS.length) return false;
    const target = LEVELS[currentLevel].pattern;
    const ar = getActiveRows();
    for (let r = 0; r < ar; r++)
        for (let c = 0; c < GRID_COLS; c++)
            if (grid[r][c] !== target[r][c]) return false;
    return true;
}

function areGoblinsAlive() {
    for (const g of goblins) {
        if (!g.dead) return true;
    }
    if (catapultGoblin) return true;
    return false;
}

// Called when pattern matches — checks if we can end level or must wait for goblins
function tryCompleteLevelOrWait() {
    if (levelComplete) return;
    if (!checkLevelComplete()) {
        patternMatched = false;
        return;
    }
    patternMatched = true;
    if (!areGoblinsAlive()) {
        triggerLevelComplete();
    }
}

function playLevelFanfare() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // Triumphant ascending arpeggio (C major -> high C)
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        g.gain.setValueAtTime(0.18 - i * 0.02, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.5);
    });
    // Held major chord at the end
    [1047, 1319, 1568].forEach((freq) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + 0.7);
        g.gain.setValueAtTime(0.08, now + 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now + 0.7); osc.stop(now + 2.0);
    });
}

function playPieceRevealChime() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // Sparkle chime: rapid ascending sine tones
    const notes = [1047, 1319, 1568, 2093, 2637];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        g.gain.setValueAtTime(0.12, now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.4);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now + i * 0.06); osc.stop(now + i * 0.06 + 0.4);
    });
}

function playSetupCompleteFanfare() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // Grand ascending arpeggio with full major chord resolution
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093, 2637];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        g.gain.setValueAtTime(0.15, now + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.6);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.6);
    });
    // Triumphant sustained chord (C major + octave)
    [1047, 1319, 1568, 2093].forEach((freq) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + 0.7);
        g.gain.setValueAtTime(0.1, now + 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now + 0.7); osc.stop(now + 2.5);
    });
}

function playBoothExplosion() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // Deep rumble
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.8);
    // Crash (white noise burst)
    const bufSize = audioCtx.sampleRate * 0.4;
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const noise = audioCtx.createBufferSource();
    const ng = audioCtx.createGain();
    noise.buffer = buf;
    ng.gain.setValueAtTime(0.2, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    noise.connect(ng); ng.connect(audioCtx.destination);
    noise.start(now); noise.stop(now + 0.4);
}

function triggerLevelComplete() {
    levelComplete = true;
    levelCelebrateTimer = 0;
    levelCelebrateDisplayScore = 0;
    gameState = "levelcomplete";
    // Kill all goblins so they stop sabotaging
    for (const g of goblins) {
        g.dead = true;
        g.deathAnimActive = false;
        g.deathAnimTimer = 0;
        g.respawnTimer = 9999;
    }
    // Kill catapult goblin too
    catapultGoblin = null;
    // Award time bonus
    lastTimeBonus = Math.ceil(levelTimer / 90) * 10;
    score += lastTimeBonus;
    // Screen flash for celebration
    screenFlash = 20;
    // Play fanfare instead of drums
    playLevelFanfare();
}

// ============================================================
// MINIGAME: Cave Beat 'Em Up
// Triggers after levels 5, 10, 15, 20, 25, 30.
// DJ gets kidnapped by goblins, fights in cave arena for 20s,
// dancers rescue by breaking through wall with torches.
// ============================================================

function startMinigameKidnap() {
    gameState = "minigame";
    minigameState = "kidnap";
    minigameKidnapTimer = 0;
    minigameKidnapPhase = 0;
    minigamePendingAfterLevel = currentLevel;

    // Clear dancers — they'll respawn walking in when the next level starts
    dancers.length = 0;

    // Stop any ongoing drums
    stopStoryDrums();

    // Position kidnap goblins off-screen on left and right
    const playerCenterX = player.x;
    const playerCenterY = player.y;
    kidnapGoblin1 = { x: -TILE * 2, y: playerCenterY, dir: 3, frame: 0, frameTimer: 0 }; // from left
    kidnapGoblin2 = { x: (COLS + 1) * TILE, y: playerCenterY, dir: 2, frame: 0, frameTimer: 0 }; // from right
    kidnapDJPos = { x: playerCenterX, y: playerCenterY };
    kidnapTargetY = -TILE * 2; // escort off top of screen

    // Play ominous kidnap sound
    ensureAudio();
    if (audioCtx) {
        const now = audioCtx.currentTime;
        // Descending dread tone
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 1.5);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 1.5);
    }
}

function updateMinigameKidnap() {
    minigameKidnapTimer++;
    const p = kidnapDJPos;

    // Animate goblin walk frames
    kidnapGoblin1.frameTimer++;
    kidnapGoblin2.frameTimer++;
    if (kidnapGoblin1.frameTimer > 8) { kidnapGoblin1.frame = (kidnapGoblin1.frame + 1) % 4; kidnapGoblin1.frameTimer = 0; }
    if (kidnapGoblin2.frameTimer > 8) { kidnapGoblin2.frame = (kidnapGoblin2.frame + 1) % 4; kidnapGoblin2.frameTimer = 0; }

    if (minigameKidnapPhase === 0) {
        // Phase 0: Goblins approach DJ from sides (0-90 frames)
        const targetX1 = p.x - TILE * 1.5;
        const targetX2 = p.x + TILE * 1.5;
        kidnapGoblin1.x += Math.min(2, targetX1 - kidnapGoblin1.x) * 0.08;
        kidnapGoblin2.x += Math.min(2, -(kidnapGoblin2.x - targetX2)) * 0.08;
        if (kidnapGoblin1.x > targetX1 - 2) kidnapGoblin1.x = targetX1;
        if (kidnapGoblin2.x < targetX2 + 2) kidnapGoblin2.x = targetX2;

        if (minigameKidnapTimer > 90) {
            minigameKidnapPhase = 1;
            minigameKidnapTimer = 0;
            // Play grab sound
            if (audioCtx) {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = "square";
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                g.gain.setValueAtTime(0.15, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.connect(g); g.connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.2);
            }
        }
    } else if (minigameKidnapPhase === 1) {
        // Phase 1: All three move up toward top of screen (escort to cave)
        const speed = 1.5;
        kidnapGoblin1.y -= speed;
        kidnapGoblin2.y -= speed;
        kidnapDJPos.y -= speed;
        kidnapGoblin1.dir = 1; // face up
        kidnapGoblin2.dir = 1;
        kidnapGoblin1.x = kidnapDJPos.x - TILE * 1.5;
        kidnapGoblin2.x = kidnapDJPos.x + TILE * 1.5;

        if (kidnapDJPos.y < kidnapTargetY) {
            // Go straight to arena (controls shown as overlay during level 1)
            startMinigameArena();
        }
    }
}

function renderMinigameKidnap() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Render the game map underneath with increasing darkness
    render();
    const darkAlpha = Math.min(0.7, minigameKidnapTimer * 0.005 + minigameKidnapPhase * 0.3);
    ctx.globalAlpha = darkAlpha;
    drawRect(0, 0, W, H, "#000");
    ctx.globalAlpha = 1;

    // Draw kidnap goblins
    drawGoblinSprite("normal", kidnapGoblin1.x, kidnapGoblin1.y,
        kidnapGoblin1.frame, { dir: kidnapGoblin1.dir });
    drawGoblinSprite("normal", kidnapGoblin2.x, kidnapGoblin2.y,
        kidnapGoblin2.frame, { dir: kidnapGoblin2.dir });

    // Draw DJ being escorted (struggling animation)
    const struggle = minigameKidnapPhase === 1 ? Math.sin(minigameKidnapTimer * 0.3) * 2 : 0;
    drawPlayerSprite(kidnapDJPos.x + struggle, kidnapDJPos.y,
        (minigameKidnapTimer >> 3) % 4, 1, {});

    // Kidnap text — escalates across the 6 minigames
    if (minigameKidnapPhase === 1 && minigameKidnapTimer > 20) {
        const kidnapTexts = [
            "KIDNAPPED!", "NOT AGAIN!", "THEY'RE GETTING BOLDER!",
            "A WELL-PLANNED AMBUSH!", "THEY BROUGHT REINFORCEMENTS!", "THE FINAL HEIST!"
        ];
        const kidnapMsg = kidnapTexts[Math.min(minigamesCompleted.length, kidnapTexts.length - 1)];
        ctx.textAlign = "center";
        ctx.font = `${14 * SCALE}px monospace`;
        const blink = Math.sin(minigameKidnapTimer * 0.15) > 0;
        if (blink) {
            ctx.fillStyle = "#FF0044";
            ctx.fillText(kidnapMsg, (W * SCALE) / 2, (H / 3) * SCALE);
        }
    }
}


function startMinigameArena() {
    minigameState = "boarding";
    minigameActive = true;
    // Scale timer: 20s → 22s → 24s → 26s → 28s → 30s across 6 minigames
    const mgIndex = minigamesCompleted.length;
    minigameTimer = MINIGAME_BASE_TIME + mgIndex * 2 * 60;
    cavePlayerDead = false;
    caveKillCount = 0;
    caveCatapultKillCount = 0;
    caveBoulderImpacts = [];

    // Reset player to center of cave arena
    player.x = (CAVE_COLS / 2) * CAVE_TILE;
    player.y = (CAVE_ROWS / 2 + 2) * CAVE_TILE;
    player.destX = player.x;
    player.destY = player.y;
    player.dir = 0;
    player.attacking = false;
    player.attackTimer = 0;
    player.punchHit = false;

    // Spawn initial cave goblins
    caveGoblins = [];
    caveBoulders = [];
    caveCatapult = null;
    caveClockPickups = [];
    caveDeathParticles = [];
    caveDeathText = null;
    caveScreenShake = 0;
    caveHitFreeze = 0;
    caveScreenFlash = 0;
    rescueDancers = [];

    // Set up 3 boarded-up cave entrances at top of cave
    // These correspond to the 3 overworld cave openings
    const entranceWidth = 3; // tiles wide
    boardedEntrances = [
        { x: 3 * CAVE_TILE, w: entranceWidth * CAVE_TILE },
        { x: Math.floor(CAVE_COLS / 2 - 1) * CAVE_TILE, w: entranceWidth * CAVE_TILE },
        { x: (CAVE_COLS - 3 - entranceWidth) * CAVE_TILE, w: entranceWidth * CAVE_TILE },
    ];
    caveBoardedUp = false;
    boardProgress = 0;
    boardingTimer = 0;
    boardingPhase = 0;

    // Set up boarding goblins — one per entrance, they'll nail boards
    boardingGoblins = [];
    for (let i = 0; i < 3; i++) {
        boardingGoblins.push({
            x: boardedEntrances[i].x + boardedEntrances[i].w / 2 - CAVE_TILE / 2,
            y: CAVE_TILE * 2,
            frame: 0, frameTimer: 0, dir: 1,
            entranceIdx: i,
        });
    }

    rescueWallCracks = [];
    rescueWallDust = [];
    rescueWallProgress = 0;

    gameState = "minigame";

    // Play boarding hammering sound
    if (audioCtx) {
        const now = audioCtx.currentTime;
        for (let h = 0; h < 4; h++) {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = "square";
            osc.frequency.setValueAtTime(180 + h * 20, now + h * 0.4);
            osc.frequency.exponentialRampToValueAtTime(80, now + h * 0.4 + 0.1);
            g.gain.setValueAtTime(0.12, now + h * 0.4);
            g.gain.exponentialRampToValueAtTime(0.001, now + h * 0.4 + 0.15);
            osc.connect(g); g.connect(audioCtx.destination);
            osc.start(now + h * 0.4); osc.stop(now + h * 0.4 + 0.15);
        }
    }
}

function updateMinigameBoarding() {
    boardingTimer++;

    // Animate goblin frames
    for (const bg of boardingGoblins) {
        bg.frameTimer++;
        if (bg.frameTimer > 8) { bg.frame = (bg.frame + 1) % 4; bg.frameTimer = 0; }
    }

    // Progress boards being nailed (0→1 over ~120 frames / 2 seconds)
    boardProgress = Math.min(1, boardingTimer / 120);

    // Hammer sound effects at specific frames
    if (audioCtx && (boardingTimer === 30 || boardingTimer === 60 || boardingTimer === 90)) {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
        g.gain.setValueAtTime(0.1, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.1);
    }

    if (boardingTimer > 140) {
        // Boarding complete — transition to arena gameplay
        caveBoardedUp = true;
        boardProgress = 1;
        minigameState = "playing";

        // Spawn first wave of goblins from cave edges
        for (let i = 0; i < 3; i++) {
            spawnCaveGoblin(false);
        }

        // Start stressful music
        startMinigameMusic();
    }
}

function renderMinigameBoarding() {
    // Render cave arena underneath (this draws walls, floor, torches etc.)
    renderMinigameArena();

    const W = CAVE_COLS * CAVE_TILE;
    const H = CAVE_ROWS * CAVE_TILE;

    // Draw boarding goblins near the top entrances
    for (const bg of boardingGoblins) {
        drawGoblinSprite("normal", bg.x, bg.y, bg.frame, { dir: bg.dir });

        // Hammering arm animation
        if (boardingTimer % 30 < 8) {
            const hammerX = bg.x + CAVE_TILE / 2 + 2;
            const hammerY = bg.y - 4 - (8 - (boardingTimer % 30)) * 1.5;
            drawRect(hammerX, hammerY, 3, 5, "#8B4513");
            drawRect(hammerX - 1, hammerY - 2, 5, 3, "#666");
        }
    }

    // Draw DJ cowering in center
    const struggle = Math.sin(boardingTimer * 0.2) * 1.5;
    drawPlayerSprite(player.x + struggle, player.y, (boardingTimer >> 4) % 4, 0, {});

    // Darkness overlay to set mood
    const darkAlpha = Math.min(0.3, boardingTimer * 0.003);
    ctx.globalAlpha = darkAlpha;
    drawRect(0, 0, W, H, "#000");
    ctx.globalAlpha = 1;

    // "TRAPPED!" text after boards are mostly done
    if (boardProgress > 0.6) {
        ctx.textAlign = "center";
        ctx.font = `${12 * SCALE}px monospace`;
        const blink = Math.sin(boardingTimer * 0.15) > 0;
        if (blink) {
            ctx.fillStyle = "#000";
            ctx.fillText("TRAPPED!", (W / 2) * SCALE + SCALE, (H / 3 + 1) * SCALE);
            ctx.fillStyle = "#FF4400";
            ctx.fillText("TRAPPED!", (W / 2) * SCALE, (H / 3) * SCALE);
        }
        ctx.textAlign = "start";
    }
}

function spawnCaveGoblin(elite) {
    // Spawn from random edge (right, bottom, left — not top, that's the boarded rescue entrance)
    const edges = [
        { x: (CAVE_COLS - 2) * CAVE_TILE, y: CAVE_TILE * 2 + Math.random() * (CAVE_ROWS - 5) * CAVE_TILE }, // right
        { x: CAVE_TILE * 2 + Math.random() * (CAVE_COLS - 5) * CAVE_TILE, y: (CAVE_ROWS - 2) * CAVE_TILE }, // bottom
        { x: CAVE_TILE, y: CAVE_TILE * 2 + Math.random() * (CAVE_ROWS - 5) * CAVE_TILE }, // left
    ];
    const spawn = edges[Math.floor(Math.random() * edges.length)];
    // Snap spawn to tile grid
    const snapX = Math.round(spawn.x / CAVE_TILE) * CAVE_TILE;
    const snapY = Math.round(spawn.y / CAVE_TILE) * CAVE_TILE;
    caveGoblins.push({
        x: snapX, y: snapY,
        destX: snapX, destY: snapY,
        w: CAVE_TILE, h: CAVE_TILE,
        dir: 0, frame: 0, frameTimer: 0,
        speed: (0.55 + minigamesCompleted.length * 0.06) + Math.random() * 0.25,
        dead: false,
        elite: elite,
        hp: elite ? 3 : 1,
        hurtTimer: 0,
        deathAnimTimer: 0,
        deathAnimActive: false,
        deathAnimElite: elite,
        moveSteps: 0,
        targetTileX: -1,
        targetTileY: -1,
        stuckCount: 0,
    });
}

function spawnCaveCatapult() {
    // Pick random edge: right(0), bottom(1), left(2) — not top (boarded rescue entrance)
    const edge = Math.floor(Math.random() * 3);
    let spawnX, spawnY, destX, destY, dir;
    if (edge === 0) { // right
        spawnX = (CAVE_COLS - 1) * CAVE_TILE;
        spawnY = (3 + Math.floor(Math.random() * (CAVE_ROWS - 6))) * CAVE_TILE;
        destX = (CAVE_COLS - 4 - Math.floor(Math.random() * 2)) * CAVE_TILE;
        destY = spawnY;
        dir = 2;
    } else if (edge === 1) { // bottom
        spawnX = (3 + Math.floor(Math.random() * (CAVE_COLS - 6))) * CAVE_TILE;
        spawnY = (CAVE_ROWS - 1) * CAVE_TILE;
        destX = spawnX;
        destY = (CAVE_ROWS - 4 - Math.floor(Math.random() * 2)) * CAVE_TILE;
        dir = 1;
    } else { // left
        spawnX = 0;
        spawnY = (3 + Math.floor(Math.random() * (CAVE_ROWS - 6))) * CAVE_TILE;
        destX = (3 + Math.floor(Math.random() * 2)) * CAVE_TILE;
        destY = spawnY;
        dir = 3;
    }
    caveCatapult = {
        x: spawnX, y: spawnY,
        destX: destX, destY: destY,
        w: CAVE_TILE, h: CAVE_TILE,
        dir: dir, frame: 0, frameTimer: 0,
        speed: 0.6,
        phase: "entering",
        phaseTimer: 0,
        targetX: 0, targetY: 0,
        spawnX: spawnX, spawnY: spawnY,
    };
}

function updateMinigameArena() {
    if (caveHitFreeze > 0) {
        caveHitFreeze--;
        if (caveHitFreeze === 0 && cavePendingShake) {
            caveScreenShake = 6;
            caveShakeIntensity = 2;
            cavePendingShake = false;
        }
        return;
    }
    if (caveScreenShake > 0) caveScreenShake--;
    if (caveScreenFlash > 0) caveScreenFlash--;

    // Timer countdown
    minigameTimer--;
    rescueWallProgress = 1 - (minigameTimer / MINIGAME_BASE_TIME);

    if (minigameTimer <= 0) {
        // Rescue time!
        startMinigameRescue();
        return;
    }

    if (cavePlayerDead) return; // player hit by boulder, waiting for rescue

    const p = player;

    // Player attack
    if (spaceJustPressed && !p.attacking) {
        p.attacking = true;
        p.attackTimer = p.attackDuration;
        p.punchHit = false;
        // Punch sound
        if (audioCtx) {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
            g.gain.setValueAtTime(0.15, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(g); g.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.1);
        }

        // Check goblin hits
        const punchBox = getPunchBox();
        for (const cg of caveGoblins) {
            if (cg.dead || cg.deathAnimActive) continue;
            const gobBox = { x: cg.x, y: cg.y, w: cg.w, h: cg.h };
            if (aabb(punchBox, gobBox)) {
                p.punchHit = true;
                cg.hp--;
                if (cg.hp > 0) {
                    cg.hurtTimer = 12;
                    caveHitFreeze = 2;
                    cavePendingShake = true;
                    // Knockback
                    const dx = Math.sign(cg.x - p.x);
                    const dy = Math.sign(cg.y - p.y);
                    cg.destX = Math.max(CAVE_TILE, Math.min((CAVE_COLS - 2) * CAVE_TILE, cg.x + dx * CAVE_TILE));
                    cg.destY = Math.max(CAVE_TILE * 2, Math.min((CAVE_ROWS - 2) * CAVE_TILE, cg.y + dy * CAVE_TILE));
                    // Hurt particles
                    for (let i = 0; i < 6; i++) {
                        caveDeathParticles.push({
                            x: cg.x + cg.w / 2, y: cg.y + cg.h / 2,
                            vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 - 0.5,
                            life: 15 + Math.random() * 10, color: cg.elite ? "#FF69B4" : "#39FF14", size: 2,
                        });
                    }
                } else {
                    // Kill
                    cg.deathAnimActive = true;
                    cg.deathAnimTimer = 24;
                    cg.dead = true;
                    caveKillCount++;
                    caveCatapultKillCount++;
                    score += cg.elite ? 300 : 100;

                    caveHitFreeze = cg.deathAnimElite ? 5 : 3;
                    cavePendingShake = true;
                    if (cg.deathAnimElite) caveScreenFlash = 10;

                    // Elite drops clock pickup
                    if (cg.elite) {
                        caveClockPickups.push({
                            x: cg.x + cg.w / 2 - 4,
                            y: cg.y,
                            timer: 300, // disappears after 5 seconds
                            bobPhase: 0,
                        });
                    }

                    // Death particles
                    const col = cg.elite ? "#FF69B4" : "#39FF14";
                    for (let i = 0; i < 12; i++) {
                        caveDeathParticles.push({
                            x: cg.x + cg.w / 2, y: cg.y + cg.h / 2,
                            vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3 - 1,
                            life: 20 + Math.random() * 20, color: col, size: 2 + Math.random() * 2,
                        });
                    }

                    // Death text
                    const texts = ["BONK!", "POW!", "WHAM!", "CRUNCH!", "SPLAT!"];
                    caveDeathText = {
                        x: cg.x - 10, y: cg.y - 12,
                        timer: 40, text: texts[Math.floor(Math.random() * texts.length)],
                        color: cg.elite ? "#FF69B4" : "#FF4444", scale: 5,
                    };

                    // Kill sound
                    if (audioCtx) {
                        const now = audioCtx.currentTime;
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.type = cg.elite ? "triangle" : "square";
                        osc.frequency.setValueAtTime(cg.elite ? 800 : 500, now);
                        osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
                        gain.gain.setValueAtTime(0.15, now);
                        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                        osc.connect(gain); gain.connect(audioCtx.destination);
                        osc.start(now); osc.stop(now + 0.2);
                    }
                }
                break; // one punch hits one goblin
            }
        }

        // Check cave catapult goblin hit — invincible! Clang + knockback (matching overworld)
        if (caveCatapult && !p.punchHit) {
            const catBox = { x: caveCatapult.x, y: caveCatapult.y, w: caveCatapult.w, h: caveCatapult.h };
            if (aabb(punchBox, catBox)) {
                p.punchHit = true;
                ensureAudio();
                if (audioCtx) playClang(audioCtx.currentTime);
                // Spark particles
                for (let i = 0; i < 8; i++) {
                    caveDeathParticles.push({
                        x: caveCatapult.x + caveCatapult.w / 2,
                        y: caveCatapult.y + caveCatapult.h / 2,
                        vx: (Math.random() - 0.5) * 4,
                        vy: (Math.random() - 0.5) * 4 - 1,
                        life: 10 + Math.random() * 10,
                        color: Math.random() > 0.5 ? "#00FFFF" : "#ffffff",
                        size: 1 + Math.random() * 2,
                    });
                }
                // Knockback player 2 tiles away from catapult
                const kbDx = p.x - caveCatapult.x;
                const kbDy = p.y - caveCatapult.y;
                const kbDirX = Math.abs(kbDx) >= Math.abs(kbDy) ? Math.sign(kbDx) : 0;
                const kbDirY = Math.abs(kbDx) >= Math.abs(kbDy) ? 0 : Math.sign(kbDy);
                for (let d = 2; d >= 1; d--) {
                    let tryX = p.x + kbDirX * d * CAVE_TILE;
                    let tryY = p.y + kbDirY * d * CAVE_TILE;
                    tryX = Math.max(CAVE_TILE * 2, Math.min((CAVE_COLS - 2) * CAVE_TILE, tryX));
                    tryY = Math.max(CAVE_TILE * 2, Math.min((CAVE_ROWS - 2) * CAVE_TILE, tryY));
                    if (!isCaveTileBlocked(tryX, tryY, null)) {
                        p.destX = tryX;
                        p.destY = tryY;
                        break;
                    }
                }
                caveScreenShake = 8;
                caveShakeIntensity = 3;
                caveDeathText = {
                    x: p.x - 16, y: p.y - 14,
                    timer: 50, text: "WHAT THE...?", color: "#FFFFFF", scale: 3,
                };
            }
        }
    }

    // Player movement (reuse main movement controls in cave bounds)
    if (!p.attacking || p.attackTimer < p.attackDuration - 4) {
        const atDest = Math.abs(p.x - p.destX) < 1 && Math.abs(p.y - p.destY) < 1;
        if (atDest) {
            p.x = p.destX;
            p.y = p.destY;
            let wantDir = -1;
            if (keys["ArrowLeft"] || keys["KeyA"]) wantDir = 2;
            else if (keys["ArrowRight"] || keys["KeyD"]) wantDir = 3;
            else if (keys["ArrowUp"] || keys["KeyW"]) wantDir = 1;
            else if (keys["ArrowDown"] || keys["KeyS"]) wantDir = 0;
            let dx = 0, dy = 0;
            if (wantDir >= 0) {
                if (p.dir !== wantDir) {
                    p.dir = wantDir;
                    p.turnDelay = 3;
                } else if (p.turnDelay > 0) {
                    p.turnDelay--;
                } else {
                    if (wantDir === 2) dx = -1;
                    else if (wantDir === 3) dx = 1;
                    else if (wantDir === 1) dy = -1;
                    else if (wantDir === 0) dy = 1;
                }
            }
            if (dx !== 0 || dy !== 0) {
                const newX = p.x + dx * CAVE_TILE;
                const newY = p.y + dy * CAVE_TILE;
                // Bound to cave walls
                if (newX >= CAVE_TILE * 2 && newX <= (CAVE_COLS - 2) * CAVE_TILE &&
                    newY >= CAVE_TILE * 2 && newY <= (CAVE_ROWS - 2) * CAVE_TILE) {
                    // Collision check: can't walk into goblins or catapult (matches overworld)
                    const ntx = Math.round(newX / CAVE_TILE) * CAVE_TILE;
                    const nty = Math.round(newY / CAVE_TILE) * CAVE_TILE;
                    let tileBlocked = false;
                    for (const cg of caveGoblins) {
                        if (cg.dead) continue;
                        if (Math.round(cg.destX / CAVE_TILE) * CAVE_TILE === ntx &&
                            Math.round(cg.destY / CAVE_TILE) * CAVE_TILE === nty) { tileBlocked = true; break; }
                    }
                    if (caveCatapult) {
                        if (Math.round(caveCatapult.x / CAVE_TILE) * CAVE_TILE === ntx &&
                            Math.round(caveCatapult.y / CAVE_TILE) * CAVE_TILE === nty) tileBlocked = true;
                    }
                    if (!tileBlocked) {
                        p.destX = newX;
                        p.destY = newY;
                    }
                }
            }
        } else {
            // Smooth movement toward destination
            const speed = p.speed;
            if (p.x < p.destX) p.x = Math.min(p.x + speed, p.destX);
            else if (p.x > p.destX) p.x = Math.max(p.x - speed, p.destX);
            if (p.y < p.destY) p.y = Math.min(p.y + speed, p.destY);
            else if (p.y > p.destY) p.y = Math.max(p.y - speed, p.destY);
            // Walk animation
            p.frameTimer++;
            if (p.frameTimer > 6) { p.frame = (p.frame + 1) % 4; p.frameTimer = 0; }
        }
    }

    // Attack timer
    if (p.attacking) {
        p.attackTimer--;
        if (p.attackTimer <= 0) {
            p.attacking = false;
        }
    }

    // Tile-blocked check for cave goblins (mirrors overworld isGobTileBlocked)
    function isCaveTileBlocked(tx, ty, excludeGob) {
        const ttx = Math.round(tx / CAVE_TILE) * CAVE_TILE;
        const tty = Math.round(ty / CAVE_TILE) * CAVE_TILE;
        const ptx = Math.round(p.x / CAVE_TILE) * CAVE_TILE;
        const pty = Math.round(p.y / CAVE_TILE) * CAVE_TILE;
        if (ttx === ptx && tty === pty) return true;
        if (caveCatapult) {
            const ctx2 = Math.round(caveCatapult.x / CAVE_TILE) * CAVE_TILE;
            const cty = Math.round(caveCatapult.y / CAVE_TILE) * CAVE_TILE;
            if (ttx === ctx2 && tty === cty) return true;
        }
        for (const og of caveGoblins) {
            if (og === excludeGob || og.dead) continue;
            if (Math.round(og.destX / CAVE_TILE) * CAVE_TILE === ttx &&
                Math.round(og.destY / CAVE_TILE) * CAVE_TILE === tty) return true;
        }
        return false;
    }

    // Update cave goblins AI — grid-aligned L-path movement (matches overworld)
    for (const cg of caveGoblins) {
        if (cg.dead) {
            if (cg.deathAnimActive) {
                cg.deathAnimTimer--;
                if (cg.deathAnimTimer <= 0) cg.deathAnimActive = false;
            }
            continue;
        }
        if (cg.hurtTimer > 0) {
            cg.hurtTimer--;
            // Move toward knockback destination
            if (cg.x < cg.destX) cg.x = Math.min(cg.x + 2, cg.destX);
            else if (cg.x > cg.destX) cg.x = Math.max(cg.x - 2, cg.destX);
            if (cg.y < cg.destY) cg.y = Math.min(cg.y + 2, cg.destY);
            else if (cg.y > cg.destY) cg.y = Math.max(cg.y - 2, cg.destY);
            continue;
        }

        const dx = cg.destX - cg.x;
        const dy = cg.destY - cg.y;
        const atDest = Math.abs(dx) < 1 && Math.abs(dy) < 1;

        if (atDest) {
            // Snap to tile grid
            cg.x = cg.destX;
            cg.y = cg.destY;

            // Pick next tile destination (L-path: one axis at a time)
            cg.moveSteps = (cg.moveSteps || 0) + 1;
            const maxSteps = cg.elite ? 3 : 5;

            // Elite: chase player. Normal: wander to random tile.
            if (cg.elite || cg.targetTileX < 0 || cg.moveSteps > maxSteps) {
                if (cg.elite) {
                    // Target player's current tile
                    cg.targetTileX = Math.round(p.x / CAVE_TILE) * CAVE_TILE;
                    cg.targetTileY = Math.round(p.y / CAVE_TILE) * CAVE_TILE;
                } else {
                    // Wander: pick random tile in arena
                    cg.targetTileX = (2 + Math.floor(Math.random() * (CAVE_COLS - 4))) * CAVE_TILE;
                    cg.targetTileY = (2 + Math.floor(Math.random() * (CAVE_ROWS - 4))) * CAVE_TILE;
                }
                cg.moveSteps = 0;
            }

            const gdx = cg.targetTileX - cg.x;
            const gdy = cg.targetTileY - cg.y;
            let nx = cg.x, ny = cg.y;

            // Move one tile on the axis with greater distance (L-path behavior)
            if (Math.abs(gdx) > Math.abs(gdy)) {
                nx += Math.sign(gdx) * CAVE_TILE;
                cg.dir = gdx > 0 ? 3 : 2;
            } else if (gdy !== 0) {
                ny += Math.sign(gdy) * CAVE_TILE;
                cg.dir = gdy > 0 ? 0 : 1;
            }

            // Clamp to cave bounds
            nx = Math.max(CAVE_TILE * 2, Math.min((CAVE_COLS - 2) * CAVE_TILE, nx));
            ny = Math.max(CAVE_TILE * 2, Math.min((CAVE_ROWS - 2) * CAVE_TILE, ny));

            // Collision check — try perpendicular if blocked
            if (!isCaveTileBlocked(nx, ny, cg)) {
                cg.destX = nx;
                cg.destY = ny;
                cg.stuckCount = 0;
            } else {
                // Try perpendicular axis
                let ax = cg.x, ay = cg.y;
                if (nx !== cg.x) {
                    if (gdy !== 0) { ay += Math.sign(gdy) * CAVE_TILE; cg.dir = gdy > 0 ? 0 : 1; }
                } else {
                    if (gdx !== 0) { ax += Math.sign(gdx) * CAVE_TILE; cg.dir = gdx > 0 ? 3 : 2; }
                }
                ax = Math.max(CAVE_TILE * 2, Math.min((CAVE_COLS - 2) * CAVE_TILE, ax));
                ay = Math.max(CAVE_TILE * 2, Math.min((CAVE_ROWS - 2) * CAVE_TILE, ay));
                if ((ax !== cg.x || ay !== cg.y) && !isCaveTileBlocked(ax, ay, cg)) {
                    cg.destX = ax;
                    cg.destY = ay;
                    cg.stuckCount = 0;
                } else {
                    // Anti-stuck: after 3 failed attempts, take one direct step
                    cg.stuckCount = (cg.stuckCount || 0) + 1;
                    if (cg.stuckCount >= 3) {
                        const sdx = p.x - cg.x;
                        const sdy = p.y - cg.y;
                        const sd = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
                        cg.x += (sdx / sd) * cg.speed;
                        cg.y += (sdy / sd) * cg.speed;
                        cg.stuckCount = 0;
                    }
                }
            }
        } else {
            // Smooth movement toward destination (one axis at a time, like overworld)
            if (Math.abs(dx) > 0) {
                cg.x += Math.sign(dx) * Math.min(cg.speed, Math.abs(dx));
            }
            if (Math.abs(dy) > 0) {
                cg.y += Math.sign(dy) * Math.min(cg.speed, Math.abs(dy));
            }
            cg.frameTimer++;
            if (cg.frameTimer >= 8) { cg.frameTimer = 0; cg.frame = (cg.frame + 1) % 4; }
        }
    }

    // Spawn more goblins over time
    const aliveCount = caveGoblins.filter(g => !g.dead).length;
    const maxCaveGobs = Math.min(6, 3 + Math.floor(caveKillCount / 3));
    if (aliveCount < maxCaveGobs && Math.random() < 0.01) {
        // 20% chance for elite after 4 kills
        const shouldElite = caveKillCount >= 4 && Math.random() < 0.2 &&
            !caveGoblins.some(g => !g.dead && g.elite);
        spawnCaveGoblin(shouldElite);
    }

    // Spawn catapult goblin after every 6 kills
    if (caveCatapultKillCount >= 6 && !caveCatapult) {
        spawnCaveCatapult();
        caveCatapultKillCount = 0;
    }

    // Update catapult goblin
    if (caveCatapult) {
        updateCaveCatapult();
    }

    // Update boulders
    for (let i = caveBoulders.length - 1; i >= 0; i--) {
        const b = caveBoulders[i];
        b.progress += 1/45;
        if (b.progress >= 1) {
            // Boulder impacts
            const impactX = b.targetX;
            const impactY = b.targetY;
            const blastRadius = CAVE_TILE * 2;

            // Check player hit
            const pdx = p.x + p.w / 2 - impactX;
            const pdy = p.y + p.h / 2 - impactY;
            if (Math.sqrt(pdx * pdx + pdy * pdy) < blastRadius) {
                // Player dies from boulder!
                cavePlayerDead = true;
                caveScreenShake = 15;
                caveShakeIntensity = 5;
                caveScreenFlash = 15;
                caveDeathText = {
                    x: p.x - 20, y: p.y - 15,
                    timer: 60, text: "CRUSHED!", color: "#FF0044", scale: 6,
                };
                if (audioCtx) {
                    const now = audioCtx.currentTime;
                    const osc = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(80, now);
                    osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
                    g.gain.setValueAtTime(0.4, now);
                    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    osc.connect(g); g.connect(audioCtx.destination);
                    osc.start(now); osc.stop(now + 0.5);
                }
            }

            // Check goblin kills in blast radius
            for (const cg of caveGoblins) {
                if (cg.dead) continue;
                const gdx = cg.x + cg.w / 2 - impactX;
                const gdy = cg.y + cg.h / 2 - impactY;
                if (Math.sqrt(gdx * gdx + gdy * gdy) < blastRadius) {
                    cg.dead = true;
                    cg.deathAnimActive = true;
                    cg.deathAnimTimer = 24;
                    caveKillCount++;
                    score += 50;
                    // Impact particles
                    for (let j = 0; j < 8; j++) {
                        caveDeathParticles.push({
                            x: cg.x + cg.w / 2, y: cg.y + cg.h / 2,
                            vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 - 1,
                            life: 20 + Math.random() * 15, color: "#8B4513", size: 3,
                        });
                    }
                }
            }

            // Impact particles (rock debris)
            for (let j = 0; j < 15; j++) {
                caveDeathParticles.push({
                    x: impactX, y: impactY,
                    vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5 - 2,
                    life: 25 + Math.random() * 20, color: j % 2 ? "#8B4513" : "#A0522D", size: 2 + Math.random() * 3,
                });
            }

            caveScreenShake = 8;
            caveShakeIntensity = 3;
            // Dust cloud ring
            caveBoulderImpacts.push({ x: impactX, y: impactY, timer: 20 });
            caveBoulders.splice(i, 1);

            // Impact sound
            if (audioCtx) {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
                g.gain.setValueAtTime(0.3, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.connect(g); g.connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.3);
            }
        }
    }

    // Update clock pickups
    for (let i = caveClockPickups.length - 1; i >= 0; i--) {
        const ck = caveClockPickups[i];
        ck.timer--;
        ck.bobPhase += 0.1;
        if (ck.timer <= 0) {
            caveClockPickups.splice(i, 1);
            continue;
        }
        // Check player pickup
        const pdx = p.x + p.w / 2 - (ck.x + 4);
        const pdy = p.y + p.h / 2 - ck.y;
        if (Math.abs(pdx) < CAVE_TILE && Math.abs(pdy) < CAVE_TILE) {
            minigameTimer += 5 * 60; // +5 seconds
            caveClockPickups.splice(i, 1);
            // Fanfare sound
            if (audioCtx) {
                const now = audioCtx.currentTime;
                [523, 659, 784].forEach((freq, fi) => {
                    const osc = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    osc.type = "triangle";
                    osc.frequency.setValueAtTime(freq, now + fi * 0.08);
                    g.gain.setValueAtTime(0.12, now + fi * 0.08);
                    g.gain.exponentialRampToValueAtTime(0.001, now + fi * 0.08 + 0.3);
                    osc.connect(g); g.connect(audioCtx.destination);
                    osc.start(now + fi * 0.08); osc.stop(now + fi * 0.08 + 0.3);
                });
            }
            // +5 text
            caveDeathText = {
                x: ck.x - 10, y: ck.y - 15,
                timer: 60, text: "+5 SECONDS!", color: "#00FF88", scale: 5,
            };
            caveScreenFlash = 5;
        }
    }

    // Update death particles
    for (let i = caveDeathParticles.length - 1; i >= 0; i--) {
        const dp = caveDeathParticles[i];
        dp.x += dp.vx;
        dp.y += dp.vy;
        dp.vy += 0.1; // gravity
        dp.life--;
        if (dp.life <= 0) caveDeathParticles.splice(i, 1);
    }

    // Update death text
    if (caveDeathText) {
        caveDeathText.timer--;
        caveDeathText.y -= 0.5;
        if (caveDeathText.timer <= 0) caveDeathText = null;
    }

    // Update rescue wall dust particles
    updateRescueWallDust();
}

function updateCaveCatapult() {
    const cat = caveCatapult;
    cat.phaseTimer++;

    if (cat.phase === "entering") {
        // Walk toward dest using one-axis-at-a-time (matching overworld)
        const dx = cat.destX - cat.x;
        const dy = cat.destY - cat.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < cat.speed) {
            cat.x = cat.destX;
            cat.y = cat.destY;
            cat.phase = "aiming";
            cat.phaseTimer = 0;
            // Snap target to nearest tile grid
            cat.targetX = Math.round(player.x / CAVE_TILE) * CAVE_TILE + CAVE_TILE / 2;
            cat.targetY = Math.round(player.y / CAVE_TILE) * CAVE_TILE + CAVE_TILE / 2;
        } else {
            if (Math.abs(dx) > Math.abs(dy)) {
                cat.x += Math.sign(dx) * Math.min(cat.speed, Math.abs(dx));
                cat.dir = dx > 0 ? 3 : 2;
            } else {
                cat.y += Math.sign(dy) * Math.min(cat.speed, Math.abs(dy));
                cat.dir = dy > 0 ? 0 : 1;
            }
            cat.frameTimer++;
            if (cat.frameTimer >= 8) { cat.frameTimer = 0; cat.frame = (cat.frame + 1) % 4; }
        }
    } else if (cat.phase === "aiming") {
        // Brief aim pause (40 frames)
        if (cat.phaseTimer > 40) {
            cat.phase = "launching";
            cat.phaseTimer = 0;
            // Fire boulder
            caveBoulders.push({
                startX: cat.x + CAVE_TILE / 2,
                startY: cat.y + CAVE_TILE / 2,
                targetX: cat.targetX,
                targetY: cat.targetY,
                progress: 0,
            });
            // Launch sound
            if (audioCtx) {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.3);
                g.gain.setValueAtTime(0.12, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.connect(g); g.connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.3);
            }
        }
    } else if (cat.phase === "launching") {
        if (cat.phaseTimer > 30) {
            cat.phase = "retreating";
            cat.phaseTimer = 0;
            // Set retreat destination back to spawn edge
            cat.destX = cat.spawnX;
            cat.destY = cat.spawnY;
        }
    } else if (cat.phase === "retreating") {
        // Walk back to spawn edge using one-axis-at-a-time (matching overworld)
        const dx = cat.destX - cat.x;
        const dy = cat.destY - cat.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < cat.speed) {
            caveCatapult = null; // gone
        } else {
            if (Math.abs(dx) > Math.abs(dy)) {
                cat.x += Math.sign(dx) * Math.min(cat.speed, Math.abs(dx));
                cat.dir = dx > 0 ? 3 : 2;
            } else {
                cat.y += Math.sign(dy) * Math.min(cat.speed, Math.abs(dy));
                cat.dir = dy > 0 ? 0 : 1;
            }
            cat.frameTimer++;
            if (cat.frameTimer >= 8) { cat.frameTimer = 0; cat.frame = (cat.frame + 1) % 4; }
        }
    }
}

function updateRescueWallDust() {
    // Spawn dust falling from boarded-up top entrances
    const intensity = rescueWallProgress;
    if (Math.random() < intensity * 0.3 && boardedEntrances.length > 0) {
        const ent = boardedEntrances[Math.floor(Math.random() * boardedEntrances.length)];
        rescueWallDust.push({
            x: ent.x + Math.random() * ent.w,
            y: CAVE_TILE * 2,
            vx: (Math.random() - 0.5) * 0.3,
            vy: 0.3 + Math.random() * 0.5,
            life: 30 + Math.random() * 30,
            size: 1 + Math.random() * (1 + intensity * 3),
            alpha: 0.3 + intensity * 0.5,
        });
    }
    for (let i = rescueWallDust.length - 1; i >= 0; i--) {
        const d = rescueWallDust[i];
        d.x += d.vx;
        d.y += d.vy;
        d.life--;
        d.alpha *= 0.98;
        if (d.life <= 0) rescueWallDust.splice(i, 1);
    }
}

function renderMinigameArena() {
    const W = CAVE_COLS * CAVE_TILE;
    const H = CAVE_ROWS * CAVE_TILE;

    // Screen shake
    if (caveScreenShake > 0) {
        const sx = (Math.random() - 0.5) * 2 * caveShakeIntensity * SCALE;
        const sy = (Math.random() - 0.5) * 2 * caveShakeIntensity * SCALE;
        ctx.save();
        ctx.translate(sx, sy);
    }

    // Dark cave background
    drawRect(0, 0, W, H, "#0a0f0a");

    // Stone floor texture
    for (let r = 2; r < CAVE_ROWS - 1; r++) {
        for (let c = 2; c < CAVE_COLS - 1; c++) {
            let seed = r * 997 + c * 31;
            seed = (seed * 9301 + 49297) % 233280;
            const bright = (seed / 233280) > 0.6;
            const floorCol = bright ? "#152015" : "#111911";
            drawRect(c * CAVE_TILE, r * CAVE_TILE, CAVE_TILE, CAVE_TILE, floorCol);
            // Subtle stone grain
            for (let i = 0; i < 4; i++) {
                seed = (seed * 9301 + 49297) % 233280;
                const gx = seed % CAVE_TILE;
                seed = (seed * 9301 + 49297) % 233280;
                const gy = seed % CAVE_TILE;
                drawRect(c * CAVE_TILE + gx, r * CAVE_TILE + gy, 1, 1, "rgba(255,255,255,0.03)");
            }
        }
    }

    // Cave walls — dark stone
    // Top wall
    for (let c = 0; c < CAVE_COLS; c++) {
        for (let r = 0; r < 2; r++) {
            const shade = (c + r) % 2 === 0 ? "#1e2e1e" : "#1a2a1a";
            drawRect(c * CAVE_TILE, r * CAVE_TILE, CAVE_TILE, CAVE_TILE, shade);
        }
        // Stalactites hanging from ceiling
        if (c % 3 === 1) {
            const stalH = 4 + (c * 7) % 6;
            drawRect(c * CAVE_TILE + 5, 2 * CAVE_TILE, 3, stalH, "#243024");
            drawRect(c * CAVE_TILE + 6, 2 * CAVE_TILE, 1, stalH + 2, "#2a3a2a");
        }
    }
    // Bottom wall
    for (let c = 0; c < CAVE_COLS; c++) {
        const shade = c % 2 === 0 ? "#1e2e1e" : "#1a2a1a";
        drawRect(c * CAVE_TILE, (CAVE_ROWS - 1) * CAVE_TILE, CAVE_TILE, CAVE_TILE, shade);
        // Stalagmites
        if (c % 4 === 2) {
            const stalH = 3 + (c * 5) % 5;
            drawRect(c * CAVE_TILE + 6, (CAVE_ROWS - 1) * CAVE_TILE - stalH, 3, stalH, "#243024");
        }
    }
    // Right wall
    for (let r = 0; r < CAVE_ROWS; r++) {
        const shade = r % 2 === 0 ? "#1e2e1e" : "#1a2a1a";
        drawRect((CAVE_COLS - 1) * CAVE_TILE, r * CAVE_TILE, CAVE_TILE, CAVE_TILE, shade);
    }

    // Left wall (normal wall — no longer the rescue wall)
    for (let r = 0; r < CAVE_ROWS; r++) {
        for (let c = 0; c < 2; c++) {
            const shade = r % 2 === 0 ? "#243024" : "#1e2e1e";
            drawRect(c * CAVE_TILE, r * CAVE_TILE, CAVE_TILE, CAVE_TILE, shade);
        }
    }

    // Boarded-up cave entrances at the top wall
    if (caveBoardedUp || boardProgress > 0) {
        const bp = caveBoardedUp ? 1 : boardProgress;
        for (let ei = 0; ei < boardedEntrances.length; ei++) {
            const ent = boardedEntrances[ei];
            // Draw dark cave opening behind the boards
            drawRect(ent.x, 0, ent.w, CAVE_TILE * 2, "#0a0604");

            // Draw wooden boards across the entrance (progressively appearing)
            const numBoards = Math.floor(bp * 4);
            for (let b = 0; b < numBoards; b++) {
                const boardY = b * (CAVE_TILE * 2 / 4);
                const boardH = CAVE_TILE * 2 / 4 - 1;
                // Main board plank
                drawRect(ent.x + 1, boardY + 1, ent.w - 2, boardH, "#8B6914");
                // Wood grain lines
                drawRect(ent.x + 3, boardY + 2, ent.w - 6, 1, "#A07828");
                drawRect(ent.x + 2, boardY + boardH - 2, ent.w - 4, 1, "#7A5A10");
                // Nails at ends
                drawRect(ent.x + 3, boardY + boardH / 2, 2, 2, "#888");
                drawRect(ent.x + ent.w - 5, boardY + boardH / 2, 2, 2, "#888");
            }

            // Partially placed board during boarding animation
            if (!caveBoardedUp && numBoards < 4) {
                const partialBoard = numBoards;
                const partialProgress = (bp * 4) - numBoards;
                const boardY = partialBoard * (CAVE_TILE * 2 / 4);
                const boardH = CAVE_TILE * 2 / 4 - 1;
                const drawnW = (ent.w - 2) * partialProgress;
                drawRect(ent.x + 1, boardY + 1, drawnW, boardH, "#8B6914");
                if (drawnW > 6) {
                    drawRect(ent.x + 3, boardY + 2, drawnW - 4, 1, "#A07828");
                }
            }
        }
    }

    // Cracks on boarded entrances — intensity scales with rescue progress
    if (caveBoardedUp && rescueWallProgress > 0) {
        const crackAlpha = Math.min(1, rescueWallProgress * 1.5);
        ctx.save();
        ctx.globalAlpha = crackAlpha;
        for (let ei = 0; ei < boardedEntrances.length; ei++) {
            const ent = boardedEntrances[ei];
            const numCracks = Math.floor(2 + rescueWallProgress * 8);
            for (let i = 0; i < numCracks; i++) {
                let seed = (ei * 3 + i) * 7919 + 42;
                seed = (seed * 9301 + 49297) % 233280;
                const startX = ent.x + (seed / 233280) * ent.w;
                seed = (seed * 9301 + 49297) % 233280;
                const len = 2 + (seed / 233280) * (4 + rescueWallProgress * 10);
                seed = (seed * 9301 + 49297) % 233280;
                const angle = Math.PI / 2 + (seed / 233280 - 0.5) * 0.8;
                const crackWidth = 1 + Math.floor(rescueWallProgress * 2);
                for (let j = 0; j < len; j++) {
                    const cx = startX + j * Math.cos(angle);
                    const cy = j * Math.sin(angle);
                    drawRect(cx, cy, crackWidth, 1, "#000");
                }
            }

            // Boards bulging/splintering at high progress
            if (rescueWallProgress > 0.7) {
                const bulge = (rescueWallProgress - 0.7) * 8;
                drawRect(ent.x + ent.w / 2 - 3, 2 * CAVE_TILE + bulge, 6, 3, "#8B6914");
                drawRect(ent.x + ent.w / 2 - 2, 2 * CAVE_TILE + bulge + 1, 4, 1, "#7A5A10");
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Dust particles falling from boarded entrances
    for (const d of rescueWallDust) {
        ctx.globalAlpha = d.alpha;
        drawRect(d.x, d.y, d.size, d.size, "#C4A882");
        ctx.globalAlpha = 1;
    }

    // Torches on all cave walls
    const torchPositions = [
        // Right wall
        { x: (CAVE_COLS - 2) * CAVE_TILE, y: 3 * CAVE_TILE },
        { x: (CAVE_COLS - 2) * CAVE_TILE, y: 8 * CAVE_TILE },
        { x: (CAVE_COLS - 2) * CAVE_TILE, y: 13 * CAVE_TILE },
        // Left wall
        { x: 1 * CAVE_TILE, y: 3 * CAVE_TILE },
        { x: 1 * CAVE_TILE, y: 8 * CAVE_TILE },
        { x: 1 * CAVE_TILE, y: 13 * CAVE_TILE },
        // Top wall (between boarded entrances)
        { x: 7 * CAVE_TILE, y: 2 * CAVE_TILE },
        { x: 14 * CAVE_TILE, y: 2 * CAVE_TILE },
        // Bottom wall
        { x: 5 * CAVE_TILE, y: (CAVE_ROWS - 2) * CAVE_TILE },
        { x: 11 * CAVE_TILE, y: (CAVE_ROWS - 2) * CAVE_TILE },
        { x: 17 * CAVE_TILE, y: (CAVE_ROWS - 2) * CAVE_TILE },
    ];
    for (const t of torchPositions) {
        drawCaveTorch(t.x, t.y);
    }

    // Draw clock pickups
    for (const ck of caveClockPickups) {
        const bobY = Math.sin(ck.bobPhase) * 3;
        const blinkOn = ck.timer < 90 ? (ck.timer % 10 < 5) : true;
        if (blinkOn) {
            const cx = ck.x + 4;
            const cy = ck.y + bobY + 4;
            // Pulsing glow halo
            const glowPulse = 0.06 + Math.sin(ck.bobPhase * 1.5) * 0.04;
            ctx.globalAlpha = glowPulse;
            for (let r = 12; r > 4; r -= 3) {
                drawRect(cx - r, cy - r, r * 2, r * 2, "#FFD700");
            }
            ctx.globalAlpha = 1;
            // Clock icon (yellow square with hands) — slightly pulsing size
            const sizePulse = Math.sin(ck.bobPhase) * 0.5;
            const sz = Math.round(8 + sizePulse);
            const off = Math.round((8 - sz) / 2);
            drawRect(ck.x + off, ck.y + bobY + off, sz, sz, "#FFD700");
            drawRect(ck.x + off + 1, ck.y + bobY + off + 1, sz - 2, sz - 2, "#0a0f0a");
            drawRect(ck.x + 3, ck.y + bobY + 2, 1, 3, "#FFD700"); // minute hand
            drawRect(ck.x + 3, ck.y + bobY + 3, 2, 1, "#FFD700"); // hour hand
            // "+5" text above
            ctx.textAlign = "center";
            ctx.font = `${7 * SCALE}px monospace`;
            ctx.fillStyle = "#000";
            ctx.fillText("+5", (ck.x + 4) * SCALE + SCALE, (ck.y + bobY - 3) * SCALE + SCALE);
            ctx.fillStyle = "#00FF88";
            ctx.fillText("+5", (ck.x + 4) * SCALE, (ck.y + bobY - 3) * SCALE);
        }
    }

    // Draw boulders in flight
    for (const b of caveBoulders) {
        const t = b.progress;
        const bx = b.startX + (b.targetX - b.startX) * t;
        const baseY = b.startY + (b.targetY - b.startY) * t;
        // Parabolic arc (matching overworld: 40px peak)
        const arcHeight = 40;
        const arcY = -4 * arcHeight * t * (1 - t);
        const by = baseY + arcY;

        // Dust/smoke trail (matching overworld)
        const trailCount = 5;
        for (let ti = 0; ti < trailCount; ti++) {
            const trailT = Math.max(0, t - ti * 0.04);
            const tx = b.startX + (b.targetX - b.startX) * trailT;
            const tBaseY = b.startY + (b.targetY - b.startY) * trailT;
            const tArcY = -4 * arcHeight * trailT * (1 - trailT);
            const ty = tBaseY + tArcY;
            const trailAlpha = (1 - ti / trailCount) * 0.3 * (1 - t);
            ctx.globalAlpha = trailAlpha;
            const trailSize = (3 + ti * 2) * SCALE;
            ctx.fillStyle = ti % 2 === 0 ? "#aaaaaa" : "#888888";
            ctx.fillRect(tx * SCALE - trailSize / 2, ty * SCALE - trailSize / 2, trailSize, trailSize);
        }
        ctx.globalAlpha = 1.0;

        // Shadow on ground (grows as boulder descends)
        const shadowPx = (3 + (1 - Math.abs(arcY) / arcHeight) * 4) * SCALE;
        const sx = bx * SCALE - shadowPx / 2;
        const sy = b.targetY * SCALE + 6;
        drawPx(sx, sy, shadowPx, 6, PAL.shadow);

        // Boulder (detailed rock sprite — matching overworld)
        const rx = bx * SCALE - 12;
        const ry = by * SCALE - 12;
        drawPx(rx + 3, ry, 18, 24, "#6a6a6a");
        drawPx(rx, ry + 3, 24, 18, "#6a6a6a");
        drawPx(rx + 3, ry + 3, 18, 18, "#888888");
        drawPx(rx + 3, ry + 3, 9, 6, "#aaaaaa");
        drawPx(rx + 3, ry + 3, 6, 9, "#aaaaaa");
        drawPx(rx + 15, ry + 15, 6, 6, "#392a1c");
        drawPx(rx + 18, ry + 9, 3, 9, "#392a1c");
        drawPx(rx + 9, ry + 9, 3, 9, "#5a5a5a");
        drawPx(rx + 12, ry + 12, 6, 3, "#5a5a5a");
    }

    // Draw boulder impact dust clouds
    for (let i = caveBoulderImpacts.length - 1; i >= 0; i--) {
        const imp = caveBoulderImpacts[i];
        const progress = 1 - imp.timer / 20;
        const radius = 6 + progress * 10;
        ctx.globalAlpha = (1 - progress) * 0.3;
        drawRect(imp.x - radius, imp.y - radius / 2, radius * 2, radius, "#C4A882");
        ctx.globalAlpha = (1 - progress) * 0.15;
        drawRect(imp.x - radius * 0.6, imp.y - radius * 0.3, radius * 1.2, radius * 0.6, "#A0522D");
        ctx.globalAlpha = 1;
        imp.timer--;
        if (imp.timer <= 0) caveBoulderImpacts.splice(i, 1);
    }

    // Draw catapult goblin
    if (caveCatapult) {
        drawGoblinSprite("catapult",
            caveCatapult.x, caveCatapult.y,
            caveCatapult.frame, { dir: caveCatapult.dir });
        // Aim indicator when aiming — tile-based flash (matches overworld)
        if (caveCatapult.phase === "aiming") {
            const flashOn = Math.floor(caveCatapult.phaseTimer / 4) % 2 === 0;
            if (flashOn) {
                const ttx = Math.round(caveCatapult.targetX / CAVE_TILE) * CAVE_TILE;
                const tty = Math.round(caveCatapult.targetY / CAVE_TILE) * CAVE_TILE;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const rx = ttx + dc * CAVE_TILE;
                        const ry = tty + dr * CAVE_TILE;
                        // Bounds check (inside cave walls)
                        if (rx >= CAVE_TILE * 2 && rx <= (CAVE_COLS - 2) * CAVE_TILE &&
                            ry >= CAVE_TILE * 2 && ry <= (CAVE_ROWS - 2) * CAVE_TILE) {
                            ctx.fillStyle = "#ff4400";
                            ctx.globalAlpha = 0.35;
                            ctx.fillRect(rx * SCALE, ry * SCALE, CAVE_TILE * SCALE, CAVE_TILE * SCALE);
                            ctx.globalAlpha = 1.0;
                            ctx.strokeStyle = "#ff6600";
                            ctx.lineWidth = SCALE;
                            ctx.strokeRect(rx * SCALE + SCALE, ry * SCALE + SCALE, CAVE_TILE * SCALE - 2 * SCALE, CAVE_TILE * SCALE - 2 * SCALE);
                        }
                    }
                }
            }
        }
    }

    // Draw cave goblins (unified with overworld rendering)
    for (const cg of caveGoblins) {
        if (cg.dead && !cg.deathAnimActive) continue;
        if (cg.deathAnimActive) {
            // Shrink-spin-dissolve (matches overworld death animation)
            const progress = 1 - cg.deathAnimTimer / 24; // 0→1
            const scale = 1 - progress * 0.85; // shrink to 15%
            const alpha = 1 - progress * 0.9;  // fade to 10%
            const rotation = progress * Math.PI * 2.5; // 2.5 full spins
            const cx = (cg.x + cg.w / 2) * SCALE;
            const cy = (cg.y + cg.h / 2) * SCALE;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
            ctx.globalAlpha = alpha;
            // Flash between normal colors and white as it dissolves
            if (progress > 0.5 && Math.floor(cg.deathAnimTimer) % 3 === 0) {
                drawGoblinSprite(cg.deathAnimElite ? "elite" : "normal", cg.x, cg.y, 0, {
                    dir: cg.dir, bodyCol: "#ffffff", darkCol: "#dddddd", headCol: "#ffffff", eyeCol: "#00FFFF"
                });
            } else {
                drawGoblinFor(cg);
            }
            ctx.restore();
            ctx.globalAlpha = 1.0;
            // Death particle bursts during countdown
            if (cg.deathAnimTimer % 4 === 0) {
                const burstCount = cg.deathAnimElite ? 4 : 2;
                for (let i = 0; i < burstCount; i++) {
                    caveDeathParticles.push({
                        x: cg.x + cg.w / 2, y: cg.y + cg.h / 2,
                        vx: (Math.random() - 0.5) * 3,
                        vy: (Math.random() - 0.5) * 3,
                        life: 20 + Math.random() * 10,
                        size: 2 + Math.random() * 2,
                        color: cg.deathAnimElite ? "#FF69B4" : "#39FF14"
                    });
                }
            }
            continue;
        }
        drawGoblinFor(cg);
    }

    // Punch target tile indicator (gold corner brackets — matches overworld)
    if (!cavePlayerDead && !player.attacking && player.x === player.destX && player.y === player.destY) {
        const ptx = Math.round(player.x / CAVE_TILE);
        const pty = Math.round(player.y / CAVE_TILE);
        let ttx = ptx, tty = pty;
        switch (player.dir) {
            case 0: tty += 1; break;
            case 1: tty -= 1; break;
            case 2: ttx -= 1; break;
            case 3: ttx += 1; break;
        }
        const tx = ttx * CAVE_TILE;
        const ty = tty * CAVE_TILE;
        const pulse = 0.35 + Math.sin(performance.now() * 0.004) * 0.2;
        const c = PAL.punch;
        const s = 2, L = 5;
        ctx.globalAlpha = 0.08;
        drawRect(tx + 1, ty + 1, CAVE_TILE - 2, CAVE_TILE - 2, c);
        ctx.globalAlpha = pulse;
        drawRect(tx, ty, L, s, c); drawRect(tx, ty, s, L, c);
        drawRect(tx + CAVE_TILE - L, ty, L, s, c); drawRect(tx + CAVE_TILE - s, ty, s, L, c);
        drawRect(tx, ty + CAVE_TILE - s, L, s, c); drawRect(tx, ty + CAVE_TILE - L, s, L, c);
        drawRect(tx + CAVE_TILE - L, ty + CAVE_TILE - s, L, s, c); drawRect(tx + CAVE_TILE - s, ty + CAVE_TILE - L, s, L, c);
        ctx.globalAlpha = 1.0;
    }

    // Draw player (unless dead)
    if (!cavePlayerDead) {
        // Punch (draw behind player for up-facing)
        if (player.attacking && player.dir === 1) drawPunch();
        drawPlayer();
        // Punch (in front for down/left/right)
        if (player.attacking && player.dir !== 1) drawPunch();
    } else {
        // Dead player — flat on ground
        ctx.globalAlpha = 0.6;
        drawRect(player.x, player.y + 8, TILE, 4, "#efb775");
        ctx.globalAlpha = 1;
    }

    // Death particles
    for (const dp of caveDeathParticles) {
        ctx.globalAlpha = dp.life / 30;
        drawRect(dp.x, dp.y, dp.size, dp.size, dp.color);
        ctx.globalAlpha = 1;
    }

    // Death text (matches overworld style)
    if (caveDeathText) {
        ctx.globalAlpha = Math.min(1, caveDeathText.timer / 20);
        drawText(caveDeathText.text, caveDeathText.x + 20, caveDeathText.y, caveDeathText.color, caveDeathText.scale);
        ctx.globalAlpha = 1;
    }

    // Screen flash (matches overworld style)
    if (caveScreenFlash > 0) {
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = Math.min(1, caveScreenFlash / 15) * 0.6;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    // "SURVIVE!" text at top
    ctx.font = `${6 * SCALE}px monospace`;
    ctx.fillStyle = "#000";
    ctx.fillText("SURVIVE!", (W / 2) * SCALE + SCALE, 2 * SCALE + SCALE);
    ctx.fillStyle = "#FF4400";
    ctx.fillText("SURVIVE!", (W / 2) * SCALE, 2 * SCALE);

    // Rescue progress hint — boards cracking overhead
    if (rescueWallProgress > 0.3) {
        const hintAlpha = Math.sin(minigameTimer * 0.05) * 0.3 + 0.5;
        ctx.globalAlpha = hintAlpha;
        ctx.font = `${4 * SCALE}px monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#FFD700";
        ctx.fillText("HELP IS COMING...", (W / 2) * SCALE, (CAVE_TILE * 3 + 6) * SCALE);
        ctx.globalAlpha = 1;
    }

    ctx.textAlign = "start";

    if (caveScreenShake > 0) {
        ctx.restore();
    }

    // Render HUD strip (same style as main gameplay)
    renderMinigameHUD();
}

function drawCaveTorch(x, y) {
    // Torch handle
    drawRect(x + 6, y + 4, 3, 10, "#8B4513");
    drawRect(x + 7, y + 4, 1, 10, "#A0522D");
    // Flame (animated)
    const flicker = Math.sin(performance.now() * 0.01 + x) * 2;
    const flicker2 = Math.cos(performance.now() * 0.013 + y) * 1.5;
    // Outer flame (orange)
    drawRect(x + 5 + flicker2, y - 1, 5, 6, "#FF6600");
    // Inner flame (yellow)
    drawRect(x + 6 + flicker, y, 3, 4, "#FFD700");
    // Core (white-hot)
    drawRect(x + 7, y + 1, 1, 2, "#FFFACD");
    // Glow effect
    ctx.globalAlpha = 0.08 + Math.sin(performance.now() * 0.008 + x) * 0.03;
    const glowR = 20 + flicker * 2;
    for (let r = glowR; r > 0; r -= 4) {
        drawRect(x + 7 - r, y + 2 - r, r * 2, r * 2, "#FF8C00");
    }
    ctx.globalAlpha = 1;
    // Warm floor light pool below torch
    const floorPulse = 0.04 + Math.sin(performance.now() * 0.006 + x * 0.7) * 0.02;
    ctx.globalAlpha = floorPulse;
    drawRect(x - 4, y + 14, 24, 10, "#FF8C00");
    ctx.globalAlpha = floorPulse * 0.6;
    drawRect(x - 8, y + 16, 32, 6, "#FF6600");
    ctx.globalAlpha = 1;
}

function startMinigameRescue() {
    minigameState = "rescue";
    minigameRescueTimer = 0;
    minigameRescuePhase = 0;
    rescueBoardBreakPhase = 0; // staggered board breaking: 0=buildup, 1/2/3=each entrance bursts
    stopMinigameMusic();

    // Set up rescue dancers — they spill in from the top through broken boards
    // Spread across the 3 boarded entrances (staggered)
    rescueDancers = [];
    for (let i = 0; i < 4; i++) {
        const entIdx = i < 3 ? i : 1; // 1 per entrance, 4th goes to center
        const ent = boardedEntrances[entIdx];
        rescueDancers.push({
            x: ent.x + ent.w / 2 - CAVE_TILE / 2 + (i === 3 ? CAVE_TILE : 0),
            y: -CAVE_TILE * (2 + i),
            palette: i % DANCER_PALETTES.length,
            frame: 0,
            hasTorch: true,
        });
    }

    // Track which entrances have been broken open
    rescueBrokenEntrances = [false, false, false];

    // Play dramatic buildup — deep rumble before the break
    if (audioCtx) {
        const now = audioCtx.currentTime;
        // Ominous buildup rumble
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(30, now);
        osc.frequency.linearRampToValueAtTime(60, now + 1.5);
        g.gain.setValueAtTime(0.15, now);
        g.gain.linearRampToValueAtTime(0.35, now + 1.5);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 1.8);

        // Staggered crash sounds for each entrance breaking
        for (let b = 0; b < 3; b++) {
            const t = now + 1.0 + b * 0.4; // each entrance breaks 0.4s apart
            // Wood splintering crack
            const crack = audioCtx.createOscillator();
            const cg = audioCtx.createGain();
            crack.type = "square";
            crack.frequency.setValueAtTime(400 - b * 60, t);
            crack.frequency.exponentialRampToValueAtTime(50, t + 0.15);
            cg.gain.setValueAtTime(0.2, t);
            cg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            crack.connect(cg); cg.connect(audioCtx.destination);
            crack.start(t); crack.stop(t + 0.2);
            // Burst noise
            const bufLen = Math.floor(audioCtx.sampleRate * 0.4);
            const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
            const noise = audioCtx.createBufferSource();
            noise.buffer = buf;
            const ng = audioCtx.createGain();
            ng.gain.setValueAtTime(0.15, t);
            ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            noise.connect(ng); ng.connect(audioCtx.destination);
            noise.start(t);
        }
    }

    // Initial subtle shake during buildup
    caveScreenShake = 10;
    caveShakeIntensity = 2;
    caveScreenFlash = 0;
}

function updateMinigameRescue() {
    minigameRescueTimer++;

    // Decrement screen effects (carried over from arena state)
    if (caveScreenFlash > 0) caveScreenFlash--;

    if (minigameRescuePhase === 0) {
        // Dramatic staggered board-breaking — each entrance bursts one at a time
        if (caveScreenShake > 0) caveScreenShake--;

        // Buildup phase: subtle dust and growing shake (first 60 frames)
        if (minigameRescueTimer < 60) {
            // Growing shake intensity
            caveShakeIntensity = Math.min(4, 1 + minigameRescueTimer * 0.05);
            caveScreenShake = Math.max(caveScreenShake, 5);
            // Dust falls from all entrances during buildup
            if (minigameRescueTimer % 4 === 0) {
                for (const ent of boardedEntrances) {
                    caveDeathParticles.push({
                        x: ent.x + Math.random() * ent.w,
                        y: CAVE_TILE * 2,
                        vx: (Math.random() - 0.5) * 1,
                        vy: 0.5 + Math.random() * 1,
                        life: 20 + Math.random() * 15,
                        color: "#C4A882",
                        size: 1 + Math.random() * 2,
                    });
                }
            }
        }

        // Each entrance breaks at staggered intervals (frames 60, 84, 108)
        const breakFrames = [60, 84, 108];
        for (let b = 0; b < 3; b++) {
            if (minigameRescueTimer === breakFrames[b]) {
                rescueBrokenEntrances[b] = true;
                // Big shake on each break
                caveScreenShake = 25 + b * 5;
                caveShakeIntensity = 8 + b * 2;
                // Bright flash
                caveScreenFlash = 12 + b * 3;

                // Massive particle burst from this entrance
                const ent = boardedEntrances[b];
                // Big wood plank pieces
                for (let p = 0; p < 12; p++) {
                    caveDeathParticles.push({
                        x: ent.x + Math.random() * ent.w,
                        y: CAVE_TILE + Math.random() * CAVE_TILE,
                        vx: (Math.random() - 0.5) * 8,
                        vy: 2 + Math.random() * 6,
                        life: 40 + Math.random() * 40,
                        color: p % 3 === 0 ? "#8B6914" : p % 3 === 1 ? "#A07828" : "#6B4F12",
                        size: 4 + Math.random() * 6,
                    });
                }
                // Sawdust cloud
                for (let p = 0; p < 15; p++) {
                    caveDeathParticles.push({
                        x: ent.x + Math.random() * ent.w,
                        y: CAVE_TILE * 2,
                        vx: (Math.random() - 0.5) * 5,
                        vy: 1 + Math.random() * 4,
                        life: 25 + Math.random() * 30,
                        color: p % 2 ? "#C4A882" : "#D4B892",
                        size: 2 + Math.random() * 3,
                    });
                }
                // Nail sparks
                for (let p = 0; p < 6; p++) {
                    caveDeathParticles.push({
                        x: ent.x + (p < 3 ? 3 : ent.w - 5),
                        y: CAVE_TILE,
                        vx: (Math.random() - 0.5) * 6,
                        vy: 1 + Math.random() * 5,
                        life: 15 + Math.random() * 15,
                        color: "#FFD700",
                        size: 1 + Math.random() * 2,
                    });
                }
            }
        }

        // Ongoing splinter rain from broken entrances
        if (minigameRescueTimer > 60 && minigameRescueTimer < 120) {
            for (let b = 0; b < 3; b++) {
                if (rescueBrokenEntrances[b] && Math.random() < 0.4) {
                    const ent = boardedEntrances[b];
                    caveDeathParticles.push({
                        x: ent.x + Math.random() * ent.w,
                        y: CAVE_TILE * 2,
                        vx: (Math.random() - 0.5) * 2,
                        vy: 0.5 + Math.random() * 2,
                        life: 20 + Math.random() * 20,
                        color: Math.random() > 0.5 ? "#8B6914" : "#A07828",
                        size: 2 + Math.random() * 3,
                    });
                }
            }
        }

        // All three broken — boards fully cleared, transition to dancers entering
        if (minigameRescueTimer > 130) {
            caveBoardedUp = false;
            minigameRescuePhase = 1;
            minigameRescueTimer = 0;
        }
    } else if (minigameRescuePhase === 1) {
        // Dancers rush in from the top through broken boarded entrances
        let allIn = true;
        for (let i = 0; i < rescueDancers.length; i++) {
            const d = rescueDancers[i];
            const targetY = CAVE_TILE * (4 + i * 2);
            if (d.y < targetY) {
                d.y += 2;
                allIn = false;
            }
        }

        // Kill remaining goblins as dancers enter
        if (minigameRescueTimer === 30) {
            for (const cg of caveGoblins) {
                if (!cg.dead) {
                    cg.dead = true;
                    cg.deathAnimActive = true;
                    cg.deathAnimTimer = 24;
                }
            }
            if (caveCatapult) caveCatapult = null;
        }

        // Revive player if dead
        if (cavePlayerDead && minigameRescueTimer > 20) {
            cavePlayerDead = false;
        }

        if (allIn && minigameRescueTimer > 90) {
            minigameRescuePhase = 2;
            minigameRescueTimer = 0;
            // Play victory fanfare
            playLevelFanfare();
        }
    } else if (minigameRescuePhase === 2) {
        // Celebration — transition to reward
        if (minigameRescueTimer > 120) {
            startMinigameReward();
        }
    }

    // Update particles
    for (let i = caveDeathParticles.length - 1; i >= 0; i--) {
        const dp = caveDeathParticles[i];
        dp.x += dp.vx;
        dp.y += dp.vy;
        dp.vy += 0.1;
        dp.life--;
        if (dp.life <= 0) caveDeathParticles.splice(i, 1);
    }
}

function renderMinigameRescue() {
    // Render cave arena underneath
    renderMinigameArena();

    const W = CAVE_COLS * CAVE_TILE;
    const H = CAVE_ROWS * CAVE_TILE;

    // Staggered board breaking — show each entrance's state during phase 0 and the open gaps after
    for (let ei = 0; ei < boardedEntrances.length; ei++) {
        const ent = boardedEntrances[ei];
        if (rescueBrokenEntrances[ei]) {
            // This entrance has been smashed open — dark gap with debris
            drawRect(ent.x, 0, ent.w, CAVE_TILE * 2, "#0a0604");
            // Splintered wood edges framing the opening
            for (let i = 0; i < 6; i++) {
                const sx = ent.x + ((i * 7 + 3) % ent.w);
                const sy = CAVE_TILE * 2 - 3 + (i % 3) * 2;
                const sw = 2 + (i % 2) * 2;
                const sh = 1 + (i % 2);
                drawRect(sx, sy, sw, sh, i % 2 ? "#8B6914" : "#6B4F12");
            }
            // Hanging board fragment at top
            drawRect(ent.x + ent.w / 2 - 4, 0, 8, 3 + Math.sin(performance.now() * 0.003 + ei) * 1, "#8B6914");
            // Light spilling in from above
            ctx.globalAlpha = 0.06;
            drawRect(ent.x + 2, CAVE_TILE * 2, ent.w - 4, CAVE_TILE * 4, "#FFD080");
            ctx.globalAlpha = 1;
        } else if (minigameRescuePhase === 0) {
            // Boards still intact during buildup — show them shaking/bulging
            const shake = Math.min(1, minigameRescueTimer / 60);
            const jitter = Math.sin(minigameRescueTimer * 0.5 + ei * 2) * shake * 2;
            // Re-draw boards over the arena's existing boards with a shake offset
            drawRect(ent.x, 0, ent.w, CAVE_TILE * 2, "#0a0604");
            for (let b = 0; b < 4; b++) {
                const boardY = b * (CAVE_TILE * 2 / 4);
                const boardH = CAVE_TILE * 2 / 4 - 1;
                drawRect(ent.x + 1 + jitter, boardY + 1, ent.w - 2, boardH, "#8B6914");
                drawRect(ent.x + 3 + jitter, boardY + 2, ent.w - 6, 1, "#A07828");
                drawRect(ent.x + 3, boardY + boardH / 2, 2, 2, "#888");
                drawRect(ent.x + ent.w - 5, boardY + boardH / 2, 2, 2, "#888");
            }
            // Bulging cracks at high buildup
            if (shake > 0.5) {
                const bulge = (shake - 0.5) * 6;
                ctx.globalAlpha = shake;
                drawRect(ent.x + ent.w / 2 - 4, CAVE_TILE * 2 + bulge, 8, 3, "#8B6914");
                for (let cr = 0; cr < 3; cr++) {
                    const cx = ent.x + ent.w * (0.2 + cr * 0.3);
                    drawRect(cx, CAVE_TILE * 0.5 + cr * 4, 1 + Math.floor(shake), cr * 3 + 2, "#000");
                }
                ctx.globalAlpha = 1;
            }
        }
    }

    // Draw rescue dancers with torches
    for (let di = 0; di < rescueDancers.length; di++) {
        const d = rescueDancers[di];
        if (d.y > 0) {
            const walkPhase = Math.sin(minigameRescueTimer * 0.15 + di * 2);
            const bob = minigameRescuePhase < 2 ? Math.abs(walkPhase) * 2 : 0;
            const footOfs = minigameRescuePhase < 2 ? walkPhase * 1.5 : 0;
            drawDancerSprite(d.x, d.y, DANCER_PALETTES[d.palette],
                { armBlend: 1, bob, footOffset: footOfs });
            // Torch in raised hand
            if (d.hasTorch) {
                drawCaveTorch(d.x + 6, d.y - 12);
            }
        }
    }

    // Rescue text — escalates across the 6 minigames
    if (minigameRescuePhase === 2) {
        const rescueTexts = [
            "RESCUED!", "THE CROWD CAME THROUGH!", "NEVER GIVE UP THE GROOVE!",
            "THE FANS WON'T QUIT!", "UNBREAKABLE BOND!", "ONE LAST TIME!"
        ];
        const rescueMsg = rescueTexts[Math.min(minigamesCompleted.length, rescueTexts.length - 1)];
        const alpha = Math.min(1, minigameRescueTimer / 30);
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.font = `${14 * SCALE}px monospace`;
        const bounce = Math.sin(minigameRescueTimer * 0.05) * 3;
        ctx.fillStyle = "#000";
        ctx.fillText(rescueMsg, (W / 2) * SCALE + SCALE, (H / 3 + bounce + 1) * SCALE);
        ctx.fillStyle = "#00FF88";
        ctx.fillText(rescueMsg, (W / 2) * SCALE, (H / 3 + bounce) * SCALE);
        ctx.textAlign = "start";
        ctx.globalAlpha = 1;
    }
}

function startMinigameReward() {
    minigameState = "reward";
    minigameRewardTimer = 0;

    // Award next DJ setup piece
    const pieceIndex = djSetupEarned.length;
    if (pieceIndex < DJ_SETUP_PIECES.length) {
        djSetupEarned.push(DJ_SETUP_PIECES[pieceIndex]);
    }
    allPiecesJustCompleted = (djSetupEarned.length === DJ_SETUP_PIECES.length);
}

function updateMinigameReward() {
    minigameRewardTimer++;
    if (minigameRewardTimer === 56) {
        playPieceRevealChime();
    }
    if (allPiecesJustCompleted && minigameRewardTimer === 111) {
        playSetupCompleteFanfare();
    }
}

function renderMinigameReward() {
    const W = CAVE_COLS * CAVE_TILE;
    const H = CAVE_ROWS * CAVE_TILE;

    // Dark background
    drawRect(0, 0, W, H, "#0a0f0a");

    // "DJ SETUP PIECE!" header
    const headerAlpha = Math.min(1, minigameRewardTimer / 40);
    ctx.globalAlpha = headerAlpha;
    ctx.textAlign = "center";
    ctx.font = `${10 * SCALE}px monospace`;
    ctx.fillStyle = "#000";
    ctx.fillText("DJ SETUP PIECE!", (W / 2) * SCALE + SCALE, (H / 4 + 1) * SCALE);
    ctx.fillStyle = "#efac28";
    ctx.fillText("DJ SETUP PIECE!", (W / 2) * SCALE, (H / 4) * SCALE);

    // Narrative connection text
    if (minigameRewardTimer > 20) {
        const narrativeAlpha = Math.min(1, (minigameRewardTimer - 20) / 30);
        ctx.globalAlpha = narrativeAlpha;
        ctx.font = `${6 * SCALE}px monospace`;
        ctx.fillStyle = "#efb775";
        ctx.fillText("YOU RECOVERED YOUR STOLEN...", (W / 2) * SCALE, (H / 4 + 16) * SCALE);
    }

    // Visual DJ booth with pieces assembling
    if (minigameRewardTimer > 40) {
        const boothAlpha = Math.min(1, (minigameRewardTimer - 40) / 20);
        ctx.globalAlpha = boothAlpha;

        // Booth positioned in center of reward screen
        const rBoothX = W / 2 - 24;
        const rBoothY = H / 2 - 10;

        // Booth platform
        drawRect(rBoothX - 8, rBoothY + 12, 64, 8, "#1e2e1e");
        drawRect(rBoothX - 8, rBoothY + 12, 64, 2, "#243024");

        // Draw all 6 piece slots
        const newPieceIndex = djSetupEarned.length - 1;
        for (let i = 0; i < DJ_SETUP_PIECES.length; i++) {
            if (i < newPieceIndex) {
                // Previously earned — draw fully
                drawDJSetupPiece(i, rBoothX, rBoothY, {});
            } else if (i === newPieceIndex && minigameRewardTimer > 55) {
                // Newly earned piece — scale-in with glow and sparkles
                const pt = minigameRewardTimer - 55;
                const pieceAlpha = Math.min(1, pt / 30);

                // Golden glow (pulsing larger, more transparent)
                const glowPulse = 0.3 + Math.sin(minigameRewardTimer * 0.05) * 0.15;
                ctx.globalAlpha = boothAlpha * pieceAlpha * glowPulse;
                ctx.save();
                const pcx = rBoothX * SCALE + 16 * SCALE;
                const pcy = rBoothY * SCALE;
                ctx.translate(pcx, pcy);
                ctx.scale(1.3, 1.3);
                ctx.translate(-pcx, -pcy);
                drawDJSetupPiece(i, rBoothX, rBoothY, {});
                ctx.restore();

                // Scale-in effect: starts at 1.8x, settles to 1x
                const scaleProgress = Math.min(1, pt / 20);
                const eased = 1 + (1 - scaleProgress) * 0.8;
                ctx.globalAlpha = boothAlpha * pieceAlpha;
                ctx.save();
                ctx.translate(pcx, pcy);
                ctx.scale(eased, eased);
                ctx.translate(-pcx, -pcy);
                drawDJSetupPiece(i, rBoothX, rBoothY, {});
                ctx.restore();

                // Sparkle particles
                if (pt < 40) {
                    for (let si = 0; si < 3; si++) {
                        const angle = (pt * 0.2 + si * 2.1) + (si * 7.3 % 1);
                        const radius = 20 + (si * 13.7 % 30);
                        const sx = (rBoothX + 16 + Math.cos(angle) * radius) * SCALE;
                        const sy = (rBoothY + Math.sin(angle) * radius) * SCALE;
                        const sparkSize = (1 + (si * 3.1 % 2)) * SCALE;
                        ctx.globalAlpha = boothAlpha * pieceAlpha * (0.4 + (si * 2.7 % 0.6));
                        ctx.fillStyle = si % 2 === 0 ? "#FFD700" : "#FFFFFF";
                        ctx.fillRect(sx - sparkSize / 2, sy - sparkSize / 2, sparkSize, sparkSize);
                    }
                }
            } else {
                // Unearned — draw as dark silhouette
                drawDJSetupPiece(i, rBoothX, rBoothY, { silhouette: true });
            }
        }

        // Piece name label below booth
        if (minigameRewardTimer > 55) {
            const labelAlpha = Math.min(1, (minigameRewardTimer - 55) / 30);
            ctx.globalAlpha = boothAlpha * labelAlpha;
            const pieceName = djSetupEarned[djSetupEarned.length - 1] || "???";
            const bounce = Math.sin(minigameRewardTimer * 0.03) * 2;
            ctx.font = `${7 * SCALE}px monospace`;
            ctx.fillStyle = "#FFD700";
            ctx.fillText(pieceName.toUpperCase(), (W / 2) * SCALE, (rBoothY + 30 + bounce) * SCALE);

            // Progress counter
            ctx.font = `${5 * SCALE}px monospace`;
            ctx.fillStyle = "#efb775";
            ctx.fillText(`${djSetupEarned.length} / ${DJ_SETUP_PIECES.length} PIECES RECOVERED`, (W / 2) * SCALE, (rBoothY + 42) * SCALE);
        }
    }

    // "DJ SETUP COMPLETE!" celebration when all 6 pieces earned
    if (allPiecesJustCompleted && minigameRewardTimer > 110) {
        const ct = minigameRewardTimer - 110;

        // Flash effect on first appearance
        if (ct < 5) {
            ctx.globalAlpha = 1 - ct / 5;
            drawRect(0, 0, W, H, "#FFD700");
        }

        const completeAlpha = Math.min(1, ct / 20);
        ctx.globalAlpha = completeAlpha;
        const completeBounce = Math.sin(ct * 0.06) * 3;

        // Shadow
        ctx.font = `${9 * SCALE}px monospace`;
        ctx.fillStyle = "#000";
        ctx.fillText("DJ SETUP COMPLETE!", (W / 2) * SCALE + SCALE, (H - 40 + completeBounce + 1) * SCALE);
        // Rainbow cycling text
        const hue = (ct * 3) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
        ctx.fillText("DJ SETUP COMPLETE!", (W / 2) * SCALE, (H - 40 + completeBounce) * SCALE);
    }

    // "PRESS ENTER" prompt
    const pressEnterThreshold = allPiecesJustCompleted ? 180 : 140;
    if (minigameRewardTimer > pressEnterThreshold) {
        const blink = Math.sin(minigameRewardTimer * 0.08) > 0;
        if (blink) {
            ctx.font = `${5 * SCALE}px monospace`;
            ctx.fillStyle = "#efd8a1";
            ctx.fillText("PRESS ENTER TO CONTINUE", (W / 2) * SCALE, (H - 12) * SCALE);
        }
    }

    ctx.globalAlpha = 1;
}

function endMinigame() {
    minigamesCompleted.push(minigamePendingAfterLevel);
    minigameState = "none";
    minigameActive = false;
    allPiecesJustCompleted = false;
    stopMinigameMusic();

    // Check for pending feature screens BEFORE advancing level
    // (feature screens use currentLevel+1 to decide, so check while still on current level)
    gameState = "levelcomplete";
    if (checkPendingFeatureScreens()) return; // feature screen → advanceLevel() on dismiss (normal flow)

    // No feature screens — do the cave-return animation
    startCaveReturn();
}

function startCaveReturn() {
    gameState = "cave-return";
    caveReturnTimer = 0;
    caveReturnPhase = 0;
    caveReturnDancerCount = 0;
    caveReturnDJVisible = false;

    // Clear any leftover dancers from before the minigame
    dancers.length = 0;

    // Prepare the next level's state (grid, goblins, etc.) but DON'T give player control yet
    currentLevel++;
    if (currentLevel >= LEVELS.length) {
        finalScore = score;
        gameState = "ending";
        startEnding();
        return;
    }

    levelTimer = LEVELS[currentLevel].timerSeconds * 90;
    const prevPattern = LEVELS[currentLevel - 1].pattern;
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            grid[r][c] = prevPattern[r][c];

    // Build zigzag cell list for sabotage animation
    sabotageCells = [];
    const ar = LEVELS[currentLevel].activeRows;
    for (let r = 0; r < ar; r++) {
        for (let i = 0; i < GRID_COLS; i++) {
            const c = r % 2 === 0 ? i : GRID_COLS - 1 - i;
            sabotageCells.push({ r, c, flip: Math.random() < getSabotageFlipChance() });
        }
    }

    // Position player hidden above the top cave (will walk out in phase 1)
    const topCave = CAVES[1]; // top wall cave
    player.x = topCave.tileX * TILE;
    player.y = -TILE;
    player.destX = player.x;
    player.destY = player.y;
    player.dir = 0; // face down
    player.attacking = false;
    player.attackTimer = 0;
    player.punchHit = false;

    // Reset goblins with extra-long timers (they don't appear during return anim)
    for (let i = 0; i < goblins.length; i++) {
        const g = goblins[i];
        g.dead = true;
        g.deathAnimActive = false;
        g.deathAnimTimer = 0;
        const staggerGap = Math.round(600 - (currentLevel / 29) * 360);
        g.respawnTimer = 600 + i * staggerGap; // extra delay for cave-return anim
    }
    catapultGoblin = null;
    catapultSpawnedThisCycle = false;
    catapultSequenceCount = 0;

    // Reset effects
    deathParticles = [];
    tomatoes = [];
    tomatoSplats = [];
    deathText = null;
    screenFlash = 0;
    screenShake = 0;
    hitFreeze = 0;
    levelComplete = false;
    patternMatched = false;
    levelCelebrateTimer = 0;
    levelCelebrateDisplayScore = 0;
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            cellFlash[r][c] = 0;

    currentStep = 0;
    lastStepTime = performance.now();
    setLevelTempo(currentLevel);
    stopStoryDrums();

    // Determine how many dancers to spawn (same as advanceLevel logic)
    caveReturnDancerCount = 0;
}

function updateCaveReturn() {
    caveReturnTimer++;

    const topCave = CAVES[1];
    const cavePixelX = topCave.tileX * TILE;
    const cavePixelY = topCave.tileY * TILE;

    if (caveReturnPhase === 0) {
        // Phase 0: Dancers emerge from top cave one by one and scatter
        const totalDancers = currentLevel * 3;
        const spawnInterval = 12; // frames between each dancer emerging

        // Spawn a new dancer every spawnInterval frames
        if (caveReturnTimer % spawnInterval === 1 && caveReturnDancerCount < totalDancers) {
            const palette = DANCER_PALETTES[caveReturnDancerCount % DANCER_PALETTES.length];

            // Target position: random spot in the dancer area
            const minPxX = 2 * TILE + 2;
            const maxPxX = (COLS - 3) * TILE - 2;
            const minPxY = 11 * TILE;
            const maxPxY = (ROWS - 1) * TILE - TILE;
            let targetX, targetY, attempts = 0;
            let valid = false;
            const occupiedPositions = dancers.map(d => ({ x: d.targetX ?? d.x, y: d.targetY ?? d.y }));
            const MIN_DIST = 14;
            do {
                targetX = Math.round(minPxX + Math.random() * (maxPxX - minPxX));
                targetY = Math.round(minPxY + Math.random() * (maxPxY - minPxY));
                const tileX = Math.floor(targetX / TILE);
                const tileY = Math.floor(targetY / TILE);
                attempts++;
                const tooClose = occupiedPositions.some(p =>
                    Math.abs(p.x - targetX) < MIN_DIST && Math.abs(p.y - targetY) < MIN_DIST
                );
                const nearCave = CAVES.some(c =>
                    Math.abs(c.tileX - tileX) <= 1 && Math.abs(c.tileY - tileY) <= 1
                );
                valid = !tooClose && !nearCave;
            } while (!valid && attempts < 80);

            if (valid) {
                dancers.push({
                    x: cavePixelX, y: cavePixelY,
                    targetX: targetX, targetY: targetY,
                    walkingIn: true,
                    palette: palette,
                    phase: Math.floor(Math.random() * 16),
                });
                caveReturnDancerCount++;
            }
        }

        // Update dancer walk-in positions
        for (const d of dancers) {
            if (d.walkingIn) {
                const dx = d.targetX - d.x;
                const dy = d.targetY - d.y;
                const walkSpeed = 0.8; // slightly faster than normal walk-in
                if (Math.abs(dx) > 0.5) d.x += Math.sign(dx) * Math.min(walkSpeed, Math.abs(dx));
                if (Math.abs(dy) > 0.5) d.y += Math.sign(dy) * Math.min(walkSpeed, Math.abs(dy));
                if (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) {
                    d.x = d.targetX;
                    d.y = d.targetY;
                    d.walkingIn = false;
                }
            }
        }

        // Check if all dancers have been spawned and most have arrived
        const allSpawned = caveReturnDancerCount >= totalDancers;
        const arrivedCount = dancers.filter(d => !d.walkingIn).length;
        if (allSpawned && arrivedCount >= Math.floor(totalDancers * 0.7)) {
            caveReturnPhase = 1;
            caveReturnTimer = 0;
        }
    } else if (caveReturnPhase === 1) {
        // Phase 1: DJ emerges from cave and walks to starting position
        caveReturnDJVisible = true;

        // Update remaining dancers still walking
        for (const d of dancers) {
            if (d.walkingIn) {
                const dx = d.targetX - d.x;
                const dy = d.targetY - d.y;
                const walkSpeed = 0.8;
                if (Math.abs(dx) > 0.5) d.x += Math.sign(dx) * Math.min(walkSpeed, Math.abs(dx));
                if (Math.abs(dy) > 0.5) d.y += Math.sign(dy) * Math.min(walkSpeed, Math.abs(dy));
                if (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) {
                    d.x = d.targetX;
                    d.y = d.targetY;
                    d.walkingIn = false;
                }
            }
        }

        // DJ walks from cave to their normal starting position
        const djTargetX = (GRID_X + 7) * TILE;
        const djTargetY = (gridBottomTileY() + 1) * TILE + GRID_Y_OFFSET;
        const djSpeed = 1.0;
        const ddx = djTargetX - player.x;
        const ddy = djTargetY - player.y;
        if (Math.abs(ddx) > 0.5) player.x += Math.sign(ddx) * Math.min(djSpeed, Math.abs(ddx));
        if (Math.abs(ddy) > 0.5) player.y += Math.sign(ddy) * Math.min(djSpeed, Math.abs(ddy));
        player.destX = player.x;
        player.destY = player.y;

        // DJ walk animation direction
        if (Math.abs(ddy) > Math.abs(ddx)) {
            player.dir = ddy > 0 ? 0 : 1; // down or up
        } else if (Math.abs(ddx) > 0.5) {
            player.dir = ddx > 0 ? 3 : 2; // right or left
        }

        if (Math.abs(ddx) <= 0.5 && Math.abs(ddy) <= 0.5) {
            player.x = djTargetX;
            player.y = djTargetY;
            player.destX = djTargetX;
            player.destY = djTargetY;
            caveReturnPhase = 2;
            caveReturnTimer = 0;
        }
    } else if (caveReturnPhase === 2) {
        // Phase 2: Brief pause then hand off to sabotage animation
        // Snap any remaining walking dancers to their targets
        for (const d of dancers) {
            if (d.walkingIn) {
                d.x = d.targetX;
                d.y = d.targetY;
                d.walkingIn = false;
            }
        }

        if (caveReturnTimer > 30) {
            // Start sabotage animation (goblin scrambles the grid)
            sabotageNextState = "playing";
            sabotageAnimTimer = 0;
            sabotageFlipIndex = 0;
            gameState = "sabotage-anim";
        }
    }
}

function renderCaveReturn() {
    // Render the normal overworld scene
    render();

    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark opening at the top cave entrance
    const topCave = CAVES[1];
    const cx = topCave.tileX * TILE;
    const cy = topCave.tileY * TILE;
    drawRect(cx - 2, cy, TILE + 4, TILE + 2, "#0a0604");

    // Draw the DJ during phase 1+ (walking out of cave)
    if (caveReturnDJVisible) {
        const walkFrame = (caveReturnTimer >> 3) % 4;
        drawPlayerSprite(player.x, player.y, walkFrame, player.dir, {});
    }
}

// ---- Minigame Music ----
function startMinigameMusic() {
    if (!audioCtx) return;
    stopMinigameMusic();

    // Create a stressful, fast, dissonant loop using oscillators
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.08;
    masterGain.connect(audioCtx.destination);
    minigameMusicGain = masterGain;

    // Pulsing bass drone (minor second interval = maximum tension)
    const bass1 = audioCtx.createOscillator();
    bass1.type = "sawtooth";
    bass1.frequency.value = 55; // A1
    const bassGain1 = audioCtx.createGain();
    bassGain1.gain.value = 0.6;
    bass1.connect(bassGain1);
    bassGain1.connect(masterGain);
    bass1.start();

    const bass2 = audioCtx.createOscillator();
    bass2.type = "sawtooth";
    bass2.frequency.value = 58.27; // Bb1 — minor second
    const bassGain2 = audioCtx.createGain();
    bassGain2.gain.value = 0.4;
    bass2.connect(bassGain2);
    bassGain2.connect(masterGain);
    bass2.start();

    minigameMusicOscs = [bass1, bass2];

    // Rapid pulsing rhythm (fast 16th note feel)
    let beatCount = 0;
    minigameMusicInterval = setInterval(() => {
        if (!audioCtx || audioCtx.state !== "running") return;
        const now = audioCtx.currentTime;
        beatCount++;

        // Hi-hat pattern every beat
        const hatBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.03, audioCtx.sampleRate);
        const hatData = hatBuf.getChannelData(0);
        for (let i = 0; i < hatData.length; i++) hatData[i] = (Math.random() * 2 - 1) * (1 - i / hatData.length);
        const hat = audioCtx.createBufferSource();
        hat.buffer = hatBuf;
        const hatGain = audioCtx.createGain();
        hatGain.gain.setValueAtTime(0.3, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        hat.connect(hatGain);
        hatGain.connect(masterGain);
        hat.start(now);

        // Kick on every 4th beat
        if (beatCount % 4 === 0) {
            const kick = audioCtx.createOscillator();
            const kg = audioCtx.createGain();
            kick.type = "sine";
            kick.frequency.setValueAtTime(120, now);
            kick.frequency.exponentialRampToValueAtTime(30, now + 0.15);
            kg.gain.setValueAtTime(0.5, now);
            kg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            kick.connect(kg);
            kg.connect(masterGain);
            kick.start(now);
            kick.stop(now + 0.15);
        }

        // Dissonant stab every 8th beat
        if (beatCount % 8 === 0) {
            const stab = audioCtx.createOscillator();
            const sg = audioCtx.createGain();
            stab.type = "square";
            stab.frequency.setValueAtTime(233, now); // Bb3 — tritone of E
            sg.gain.setValueAtTime(0.15, now);
            sg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            stab.connect(sg);
            sg.connect(masterGain);
            stab.start(now);
            stab.stop(now + 0.1);
        }
    }, 125); // ~120 BPM 16th notes
}

function stopMinigameMusic() {
    if (minigameMusicInterval) {
        clearInterval(minigameMusicInterval);
        minigameMusicInterval = null;
    }
    for (const osc of minigameMusicOscs) {
        try { osc.stop(); } catch (e) {}
    }
    minigameMusicOscs = [];
    if (minigameMusicGain) {
        try { minigameMusicGain.disconnect(); } catch (e) {}
        minigameMusicGain = null;
    }
}

function advanceLevel() {
    currentLevel++;
    if (currentLevel >= LEVELS.length) {
        // Player beat all levels — start ending cinematic!
        finalScore = score;
        gameState = "ending";
        startEnding();
        return;
    }
    // After a minigame, dancers rescued the DJ and scattered — respawn the full crowd
    if (dancers.length === 0 && currentLevel > 1) {
        spawnDancers(currentLevel * 3);
    } else {
        // Normal level start: 3 new dancer fans join the crowd
        spawnDancers(3);
    }
    levelTimer = LEVELS[currentLevel].timerSeconds * 90;
    // Start with previous level's completed pattern (each level builds on the last)
    const prevPattern = LEVELS[currentLevel - 1].pattern;
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            grid[r][c] = prevPattern[r][c];

    // Build zigzag cell list for sabotage animation
    sabotageCells = [];
    const ar = LEVELS[currentLevel].activeRows;
    for (let r = 0; r < ar; r++) {
        for (let i = 0; i < GRID_COLS; i++) {
            const c = r % 2 === 0 ? i : GRID_COLS - 1 - i;
            sabotageCells.push({ r, c, flip: Math.random() < getSabotageFlipChance() });
        }
    }

    // Reset player position (below the active grid)
    player.x = (GRID_X + 7) * TILE;
    player.y = (gridBottomTileY() + 1) * TILE + GRID_Y_OFFSET;
    player.destX = player.x;
    player.destY = player.y;
    player.attacking = false;
    player.attackTimer = 0;
    player.punchHit = false;

    // Reset all goblins with staggered respawn timers
    for (let i = 0; i < goblins.length; i++) {
        const g = goblins[i];
        g.dead = true;
        g.deathAnimActive = false;
        g.deathAnimTimer = 0;
        const staggerGap = Math.round(600 - (currentLevel / 29) * 360); // 10s apart early → 4s apart late
        g.respawnTimer = 180 + i * staggerGap;
    }
    catapultGoblin = null;
    catapultSpawnedThisCycle = false;
    catapultSequenceCount = 0;

    // DON'T reset: dancers, killCount (persist across levels)

    // Reset effects
    deathParticles = [];
    tomatoes = [];
    tomatoSplats = [];
    deathText = null;
    screenFlash = 0;
    screenShake = 0;
    hitFreeze = 0;
    levelComplete = false;
    patternMatched = false;
    levelCelebrateTimer = 0;
    levelCelebrateDisplayScore = 0;
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            cellFlash[r][c] = 0;

    // Reset sequencer timing to prevent catch-up
    currentStep = 0;
    lastStepTime = performance.now();

    // Set tempo for new level
    setLevelTempo(currentLevel);

    // Determine post-sabotage destination (new enemy/instrument intro or straight to playing)
    const prevRows = currentLevel > 0 ? LEVELS[currentLevel - 1].activeRows : LEVELS[0].activeRows;
    const newRows = LEVELS[currentLevel].activeRows;
    sabotageNextState = "playing";

    // All feature screens (instruments, enemy warnings) now shown before advanceLevel is called

    // Stop marching drums before sabotage begins
    stopStoryDrums();

    // Start sabotage animation (goblin zigzags across grid scrambling cells)
    sabotageAnimTimer = 0;
    sabotageFlipIndex = 0;
    gameState = "sabotage-anim";
}

// ---- Catapult Goblin Logic ----
function spawnCatapultGoblin() {
    catapultSequenceCount++;
    const caveIdx = Math.floor(Math.random() * CAVES.length);
    const cave = CAVES[caveIdx];
    const spawnX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
    const spawnY = cave.tileY === 0 ? TILE * 2 : cave.tileY === ROWS - 1 ? (ROWS - 2) * TILE : cave.tileY * TILE;

    // Pick a random grid cell as boulder target
    const tRow = Math.floor(Math.random() * getActiveRows());
    const tCol = Math.floor(Math.random() * GRID_COLS);

    // Calculate a stop position: 2 tiles outside the grid area
    let stopX, stopY;
    if (cave.tileX === 0) {
        stopX = TILE * 2; stopY = rowPixelY(tRow);
    } else if (cave.tileX === COLS - 1) {
        stopX = (COLS - 3) * TILE; stopY = rowPixelY(tRow);
    } else {
        // Top cave: position above the grid
        stopX = (GRID_X + tCol) * TILE; stopY = TILE * 3;
    }
    // Clamp to room bounds
    stopX = Math.max(TILE, Math.min((COLS - 2) * TILE, stopX));
    stopY = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, stopY));

    catapultGoblin = {
        x: spawnX, y: spawnY,
        destX: stopX, destY: stopY,
        w: TILE, h: TILE,
        dir: 0, frame: 0, frameTimer: 0,
        speed: 0.6,
        phase: "entering",
        phaseTimer: 0,
        caveIndex: caveIdx,
        targetRow: tRow,
        targetCol: tCol,
        boulder: null,
    };

    // Spawn sound — ominous rumble
    ensureAudio();
    if (audioCtx) {
        const now = audioCtx.currentTime;
        // Low menacing rumble
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(70, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.6);
        g.gain.setValueAtTime(0.15, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.7);
        // Wooden creak
        const osc2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        osc2.type = "square";
        osc2.frequency.setValueAtTime(150, now);
        osc2.frequency.linearRampToValueAtTime(120, now + 0.3);
        g2.gain.setValueAtTime(0.05, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc2.connect(g2); g2.connect(audioCtx.destination);
        osc2.start(now + 0.1); osc2.stop(now + 0.4);
    }
}

function updateCatapultGoblin() {
    const cg = catapultGoblin;
    if (!cg) return;

    if (cg.phase === "entering") {
        // Walk toward stop position
        const dx = cg.destX - cg.x;
        const dy = cg.destY - cg.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < cg.speed) {
            cg.x = cg.destX;
            cg.y = cg.destY;
            cg.phase = "aiming";
            cg.phaseTimer = 60; // 1 second aiming
        } else {
            if (Math.abs(dx) > Math.abs(dy)) {
                cg.x += Math.sign(dx) * Math.min(cg.speed, Math.abs(dx));
                cg.dir = dx > 0 ? 3 : 2;
            } else {
                cg.y += Math.sign(dy) * Math.min(cg.speed, Math.abs(dy));
                cg.dir = dy > 0 ? 0 : 1;
            }
            cg.frameTimer++;
            if (cg.frameTimer >= 8) { cg.frameTimer = 0; cg.frame = (cg.frame + 1) % 4; }
        }
    } else if (cg.phase === "aiming") {
        cg.phaseTimer--;
        if (cg.phaseTimer <= 0) {
            // Fire!
            cg.phase = "firing";
            const targetPixelX = (GRID_X + cg.targetCol) * TILE + TILE / 2;
            const targetPixelY = rowPixelY(cg.targetRow) + TILE / 2;
            cg.boulder = {
                startX: cg.x + cg.w / 2,
                startY: cg.y - 4, // launch from top of catapult
                targetX: targetPixelX,
                targetY: targetPixelY,
                progress: 0,
            };
            ensureAudio();
            if (audioCtx) playCatapultLaunch(audioCtx.currentTime);
        }
    } else if (cg.phase === "firing") {
        // Animate boulder arc
        cg.boulder.progress += 1 / 45; // ~45 frames to land
        if (cg.boulder.progress >= 1) {
            // IMPACT — flip 3x3 grid cells
            cg.boulder.progress = 1;
            const cr = cg.targetRow;
            const cc = cg.targetCol;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = cr + dr;
                    const c = cc + dc;
                    if (r >= 0 && r < getActiveRows() && c >= 0 && c < GRID_COLS) {
                        grid[r][c] = !grid[r][c];
                        cellFlash[r][c] = 30;
                    }
                }
            }
            // Boulder may break or complete the pattern
            if (patternMatched && !checkLevelComplete()) {
                patternMatched = false;
            }
            tryCompleteLevelOrWait();
            // Impact effects
            ensureAudio();
            if (audioCtx) playCatapultImpact(audioCtx.currentTime);
            screenShake = 12;
            shakeIntensity = 5;
            // Dust particles at impact
            const impactX = cg.boulder.targetX;
            const impactY = cg.boulder.targetY;
            for (let i = 0; i < 15; i++) {
                deathParticles.push({
                    x: impactX, y: impactY,
                    vx: (Math.random() - 0.5) * 3,
                    vy: (Math.random() - 0.5) * 3 - 1,
                    life: 20 + Math.random() * 20,
                    color: Math.random() > 0.5 ? "#8B7355" : "#6B5335",
                    size: 2 + Math.random() * 3,
                    sparkle: false,
                });
            }
            cg.boulder = null;

            // Check if player is in the 3x3 impact zone — comical launch!
            const pGridCol = Math.round(player.x / TILE) - GRID_X;
            const pGridRow = tileYToRow(Math.round(player.y / TILE));
            if (pGridCol >= cc - 1 && pGridCol <= cc + 1 && pGridRow >= cr - 1 && pGridRow <= cr + 1 && !playerLaunch.active) {
                // Boulder knocks DJ into the air!
                playerLaunch.active = true;
                playerLaunch.timer = 0;
                playerLaunch.duration = 70;
                playerLaunch.startX = player.x;
                playerLaunch.startY = player.y;
                // Pick a random landing spot on the opposite side of the grid
                const landCol = GRID_X + (pGridCol < GRID_COLS / 2
                    ? GRID_COLS - 2 - Math.floor(Math.random() * 3)
                    : 1 + Math.floor(Math.random() * 3));
                const landRow = Math.floor(Math.random() * getActiveRows());
                playerLaunch.endX = landCol * TILE;
                playerLaunch.endY = rowPixelY(landRow);
                screenShake = 8;
                shakeIntensity = 4;
            }

            cg.phase = "retreating";
            // Set retreat destination back to cave
            const cave = CAVES[cg.caveIndex];
            const retreatX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
            const retreatY = cave.tileY === 0 ? TILE * 2 : cave.tileY === ROWS - 1 ? (ROWS - 2) * TILE : cave.tileY * TILE;
            cg.destX = retreatX;
            cg.destY = retreatY;
        }
    } else if (cg.phase === "retreating") {
        // Walk back to cave
        const dx = cg.destX - cg.x;
        const dy = cg.destY - cg.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < cg.speed) {
            // Reached cave — disappear
            catapultGoblin = null;
            // Check if pattern was waiting on this goblin
            if (patternMatched && !areGoblinsAlive()) {
                triggerLevelComplete();
                return;
            }
            // Chain next catapult if sequence not complete (3 total)
            if (catapultSequenceCount < 3) {
                spawnCatapultGoblin();
            }
            return;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
            cg.x += Math.sign(dx) * Math.min(cg.speed, Math.abs(dx));
            cg.dir = dx > 0 ? 3 : 2;
        } else {
            cg.y += Math.sign(dy) * Math.min(cg.speed, Math.abs(dy));
            cg.dir = dy > 0 ? 0 : 1;
        }
        cg.frameTimer++;
        if (cg.frameTimer >= 8) { cg.frameTimer = 0; cg.frame = (cg.frame + 1) % 4; }
    }
}

// ---- Drawing helpers ----
function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
}

function drawHudRect(x, y, w, h, color) {
    hudCtx.fillStyle = color;
    hudCtx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
}

function drawHudPixelDigits(num, cx, cy, color, pixelSize) {
    const str = String(num);
    const digitW = 3 * pixelSize + pixelSize;
    const totalW = str.length * digitW - pixelSize;
    let startX = cx - totalW / 2;
    for (let d = 0; d < str.length; d++) {
        const bitmap = DIGIT_BITMAPS[parseInt(str[d])];
        const dx = startX + d * digitW;
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 3; col++) {
                if (bitmap[row] & (1 << (2 - col))) {
                    drawHudRect(dx + col * pixelSize, cy + row * pixelSize, pixelSize, pixelSize, color);
                }
            }
        }
    }
}

// Simple seeded random for deterministic floor grain (no flicker)
function seededRandom(seed) {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
}

function drawText(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `${size * SCALE}px monospace`;
    ctx.fillText(text, x * SCALE, y * SCALE);
}

// Rounded rectangle helper for block-print style grid blocks
function fillRoundRect(context, x, y, w, h, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    context.fill();
}
function strokeRoundRect(context, x, y, w, h, r, color, lineWidth) {
    context.strokeStyle = color;
    context.lineWidth = lineWidth || 1;
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    context.stroke();
}

// ---- HUD Render (separate canvas below game) ----
function renderHUD() {
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

    if (IMAGES.hud_bg) {
        // Sprite-based HUD background
        hudCtx.drawImage(IMAGES.hud_bg, 0, 0);
    } else {
        // Procedural fallback — background fill
        drawHudRect(0, 0, COLS * TILE, HUD_H, "#0a0f0a");

        // Teal border along top — connects visually to the venue's bottom wall
        for (let c = 0; c < COLS; c++) {
            drawHudRect(c * TILE, 0, TILE, 2, c % 2 === 0 ? "#1a2a1a" : "#1e2e1e");
        }
        // Highlight on border edge
        hudCtx.fillStyle = "rgba(255,255,255,0.08)";
        hudCtx.fillRect(0, 0, COLS * TILE * SCALE, 1 * SCALE);

        // Subtle grain texture (matches venue floor grain)
        for (let c = 0; c < COLS; c++) {
            let seed = c * 37 + 7;
            for (let i = 0; i < 4; i++) {
                seed = (seed * 9301 + 49297) % 233280;
                const gx = c * TILE + (seed % TILE);
                seed = (seed * 9301 + 49297) % 233280;
                const gy = 3 + (seed % (HUD_H - 4));
                const bright = (seed % 2) === 0;
                hudCtx.fillStyle = bright ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)";
                hudCtx.fillRect(gx * SCALE, gy * SCALE, SCALE, SCALE);
            }
        }
    }

    const pxSz = 3;
    const digitW = 3 * pxSz + pxSz;
    const panelH = 5 * pxSz + 6;
    const panelGap = 4;

    const kcY = Math.floor((HUD_H - panelH) / 2);
    const W = COLS * TILE;
    const margin = TILE; // 1-tile margin from edges

    // Panel drawing helper — adds border, fill, top highlight, and bottom shadow
    function drawHudPanel(x, y, w, h, borderCol, bgCol, hiCol) {
        drawHudRect(x - 2, y - 2, w + 4, h + 4, borderCol);
        drawHudRect(x, y, w, h, bgCol);
        drawHudRect(x, y, w, 1, hiCol);                    // top highlight
        drawHudRect(x, y + h - 1, w, 1, "rgba(0,0,0,0.2)"); // bottom shadow
    }

    const iconW = 3 * pxSz + 2;
    const numY = kcY + 3;
    const p = pxSz;

    // --- Level counter (left-aligned) ---
    const lvlStr = String(currentLevel + 1).padStart(2, "0");
    const lvlPanelW = iconW + 2 * digitW + 6;
    const lvlX = margin;
    drawHudPanel(lvlX, kcY, lvlPanelW, panelH, "#0a0f0a", "#1a2a1a", "#243024");
    // "L" icon
    const fx = lvlX + 2, fy = kcY + 3;
    drawHudRect(fx, fy, p, 5 * p, "#efd8a1");
    drawHudRect(fx + p, fy + 4 * p, 2 * p, p, "#efd8a1");
    // Level digits (centered in remaining panel space after icon)
    const lvlDigitArea = lvlPanelW - iconW;
    drawHudPixelDigits(lvlStr, lvlX + iconW + lvlDigitArea / 2, numY, "#efd8a1", p);
    // Tier subtitle below level panel
    const tierNames = ["ROCK", "FUNK", "BREAKS"];
    const tierIdx = currentLevel < 10 ? 0 : currentLevel < 20 ? 1 : 2;
    hudCtx.font = `${2.5 * SCALE}px monospace`;
    hudCtx.fillStyle = "#8a7a5a";
    hudCtx.textAlign = "center";
    hudCtx.fillText(tierNames[tierIdx], (lvlX + lvlPanelW / 2) * SCALE, (kcY + panelH + 5) * SCALE);
    hudCtx.textAlign = "start";

    // --- Timer counter (right-aligned) ---
    const timerSec = Math.max(0, Math.ceil(levelTimer / 90));
    const timerStr = timerSec < 10 ? "0" + timerSec : String(timerSec);
    const timerPanelW = iconW + timerStr.length * digitW + 6;
    const timerX = W - margin - timerPanelW;
    const isUrgent = timerSec <= 30;
    const isCritical = timerSec <= 10;
    const blinkRate = isCritical ? 15 : 30;
    const blinkOn = !isUrgent || Math.floor(levelTimer / blinkRate) % 2 === 0;
    const timerColor = isUrgent ? "#ef3a0c" : "#efd8a1";
    const timerBorderColor = isUrgent ? "#550f0a" : "#0a0f0a";
    const timerBgColor = isUrgent ? "#1e2e1e" : "#1a2a1a";
    const timerHighlight = isUrgent ? "#661100" : "#243024";
    drawHudPanel(timerX, kcY, timerPanelW, panelH, timerBorderColor, timerBgColor, timerHighlight);
    // "T" icon
    const tx2 = timerX + 2, ty2 = kcY + 3;
    drawHudRect(tx2, ty2, 3 * p, p, blinkOn ? timerColor : timerBgColor);
    drawHudRect(tx2 + p, ty2 + p, p, 4 * p, blinkOn ? timerColor : timerBgColor);
    // Timer digits (centered in remaining panel space after icon)
    if (blinkOn) {
        const timerDigitArea = timerPanelW - iconW;
        drawHudPixelDigits(timerStr, timerX + iconW + timerDigitArea / 2, numY, timerColor, p);
    }

    // --- Score counter (centered) ---
    const scoreStr = String(score).padStart(5, "0");
    const skullW = 5 * p + 2;
    const killPanelW = skullW + 5 * digitW + 6;
    const kcX = Math.floor((W - killPanelW) / 2);
    drawHudPanel(kcX, kcY, killPanelW, panelH, "#0a0f0a", "#1a2a1a", "#243024");
    // Skull icon
    const sx = kcX + 2, sy = kcY + 3;
    const skullBg = "#1a2a1a";
    drawHudRect(sx + p, sy, 3 * p, p, "#efd8a1");
    drawHudRect(sx, sy + p, 5 * p, 2 * p, "#efd8a1");
    drawHudRect(sx + p, sy + 3 * p, 3 * p, p, "#efd8a1");
    drawHudRect(sx + p, sy + 4 * p, p, p, "#efd8a1");
    drawHudRect(sx + 3 * p, sy + 4 * p, p, p, "#efd8a1");
    drawHudRect(sx + p, sy + p, p, p, skullBg);
    drawHudRect(sx + 3 * p, sy + p, p, p, skullBg);
    drawHudRect(sx + 2 * p, sy + 2 * p, p, p, skullBg);
    drawHudRect(sx + 2 * p, sy + 4 * p, p, p, skullBg);
    // Score digits (centered in remaining panel space after skull)
    const scoreDigitArea = killPanelW - skullW;
    drawHudPixelDigits(scoreStr, kcX + skullW + scoreDigitArea / 2, numY, "#efd8a1", p);

    // Tick sound during last 10 seconds (once per second)
    if (isCritical && timerSec > 0 && levelTimer % 90 === 0 && audioCtx) {
        const now = audioCtx.currentTime;
        const tick = audioCtx.createOscillator();
        const tg = audioCtx.createGain();
        tick.type = "square";
        tick.frequency.setValueAtTime(880, now);
        tick.frequency.exponentialRampToValueAtTime(660, now + 0.06);
        tg.gain.setValueAtTime(0.15, now);
        tg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        tick.connect(tg); tg.connect(audioCtx.destination);
        tick.start(now); tick.stop(now + 0.08);
    }

    // Chill mode indicator
    if (gameMode === "chill") {
        const cmX = (COLS - 2) * TILE - 2;
        hudCtx.font = `${3 * SCALE}px monospace`;
        hudCtx.fillStyle = "#3c9f9c";
        hudCtx.textAlign = "right";
        hudCtx.fillText("CHILL", cmX * SCALE, (kcY + panelH - 2) * SCALE);
        hudCtx.textAlign = "start";
    }

    // Equipment recovery tracker (thrill mode only — shows DJ setup piece progress)
    if (gameMode === "thrill") {
        const earned = djSetupEarned.length;
        const total = DJ_SETUP_PIECES.length;
        if (earned > 0 || currentLevel >= 4) { // show after level 5 (first minigame milestone)
            const trackerX = (COLS * TILE) / 2 - (total * 5) / 2;
            const trackerY = kcY + panelH + 2;
            for (let i = 0; i < total; i++) {
                const ix = trackerX + i * 5;
                if (i < earned) {
                    drawHudRect(ix, trackerY, 4, 4, "#efac28"); // recovered — gold
                    drawHudRect(ix, trackerY, 4, 1, "#efd8a1"); // highlight
                } else {
                    drawHudRect(ix, trackerY, 4, 4, "#3a2a1a"); // missing — dark
                    drawHudRect(ix, trackerY, 4, 1, "#4a3a2a"); // subtle border
                }
            }
        }
    }

    // Grain texture overlay for HUD
    hudCtx.drawImage(hudGrainCanvas, 0, 0);
}

// ---- Minigame HUD (mirrors main HUD style during cave arena) ----
function renderMinigameHUD() {
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

    // Background fill (same as main HUD)
    drawHudRect(0, 0, COLS * TILE, HUD_H, "#0a0f0a");

    // Teal border along top
    for (let c = 0; c < COLS; c++) {
        drawHudRect(c * TILE, 0, TILE, 2, c % 2 === 0 ? "#1a2a1a" : "#1e2e1e");
    }
    hudCtx.fillStyle = "rgba(255,255,255,0.08)";
    hudCtx.fillRect(0, 0, COLS * TILE * SCALE, 1 * SCALE);

    // Subtle grain texture
    for (let c = 0; c < COLS; c++) {
        let seed = c * 37 + 7;
        for (let i = 0; i < 4; i++) {
            seed = (seed * 9301 + 49297) % 233280;
            const gx = c * TILE + (seed % TILE);
            seed = (seed * 9301 + 49297) % 233280;
            const gy = 3 + (seed % (HUD_H - 4));
            const bright = (seed % 2) === 0;
            hudCtx.fillStyle = bright ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)";
            hudCtx.fillRect(gx * SCALE, gy * SCALE, SCALE, SCALE);
        }
    }

    const pxSz = 3;
    const digitW = 3 * pxSz + pxSz;
    const panelH = 5 * pxSz + 6;
    const kcY = Math.floor((HUD_H - panelH) / 2);
    const W = COLS * TILE;
    const margin = TILE;
    const iconW = 3 * pxSz + 2;
    const numY = kcY + 3;
    const p = pxSz;

    function drawMiniHudPanel(x, y, w, h, borderCol, bgCol, hiCol) {
        drawHudRect(x - 2, y - 2, w + 4, h + 4, borderCol);
        drawHudRect(x, y, w, h, bgCol);
        drawHudRect(x, y, w, 1, hiCol);
        drawHudRect(x, y + h - 1, w, 1, "rgba(0,0,0,0.2)");
    }

    // --- Level counter (left) ---
    const lvlStr = String(currentLevel + 1).padStart(2, "0");
    const lvlPanelW = iconW + 2 * digitW + 6;
    const lvlX = margin;
    drawMiniHudPanel(lvlX, kcY, lvlPanelW, panelH, "#0a0f0a", "#1a2a1a", "#243024");
    // "L" icon
    const fx = lvlX + 2, fy = kcY + 3;
    drawHudRect(fx, fy, p, 5 * p, "#efd8a1");
    drawHudRect(fx + p, fy + 4 * p, 2 * p, p, "#efd8a1");
    drawHudPixelDigits(lvlStr, lvlX + iconW + (lvlPanelW - iconW) / 2, numY, "#efd8a1", p);

    // --- Timer counter (right) — cave countdown ---
    const timerSecs = Math.max(0, Math.ceil(minigameTimer / 60));
    const timerStr = timerSecs < 10 ? "0" + timerSecs : String(timerSecs);
    const timerPanelW = iconW + timerStr.length * digitW + 6;
    const timerX = W - margin - timerPanelW;
    const isUrgent = timerSecs <= 10;
    const isCritical = timerSecs <= 5;
    const blinkRate = isCritical ? 15 : 30;
    const blinkOn = !isUrgent || Math.floor(minigameTimer / blinkRate) % 2 === 0;
    const timerColor = isCritical ? "#FF0044" : isUrgent ? "#efac28" : "#00FF88";
    const timerBorderColor = isUrgent ? "#550f0a" : "#0a0f0a";
    const timerBgColor = isUrgent ? "#1e2e1e" : "#1a2a1a";
    const timerHighlight = isUrgent ? "#661100" : "#243024";
    drawMiniHudPanel(timerX, kcY, timerPanelW, panelH, timerBorderColor, timerBgColor, timerHighlight);
    // "T" icon
    const tx2 = timerX + 2, ty2 = kcY + 3;
    drawHudRect(tx2, ty2, 3 * p, p, blinkOn ? timerColor : timerBgColor);
    drawHudRect(tx2 + p, ty2 + p, p, 4 * p, blinkOn ? timerColor : timerBgColor);
    if (blinkOn) {
        const timerDigitArea = timerPanelW - iconW;
        drawHudPixelDigits(timerStr, timerX + iconW + timerDigitArea / 2, numY, timerColor, p);
    }

    // --- Kill count (center) — skull + cave kills ---
    const scoreStr = String(caveKillCount).padStart(3, "0");
    const skullW = 5 * p + 2;
    const killPanelW = skullW + scoreStr.length * digitW + 6;
    const kcX = Math.floor((W - killPanelW) / 2);
    drawMiniHudPanel(kcX, kcY, killPanelW, panelH, "#0a0f0a", "#1a2a1a", "#243024");
    // Skull icon (same as main HUD)
    const sx = kcX + 2, sy = kcY + 3;
    const skullBg = "#1a2a1a";
    drawHudRect(sx + p, sy, 3 * p, p, "#efd8a1");
    drawHudRect(sx, sy + p, 5 * p, 2 * p, "#efd8a1");
    drawHudRect(sx + p, sy + 3 * p, 3 * p, p, "#efd8a1");
    drawHudRect(sx + p, sy + 4 * p, p, p, "#efd8a1");
    drawHudRect(sx + 3 * p, sy + 4 * p, p, p, "#efd8a1");
    drawHudRect(sx + p, sy + p, p, p, skullBg);
    drawHudRect(sx + 3 * p, sy + p, p, p, skullBg);
    drawHudRect(sx + 2 * p, sy + 2 * p, p, p, skullBg);
    drawHudRect(sx + 2 * p, sy + 4 * p, p, p, skullBg);
    drawHudPixelDigits(scoreStr, kcX + skullW + (killPanelW - skullW) / 2, numY, "#efd8a1", p);

    // Grain texture overlay for minigame HUD
    hudCtx.drawImage(hudGrainCanvas, 0, 0);
}

// ---- Render ----
function render() {
    // Screen shake offset
    if (screenShake > 0) {
        const sx = (Math.random() - 0.5) * 2 * shakeIntensity * SCALE;
        const sy = (Math.random() - 0.5) * 2 * shakeIntensity * SCALE;
        ctx.save();
        ctx.translate(sx, sy);
    }

    // Clear & draw cave background (sprite or pre-rendered fallback)
    ctx.drawImage(IMAGES.cave_bg || TEX_CAVE_BG, 0, 0);

    // Cave openings (goblin spawn points) — dark tunnel arches
    for (let ci = 0; ci < CAVES.length; ci++) {
        const cave = CAVES[ci];
        const cx = cave.tileX * TILE;
        const cy = cave.tileY * TILE;

        if (IMAGES.cave_entrance) {
            // Sprite-based cave entrance
            ctx.drawImage(IMAGES.cave_entrance, (cx - 2) * SCALE, (cy - 5) * SCALE);
        } else {
            // Procedural fallback — deep black cave hole
            ctx.fillStyle = "#050805";
            ctx.beginPath();
            ctx.roundRect(cx * SCALE, (cy - 2) * SCALE, TILE * SCALE, (TILE + 4) * SCALE, [6, 6, 2, 2]);
            ctx.fill();
            // Stone arch around cave
            ctx.fillStyle = "#243024";
            ctx.beginPath();
            ctx.roundRect((cx - 2) * SCALE, (cy - 5) * SCALE, (TILE + 4) * SCALE, 4 * SCALE, [4, 4, 0, 0]);
            ctx.fill();
            // Bottom rocks
            ctx.beginPath();
            ctx.roundRect((cx - 2) * SCALE, (cy + TILE + 1) * SCALE, (TILE + 4) * SCALE, 4 * SCALE, [0, 0, 4, 4]);
            ctx.fill();
            // Side edges
            if (cave.tileX > 0) drawRect(cx - 3, cy - 2, 3, TILE + 4, "#1e2e1e");
            if (cave.tileX < COLS - 1) drawRect(cx + TILE, cy - 2, 3, TILE + 4, "#1e2e1e");
            // Stalactites (triangular — stone gray-green)
            ctx.fillStyle = "#243024";
            ctx.beginPath();
            ctx.moveTo((cx + 3) * SCALE, (cy - 2) * SCALE);
            ctx.lineTo((cx + 5) * SCALE, (cy - 2) * SCALE);
            ctx.lineTo((cx + 4) * SCALE, (cy + 2) * SCALE);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo((cx + 9) * SCALE, (cy - 2) * SCALE);
            ctx.lineTo((cx + 11) * SCALE, (cy - 2) * SCALE);
            ctx.lineTo((cx + 10) * SCALE, (cy + 1) * SCALE);
            ctx.closePath();
            ctx.fill();
            // Stalagmites (triangular)
            ctx.beginPath();
            ctx.moveTo((cx + 5) * SCALE, (cy + TILE + 2) * SCALE);
            ctx.lineTo((cx + 7) * SCALE, (cy + TILE + 2) * SCALE);
            ctx.lineTo((cx + 6) * SCALE, (cy + TILE - 2) * SCALE);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo((cx + 11) * SCALE, (cy + TILE + 2) * SCALE);
            ctx.lineTo((cx + 13) * SCALE, (cy + TILE + 2) * SCALE);
            ctx.lineTo((cx + 12) * SCALE, (cy + TILE - 1) * SCALE);
            ctx.closePath();
            ctx.fill();
        }
        // Green glow from inside cave (always procedural — beat-synced effect)
        const caveGlow = ctx.createRadialGradient(
            (cx + TILE / 2) * SCALE, (cy + TILE / 2) * SCALE, 2 * SCALE,
            (cx + TILE / 2) * SCALE, (cy + TILE / 2) * SCALE, TILE * SCALE
        );
        caveGlow.addColorStop(0, "rgba(50,255,50,0.12)");
        caveGlow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = caveGlow;
        ctx.fillRect((cx - 4) * SCALE, (cy - 4) * SCALE, (TILE + 8) * SCALE, (TILE + 8) * SCALE);
        // Eye gleam inside cave (glowing circles)
        for (const g of goblins) {
            if (g.dead && g.respawnTimer < 60 && ci === g.spawnCave) {
                const caveEyeCol = g.elite ? "#00FFFF" : "#39FF14";
                ctx.fillStyle = caveEyeCol;
                ctx.beginPath();
                ctx.arc((cx + 6) * SCALE, (cy + 6) * SCALE, 2 * SCALE, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc((cx + 10) * SCALE, (cy + 6) * SCALE, 2 * SCALE, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
        }
    }

    // Bioluminescent mushroom & crystal lights along cave ceiling — drum-synced
    const MUSH_COLORS = ["#33ff33", "#22dd44", "#44ee88", "#22cc66", "#33ff55", "#44ff44"];
    const topCaveCol = Math.floor(COLS / 2);
    const ar_lights = getActiveRows();
    const now_lights = performance.now();
    for (let c = 1; c < COLS - 1; c++) {
        if (c === topCaveCol) continue;
        const mushX = c * TILE + TILE / 2;
        const mushY = TILE + 4;
        const rowIdx = c % ar_lights;
        const mushCol = MUSH_COLORS[c % MUSH_COLORS.length];
        const triggered = rowTrigger[rowIdx] > 0;
        const pulseIntensity = triggered ? rowTrigger[rowIdx] / 8 : 0;
        const chasePhase = (now_lights * 0.003 + c * 0.4) % (Math.PI * 2);
        const chaseBright = Math.sin(chasePhase) * 0.5 + 0.5;
        const twinkle = Math.sin(now_lights * 0.005 + c * 2.7) > 0.7 ? 0.3 : 0;
        const isCrystal = c % 4 === 0; // every 4th light is a crystal pendant

        // Stem/chain from ceiling
        ctx.strokeStyle = "#1e2e1e";
        ctx.lineWidth = 1 * SCALE;
        ctx.beginPath();
        ctx.moveTo(mushX * SCALE, TILE * SCALE);
        ctx.lineTo(mushX * SCALE, (mushY - 1) * SCALE);
        ctx.stroke();

        if (isCrystal) {
            // Crystal pendant — diamond/rhombus shape
            const cSize = triggered ? 3.5 : 3;
            ctx.globalAlpha = 0.6 + chaseBright * 0.3 + pulseIntensity * 0.2 + twinkle;
            ctx.fillStyle = mushCol;
            ctx.beginPath();
            ctx.moveTo(mushX * SCALE, (mushY - 1) * SCALE);
            ctx.lineTo((mushX + cSize) * SCALE, (mushY + 2) * SCALE);
            ctx.lineTo(mushX * SCALE, (mushY + 5) * SCALE);
            ctx.lineTo((mushX - cSize) * SCALE, (mushY + 2) * SCALE);
            ctx.closePath();
            ctx.fill();
            // Inner highlight
            ctx.fillStyle = "#aaffaa";
            ctx.globalAlpha = 0.3 + pulseIntensity * 0.3;
            ctx.beginPath();
            ctx.moveTo(mushX * SCALE, mushY * SCALE);
            ctx.lineTo((mushX + 1.5) * SCALE, (mushY + 2) * SCALE);
            ctx.lineTo(mushX * SCALE, (mushY + 4) * SCALE);
            ctx.lineTo((mushX - 1.5) * SCALE, (mushY + 2) * SCALE);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1.0;
        } else {
            // Mushroom cap — half-circle with stem
            const capR = triggered ? 3.5 : (chaseBright > 0.7 ? 3 : 2.5);
            // Thin stem
            ctx.fillStyle = "#2a4a2a";
            ctx.fillRect((mushX - 0.5) * SCALE, (mushY - 1) * SCALE, 1 * SCALE, 4 * SCALE);
            // Cap (half-circle arc facing down)
            ctx.globalAlpha = 0.5 + chaseBright * 0.3 + pulseIntensity * 0.2 + twinkle;
            ctx.fillStyle = mushCol;
            ctx.beginPath();
            ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, capR * SCALE, Math.PI, 0);
            ctx.fill();
            // Cap underside glow (lighter)
            ctx.fillStyle = "#aaffaa";
            ctx.globalAlpha = 0.15 + pulseIntensity * 0.2;
            ctx.beginPath();
            ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, (capR - 0.5) * SCALE, 0, Math.PI);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
        // Glow halo — green-tinted, stronger on drum trigger
        const baseGlow = 0.06 + chaseBright * 0.06;
        const pulseGlow = pulseIntensity * 0.35;
        ctx.globalAlpha = baseGlow + pulseGlow + twinkle * 0.12;
        ctx.fillStyle = mushCol;
        const glowR = triggered ? 7 : (chaseBright > 0.6 ? 5.5 : 4.5);
        ctx.beginPath();
        ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, glowR * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Floor crystals along bottom wall — drum-synced glowing formations
    for (let c = 1; c < COLS - 1; c++) {
        const crX = c * TILE + TILE / 2;
        const crBaseY = (ROWS - 1) * TILE + 2;
        const rowIdx = (c + 2) % ar_lights;
        const crCol = MUSH_COLORS[(c + 2) % MUSH_COLORS.length];
        const triggered = rowTrigger[rowIdx] > 0;
        const crH = 2 + (c * 3) % 3;
        // Small crystal pointing up
        ctx.fillStyle = crCol;
        ctx.globalAlpha = triggered ? 0.7 : 0.3;
        ctx.beginPath();
        ctx.moveTo((crX - 1.5) * SCALE, (crBaseY + 1) * SCALE);
        ctx.lineTo((crX + 1.5) * SCALE, (crBaseY + 1) * SCALE);
        ctx.lineTo(crX * SCALE, (crBaseY - crH) * SCALE);
        ctx.closePath();
        ctx.fill();
        if (triggered) {
            ctx.fillStyle = crCol;
            ctx.globalAlpha = rowTrigger[rowIdx] / 8 * 0.25;
            ctx.beginPath();
            ctx.arc(crX * SCALE, (crBaseY - crH / 2) * SCALE, 4 * SCALE, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }

    // Row labels (O, H, S, K, B, T) in the column just left of the first beat block
    const ROW_LETTERS = ["O", "H", "S", "K", "B", "T"];
    const ar = getActiveRows();
    for (let r = 0; r < ar; r++) {
        const lx = (GRID_X - 1) * TILE + 3;
        const ly = rowPixelY(r) + 12;
        drawText(ROW_LETTERS[r], lx, ly, PAL.gridOn[r], 7);
    }

    // Stone wall background behind grid (sprite or pre-rendered fallback)
    {
        const gwX = GRID_X * TILE - 2;
        const gwY = (GRID_Y * TILE + GRID_Y_OFFSET) - 2;
        const gwH = ar * TILE + 4;
        const gwSrc = IMAGES.grid_wall || TEX_GRID_WALL;
        ctx.drawImage(gwSrc, 0, 0, gwSrc.width, gwH * SCALE, gwX * SCALE, gwY * SCALE, gwSrc.width, gwH * SCALE);
    }

    // Grid blocks — pre-rendered stone textures with glow overlays
    for (let r = 0; r < ar; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const bx = (GRID_X + c) * TILE;
            const by = rowPixelY(r);
            const on = grid[r][c];

            const bxs = bx * SCALE, bys = by * SCALE;
            const ts = TILE * SCALE;
            if (on) {
                // Draw glow tile (sprite or pre-rendered fallback)
                ctx.shadowColor = PAL.gridOn[r];
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.drawImage(IMAGES["grid_on_" + ROW_LETTERS[r]] || TEX_GRID_ON[r][c], bxs, bys);
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
            } else {
                // Draw dark stone tile (sprite or pre-rendered fallback)
                ctx.drawImage(IMAGES.grid_off || TEX_GRID_OFF[r][c], bxs, bys);
            }

            // Block toggle pop animation (scale + glow burst)
            if (blockToggleAnim[r][c] > 0) {
                const animProg = blockToggleAnim[r][c] / 12; // 1→0
                const popScale = 1 + animProg * 0.3; // 1.3→1.0
                const cx_b = (bx + TILE / 2) * SCALE;
                const cy_b = (by + TILE / 2) * SCALE;
                ctx.fillStyle = PAL.gridOn[r];
                ctx.globalAlpha = animProg * 0.5;
                const glowR = TILE * popScale;
                ctx.fillRect(cx_b - glowR * SCALE / 2, cy_b - glowR * SCALE / 2, glowR * SCALE, glowR * SCALE);
                ctx.fillStyle = "#ffffff";
                ctx.globalAlpha = animProg * 0.4;
                ctx.fillRect((bx + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, (TILE - 2) * SCALE);
                ctx.globalAlpha = 1.0;
            }

            // Sabotage flash overlay — boosted visibility
            if (cellFlash[r][c] > 0) {
                ctx.fillStyle = "#FF00FF";
                ctx.globalAlpha = cellFlash[r][c] / 30 * 0.75;
                ctx.fillRect((bx + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, (TILE - 2) * SCALE);
                ctx.globalAlpha = 1.0;
                // "!" indicator — visible longer, larger
                if (cellFlash[r][c] > 10) {
                    drawText("!", bx + 5, by - 5, "#39FF14", 5);
                }
                cellFlash[r][c]--;
            }

            // Target pattern indicator
            if (currentLevel < LEVELS.length) {
                const target = LEVELS[currentLevel].pattern[r][c];
                if (target && !on) {
                    // Needs to be ON — draw pulsing outline
                    const pulse = 0.5 + Math.sin(performance.now() * 0.003) * 0.25;
                    ctx.globalAlpha = pulse;
                    const rowCol = PAL.gridOn[r];
                    drawRect(bx + 1, by + 1, TILE - 2, 1, rowCol);
                    drawRect(bx + 1, by + TILE - 2, TILE - 2, 1, rowCol);
                    drawRect(bx + 1, by + 1, 1, TILE - 2, rowCol);
                    drawRect(bx + TILE - 2, by + 1, 1, TILE - 2, rowCol);
                    // Small dot in center
                    drawRect(bx + 6, by + 6, 4, 4, rowCol);
                    ctx.globalAlpha = 1.0;
                } else if (!target && on) {
                    // Needs to be OFF — draw X indicator in complementary color
                    const xCol = PAL.gridX[r];
                    ctx.globalAlpha = 0.8 + Math.sin(performance.now() * 0.004) * 0.2;
                    drawRect(bx + 4, by + 4, 2, 2, xCol);
                    drawRect(bx + 6, by + 6, 2, 2, xCol);
                    drawRect(bx + 8, by + 8, 2, 2, xCol);
                    drawRect(bx + 10, by + 10, 2, 2, xCol);
                    drawRect(bx + 10, by + 4, 2, 2, xCol);
                    drawRect(bx + 8, by + 6, 2, 2, xCol);
                    drawRect(bx + 6, by + 8, 2, 2, xCol);
                    drawRect(bx + 4, by + 10, 2, 2, xCol);
                    ctx.globalAlpha = 1.0;
                }
            }
        }
    }

    // Playhead with beat pulse on active blocks
    if (playing) {
        const px = (GRID_X + currentStep) * TILE;
        ctx.fillStyle = PAL.playhead;
        ctx.globalAlpha = 0.2;
        const playheadH = (gridBottomTileY() - GRID_Y) * TILE;
        fillRoundRect(ctx, px * SCALE, (GRID_Y * TILE + GRID_Y_OFFSET) * SCALE, TILE * SCALE, playheadH * SCALE, 4, PAL.playhead);
        ctx.globalAlpha = 1.0;
        // Top marker — rounded
        fillRoundRect(ctx, (px + 2) * SCALE, ((GRID_Y - 1) * TILE + 10 + GRID_Y_OFFSET) * SCALE, (TILE - 4) * SCALE, 4 * SCALE, 2, PAL.playhead);
        // Beat pulse: brighten blocks under the playhead that are ON
        for (let r = 0; r < ar; r++) {
            if (grid[r][currentStep] && rowTrigger[r] > 0) {
                const by = rowPixelY(r);
                const pulseAlpha = rowTrigger[r] / 8 * 0.45;
                ctx.fillStyle = "#ffffff";
                ctx.globalAlpha = pulseAlpha;
                ctx.fillRect((px + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, (TILE - 2) * SCALE);
                ctx.globalAlpha = 1.0;
            }
        }
    }

    // Step numbers (below grid)
    for (let c = 0; c < GRID_COLS; c++) {
        const num = String(c + 1);
        const tx = (GRID_X + c) * TILE + (c < 9 ? 4 : 1);
        drawText(num, tx, gridBottomTileY() * TILE + 8 + GRID_Y_OFFSET, c === currentStep && playing ? PAL.playhead : "#5a8a8f", 3);
    }

    // HUD is rendered on separate canvas
    renderHUD();

    // Dancers (rendered behind player/goblin)
    for (const d of dancers) {
        drawDancer(d);
    }

    // Goblins (all active ones)
    for (const g of goblins) {
        if (!g.dead) {
            drawGoblinFor(g);
        } else if (g.deathAnimActive) {
            // Poof animation: shrink, spin, and dissolve
            const progress = 1 - g.deathAnimTimer / 24; // 0→1
            const scale = 1 - progress * 0.85; // shrink to 15%
            const alpha = 1 - progress * 0.9;  // fade to 10%
            const rotation = progress * Math.PI * 2.5; // 2.5 full spins
            const cx = (g.x + g.w / 2) * SCALE;
            const cy = (g.y + g.h / 2) * SCALE;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
            ctx.globalAlpha = alpha;
            // Flash between normal colors and white as it dissolves
            if (progress > 0.5 && Math.floor(g.deathAnimTimer) % 3 === 0) {
                drawGoblinSprite(g.deathAnimElite ? "elite" : "normal", g.x, g.y, 0, {
                    dir: g.dir, bodyCol: "#ffffff", darkCol: "#dddddd", headCol: "#ffffff", eyeCol: "#00FFFF"
                });
            } else {
                drawGoblinFor(g);
            }
            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    }

    // Catapult goblin
    if (catapultGoblin) {
        drawCatapultGoblin();
    }

    // Death particles
    for (const p of deathParticles) {
        if (p.sparkle && Math.random() > 0.6) continue; // twinkle effect
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 60;
        ctx.fillRect(p.x * SCALE, p.y * SCALE, p.size * SCALE, p.size * SCALE);
    }
    ctx.globalAlpha = 1.0;

    // Tomato projectiles (with parabolic arc and tumble)
    for (const t of tomatoes) {
        // Parabolic arc: peak at midpoint, height scales with distance
        const arcHeight = Math.min(30, t.totalDist * 0.4);
        const arcY = -4 * arcHeight * t.progress * (1 - t.progress);
        const drawX = t.x;
        const drawY = t.y + arcY;
        // Trailing afterimages — fading red dots behind the tomato
        if (t.progress > 0.05) {
            const tdx = t.targetX - t.x;
            const tdy = t.targetY - t.y;
            const td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
            const vnx = tdx / td;
            const vny = tdy / td;
            for (let ti = 1; ti <= 3; ti++) {
                const trailP = Math.max(0, t.progress - ti * 0.06);
                const trailArcY = -4 * arcHeight * trailP * (1 - trailP);
                const trailX = t.x - vnx * ti * 5;
                const trailY = t.y - vny * ti * 5 + (trailArcY - arcY) * 0.5;
                ctx.globalAlpha = (4 - ti) / 4 * 0.25;
                drawRect(trailX - 1, trailY - 1, 3, 2, "#ef3a0c");
            }
            ctx.globalAlpha = 1;
        }
        // Shadow on ground
        ctx.globalAlpha = 0.25;
        drawRect(t.x - 1, t.y + 1, 3, 1, "#000");
        ctx.globalAlpha = 1;
        // Tumble: one lazy rotation over the entire flight
        const rot = Math.floor(t.progress * 4) % 4;
        if (rot === 0) {
            // Upright
            drawRect(drawX - 2, drawY - 1, 4, 3, "#ef3a0c");
            drawRect(drawX - 1, drawY - 2, 2, 1, "#ef3a0c");
            drawRect(drawX, drawY - 3, 1, 1, "#39571c");
            drawRect(drawX - 2, drawY - 1, 1, 1, "#ef692f");
        } else if (rot === 1) {
            // Tilted right
            drawRect(drawX - 1, drawY - 2, 3, 4, "#ef3a0c");
            drawRect(drawX + 2, drawY - 1, 1, 2, "#ef3a0c");
            drawRect(drawX + 3, drawY, 1, 1, "#39571c");
            drawRect(drawX - 1, drawY - 2, 1, 1, "#ef692f");
        } else if (rot === 2) {
            // Upside down
            drawRect(drawX - 2, drawY - 1, 4, 3, "#ef3a0c");
            drawRect(drawX - 1, drawY + 2, 2, 1, "#ef3a0c");
            drawRect(drawX, drawY + 3, 1, 1, "#39571c");
            drawRect(drawX + 1, drawY + 1, 1, 1, "#ef692f");
        } else {
            // Tilted left
            drawRect(drawX - 1, drawY - 2, 3, 4, "#ef3a0c");
            drawRect(drawX - 2, drawY - 1, 1, 2, "#ef3a0c");
            drawRect(drawX - 3, drawY, 1, 1, "#39571c");
            drawRect(drawX + 1, drawY - 2, 1, 1, "#ef692f");
        }
    }

    // Tomato splats
    for (const s of tomatoSplats) {
        const a = s.timer / 25;
        ctx.globalAlpha = a;
        // Splat — irregular red blobs
        drawRect(s.x - 3, s.y - 1, 6, 3, "#ef3a0c");
        drawRect(s.x - 1, s.y - 3, 3, 6, "#9b1a0a");
        drawRect(s.x - 5, s.y, 2, 2, "#ef3a0c");
        drawRect(s.x + 4, s.y - 2, 2, 2, "#9b1a0a");
        drawRect(s.x - 2, s.y + 3, 2, 1, "#ef3a0c");
        // Seeds
        drawRect(s.x + 1, s.y - 1, 1, 1, "#efac28");
        drawRect(s.x - 2, s.y + 1, 1, 1, "#efac28");
    }
    ctx.globalAlpha = 1.0;

    // Death text
    if (deathText) {
        ctx.globalAlpha = Math.min(1, deathText.timer / 20);
        drawText(deathText.text, deathText.x, deathText.y, deathText.color || "#FF0044", deathText.scale || 5);
        ctx.globalAlpha = 1.0;
    }

    // Screen flash (elite kill)
    if (screenFlash > 0) {
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = Math.min(1, screenFlash / 15) * 0.6;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    // Punch target tile indicator (gold corner brackets)
    if (!player.attacking && player.x === player.destX && player.y === player.destY) {
        const ptx = Math.round(player.x / TILE);
        const pty = Math.round((player.y - GRID_Y_OFFSET) / TILE);
        let ttx = ptx, tty = pty;
        switch (player.dir) {
            case 0: tty += 1; break;
            case 1: tty -= 1; break;
            case 2: ttx -= 1; break;
            case 3: ttx += 1; break;
        }
        const tx = ttx * TILE;
        const ty = tty * TILE + GRID_Y_OFFSET;
        const pulse = 0.35 + Math.sin(performance.now() * 0.004) * 0.2;
        const c = PAL.punch; // "#efac28"
        const s = 2; // bracket stroke width
        const L = 5; // bracket arm length
        // Subtle filled highlight behind brackets
        ctx.globalAlpha = 0.08;
        drawRect(tx + 1, ty + 1, TILE - 2, TILE - 2, c);
        // Corner brackets
        ctx.globalAlpha = pulse;
        // Top-left corner
        drawRect(tx, ty, L, s, c);
        drawRect(tx, ty, s, L, c);
        // Top-right corner
        drawRect(tx + TILE - L, ty, L, s, c);
        drawRect(tx + TILE - s, ty, s, L, c);
        // Bottom-left corner
        drawRect(tx, ty + TILE - s, L, s, c);
        drawRect(tx, ty + TILE - L, s, L, c);
        // Bottom-right corner
        drawRect(tx + TILE - L, ty + TILE - s, L, s, c);
        drawRect(tx + TILE - s, ty + TILE - L, s, L, c);
        ctx.globalAlpha = 1.0;
    }

    // Player shadow (hidden during boulder launch — launch draws its own landing shadow)
    if (!playerLaunch.active) {
        drawRect(player.x + 2, player.y + player.h - 2, player.w - 4, 4, PAL.shadow);
    }

    // Punch (draw behind player for up-facing, in front otherwise)
    if (!playerLaunch.active && player.attacking && player.dir === 1) drawPunch();

    // Player sprite (or launch animation)
    if (playerLaunch.active) {
        const lt = playerLaunch.timer / playerLaunch.duration; // 0→1
        // Parabolic arc — launches UP then crashes DOWN
        const launchX = playerLaunch.startX + (playerLaunch.endX - playerLaunch.startX) * lt;
        const arcHeight = -60 * Math.sin(lt * Math.PI * 0.85);
        const launchY = playerLaunch.startY + (playerLaunch.endY - playerLaunch.startY) * Math.pow(lt, 1.6) + arcHeight;
        // Comic perspective scaling — grows at apex
        const flyScale = 1 + 0.6 * Math.sin(lt * Math.PI);
        // Tumbling rapidly
        const tumbleDir = [3, 0, 2, 1][Math.floor(playerLaunch.timer / 3) % 4];
        const djFrame = Math.floor(playerLaunch.timer / 2) % 4;
        // Impact flash on first frame
        if (playerLaunch.timer <= 2) {
            ctx.globalAlpha = 0.7;
            drawRect(playerLaunch.startX - 4, playerLaunch.startY - 4, 24, 24, "#FFFFFF");
            ctx.globalAlpha = 1;
        }
        // Draw scaled tumbling DJ
        ctx.save();
        const spCX = launchX * SCALE + 8 * SCALE;
        const spCY = launchY * SCALE + 8 * SCALE;
        ctx.translate(spCX, spCY);
        ctx.scale(flyScale, flyScale);
        ctx.translate(-spCX, -spCY);
        drawPlayerSprite(launchX, launchY, djFrame, tumbleDir, {});
        // Flailing arms
        const flailAngle = playerLaunch.timer * 0.8;
        const flailLen = (6 + Math.sin(playerLaunch.timer * 0.5) * 3) * SCALE;
        ctx.strokeStyle = "#efb775";
        ctx.lineWidth = 2 * SCALE;
        ctx.lineCap = "round";
        const armLX = (launchX + 4) * SCALE;
        const armRX = (launchX + 12) * SCALE;
        const armY = (launchY + 6) * SCALE;
        ctx.beginPath(); ctx.moveTo(armLX, armY);
        ctx.lineTo(armLX + Math.cos(flailAngle) * flailLen, armY + Math.sin(flailAngle) * flailLen);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(armRX, armY);
        ctx.lineTo(armRX + Math.cos(flailAngle + 2.5) * flailLen, armY + Math.sin(flailAngle + 2.5) * flailLen);
        ctx.stroke();
        ctx.restore();
        // Landing shadow at destination
        const shadowAlpha = lt * 0.3;
        ctx.globalAlpha = shadowAlpha;
        drawRect(playerLaunch.endX + 2, playerLaunch.endY + player.h - 2, player.w - 4, 4, "#000000");
        ctx.globalAlpha = 1;
    } else {
        drawPlayer();
    }

    // Punch (in front for down/left/right)
    if (!playerLaunch.active && player.attacking && player.dir !== 1) drawPunch();

    // "SLAY THE GOBLIN!" indicator when pattern is done but goblins remain
    if (patternMatched && !levelComplete && areGoblinsAlive()) {
        const blink = Math.floor(performance.now() / 400) % 2 === 0;
        if (blink) {
            ctx.font = `${6 * SCALE}px monospace`;
            ctx.textAlign = "center";
            ctx.fillStyle = "#000000";
            ctx.fillText("SLAY THE GOBLIN!", (COLS * TILE * SCALE) / 2 + SCALE, 14 * SCALE + SCALE);
            ctx.fillStyle = "#ef3a0c";
            ctx.fillText("SLAY THE GOBLIN!", (COLS * TILE * SCALE) / 2, 14 * SCALE);
            ctx.textAlign = "start";
        }
    }

    // Ambient cave vignette — dark green-tinted edges
    {
        const W_a = COLS * TILE * SCALE;
        const H_a = ROWS * TILE * SCALE;
        const ambGrad = ctx.createRadialGradient(W_a / 2, H_a / 2, W_a * 0.35, W_a / 2, H_a / 2, W_a * 0.72);
        ambGrad.addColorStop(0, "rgba(0,0,0,0)");
        ambGrad.addColorStop(1, "rgba(0,15,0,0.4)");
        ctx.fillStyle = ambGrad;
        ctx.fillRect(0, 0, W_a, H_a);
    }

    // Timer urgency vignette (pulsing red edges when ≤10 seconds)
    {
        const timerSec_v = Math.max(0, Math.ceil(levelTimer / 90));
        if (timerSec_v <= 10 && timerSec_v > 0 && !levelComplete) {
            const urgency = 1 - timerSec_v / 10; // 0→1 as timer approaches 0
            const pulse = 0.3 + Math.sin(performance.now() * 0.008) * 0.2;
            const vigAlpha = (urgency * 0.4 + 0.1) * pulse;
            const W_v = COLS * TILE * SCALE;
            const H_v = ROWS * TILE * SCALE;
            const grad = ctx.createRadialGradient(W_v / 2, H_v / 2, W_v * 0.3, W_v / 2, H_v / 2, W_v * 0.7);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(1, "#ef3a0c");
            ctx.fillStyle = grad;
            ctx.globalAlpha = vigAlpha;
            ctx.fillRect(0, 0, W_v, H_v);
            ctx.globalAlpha = 1.0;
        }
    }

    // Controls overlay (level 1 only — stays visible, keys light up on press)
    if (currentLevel === 0) {
        const W = COLS * TILE;
        const overlayY = (GRID_Y + LEVELS[currentLevel].activeRows + 2) * TILE + GRID_Y_OFFSET;
        const boxW = 108;
        const boxH = 36;
        const boxX = W / 2 - boxW / 2;

        // Semi-transparent background
        ctx.globalAlpha = 0.65;
        drawRect(boxX, overlayY, boxW, boxH, "#0a0f0a");
        // Border
        ctx.globalAlpha = 0.4;
        drawRect(boxX, overlayY, boxW, 1, "#44ff44");
        drawRect(boxX, overlayY + boxH - 1, boxW, 1, "#44ff44");
        drawRect(boxX, overlayY, 1, boxH, "#44ff44");
        drawRect(boxX + boxW - 1, overlayY, 1, boxH, "#44ff44");
        ctx.globalAlpha = 1;

        // Helper: draw a small key cap that lights up
        const keySize = 8;
        const drawKeyCap = (x, y, label, flashKey) => {
            const flash = controlsKeyFlash[flashKey] || 0;
            const held = keys["Arrow" + flashKey.charAt(0) + flashKey.slice(1).toLowerCase()] ||
                         (flashKey === "UP" && keys["KeyW"]) || (flashKey === "DOWN" && keys["KeyS"]) ||
                         (flashKey === "LEFT" && keys["KeyA"]) || (flashKey === "RIGHT" && keys["KeyD"]) ||
                         (flashKey === "SPACE" && keys["Space"]);
            const lit = held || flash > 0;
            const brightness = held ? 1 : flash / 10;

            // Key background
            if (lit) {
                const r = Math.round(239 * brightness + 60 * (1 - brightness));
                const g = Math.round(172 * brightness + 40 * (1 - brightness));
                const b = Math.round(40 * brightness + 20 * (1 - brightness));
                drawRect(x, y, label === "SPACE" ? 30 : keySize, keySize, `rgb(${r},${g},${b})`);
            } else {
                drawRect(x, y, label === "SPACE" ? 30 : keySize, keySize, "#2a1a10");
            }
            // Key border
            const borderColor = lit ? "#44ff44" : "#1a3a1a";
            const kw = label === "SPACE" ? 30 : keySize;
            drawRect(x, y, kw, 1, borderColor);
            drawRect(x, y + keySize - 1, kw, 1, borderColor);
            drawRect(x, y, 1, keySize, borderColor);
            drawRect(x + kw - 1, y, 1, keySize, borderColor);

            // Key label
            ctx.font = `${3 * SCALE}px monospace`;
            ctx.textAlign = "center";
            ctx.fillStyle = lit ? "#fff" : "#8a6a4a";
            const labelX = label === "SPACE" ? x + 15 : x + keySize / 2;
            ctx.fillText(label === "SPACE" ? "SPACE" : label, labelX * SCALE, (y + 6) * SCALE);
            ctx.textAlign = "start";
        };

        // "MOVE" label + arrow key layout
        ctx.font = `${3 * SCALE}px monospace`;
        ctx.fillStyle = "#8a7a5a";
        ctx.fillText("MOVE", (boxX + 5) * SCALE, (overlayY + 7) * SCALE);

        const arrowBaseX = boxX + 5;
        const arrowBaseY = overlayY + 10;
        drawKeyCap(arrowBaseX + 10, arrowBaseY, "\u2191", "UP");        // ↑ centered
        drawKeyCap(arrowBaseX,      arrowBaseY + 10, "\u2190", "LEFT"); // ←
        drawKeyCap(arrowBaseX + 10, arrowBaseY + 10, "\u2193", "DOWN"); // ↓
        drawKeyCap(arrowBaseX + 20, arrowBaseY + 10, "\u2192", "RIGHT"); // →

        // "PUNCH" label + spacebar
        ctx.font = `${3 * SCALE}px monospace`;
        ctx.fillStyle = "#8a7a5a";
        ctx.fillText("PUNCH", (boxX + 55) * SCALE, (overlayY + 7) * SCALE);

        drawKeyCap(boxX + 55, overlayY + 10, "SPACE", "SPACE");
    }

    // Tutorial objective hint (level 1 only — explains pattern matching)
    if (currentLevel === 0) {
        tutorialHintTimer++;
        // Fade out after player toggles first cell or after ~8 seconds
        const hintAlpha = tutorialFirstToggle
            ? Math.max(0, 1 - (tutorialHintTimer - tutorialFirstToggleFrame) / 60)
            : Math.min(1, tutorialHintTimer / 30); // fade in over 0.5s
        if (hintAlpha > 0) {
            const W_t = COLS * TILE;
            const hintY = (GRID_Y - 1) * TILE + GRID_Y_OFFSET;
            ctx.globalAlpha = hintAlpha * 0.85;
            ctx.font = `${3.5 * SCALE}px monospace`;
            ctx.textAlign = "center";
            // Line 1: objective
            ctx.fillStyle = "#000000";
            ctx.fillText("PUNCH cells to match the beat pattern!", W_t / 2 * SCALE + SCALE, hintY * SCALE + SCALE);
            ctx.fillStyle = "#efac28";
            ctx.fillText("PUNCH cells to match the beat pattern!", W_t / 2 * SCALE, hintY * SCALE);
            // Line 2: hint about indicators
            if (!tutorialFirstToggle) {
                ctx.fillStyle = "#000000";
                ctx.fillText("Dotted outlines show what needs toggling.", W_t / 2 * SCALE + SCALE, (hintY + 7) * SCALE + SCALE);
                ctx.fillStyle = "#efd8a1";
                ctx.fillText("Dotted outlines show what needs toggling.", W_t / 2 * SCALE, (hintY + 7) * SCALE);
            }
            ctx.textAlign = "start";
            ctx.globalAlpha = 1;
        }
    }

    // Restore screen shake transform
    if (screenShake > 0) {
        ctx.restore();
    }
}

// Draw at screen-pixel resolution (1:1) — for high-detail 48x48 sprites
// Shadow glow makes pixel blocks bleed together into solid block-print shapes
function drawPx(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

// Enable/disable block-print shadow glow for sprite drawing
function spriteGlowOn(color) {
    ctx.shadowColor = color || "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}
function spriteGlowOff() {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
}

// Convert a color to a ghostly blue-white tint for soul/ghost effect
function ghostTint(color) {
    // Parse hex color
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    // Blend toward light blue-white (#ccddff)
    const t = 0.7; // tint strength
    const tr = Math.round(r + (0xcc - r) * t);
    const tg = Math.round(g + (0xdd - g) * t);
    const tb = Math.round(b + (0xff - b) * t);
    return `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`;
}

// Reusable 48x48 player sprite for all screens — block-print / screen-print style
// gx, gy: top-left position (game coords)
// frame: animation frame (0-3), dir: facing direction (0-3)
// options: { isBlinking, punchThrust, ghostMode }
function drawPlayerSprite(gx, gy, frame, dir, options) {
    const opts = options || {};
    const sx = gx * SCALE;
    const sy = gy * SCALE;
    const bob = (frame % 2 === 1 ? 1 : 0) * SCALE;
    const ghost = opts.ghostMode || false;

    // Punch lean: upper body shifts toward punch direction
    const punch = opts.punchThrust || 0;
    let leanX = 0, leanY = 0;
    if (punch > 0) {
        switch (dir) {
            case 0: leanY = punch * 4; break;
            case 1: leanY = -punch * 4; break;
            case 2: leanX = -punch * 5; break;
            case 3: leanX = punch * 5; break;
        }
    }

    // ---- Sprite-based path (early return if PNG loaded) ----
    {
        const dirName = ["down", "up", "left", "right"][dir];
        const sprKey = punch > 0
            ? "player_punch_" + dirName
            : "player_" + dirName + "_" + (frame % 2);
        if (IMAGES[sprKey]) {
            const lx = leanX * SCALE, ly = leanY * SCALE;
            if (ghost) { ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = "lighter"; }
            ctx.drawImage(IMAGES[sprKey], sx + lx, sy - bob + ly);
            if (ghost) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
            return;
        }
    }

    // ---- Procedural fallback ----
    const col = (c) => ghost ? ghostTint(c) : c;
    const lx = leanX * SCALE, ly = leanY * SCALE;

    // Block-print shadow glow
    spriteGlowOn();

    // === BODY (foggy mint shirt — solid rounded shape) ===
    // Lower body stays planted
    ctx.fillStyle = col("#82c48c");
    ctx.beginPath();
    ctx.roundRect(sx + 9, sy + 9 - bob, 30, 27, [0, 0, 4, 4]);
    ctx.fill();
    // Body shading (left/right edges)
    ctx.fillStyle = col("#4a8454");
    ctx.beginPath();
    ctx.roundRect(sx + 9, sy + 9 - bob, 8, 27, [0, 0, 0, 4]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(sx + 31, sy + 9 - bob, 8, 27, [0, 0, 4, 0]);
    ctx.fill();
    // Hem
    ctx.fillStyle = col("#4a8454");
    ctx.fillRect(sx + 12, sy + 30 - bob, 24, 3);

    // Upper body leans into punch
    ctx.fillStyle = col("#82c48c");
    ctx.beginPath();
    ctx.roundRect(sx + 9 + lx, sy + 3 + ly - bob, 30, 21, [6, 6, 0, 0]);
    ctx.fill();
    // Upper shading
    ctx.fillStyle = col("#4a8454");
    ctx.fillRect(sx + 9 + lx, sy + 3 + ly - bob, 6, 18);
    ctx.fillRect(sx + 33 + lx, sy + 3 + ly - bob, 6, 18);
    // Chest highlight
    ctx.fillStyle = col("#a8e0ae");
    ctx.fillRect(sx + 15 + lx, sy + 9 + ly - bob, 18, 3);
    // Collar
    ctx.fillStyle = col("#392a1c");
    ctx.beginPath();
    ctx.roundRect(sx + 15 + lx, sy + 3 + ly - bob, 18, 4, [3, 3, 0, 0]);
    ctx.fill();

    // === HEAD (bald, round dome) — smooth circle ===
    const headCx = sx + 24 + lx;
    const headCy = sy - 6 + ly - bob;
    const headR = 18;
    // Main head circle
    ctx.fillStyle = col("#efb775");
    ctx.beginPath();
    ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
    ctx.fill();
    // Bald shine highlight (crescent on top)
    ctx.fillStyle = col("#f5c882");
    ctx.beginPath();
    ctx.arc(headCx, headCy - 2, headR - 3, -Math.PI * 0.9, -Math.PI * 0.1);
    ctx.fill();
    // Ears (small circles on sides)
    ctx.fillStyle = col("#a58c27");
    ctx.beginPath();
    ctx.arc(headCx - headR + 2, headCy + 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headCx + headR - 2, headCy + 4, 4, 0, Math.PI * 2);
    ctx.fill();

    // === EYES & BEARD (direction-aware) ===
    const isBlinking = opts.isBlinking || false;
    const eyeDir = [[0, 3], [0, -6], [-3, 0], [3, 0]][dir];

    if (dir === 1) {
        // Facing UP — back of bald head
        ctx.fillStyle = col("#e0a860");
        ctx.beginPath();
        ctx.arc(headCx, headCy, headR - 3, -Math.PI * 0.8, -Math.PI * 0.2);
        ctx.fill();
        // Neck area
        ctx.fillStyle = col("#efb775");
        ctx.fillRect(sx + 15 + lx, sy - 3 + ly - bob, 18, 6);
    } else {
        // Facing DOWN, LEFT, or RIGHT — show beard and eyes
        // Big bushy beard (rounded bottom)
        ctx.fillStyle = col("#ab5c1c");
        ctx.beginPath();
        ctx.moveTo(headCx - 15, headCy + 2);
        ctx.lineTo(headCx + 15, headCy + 2);
        ctx.lineTo(headCx + 15, headCy + 14);
        ctx.quadraticCurveTo(headCx + 15, headCy + 22, headCx + 6, headCy + 22);
        ctx.lineTo(headCx - 6, headCy + 22);
        ctx.quadraticCurveTo(headCx - 15, headCy + 22, headCx - 15, headCy + 14);
        ctx.closePath();
        ctx.fill();
        // Beard side tufts
        ctx.beginPath();
        ctx.arc(headCx - 16, headCy + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(headCx + 16, headCy + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        // Beard bottom detail
        ctx.fillStyle = col("#773421");
        ctx.beginPath();
        ctx.ellipse(headCx, headCy + 20, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eyebrow ridge
        ctx.fillStyle = col("#773421");
        ctx.fillRect(sx + 12 + lx + eyeDir[0], sy - 20 + ly - bob + eyeDir[1], 24, 2);

        // Mouth (direction-shifted)
        const mOfs = dir === 2 ? -3 : dir === 3 ? 3 : 0;
        // Mouth opening
        ctx.fillStyle = col("#9b1a0a");
        ctx.beginPath();
        ctx.roundRect(sx + 16 + lx + mOfs, sy - 5 + ly - bob, 16, 6, 2);
        ctx.fill();
        // Inner mouth
        ctx.fillStyle = col("#300f0a");
        ctx.beginPath();
        ctx.roundRect(sx + 17 + lx + mOfs, sy - 4 + ly - bob, 14, 4, 1);
        ctx.fill();
        // Teeth
        ctx.fillStyle = col("#efd8a1");
        ctx.fillRect(sx + 18 + lx + mOfs, sy - 4 + ly - bob, 12, 1);

        // Eyes
        if (isBlinking) {
            ctx.fillStyle = col("#2a1d0d");
            ctx.fillRect(sx + 12 + lx + eyeDir[0], sy - 13 + ly - bob + eyeDir[1], 8, 2);
            ctx.fillRect(sx + 28 + lx + eyeDir[0], sy - 13 + ly - bob + eyeDir[1], 8, 2);
        } else {
            // Eye whites (rounded)
            ctx.fillStyle = col("#efd8a1");
            ctx.beginPath();
            ctx.ellipse(sx + 16 + lx + eyeDir[0], sy - 14 + ly - bob + eyeDir[1], 5, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(sx + 32 + lx + eyeDir[0], sy - 14 + ly - bob + eyeDir[1], 5, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            // Pupils
            ctx.fillStyle = col("#2a1d0d");
            ctx.beginPath();
            ctx.arc(sx + 17 + lx + eyeDir[0], sy - 13 + ly - bob + eyeDir[1], 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(sx + 33 + lx + eyeDir[0], sy - 13 + ly - bob + eyeDir[1], 3, 0, Math.PI * 2);
            ctx.fill();
            // Pupil highlights
            ctx.fillStyle = col("#efd8a1");
            ctx.beginPath();
            ctx.arc(sx + 16 + lx + eyeDir[0], sy - 14 + ly - bob + eyeDir[1], 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(sx + 32 + lx + eyeDir[0], sy - 14 + ly - bob + eyeDir[1], 1, 0, Math.PI * 2);
            ctx.fill();
            // Brows
            ctx.fillStyle = col("#927e6a");
            ctx.lineWidth = 2;
            ctx.strokeStyle = col("#927e6a");
            ctx.beginPath();
            ctx.moveTo(sx + 10 + lx + eyeDir[0], sy - 19 + ly - bob + eyeDir[1]);
            ctx.lineTo(sx + 22 + lx + eyeDir[0], sy - 19 + ly - bob + eyeDir[1]);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx + 26 + lx + eyeDir[0], sy - 19 + ly - bob + eyeDir[1]);
            ctx.lineTo(sx + 38 + lx + eyeDir[0], sy - 19 + ly - bob + eyeDir[1]);
            ctx.stroke();
        }
    }

    // === FEET / SHOES (rounded) — stay planted ===
    const walkOfs = (frame === 1 ? 2 : frame === 3 ? -2 : 0) * SCALE;
    ctx.fillStyle = col("#927e6a");
    ctx.beginPath();
    ctx.roundRect(sx + 12 + walkOfs, sy + 36 - bob, 9, 6, [0, 0, 3, 3]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(sx + 27 - walkOfs, sy + 36 - bob, 9, 6, [0, 0, 3, 3]);
    ctx.fill();
    // Shoe soles
    ctx.fillStyle = col("#243024");
    ctx.fillRect(sx + 12 + walkOfs, sy + 40 - bob, 9, 2);
    ctx.fillRect(sx + 27 - walkOfs, sy + 40 - bob, 9, 2);
    // Shoe tops
    ctx.fillStyle = col("#1e2e1e");
    ctx.fillRect(sx + 12 + walkOfs, sy + 34 - bob, 9, 3);
    ctx.fillRect(sx + 27 - walkOfs, sy + 34 - bob, 9, 3);

    spriteGlowOff();
}

function drawPlayer() {
    const p = player;
    let punchThrust = 0;
    if (p.attacking) {
        const progress = 1 - (p.attackTimer / p.attackDuration);
        punchThrust = Math.sin(progress * Math.PI);
    }
    drawPlayerSprite(p.x, p.y, p.frame, p.dir, { isBlinking: p.blinkTimer >= 180, punchThrust: punchThrust });
}

function drawPunch() {
    const p = player;
    const px = p.x;
    const py = p.y;
    const cx = px + p.w / 2;
    const cy = py + p.h * 0.35; // shoulder height
    const progress = 1 - (p.attackTimer / p.attackDuration);

    ctx.save();
    const sbox = getPunchBox();

    // Punch thrust: arm extends outward, peaks at progress=0.5
    const thrust = Math.sin(progress * Math.PI); // 0→1→0

    // Direction vectors
    let dx = 0, dy = 0;
    switch (p.dir) {
        case 0: dy = 1; break;  // down
        case 1: dy = -1; break; // up
        case 2: dx = -1; break; // left
        case 3: dx = 1; break;  // right
    }

    // Body lean (must match drawPlayerSprite lean values)
    const leanX = dx !== 0 ? dx * thrust * 5 : 0;
    const leanY = dy !== 0 ? dy * thrust * 4 : 0;

    // Arm starts from edge of leaned body, extends a short distance to fist
    let shoulderOffX, shoulderOffY;
    switch (p.dir) {
        case 0: shoulderOffX = -5; shoulderOffY = 2; break;  // down — character's right arm, at shoulder height
        case 1: shoulderOffX = 5; shoulderOffY = -8; break;   // up
        case 2: shoulderOffX = -8; shoulderOffY = -2; break;  // left
        case 3: shoulderOffX = 8; shoulderOffY = -2; break;   // right
    }
    const armLen = 3 + thrust * 6; // short arm from body edge to fist
    const shoulderX = (cx + leanX + shoulderOffX) * SCALE;
    const shoulderY = (cy + leanY + shoulderOffY) * SCALE;
    const fistX = (cx + leanX + shoulderOffX + dx * armLen) * SCALE;
    const fistY = (cy + leanY + shoulderOffY + dy * armLen) * SCALE;

    // === ARM ===
    ctx.strokeStyle = "#efb775"; // skin color
    ctx.lineWidth = 4 * SCALE;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(fistX, fistY);
    ctx.stroke();

    // Arm outline
    ctx.strokeStyle = "#927e6a";
    ctx.lineWidth = 5 * SCALE;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(fistX, fistY);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // === FIST ===
    const fistSize = 3.5;
    // Fist shadow
    ctx.fillStyle = "#a58c27";
    ctx.beginPath();
    ctx.arc(fistX + SCALE, fistY + SCALE, fistSize * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Main fist
    ctx.fillStyle = "#efb775";
    ctx.beginPath();
    ctx.arc(fistX, fistY, fistSize * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Knuckle highlights
    ctx.fillStyle = "#F0D8B8";
    const knucklePerp = dx === 0 ? 1 : 0; // perpendicular axis
    for (let i = -1; i <= 1; i++) {
        const kx = fistX + (knucklePerp === 1 ? i * 1.8 * SCALE : dx * 2.5 * SCALE);
        const ky = fistY + (knucklePerp === 0 ? i * 1.8 * SCALE : dy * 2.5 * SCALE);
        ctx.beginPath();
        ctx.arc(kx, ky, 1.0 * SCALE, 0, Math.PI * 2);
        ctx.fill();
    }

    // === IMPACT EFFECT on hit ===
    if (thrust > 0.5 && p.punchHit) {
        // Impact burst lines — larger, more visible
        const burstCount = 8;
        for (let i = 0; i < burstCount; i++) {
            const angle = (i / burstCount) * Math.PI * 2 + progress * 2;
            const innerR = 5 * SCALE;
            const outerR = (10 + thrust * 5) * SCALE;
            ctx.strokeStyle = "#efd8a1";
            ctx.lineWidth = 2.5 * SCALE;
            ctx.globalAlpha = thrust * 0.85;
            ctx.beginPath();
            ctx.moveTo(fistX + Math.cos(angle) * innerR, fistY + Math.sin(angle) * innerR);
            ctx.lineTo(fistX + Math.cos(angle) * outerR, fistY + Math.sin(angle) * outerR);
            ctx.stroke();
        }
        // Impact flash — larger
        ctx.fillStyle = "#FFF";
        ctx.globalAlpha = thrust * 0.5;
        ctx.beginPath();
        ctx.arc(fistX, fistY, 9 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // === MOTION LINES (whoosh trail) ===
    if (thrust > 0.3) {
        ctx.strokeStyle = "#efb775";
        ctx.lineWidth = 1.5 * SCALE;
        ctx.globalAlpha = thrust * 0.55;
        for (let i = 1; i <= 3; i++) {
            const trailLen = i * 3;
            const offset = i * 2.5;
            const tx = fistX - dx * trailLen * SCALE;
            const ty = fistY - dy * trailLen * SCALE;
            const perpX = dy !== 0 ? offset : 0;
            const perpY = dx !== 0 ? offset : 0;
            ctx.beginPath();
            ctx.moveTo(tx + perpX * SCALE, ty + perpY * SCALE);
            ctx.lineTo(tx + perpX * SCALE - dx * 4 * SCALE, ty + perpY * SCALE - dy * 4 * SCALE);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(tx - perpX * SCALE, ty - perpY * SCALE);
            ctx.lineTo(tx - perpX * SCALE - dx * 4 * SCALE, ty - perpY * SCALE - dy * 4 * SCALE);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }

    ctx.restore();
}

// Draw the ruined venue backdrop (used in tutorial scenes)
// t: animation timer for smoke wisps
function drawRuinedVenueBackdrop(t, options) {
    const opts = options || {};
    const skipGrid = opts.skipGrid || false;
    const W = COLS * TILE;
    const H = ROWS * TILE;
    // Dark cave floor
    drawRect(0, 0, W, H, "#0a0f0a");
    // Damaged cave walls
    for (let c = 0; c < COLS; c++) {
        const damaged = ((c * 7 + 3) % 10) > 6;
        drawRect(c * TILE, 0, TILE, TILE, damaged ? "#111911" : ((c * 7 + 3) % 3 === 0 ? "#1e2e1e" : "#1a2a1a"));
        const botCol = (c * 11 + 5) % 3 === 0 ? "#152015" : "#1a2a1a";
        drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, botCol);
    }
    for (let r = 0; r < ROWS; r++) {
        const lCol = (r * 7) % 3 === 0 ? "#152015" : "#1a2a1a";
        drawRect(0, r * TILE, TILE, TILE, lCol);
        drawRect((COLS - 1) * TILE, r * TILE, TILE, TILE, lCol);
    }
    // Open caves
    for (const cave of CAVES) {
        const cx = cave.tileX * TILE, cy = cave.tileY * TILE;
        drawRect(cx, cy - 2, TILE, TILE + 4, "#050805");
        drawRect(cx - 2, cy - 4, TILE + 4, 3, "#243024");
        drawRect(cx - 2, cy + TILE + 1, TILE + 4, 3, "#243024");
    }
    // Dead mushroom lights
    for (let c = 1; c < COLS - 1; c++) {
        drawRect(c * TILE + TILE / 2 - 2, TILE + 6, 4, 4, "#0a0f0a");
    }
    // Destroyed DJ booth (stone rubble)
    const boothX = W / 2 - 24;
    const boothY = GRID_Y * TILE - 8;
    drawRect(boothX - 8, boothY + 12, 64, 8, "#0a0f0a");
    drawRect(boothX + 5, boothY + 6, 10, 6, "#0d150d");
    drawRect(boothX + 35, boothY + 8, 8, 4, "#0d150d");
    // Smoke wisps
    for (let si = 0; si < 3; si++) {
        const smokeX = boothX + 15 + si * 12;
        const smokeY = boothY - (t * 0.3 + si * 20) % 30;
        ctx.globalAlpha = 0.15 - (t * 0.3 + si * 20) % 30 / 200;
        if (ctx.globalAlpha > 0) drawRect(smokeX, smokeY, 3, 3, "#888888");
    }
    ctx.globalAlpha = 1;
    // Corrupted beat grid (carries over from intro scenes)
    if (introGridState && !skipGrid) {
        const miniGridY = GRID_Y * TILE + GRID_Y_OFFSET;
        const miniGridX = 3 * TILE;
        ctx.globalAlpha = 0.35;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 16; c++) {
                const gx = miniGridX + c * TILE;
                const gy = miniGridY + r * TILE;
                const cellOn = introGridState[r][c];
                drawRect(gx, gy, TILE, TILE, PAL.gridBorder);
                drawRect(gx + 1, gy + 1, TILE - 2, TILE - 2, cellOn ? PAL.gridOn[r] : PAL.gridOff);
            }
        }
        ctx.globalAlpha = 1;
    }
    // Dark vignette
    const W_v = W * SCALE;
    const H_v = H * SCALE;
    const vGrad = ctx.createRadialGradient(W_v / 2, H_v / 2, W_v * 0.2, W_v / 2, H_v / 2, W_v * 0.6);
    vGrad.addColorStop(0, "rgba(0,0,0,0)");
    vGrad.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, W_v, H_v);

    // Grain texture overlay (screen-print effect)
    ctx.drawImage(grainCanvas, 0, 0);
}

// Reusable goblin sprite for all screens (story, warnings, gameplay)
// Draw a subwoofer speaker (replaces turntable)
// sx, sy: top-left position (game coords), pump: 0-1 kick intensity, side: -1=left, 1=right
function drawSubwoofer(sx, sy, pump, side) {
    const pw = pump * 2;
    const bx = sx - pw * 0.5;
    const by = sy - pw * 0.5;
    const bw = 16 + pw;
    const bh = 12 + pw;
    // Cabinet (rounded — stone/metal)
    fillRoundRect(ctx, bx * SCALE, by * SCALE, bw * SCALE, bh * SCALE, 3, "#2a3a2a");
    fillRoundRect(ctx, (bx + 1) * SCALE, (by + 1) * SCALE, (bw - 2) * SCALE, (bh - 2) * SCALE, 2, "#1e2e1e");
    // Speaker cone (actual circle)
    const cx = (bx + bw / 2) * SCALE;
    const cy = (by + bh / 2) * SCALE;
    // Surround ring
    ctx.fillStyle = "#2e4a4e";
    ctx.beginPath();
    ctx.arc(cx, cy, 5 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Cone
    const coneCol = pump > 0.3 ? "#504030" : "#3a3020";
    ctx.fillStyle = coneCol;
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Dust cap (center)
    ctx.fillStyle = "#1a1410";
    ctx.beginPath();
    ctx.arc(cx, cy, 1 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Sound lines emanating outward
    if (pump > 0.05) {
        ctx.globalAlpha = pump * 0.6;
        ctx.strokeStyle = "#efd8a1";
        ctx.lineWidth = 1 * SCALE;
        for (let i = 0; i < 3; i++) {
            const dist = (4 + i * 5 + (1 - pump) * 6);
            const lineX = cx + side * dist;
            ctx.beginPath();
            ctx.moveTo(lineX * SCALE, (cy - 3 + i) * SCALE);
            ctx.lineTo(lineX * SCALE, (cy + 3 - i) * SCALE);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
}

// ---- DJ Equipment Sprite Functions ----

function drawTurntable(tx, ty) {
    // Platter base (rounded — stone/metal)
    fillRoundRect(ctx, tx * SCALE, (ty + 6) * SCALE, 14 * SCALE, 6 * SCALE, 3, "#2a3a2a");
    fillRoundRect(ctx, (tx + 1) * SCALE, (ty + 7) * SCALE, 12 * SCALE, 4 * SCALE, 2, "#1e2e1e");
    // Platter (actual circle)
    const pcx = (tx + 7) * SCALE, pcy = (ty + 5) * SCALE;
    ctx.fillStyle = "#1a1410";
    ctx.beginPath();
    ctx.arc(pcx, pcy, 5 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Vinyl grooves (concentric circles)
    ctx.strokeStyle = "#2a2018";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pcx, pcy, 3.5 * SCALE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pcx, pcy, 2.5 * SCALE, 0, Math.PI * 2);
    ctx.stroke();
    // Label center
    ctx.fillStyle = "#efac28";
    ctx.beginPath();
    ctx.arc(pcx, pcy, 1.2 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Tonearm (line with rounded cap)
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1 * SCALE;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo((tx + 12) * SCALE, ty * SCALE);
    ctx.lineTo((tx + 11) * SCALE, (ty + 5) * SCALE);
    ctx.stroke();
    ctx.lineCap = "butt";
    // Tonearm base
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.arc((tx + 12) * SCALE, ty * SCALE, 1 * SCALE, 0, Math.PI * 2);
    ctx.fill();
}

function drawMixer(mx, my) {
    // Mixer body (rounded — dark cave metal)
    fillRoundRect(ctx, mx * SCALE, my * SCALE, 12 * SCALE, 10 * SCALE, 3, "#1e3e2e");
    // Fader slots (rounded)
    for (let ml = 0; ml < 4; ml++) {
        fillRoundRect(ctx, (mx + 2 + ml * 2) * SCALE, (my + 1) * SCALE, 1 * SCALE, 2 * SCALE, 1, "#1f240a");
    }
    // Crossfader track
    fillRoundRect(ctx, (mx + 3) * SCALE, (my + 5) * SCALE, 6 * SCALE, 2 * SCALE, 1, "#1f240a");
    // Crossfader knob (circle)
    ctx.fillStyle = "#efac28";
    ctx.beginPath();
    ctx.arc((mx + 6) * SCALE, (my + 6) * SCALE, 1.5 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Level meters (small circles)
    ctx.fillStyle = "#00FF88";
    ctx.beginPath();
    ctx.arc((mx + 2) * SCALE, (my + 8.5) * SCALE, 1 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc((mx + 6) * SCALE, (my + 8.5) * SCALE, 1 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FF4400";
    ctx.beginPath();
    ctx.arc((mx + 10) * SCALE, (my + 8.5) * SCALE, 1 * SCALE, 0, Math.PI * 2);
    ctx.fill();
}

const LIGHT_RIG_COLORS = ["#FF4400", "#efac28", "#00FF88", "#4488FF", "#FF44AA", "#efac28"];
function drawLightRig(lx, ly, pump) {
    // Two vertical light arrays flanking the stage (left and right)
    // lx, ly is top-left reference (boothX - 8, boothY - 18)
    // pump: 0-1 beat intensity for glow effect
    pump = pump || 0;
    const leftX = lx - 4;       // aligned with left speaker outer edge
    const rightX = lx + 66;     // aligned with right speaker outer edge
    const poleTop = ly;
    const poleH = 18;           // vertical pole height

    // Left pole (rounded)
    fillRoundRect(ctx, (leftX + 1) * SCALE, poleTop * SCALE, 2 * SCALE, poleH * SCALE, 1, "#555");
    // Right pole (rounded)
    fillRoundRect(ctx, (rightX + 1) * SCALE, poleTop * SCALE, 2 * SCALE, poleH * SCALE, 1, "#555");

    // 3 lights on each pole, evenly spaced (circles)
    const baseGlow = 0.2;
    const beatGlow = pump * 0.5;
    const glowAlpha = baseGlow + beatGlow;
    const bulbR = pump > 0.1 ? 2.5 : 2;
    // Glow pass
    ctx.globalAlpha = glowAlpha;
    for (let i = 0; i < 3; i++) {
        const by = poleTop + 2 + i * 5;
        ctx.fillStyle = LIGHT_RIG_COLORS[i];
        ctx.beginPath();
        ctx.arc((leftX + 3) * SCALE, (by + 1) * SCALE, 4 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = LIGHT_RIG_COLORS[i + 3];
        ctx.beginPath();
        ctx.arc((rightX) * SCALE, (by + 1) * SCALE, 4 * SCALE, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Bulb pass (circles on top of glow)
    for (let i = 0; i < 3; i++) {
        const by = poleTop + 2 + i * 5;
        ctx.fillStyle = LIGHT_RIG_COLORS[i];
        ctx.beginPath();
        ctx.arc((leftX + 3) * SCALE, (by + 1) * SCALE, bulbR * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = LIGHT_RIG_COLORS[i + 3];
        ctx.beginPath();
        ctx.arc((rightX) * SCALE, (by + 1) * SCALE, bulbR * SCALE, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawDiscoBall(dx, dy) {
    const bcx = (dx + 4.5) * SCALE;
    const bcy = (dy + 4.5) * SCALE;
    const br = 4.5 * SCALE;
    // String
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1 * SCALE;
    ctx.beginPath();
    ctx.moveTo(bcx, (dy - 6) * SCALE);
    ctx.lineTo(bcx, bcy - br);
    ctx.stroke();
    // Ball body (actual circle)
    ctx.fillStyle = "#aaa";
    ctx.beginPath();
    ctx.arc(bcx, bcy, br, 0, Math.PI * 2);
    ctx.fill();
    // Mirror facets (small circles arranged in a grid pattern)
    const facetCols = ["#ddd", "#fff", "#bbb", "#eee"];
    for (let fy = -1; fy <= 1; fy++) {
        for (let fx = -1; fx <= 1; fx++) {
            ctx.fillStyle = facetCols[(fx + fy + 4) % 4];
            ctx.beginPath();
            ctx.arc(bcx + fx * 2.5 * SCALE, bcy + fy * 2.5 * SCALE, 1 * SCALE, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // Highlight (crescent)
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(bcx - 1 * SCALE, bcy - 1.5 * SCALE, 2 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

// Map DJ_SETUP_PIECES names to draw functions with booth-relative offsets
// Offsets are relative to boothX, boothY as defined in intro Scene 0
function drawDJSetupPiece(pieceIndex, boothX, boothY, options) {
    const alpha = (options && options.alpha !== undefined) ? options.alpha : 1;
    const silhouette = (options && options.silhouette) || false;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * alpha;
    if (silhouette) ctx.globalAlpha = prevAlpha * 0.15;

    // Sprite-based path — offsets match the procedural positions below
    const _djKeys = ["speaker_left", "speaker_right", "turntable", "mixer", "light_rig", "disco_ball"];
    const _djOffsets = [[-12, -2], [44, -2], [1, -2], [18, 2], [-8, -18], [20, -30]];
    const djSpr = IMAGES[_djKeys[pieceIndex]];
    if (djSpr) {
        const [ox, oy] = _djOffsets[pieceIndex];
        ctx.drawImage(djSpr, (boothX + ox) * SCALE, (boothY + oy) * SCALE);
        ctx.globalAlpha = prevAlpha;
        return;
    }

    // Procedural fallback
    switch (pieceIndex) {
        case 0: // left speaker
            drawSubwoofer(boothX - 12, boothY - 2, 0, -1);
            break;
        case 1: // right speaker
            drawSubwoofer(boothX + 44, boothY - 2, 0, 1);
            break;
        case 2: // turntable
            drawTurntable(boothX + 1, boothY - 2);
            break;
        case 3: // mixer
            drawMixer(boothX + 18, boothY + 2);
            break;
        case 4: // light rig
            drawLightRig(boothX - 8, boothY - 18, options && options.pump);
            break;
        case 5: // disco ball
            drawDiscoBall(boothX + 20, boothY - 30);
            break;
    }
    ctx.globalAlpha = prevAlpha;
}

// type: "normal", "elite", "catapult"
// gx, gy: top-left position (game coords)
// frame: animation frame (0-3)
// options: { dir, showShadow, bodyCol, darkCol, headCol, eyeCol }
function drawGoblinSprite(type, gx, gy, frame, options) {
    const opts = options || {};
    const dir = opts.dir !== undefined ? opts.dir : 0;
    const showShadow = opts.showShadow !== false;
    const bob = (frame % 2 === 1 ? 1 : 0) * SCALE;

    // ---- Sprite-based path (early return if PNG loaded) ----
    {
        const dirName = ["down", "up", "left", "right"][dir];
        const prefix = type === "elite" ? "elite" : type === "catapult" ? "catapult" : "goblin";
        const sprKey = prefix + "_" + dirName + "_" + (frame % 2);
        if (IMAGES[sprKey]) {
            const sx = gx * SCALE;
            const sy = gy * SCALE;
            // Draw catapult frame behind goblin
            if (type === "catapult" && IMAGES.catapult_frame) {
                ctx.drawImage(IMAGES.catapult_frame, sx - 12 * SCALE, sy - 6 * SCALE);
            }
            // Hurt flash: overlay white tint
            const isHurt = opts.bodyCol && opts.bodyCol !== "#39FF14" && opts.bodyCol !== "#FF00FF" && opts.bodyCol !== "#FF6600";
            if (isHurt) {
                ctx.drawImage(IMAGES[sprKey], sx, sy - bob);
                ctx.globalCompositeOperation = "source-atop";
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(sx, sy - bob, TILE * SCALE, TILE * SCALE);
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = "source-over";
            } else {
                ctx.drawImage(IMAGES[sprKey], sx, sy - bob);
            }
            return;
        }
    }

    // ---- Procedural fallback ----
    // Colors — allow overrides (for hurt flash, HP changes)
    let bodyCol, darkCol, headCol, eyeCol;
    if (opts.bodyCol) {
        bodyCol = opts.bodyCol; darkCol = opts.darkCol; headCol = opts.headCol; eyeCol = opts.eyeCol;
    } else if (type === "elite") {
        bodyCol = "#FF00FF"; darkCol = "#CC00CC"; headCol = "#FF44FF"; eyeCol = "#00FFFF";
    } else if (type === "catapult") {
        bodyCol = "#FF6600"; darkCol = "#CC4400"; headCol = "#FF8833"; eyeCol = "#00FFFF";
    } else {
        bodyCol = "#39FF14"; darkCol = "#00CC00"; headCol = "#66FF44"; eyeCol = "#FF00FF";
    }

    // Screen-pixel base position
    const sx = gx * SCALE;
    const sy = gy * SCALE;
    let bodyOffX = 0, bodyOffY = 0;

    function px(x, y, w, h, color) {
        drawPx(sx + bodyOffX + x, sy + bodyOffY + y - bob, w, h, color);
    }

    // Shadow
    if (showShadow) {
        drawRect(gx + 3, gy + TILE - 2, TILE - 6, 3, PAL.shadow);
    }

    // Catapult frame (behind goblin) — 48x48 detail
    // Frame draws at base position; goblin body offsets behind it
    if (type === "catapult") {
        // Draw frame at base position (no body offset)
        function cpx(x, y, w, h, color) {
            drawPx(sx + x, sy + y - bob, w, h, color);
        }
        // Base platform
        cpx(-12, 18, 72, 9, "#5C3A1E");
        cpx(-9, 15, 66, 3, "#4A2A0E");
        // Left upright post
        cpx(-6, 3, 9, 18, "#5C3A1E");
        cpx(-3, 3, 3, 18, "#7B5A3A");     // Wood grain highlight
        // Right upright post
        cpx(45, 3, 9, 18, "#5C3A1E");
        cpx(48, 3, 3, 18, "#7B5A3A");     // Wood grain highlight
        // Throwing arm (horizontal beam)
        cpx(-3, -3, 54, 6, "#7B5A3A");
        cpx(0, -6, 48, 3, "#6B4A2A");     // Arm top edge
        // Bowl/cup at launch end
        cpx(-12, -12, 18, 9, "#4A2A0E");
        cpx(-9, -15, 12, 3, "#4A2A0E");   // Bowl lip
        cpx(-9, -9, 12, 3, "#5C3A1E");    // Bowl inner
        // Rope/binding details
        cpx(-3, 0, 6, 3, "#3A2A0E");
        cpx(45, 0, 6, 3, "#3A2A0E");
        // Cross brace
        cpx(12, 9, 24, 3, "#4A2A0E");

        // Offset goblin body behind the catapult based on facing direction
        const d = opts.dir || 0;
        if (d === 0) bodyOffY = -15;       // moving down → goblin shifts up (behind)
        else if (d === 1) bodyOffY = 15;   // moving up → goblin shifts down (behind)
        else if (d === 2) bodyOffX = 15;   // moving left → goblin shifts right (behind)
        else if (d === 3) bodyOffX = -15;  // moving right → goblin shifts left (behind)
    }

    // Block-print shadow glow
    spriteGlowOn();

    // === BODY (squat, stocky — solid rounded shape) ===
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.roundRect(sx + bodyOffX + 12, sy + bodyOffY + 9 - bob, 24, 27, [0, 0, 4, 4]);
    ctx.fill();
    // Body shading
    ctx.fillStyle = darkCol;
    ctx.fillRect(sx + bodyOffX + 12, sy + bodyOffY + 9 - bob, 6, 27);
    ctx.fillRect(sx + bodyOffX + 30, sy + bodyOffY + 9 - bob, 6, 27);
    // Tattered hem
    ctx.fillStyle = darkCol;
    ctx.fillRect(sx + bodyOffX + 12, sy + bodyOffY + 33 - bob, 24, 3);

    // === HEAD (round, expressive — smooth circle) ===
    const ghCx = sx + bodyOffX + 24;
    const ghCy = sy + bodyOffY - 3 - bob;
    const ghR = 17;
    ctx.fillStyle = headCol;
    ctx.beginPath();
    ctx.arc(ghCx, ghCy, ghR, 0, Math.PI * 2);
    ctx.fill();
    // Head shading
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.arc(ghCx - 12, ghCy - 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ghCx + 12, ghCy - 10, 5, 0, Math.PI * 2);
    ctx.fill();

    // === POINTY EARS (triangular, smooth) ===
    ctx.fillStyle = headCol;
    // Left ear
    ctx.beginPath();
    ctx.moveTo(ghCx - ghR + 2, ghCy - 2);
    ctx.lineTo(ghCx - ghR - 8, ghCy - 16);
    ctx.lineTo(ghCx - ghR + 8, ghCy - 6);
    ctx.closePath();
    ctx.fill();
    // Right ear
    ctx.beginPath();
    ctx.moveTo(ghCx + ghR - 2, ghCy - 2);
    ctx.lineTo(ghCx + ghR + 8, ghCy - 16);
    ctx.lineTo(ghCx + ghR - 8, ghCy - 6);
    ctx.closePath();
    ctx.fill();
    // Inner ear detail
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.moveTo(ghCx - ghR + 1, ghCy);
    ctx.lineTo(ghCx - ghR - 4, ghCy - 10);
    ctx.lineTo(ghCx - ghR + 5, ghCy - 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ghCx + ghR - 1, ghCy);
    ctx.lineTo(ghCx + ghR + 4, ghCy - 10);
    ctx.lineTo(ghCx + ghR - 5, ghCy - 4);
    ctx.closePath();
    ctx.fill();

    // === EYES (direction-aware) ===
    const eyeOfs = [[0, 3], [0, -6], [-3, 0], [3, 0]][dir];

    if (dir !== 1) {
        // Eye sockets
        ctx.fillStyle = "#1a2a1a";
        ctx.beginPath();
        ctx.ellipse(ghCx - 8 + eyeOfs[0], ghCy - 2 + eyeOfs[1], 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(ghCx + 8 + eyeOfs[0], ghCy - 2 + eyeOfs[1], 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Glowing eyes
        ctx.fillStyle = eyeCol;
        ctx.beginPath();
        ctx.ellipse(ghCx - 8 + eyeOfs[0], ghCy - 1 + eyeOfs[1], 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(ghCx + 8 + eyeOfs[0], ghCy - 1 + eyeOfs[1], 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Bright pupils
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ghCx - 7 + eyeOfs[0], ghCy - 1 + eyeOfs[1], 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ghCx + 9 + eyeOfs[0], ghCy - 1 + eyeOfs[1], 2, 0, Math.PI * 2);
        ctx.fill();
        // Angry brow ridge
        ctx.strokeStyle = darkCol;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ghCx - 14 + eyeOfs[0], ghCy - 6 + eyeOfs[1]);
        ctx.lineTo(ghCx - 3 + eyeOfs[0], ghCy - 8 + eyeOfs[1]);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ghCx + 3 + eyeOfs[0], ghCy - 8 + eyeOfs[1]);
        ctx.lineTo(ghCx + 14 + eyeOfs[0], ghCy - 6 + eyeOfs[1]);
        ctx.stroke();
        ctx.lineCap = "butt";
    }

    // === MOUTH / FANGS (direction-aware) ===
    if (dir !== 1) {
        const mOfs = dir === 2 ? -3 : dir === 3 ? 3 : 0;
        // Wide grin
        ctx.fillStyle = "#2a1a1a";
        ctx.beginPath();
        ctx.roundRect(sx + bodyOffX + 12 + mOfs, sy + bodyOffY - bob, 24, 9, [0, 0, 4, 4]);
        ctx.fill();
        // Fangs (triangular)
        ctx.fillStyle = "#efd8a1";
        // Left fang
        ctx.beginPath();
        ctx.moveTo(sx + bodyOffX + 14 + mOfs, sy + bodyOffY - bob);
        ctx.lineTo(sx + bodyOffX + 17 + mOfs, sy + bodyOffY - bob);
        ctx.lineTo(sx + bodyOffX + 15.5 + mOfs, sy + bodyOffY + 8 - bob);
        ctx.closePath();
        ctx.fill();
        // Center fang
        ctx.beginPath();
        ctx.moveTo(sx + bodyOffX + 21 + mOfs, sy + bodyOffY - bob);
        ctx.lineTo(sx + bodyOffX + 24 + mOfs, sy + bodyOffY - bob);
        ctx.lineTo(sx + bodyOffX + 22.5 + mOfs, sy + bodyOffY + 7 - bob);
        ctx.closePath();
        ctx.fill();
        // Right fang
        ctx.beginPath();
        ctx.moveTo(sx + bodyOffX + 28 + mOfs, sy + bodyOffY - bob);
        ctx.lineTo(sx + bodyOffX + 31 + mOfs, sy + bodyOffY - bob);
        ctx.lineTo(sx + bodyOffX + 29.5 + mOfs, sy + bodyOffY + 8 - bob);
        ctx.closePath();
        ctx.fill();
    }

    // === FEET (clawed — rounded with points) ===
    const walkOfs = (frame === 1 ? 2 : frame === 3 ? -2 : 0) * SCALE;
    ctx.fillStyle = darkCol;
    ctx.beginPath();
    ctx.roundRect(sx + bodyOffX + 12 + walkOfs, sy + bodyOffY + 36 - bob, 9, 6, [0, 0, 3, 3]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(sx + bodyOffX + 27 - walkOfs, sy + bodyOffY + 36 - bob, 9, 6, [0, 0, 3, 3]);
    ctx.fill();
    // Claw tips (small triangles)
    ctx.beginPath();
    ctx.moveTo(sx + bodyOffX + 10 + walkOfs, sy + bodyOffY + 40 - bob);
    ctx.lineTo(sx + bodyOffX + 14 + walkOfs, sy + bodyOffY + 40 - bob);
    ctx.lineTo(sx + bodyOffX + 10 + walkOfs, sy + bodyOffY + 43 - bob);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + bodyOffX + 33 - walkOfs, sy + bodyOffY + 40 - bob);
    ctx.lineTo(sx + bodyOffX + 37 - walkOfs, sy + bodyOffY + 40 - bob);
    ctx.lineTo(sx + bodyOffX + 37 - walkOfs, sy + bodyOffY + 43 - bob);
    ctx.closePath();
    ctx.fill();

    spriteGlowOff();

    // Catapult invincibility shimmer
    if (type === "catapult") {
        const shimmerPhase = (performance.now() / 100) % (Math.PI * 2);
        const shimmerAlpha = 0.15 + Math.sin(shimmerPhase) * 0.1;
        ctx.fillStyle = "#00FFFF";
        ctx.globalAlpha = shimmerAlpha;
        ctx.fillRect(sx, (sy - 18 * 1) - bob, 48, 60);
        ctx.globalAlpha = 1.0;
    }
}

function drawGoblinFor(g) {
    // Color palette: elite changes color based on HP
    let bodyCol, darkCol, headCol, eyeCol;
    if (g.hurtTimer > 0 && g.hurtTimer % 4 < 2) {
        bodyCol = "#ffffff"; darkCol = "#dddddd"; headCol = "#ffffff"; eyeCol = "#00FFFF";
    } else if (!g.elite) {
        bodyCol = "#39FF14"; darkCol = "#00CC00"; headCol = "#66FF44"; eyeCol = "#FF00FF";
    } else if (g.hp === 3) {
        bodyCol = "#FF00FF"; darkCol = "#CC00CC"; headCol = "#FF44FF"; eyeCol = "#00FFFF";
    } else if (g.hp === 2) {
        bodyCol = "#CC00CC"; darkCol = "#990099"; headCol = "#DD33DD"; eyeCol = "#FF3333";
    } else {
        bodyCol = "#FF0044"; darkCol = "#CC0033"; headCol = "#FF3366"; eyeCol = "#00FFFF";
    }

    drawGoblinSprite(g.elite ? "elite" : "normal", g.x, g.y, g.frame, {
        dir: g.dir, bodyCol, darkCol, headCol, eyeCol
    });

    // Damage flash: bright white burst when hurt
    if (g.hurtTimer > 8) {
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = (g.hurtTimer - 8) / 4 * 0.6;
        ctx.fillRect((g.x - 2) * SCALE, (g.y - 6) * SCALE, (g.w + 4) * SCALE, (g.h + 8) * SCALE);
        ctx.globalAlpha = 1.0;
    }

    // HP pips for elite goblins (above head)
    if (g.elite && g.hp > 0 && g.hp <= 3) {
        const pipY = g.y - 10;
        const pipStartX = g.x + g.w / 2 - (3 * 4) / 2;
        for (let i = 0; i < 3; i++) {
            const filled = i < g.hp;
            drawRect(pipStartX + i * 4, pipY, 3, 3, filled ? "#FF00FF" : "#333333");
            if (filled) {
                drawRect(pipStartX + i * 4, pipY, 3, 1, "#FF88FF"); // highlight
            }
        }
    }
}

// Legacy alias
function drawGoblin() { drawGoblinFor(goblin); }

function drawCatapultGoblin() {
    const cg = catapultGoblin;
    if (!cg) return;

    drawGoblinSprite("catapult", cg.x, cg.y, cg.frame, { dir: cg.dir });

    // Boulder in flight
    if (cg.boulder) {
        const b = cg.boulder;
        const t = b.progress;
        // Lerp position
        const bx = b.startX + (b.targetX - b.startX) * t;
        const baseY = b.startY + (b.targetY - b.startY) * t;
        // Parabolic arc — peak height proportional to distance
        const arcHeight = 40;
        const arcY = -4 * arcHeight * t * (1 - t);
        const by = baseY + arcY;

        // Dust/smoke trail behind boulder in flight
        const trailCount = 5;
        for (let ti = 0; ti < trailCount; ti++) {
            const trailT = Math.max(0, t - ti * 0.04);
            const tx = b.startX + (b.targetX - b.startX) * trailT;
            const tBaseY = b.startY + (b.targetY - b.startY) * trailT;
            const tArcY = -4 * arcHeight * trailT * (1 - trailT);
            const ty = tBaseY + tArcY;
            const trailAlpha = (1 - ti / trailCount) * 0.3 * (1 - t); // fade as boulder lands
            ctx.globalAlpha = trailAlpha;
            const trailSize = (3 + ti * 2) * SCALE;
            ctx.fillStyle = ti % 2 === 0 ? "#aaaaaa" : "#888888";
            ctx.fillRect(tx * SCALE - trailSize / 2, ty * SCALE - trailSize / 2, trailSize, trailSize);
        }
        ctx.globalAlpha = 1.0;

        // Shadow on ground (grows as boulder descends) — 48×48 detail
        const shadowPx = (3 + (1 - Math.abs(arcY) / arcHeight) * 4) * SCALE;
        const sx = bx * SCALE - shadowPx / 2;
        const sy = b.targetY * SCALE + 6;
        drawPx(sx, sy, shadowPx, 6, PAL.shadow);

        // Boulder (detailed rock) — 48×48 detail
        const rx = bx * SCALE - 12;
        const ry = by * SCALE - 12;
        // Base rock shape
        drawPx(rx + 3, ry, 18, 24, "#6a6a6a");
        drawPx(rx, ry + 3, 24, 18, "#6a6a6a");
        // Inner lighter stone
        drawPx(rx + 3, ry + 3, 18, 18, "#888888");
        // Highlight (top-left)
        drawPx(rx + 3, ry + 3, 9, 6, "#aaaaaa");
        drawPx(rx + 3, ry + 3, 6, 9, "#aaaaaa");
        // Shadow edge (bottom-right)
        drawPx(rx + 15, ry + 15, 6, 6, "#392a1c");
        drawPx(rx + 18, ry + 9, 3, 9, "#392a1c");
        // Crack detail
        drawPx(rx + 9, ry + 9, 3, 9, "#5a5a5a");
        drawPx(rx + 12, ry + 12, 6, 3, "#5a5a5a");
    }

    // Target warning during aiming phase
    if (cg.phase === "aiming") {
        const flashOn = Math.floor(cg.phaseTimer / 4) % 2 === 0;
        if (flashOn) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = cg.targetRow + dr;
                    const c = cg.targetCol + dc;
                    if (r >= 0 && r < getActiveRows() && c >= 0 && c < GRID_COLS) {
                        const tx = (GRID_X + c) * TILE;
                        const ty = rowPixelY(r);
                        ctx.fillStyle = "#ff4400";
                        ctx.globalAlpha = 0.35;
                        ctx.fillRect(tx * SCALE, ty * SCALE, TILE * SCALE, TILE * SCALE);
                        ctx.globalAlpha = 1.0;
                        // Orange border
                        ctx.strokeStyle = "#ff6600";
                        ctx.lineWidth = SCALE;
                        ctx.strokeRect(tx * SCALE + SCALE, ty * SCALE + SCALE, TILE * SCALE - 2 * SCALE, TILE * SCALE - 2 * SCALE);
                    }
                }
            }
        }
    }
}

// Reusable 48x48 dancer sprite
// gx, gy: position (game coords), pal: color palette
// options: { bob (px), armBlend (0-1), footOffset (px) }
function drawDancerSprite(gx, gy, pal, options) {
    const opts = options || {};
    const bob = (opts.bob || 0) * SCALE;
    const armBlend = opts.armBlend || 0;
    const footOfs = (opts.footOffset || 0) * SCALE;
    const scale = opts.scale || 1;

    const sx = gx * SCALE;
    const sy = gy * SCALE;

    // ---- Sprite-based path (early return if PNG loaded) ----
    {
        const palIdx = pal._index !== undefined ? pal._index : 0;
        const keyDown = "dancer_" + palIdx;
        const keyUp = "dancer_" + palIdx + "_up";
        if (IMAGES[keyDown]) {
            const drawY = sy - bob;
            if (scale !== 1) {
                ctx.save();
                ctx.translate(sx + 18, sy + 18);
                ctx.scale(scale, scale);
                ctx.translate(-(sx + 18), -(sy + 18));
            }
            // Choose pose based on arm blend threshold
            if (armBlend > 0.5 && IMAGES[keyUp]) {
                ctx.drawImage(IMAGES[keyUp], sx, drawY);
            } else {
                ctx.drawImage(IMAGES[keyDown], sx, drawY);
            }
            if (scale !== 1) ctx.restore();
            return;
        }
    }

    // ---- Procedural fallback ----
    if (scale !== 1) {
        ctx.save();
        ctx.translate(sx + 18, sy + 18);
        ctx.scale(scale, scale);
        ctx.translate(-(sx + 18), -(sy + 18));
    }

    function px(x, y, w, h, color) {
        drawPx(sx + x, sy + y - bob, w, h, color);
    }

    // Block-print shadow glow
    spriteGlowOn();

    // === BODY (outfit — solid rounded shape) ===
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.roundRect(sx + 9, sy + 12 - bob, 18, 21, [4, 4, 3, 3]);
    ctx.fill();
    // Body shading
    ctx.fillStyle = pal.dark;
    ctx.fillRect(sx + 9, sy + 12 - bob, 3, 21);
    ctx.fillRect(sx + 24, sy + 12 - bob, 3, 21);
    // Hem
    ctx.fillStyle = pal.dark;
    ctx.fillRect(sx + 9, sy + 30 - bob, 18, 3);

    // === HEAD (round, friendly — smooth circle) ===
    const dcx = sx + 18;
    const dcy = sy + 2 - bob;
    const dr = 13;
    ctx.fillStyle = pal.head;
    ctx.beginPath();
    ctx.arc(dcx, dcy, dr, 0, Math.PI * 2);
    ctx.fill();

    // === HAIR (dome cap on top of head) ===
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.arc(dcx, dcy - 1, dr + 1, -Math.PI, 0);
    ctx.fill();
    // Hair peak on top
    ctx.beginPath();
    ctx.arc(dcx, dcy - 4, dr - 2, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.fill();
    // Side hair tufts
    ctx.beginPath();
    ctx.arc(dcx - dr, dcy + 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dcx + dr, dcy + 5, 4, 0, Math.PI * 2);
    ctx.fill();

    // === FACE ===
    // Eyes (friendly, round)
    ctx.fillStyle = "#efd8a1";
    ctx.beginPath();
    ctx.ellipse(dcx - 5, dcy + 3, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(dcx + 5, dcy + 3, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = "#2a1d0d";
    ctx.beginPath();
    ctx.arc(dcx - 4, dcy + 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dcx + 6, dcy + 4, 2, 0, Math.PI * 2);
    ctx.fill();
    // Highlights
    ctx.fillStyle = "#efd8a1";
    ctx.beginPath();
    ctx.arc(dcx - 5, dcy + 3, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dcx + 5, dcy + 3, 0.8, 0, Math.PI * 2);
    ctx.fill();
    // Friendly smile (curved line)
    ctx.strokeStyle = "#a56243";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(dcx, dcy + 7, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.lineCap = "butt";
    // Rosy cheeks
    ctx.fillStyle = "#a56243";
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(dcx - 10, dcy + 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dcx + 10, dcy + 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // === ARMS (position based on armBlend — rounded) ===
    const armDownY = 15;
    const armUpY = 6;
    const armY = armDownY + (armUpY - armDownY) * armBlend;
    const armH = 12 + (9 - 12) * armBlend;
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.roundRect(sx + 3, sy + armY - bob, 6, armH, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(sx + 27, sy + armY - bob, 6, armH, 3);
    ctx.fill();
    // Hands (small circles)
    ctx.fillStyle = pal.head;
    ctx.beginPath();
    ctx.arc(sx + 5, sy + armY - bob + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 31, sy + armY - bob + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // === FEET (rounded) ===
    ctx.fillStyle = pal.dark;
    ctx.beginPath();
    ctx.roundRect(sx + 9 - footOfs, sy + 33 - bob, 8, 6, [0, 0, 3, 3]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(sx + 19 + footOfs, sy + 33 - bob, 8, 6, [0, 0, 3, 3]);
    ctx.fill();
    // Shoe accent
    ctx.fillStyle = pal.body;
    ctx.fillRect(sx + 9 - footOfs, sy + 37 - bob, 8, 2);
    ctx.fillRect(sx + 19 + footOfs, sy + 37 - bob, 8, 2);

    spriteGlowOff();

    if (scale !== 1) {
        ctx.restore();
    }
}

function drawDancer(d) {
    const pal = d.palette;
    const step = (currentStep + d.phase) % 16;

    // Smooth interpolation
    const now = performance.now();
    const stepProgress = lastStepTime ? Math.min((now - lastStepTime) / stepMs, 1.0) : 0;
    const smoothStep = step + stepProgress;

    // Smooth bob
    const onBeat = (step % 4 === 0);
    const onEighth = (step % 2 === 0);
    const targetBob = onBeat ? 3 : onEighth ? 1 : 0;
    const nextStep = (step + 1) % 16;
    const nextOnBeat = (nextStep % 4 === 0);
    const nextOnEighth = (nextStep % 2 === 0);
    const nextBob = nextOnBeat ? 3 : nextOnEighth ? 1 : 0;
    const easedProgress = Math.sin(stepProgress * Math.PI / 2);
    const bob = targetBob + (nextBob - targetBob) * easedProgress;

    // Smooth arms
    const armTarget = onBeat ? 1.0 : 0.0;
    const nextArmTarget = nextOnBeat ? 1.0 : 0.0;
    const armBlend = armTarget + (nextArmTarget - armTarget) * easedProgress;

    // Smooth feet
    const footOffset = Math.sin(smoothStep * Math.PI) * 1.5;

    // Shadow (squishes when dancer is higher)
    const shadowW = 8 + bob * 0.5;
    drawRect(d.x + 2 - bob * 0.25, d.y + 13, shadowW, 2, PAL.shadow);

    drawDancerSprite(d.x, d.y, pal, { bob, armBlend, footOffset });
}

// ---- Ending Scene: The Underground Rave ----

function startEndingDrums(initialGain) {
    if (endingDrumStarted) return;
    endingDrumStarted = true;
    ensureAudio();
    if (!audioCtx) return;

    endingDrumGain = audioCtx.createGain();
    endingDrumGain.gain.setValueAtTime(initialGain || 1, audioCtx.currentTime);
    endingDrumGain.connect(audioCtx.destination);

    const bpm = 110;
    const sixteenth = 60 / bpm / 4;
    const K = INTRO_BEAT.K, S = INTRO_BEAT.S, H = INTRO_BEAT.H, O = INTRO_BEAT.O;
    const loopLen = 16 * sixteenth;

    function scheduleLoop() {
        if (!endingDrumStarted || !audioCtx || !endingDrumGain) return;
        const now = audioCtx.currentTime;
        const dest = endingDrumGain;

        for (let i = 0; i < 16; i++) {
            const t = now + i * sixteenth;
            if (K[i]) {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
                gain.gain.setValueAtTime(1.0, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                osc.connect(gain); gain.connect(dest);
                osc.start(t); osc.stop(t + 0.3);
            }
            if (S[i]) {
                const bufSz = audioCtx.sampleRate * 0.15;
                const buf = audioCtx.createBuffer(1, bufSz, audioCtx.sampleRate);
                const data = buf.getChannelData(0);
                for (let s = 0; s < bufSz; s++) data[s] = Math.random() * 2 - 1;
                const noise = audioCtx.createBufferSource();
                noise.buffer = buf;
                const nGain = audioCtx.createGain();
                nGain.gain.setValueAtTime(0.6, t);
                nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                const filt = audioCtx.createBiquadFilter();
                filt.type = "highpass"; filt.frequency.value = 1000;
                noise.connect(filt); filt.connect(nGain); nGain.connect(dest);
                noise.start(t); noise.stop(t + 0.15);
                const osc = audioCtx.createOscillator();
                const oGain = audioCtx.createGain();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(180, t);
                osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
                oGain.gain.setValueAtTime(0.5, t);
                oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.connect(oGain); oGain.connect(dest);
                osc.start(t); osc.stop(t + 0.1);
            }
            if (H[i]) {
                const bufSz = audioCtx.sampleRate * 0.06;
                const buf = audioCtx.createBuffer(1, bufSz, audioCtx.sampleRate);
                const data = buf.getChannelData(0);
                for (let s = 0; s < bufSz; s++) data[s] = Math.random() * 2 - 1;
                const noise = audioCtx.createBufferSource();
                noise.buffer = buf;
                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.25, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                const filt = audioCtx.createBiquadFilter();
                filt.type = "bandpass"; filt.frequency.value = 10000; filt.Q.value = 1.0;
                noise.connect(filt); filt.connect(gain); gain.connect(dest);
                noise.start(t); noise.stop(t + 0.06);
            }
            if (O[i]) {
                const bufSz2 = audioCtx.sampleRate * 0.15;
                const buf2 = audioCtx.createBuffer(1, bufSz2, audioCtx.sampleRate);
                const data2 = buf2.getChannelData(0);
                for (let s = 0; s < bufSz2; s++) data2[s] = Math.random() * 2 - 1;
                const noise2 = audioCtx.createBufferSource();
                noise2.buffer = buf2;
                const gain2 = audioCtx.createGain();
                gain2.gain.setValueAtTime(0.15, t);
                gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                const filt2 = audioCtx.createBiquadFilter();
                filt2.type = "highpass"; filt2.frequency.value = 4000;
                noise2.connect(filt2); filt2.connect(gain2); gain2.connect(dest);
                noise2.start(t); noise2.stop(t + 0.15);
            }
        }
        endingDrumTimer = setTimeout(scheduleLoop, loopLen * 1000);
    }
    scheduleLoop();
}

function stopEndingDrums() {
    endingDrumStarted = false;
    if (endingDrumTimer !== null) { clearTimeout(endingDrumTimer); endingDrumTimer = null; }
    if (endingDrumGain && audioCtx) {
        endingDrumGain.gain.setValueAtTime(0, audioCtx.currentTime);
        endingDrumGain.disconnect();
        endingDrumGain = null;
    }
}

function startEnding() {
    endingPhase = 0;
    endingTimer = 0;
    endingGlobalTimer = 0;
    endingPiecesPlaced = 0;
    endingKickPump = 0;
    endingBeatStep = 0;
    endingBeatTimer = 0;
    endingDJX = COLS * TILE / 2 - 8;
    endingDJY = ROWS * TILE + 10; // start below screen
    stopStoryDrums();
    stopEndingDrums();

    // Set up surface dancers (will enter from edges in phase 2)
    endingDancers = [];
    const danceFloorY = (GRID_Y + 5) * TILE;
    const positions = [
        { x: -20, targetX: 2 * TILE, y: danceFloorY, pal: 0, phase: 0 },
        { x: -20, targetX: 4 * TILE, y: danceFloorY + 4, pal: 1, phase: 3 },
        { x: -20, targetX: 6 * TILE, y: danceFloorY + 2, pal: 2, phase: 7 },
        { x: COLS * TILE + 20, targetX: 8 * TILE, y: danceFloorY, pal: 3, phase: 11 },
        { x: COLS * TILE + 20, targetX: 10 * TILE, y: danceFloorY + 3, pal: 4, phase: 5 },
        { x: COLS * TILE + 20, targetX: 12 * TILE, y: danceFloorY + 1, pal: 5, phase: 9 },
        { x: -20, targetX: 14 * TILE, y: danceFloorY + 4, pal: 0, phase: 2 },
        { x: COLS * TILE + 20, targetX: 16 * TILE, y: danceFloorY, pal: 3, phase: 13 },
        { x: -20, targetX: 3 * TILE, y: danceFloorY + 14, pal: 2, phase: 4 },
        { x: COLS * TILE + 20, targetX: 5 * TILE, y: danceFloorY + 16, pal: 5, phase: 8 },
        { x: -20, targetX: 11 * TILE, y: danceFloorY + 15, pal: 1, phase: 1 },
        { x: COLS * TILE + 20, targetX: 13 * TILE, y: danceFloorY + 14, pal: 0, phase: 10 },
        { x: COLS * TILE + 20, targetX: 15 * TILE, y: danceFloorY + 16, pal: 3, phase: 14 },
        { x: -20, targetX: 17 * TILE, y: danceFloorY + 14, pal: 5, phase: 6 },
    ];
    endingDancers = positions;

    // Set up cave rave partygoers (mixed dancers and goblins)
    endingCavePartygoers = [];
    const caveDanceY = 6 * TILE;
    for (let i = 0; i < 16; i++) {
        const isGoblin = i % 2 === 1; // alternate human/goblin
        endingCavePartygoers.push({
            isGoblin,
            x: (2 + (i % 8) * 2.2) * TILE,
            y: caveDanceY + Math.floor(i / 8) * 4 * TILE + (i % 3) * 6,
            pal: i % DANCER_PALETTES.length,
            gobType: i === 7 ? "elite" : "normal",
            phase: i * 2.3,
            frame: 0,
        });
    }
}

const ENDING_BEAT_FRAMES = 8.2; // ~110bpm at 60fps

function updateEnding() {
    endingTimer++;
    endingGlobalTimer++;

    // Beat step tracking (for visual sync)
    endingBeatTimer++;
    if (endingBeatTimer >= ENDING_BEAT_FRAMES) {
        endingBeatTimer -= ENDING_BEAT_FRAMES;
        endingBeatStep = (endingBeatStep + 1) % 16;
        // Kick pump
        if (INTRO_BEAT.K[endingBeatStep] && endingPhase >= 1 && endingPhase <= 2) {
            endingKickPump = 1;
        }
        if (INTRO_BEAT.K[endingBeatStep] && endingPhase === 4) {
            endingKickPump = 1;
        }
    }
    endingKickPump *= 0.85;

    // Phase transitions
    if (endingPhase === 0) {
        // DJ walks up to booth
        const boothY = GRID_Y * TILE - 8;
        const targetY = boothY - 10;
        endingDJY += (targetY - endingDJY) * 0.04;

        // Place pieces every 40 frames starting at frame 60
        if (endingTimer > 60 && endingPiecesPlaced < 6) {
            const placeFrame = 60 + endingPiecesPlaced * 40;
            if (endingTimer === placeFrame) {
                playPieceRevealChime();
                endingPiecesPlaced++;
            }
        }

        if (endingTimer >= 300) {
            endingPhase = 1;
            endingTimer = 0;
            startEndingDrums(0.15);
        }
    } else if (endingPhase === 1) {
        // Ramp up drums
        if (endingDrumGain && audioCtx) {
            const rampT = Math.min(1, endingTimer / 180);
            endingDrumGain.gain.setValueAtTime(0.15 + rampT * 0.35, audioCtx.currentTime);
        }
        if (endingTimer >= 180) {
            endingPhase = 2;
            endingTimer = 0;
        }
    } else if (endingPhase === 2) {
        // Move dancers inward, ramp drums to full
        for (const d of endingDancers) {
            d.x += (d.targetX - d.x) * 0.03;
        }
        if (endingDrumGain && audioCtx) {
            const rampT = Math.min(1, endingTimer / 120);
            endingDrumGain.gain.setValueAtTime(0.5 + rampT * 0.5, audioCtx.currentTime);
        }
        if (endingTimer >= 240) {
            endingPhase = 3;
            endingTimer = 0;
        }
    } else if (endingPhase === 3) {
        // Fade drums and fade to black
        if (endingDrumGain && audioCtx && endingTimer < 120) {
            const fadeT = Math.min(1, endingTimer / 120);
            endingDrumGain.gain.setValueAtTime(1.0 * (1 - fadeT), audioCtx.currentTime);
        }
        if (endingTimer === 120) {
            stopEndingDrums();
        }
        if (endingTimer >= 240) {
            endingPhase = 4;
            endingTimer = 0;
            startEndingDrums(1.0);
        }
    } else if (endingPhase === 4) {
        // Cave rave — animate partygoers
        for (const p of endingCavePartygoers) {
            if (p.isGoblin) {
                p.frame = Math.floor(endingGlobalTimer / 10) % 4;
            }
        }
        if (endingTimer >= 540) {
            endingPhase = 5;
            endingTimer = 0;
        }
    }
    // Phase 5: just wait for Enter
}

function renderEnding() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    function drawCentered(text, y, color, size) {
        ctx.font = `${size * SCALE}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    if (endingPhase <= 3) {
        // === SURFACE VENUE ===
        // Dark floor
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const shade = (r + c) % 2 === 0 ? "#0a0f0a" : "#0d150d";
                drawRect(c * TILE, r * TILE, TILE, TILE, shade);
            }
        }

        // Walls
        for (let c = 0; c < COLS; c++) {
            drawRect(c * TILE, 0, TILE, TILE, (c * 7 + 3) % 3 === 0 ? "#1e2e1e" : "#1a2a1a");
            drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, (c * 11 + 5) % 3 === 0 ? "#152015" : "#1a2a1a");
        }
        for (let r = 0; r < ROWS; r++) {
            drawRect(0, r * TILE, TILE, TILE, (r * 7) % 3 === 0 ? "#152015" : "#1a2a1a");
            drawRect((COLS - 1) * TILE, r * TILE, TILE, TILE, (r * 11) % 3 === 0 ? "#152015" : "#1a2a1a");
        }

        // String lights (fade in during phase 0)
        const lightsAlpha = endingPhase === 0 ? Math.min(1, endingPiecesPlaced / 4) : 1;
        if (lightsAlpha > 0) {
            ctx.globalAlpha = lightsAlpha;
            const bulbColors = ["#FF4400", "#efac28", "#00FF88", "#4488FF", "#FF44AA", "#efac28"];
            for (let c = 0; c < 18; c++) {
                const bulbX = 2 * TILE + c * (TILE + 2);
                const bulbY = TILE + 4;
                const lightCol = bulbColors[c % bulbColors.length];
                const chase = Math.sin(endingGlobalTimer * 0.05 + c * 0.6) * 0.5 + 0.5;
                ctx.globalAlpha = lightsAlpha * (0.5 + chase * 0.5);
                drawRect(bulbX - 2, bulbY, 4, 4, lightCol);
            }
            ctx.globalAlpha = 1;
        }

        // DJ Booth
        const boothX = W / 2 - 24;
        const boothY = GRID_Y * TILE - 8;

        // Platform
        drawRect(boothX - 8, boothY + 12, 64, 8, "#2a3a2a");
        drawRect(boothX - 8, boothY + 12, 64, 2, "#3a4a3a");

        // Equipment pieces (fly in during phase 0)
        for (let i = 0; i < 6; i++) {
            if (i < endingPiecesPlaced) {
                // Piece is in place
                drawDJSetupPiece(i, boothX, boothY, { pump: endingKickPump });
            } else if (endingPhase === 0) {
                // Show as silhouette
                drawDJSetupPiece(i, boothX, boothY, { silhouette: true });
            }
        }

        // DJ sprite
        const djFrame = Math.floor(endingGlobalTimer / 10) % 4;
        const djBob = endingKickPump > 0.1 ? 3 : 0;
        drawPlayerSprite(endingDJX, endingDJY - djBob, djFrame, 0, {});

        // Beat grid (lights up in phase 1+)
        if (endingPhase >= 1) {
            const miniGridY = GRID_Y * TILE + GRID_Y_OFFSET;
            const miniGridX = 3 * TILE;
            const patterns = [INTRO_BEAT.O, INTRO_BEAT.H, INTRO_BEAT.S, INTRO_BEAT.K];
            const gridAlpha = endingPhase === 1 ? Math.min(1, endingTimer / 60) : 1;
            ctx.globalAlpha = gridAlpha;
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 16; c++) {
                    const gx = miniGridX + c * TILE;
                    const gy = miniGridY + r * TILE;
                    const on = patterns[r][c];
                    drawRect(gx, gy, TILE, TILE, PAL.gridBorder);
                    drawRect(gx + 1, gy + 1, TILE - 2, TILE - 2, on ? PAL.gridOn[r] : PAL.gridOff);
                }
            }
            // Playhead
            const phX = miniGridX + endingBeatStep * TILE;
            ctx.fillStyle = "#efac28";
            ctx.globalAlpha = gridAlpha * 0.35;
            ctx.fillRect(phX * SCALE, miniGridY * SCALE, TILE * SCALE, (4 * TILE) * SCALE);
            ctx.globalAlpha = 1;
        }

        // Dancers (phase 2+)
        if (endingPhase >= 2) {
            const beatOn = INTRO_BEAT.K[endingBeatStep];
            for (const d of endingDancers) {
                if (d.x < -10 || d.x > W + 10) continue;
                const step = (endingBeatStep + d.phase) % 16;
                const bobWave = Math.sin(step * Math.PI / 2);
                const bob = Math.abs(bobWave) * 3;
                const armBlend = Math.abs(bobWave);
                const footOffset = bobWave * 1.5;
                drawDancerSprite(d.x, d.y, DANCER_PALETTES[d.pal], { bob, armBlend, footOffset });
            }
        }

        // Phase 3: Three-beat revelation + fade to black
        if (endingPhase === 3) {
            // Beat 1 (frames 10-70): Acknowledge the rebuild
            if (endingTimer > 10 && endingTimer < 70) {
                const a = endingTimer < 30 ? (endingTimer - 10) / 20 : Math.max(0, 1 - (endingTimer - 50) / 20);
                ctx.globalAlpha = a;
                ctx.textAlign = "center";
                ctx.font = `${7 * SCALE}px monospace`;
                ctx.fillStyle = "#000";
                ctx.fillText("THE BOOTH IS REBUILT. THE CROWD IS BACK.", (W / 2) * SCALE + SCALE, (H / 2 + 1) * SCALE);
                ctx.fillStyle = "#efd8a1";
                ctx.fillText("THE BOOTH IS REBUILT. THE CROWD IS BACK.", (W / 2) * SCALE, (H / 2) * SCALE);
                ctx.textAlign = "start";
                ctx.globalAlpha = 1;
            }
            // Beat 2 (frames 75-135): The caves
            if (endingTimer > 75 && endingTimer < 135) {
                const a = endingTimer < 95 ? (endingTimer - 75) / 20 : Math.max(0, 1 - (endingTimer - 115) / 20);
                ctx.globalAlpha = a;
                ctx.textAlign = "center";
                ctx.font = `${8 * SCALE}px monospace`;
                ctx.fillStyle = "#000";
                ctx.fillText("...BUT THE CAVES ARE SILENT.", (W / 2) * SCALE + SCALE, (H / 2 + 1) * SCALE);
                ctx.fillStyle = "#7a6a5a";
                ctx.fillText("...BUT THE CAVES ARE SILENT.", (W / 2) * SCALE, (H / 2) * SCALE);
                ctx.textAlign = "start";
                ctx.globalAlpha = 1;
            }

            // Fade to black
            if (endingTimer > 120) {
                const fadeAlpha = Math.min(1, (endingTimer - 120) / 60);
                ctx.globalAlpha = fadeAlpha;
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, W * SCALE, H * SCALE);
                ctx.globalAlpha = 1;
            }

            // Beat 3 (frames 155-230): The realization — drawn ON TOP of the black
            if (endingTimer > 155 && endingTimer < 230) {
                const a = endingTimer < 175 ? (endingTimer - 155) / 20 : Math.max(0, 1 - (endingTimer - 210) / 20);
                ctx.globalAlpha = a;
                ctx.textAlign = "center";
                ctx.font = `${6 * SCALE}px monospace`;
                ctx.fillStyle = "#1a3a1a";
                ctx.fillText("MAYBE THEY WEREN'T ATTACKING.", (W / 2) * SCALE + SCALE, (H / 2 - 6) * SCALE);
                ctx.fillStyle = "#39FF14";
                ctx.fillText("MAYBE THEY WEREN'T ATTACKING.", (W / 2) * SCALE, (H / 2 - 7) * SCALE);
                ctx.fillStyle = "#1a3a1a";
                ctx.fillText("MAYBE THEY WERE ASKING TO JOIN IN.", (W / 2) * SCALE + SCALE, (H / 2 + 8) * SCALE);
                ctx.fillStyle = "#39FF14";
                ctx.fillText("MAYBE THEY WERE ASKING TO JOIN IN.", (W / 2) * SCALE, (H / 2 + 7) * SCALE);
                ctx.textAlign = "start";
                ctx.globalAlpha = 1;
            }
        }

    } else {
        // === PHASES 4-5: UNDERGROUND RAVE ===
        const caveW = CAVE_COLS * CAVE_TILE;
        const caveH = CAVE_ROWS * CAVE_TILE;

        // Cave background
        drawRect(0, 0, caveW, caveH, "#0a0f0a");

        // Stone floor
        for (let r = 3; r < CAVE_ROWS - 1; r++) {
            for (let c = 1; c < CAVE_COLS - 1; c++) {
                let seed = r * 997 + c * 31;
                seed = (seed * 9301 + 49297) % 233280;
                const bright = (seed / 233280) > 0.6;
                const floorCol = bright ? "#152015" : "#111911";
                drawRect(c * CAVE_TILE, r * CAVE_TILE, CAVE_TILE, CAVE_TILE, floorCol);
            }
        }

        // Cave walls
        for (let c = 0; c < CAVE_COLS; c++) {
            // Top wall (3 rows for grand stage area)
            for (let r = 0; r < 3; r++) {
                drawRect(c * CAVE_TILE, r * CAVE_TILE, CAVE_TILE, CAVE_TILE, (c + r) % 2 === 0 ? "#1e2e1e" : "#1a2a1a");
            }
            // Bottom wall
            drawRect(c * CAVE_TILE, (CAVE_ROWS - 1) * CAVE_TILE, CAVE_TILE, CAVE_TILE, c % 2 === 0 ? "#1e2e1e" : "#1a2a1a");
            // Stalactites
            if (c % 3 === 1) {
                const stalH = 4 + (c * 7) % 6;
                drawRect(c * CAVE_TILE + 5, 3 * CAVE_TILE, 3, stalH, "#243024");
                drawRect(c * CAVE_TILE + 6, 3 * CAVE_TILE, 1, stalH + 2, "#2a3a2a");
            }
        }
        // Side walls
        for (let r = 0; r < CAVE_ROWS; r++) {
            drawRect(0, r * CAVE_TILE, CAVE_TILE, CAVE_TILE, r % 2 === 0 ? "#1e2e1e" : "#1a2a1a");
            drawRect((CAVE_COLS - 1) * CAVE_TILE, r * CAVE_TILE, CAVE_TILE, CAVE_TILE, r % 2 === 0 ? "#1e2e1e" : "#1a2a1a");
        }

        // Torches on walls
        const torchPositions = [
            { x: 1 * CAVE_TILE + 2, y: 4 * CAVE_TILE },
            { x: 1 * CAVE_TILE + 2, y: 10 * CAVE_TILE },
            { x: (CAVE_COLS - 2) * CAVE_TILE - 2, y: 4 * CAVE_TILE },
            { x: (CAVE_COLS - 2) * CAVE_TILE - 2, y: 10 * CAVE_TILE },
            { x: 5 * CAVE_TILE, y: 2 * CAVE_TILE + 8 },
            { x: (CAVE_COLS - 6) * CAVE_TILE, y: 2 * CAVE_TILE + 8 },
        ];
        for (const tp of torchPositions) {
            drawCaveTorch(tp.x, tp.y);
        }

        // Grand DJ stage at back of cave
        const stageX = caveW / 2 - 40;
        const stageY = 3 * CAVE_TILE;

        // Stage platform (wider than normal booth)
        drawRect(stageX - 16, stageY + 16, 112, 10, "#1e2e1e");
        drawRect(stageX - 16, stageY + 16, 112, 2, "#243024");
        // Stage risers
        drawRect(stageX - 20, stageY + 26, 120, 6, "#1a2a1a");

        // All 6 equipment pieces on the grand stage
        const sBoothX = caveW / 2 - 24;
        const sBoothY = stageY;
        for (let i = 0; i < 6; i++) {
            drawDJSetupPiece(i, sBoothX, sBoothY, { pump: endingKickPump });
        }

        // DJ at the booth
        const djFrame = Math.floor(endingGlobalTimer / 10) % 4;
        const djBob = endingKickPump > 0.1 ? 3 : 0;
        drawPlayerSprite(caveW / 2 - 8, stageY - 8 - djBob, djFrame, 0, {});

        // Disco ball with light reflections
        const ballX = caveW / 2 - 4;
        const ballY = CAVE_TILE + 4;
        drawDiscoBall(ballX, ballY);

        // Disco ball light reflections sweeping cave walls
        const reflectionColors = ["#FF4400", "#efac28", "#00FF88", "#4488FF", "#FF44AA", "#FFD700",
                                   "#FF6600", "#88FF44", "#44DDFF", "#FF88CC", "#AAFFEE", "#FFAA44"];
        for (let ri = 0; ri < 12; ri++) {
            const speed = 0.015 + (ri % 4) * 0.005;
            const angle = endingGlobalTimer * speed + ri * (Math.PI * 2 / 12);
            const radius = 60 + (ri % 3) * 30;
            const rx = ballX + 4 + Math.cos(angle) * radius;
            const ry = ballY + 4 + Math.sin(angle) * radius * 0.6;

            // Only draw if on a wall or ceiling (not in the middle of the floor)
            if (rx < 2 * CAVE_TILE || rx > (CAVE_COLS - 2) * CAVE_TILE || ry < 3 * CAVE_TILE || ry > (CAVE_ROWS - 2) * CAVE_TILE) {
                const pulse = 0.3 + Math.sin(endingGlobalTimer * 0.08 + ri) * 0.2;
                ctx.globalAlpha = pulse;
                ctx.fillStyle = reflectionColors[ri];
                ctx.beginPath();
                ctx.ellipse(rx * SCALE, ry * SCALE, 6 * SCALE, 3 * SCALE, angle * 0.3, 0, Math.PI * 2);
                ctx.fill();
                // Glow
                ctx.globalAlpha = pulse * 0.3;
                ctx.beginPath();
                ctx.ellipse(rx * SCALE, ry * SCALE, 12 * SCALE, 6 * SCALE, angle * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // Mixed crowd: dancers and goblins partying together
        const beatOn = INTRO_BEAT.K[endingBeatStep];
        for (const p of endingCavePartygoers) {
            if (p.isGoblin) {
                drawGoblinSprite(p.gobType, p.x, p.y, p.frame, { dir: 0, showShadow: false });
            } else {
                const step = (endingBeatStep + p.phase) % 16;
                const bobWave = Math.sin(step * Math.PI / 2);
                const bob = Math.abs(bobWave) * 3;
                const armBlend = Math.abs(bobWave);
                const footOffset = bobWave * 1.5;
                drawDancerSprite(p.x, p.y, DANCER_PALETTES[p.pal], { bob, armBlend, footOffset });
            }
        }

        // Fade in from black at start of phase 4
        if (endingPhase === 4 && endingTimer < 60) {
            const fadeAlpha = 1 - endingTimer / 60;
            ctx.globalAlpha = fadeAlpha;
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, caveW * SCALE, caveH * SCALE);
            ctx.globalAlpha = 1;
        }

        // Caption text
        if (endingPhase === 4) {
            if (endingTimer > 120 && endingTimer < 360) {
                const capAlpha = endingTimer < 150 ? (endingTimer - 120) / 30 : endingTimer > 300 ? Math.max(0, 1 - (endingTimer - 300) / 60) : 1;
                ctx.globalAlpha = capAlpha;
                drawCentered("THE UNDERGROUND CAME ALIVE AGAIN.", caveH - 40, "#FFD700", 6);
                ctx.globalAlpha = 1;
            }
            if (endingTimer > 360) {
                const capAlpha = Math.min(1, (endingTimer - 360) / 30);
                ctx.globalAlpha = capAlpha;
                drawCentered("BUT THIS TIME, EVERYONE WAS INVITED.", caveH - 40, "#00FF88", 6);
                ctx.globalAlpha = 1;
            }
        }

        // Phase 5: Score overlay
        if (endingPhase === 5) {
            // Semi-transparent overlay
            ctx.globalAlpha = Math.min(0.5, endingTimer / 60);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, caveW * SCALE, caveH * SCALE);
            ctx.globalAlpha = 1;

            const overlayAlpha = Math.min(1, endingTimer / 60);
            ctx.globalAlpha = overlayAlpha;

            // "THE END" header
            ctx.textAlign = "center";
            ctx.font = `${12 * SCALE}px monospace`;
            ctx.fillStyle = "#000";
            ctx.fillText("THE END", (caveW / 2) * SCALE + SCALE, (caveH / 3 + 1) * SCALE);
            ctx.fillStyle = "#FFD700";
            ctx.fillText("THE END", (caveW / 2) * SCALE, (caveH / 3) * SCALE);

            // Final score
            ctx.font = `${8 * SCALE}px monospace`;
            ctx.fillStyle = "#efd8a1";
            ctx.fillText("FINAL SCORE: " + finalScore, (caveW / 2) * SCALE, (caveH / 3 + 20) * SCALE);

            // Press Enter prompt
            if (endingTimer > 90) {
                const blink = Math.sin(endingTimer * 0.08) > 0;
                if (blink) {
                    ctx.font = `${5 * SCALE}px monospace`;
                    ctx.fillStyle = "#efd8a1";
                    const promptText = scoreQualifies(finalScore) ? "PRESS ENTER FOR HIGH SCORE" : "PRESS ENTER TO CONTINUE";
                    ctx.fillText(promptText, (caveW / 2) * SCALE, (caveH - 20) * SCALE);
                }
            }
            ctx.textAlign = "start";
            ctx.globalAlpha = 1;
        }
    }
}

// ---- Game Loop (60 fps) ----
let lastTime = 0;
const FRAME_MS = 1000 / 60;
let frameAccum = 0;
// ---- Title Screen Drum Groove ----
let titleDrumTimer = null;
let titleDrumStarted = false;
let titleDrumGain = null;

function startTitleDrums() {
    if (titleDrumStarted) return;
    titleDrumStarted = true;
    ensureAudio();
    if (!audioCtx) return;

    titleDrumGain = audioCtx.createGain();
    titleDrumGain.gain.setValueAtTime(1, audioCtx.currentTime);
    titleDrumGain.connect(audioCtx.destination);

    const bpm = 110;
    const sixteenth = 60 / bpm / 4;

    const K = INTRO_BEAT.K;
    const S = INTRO_BEAT.S;
    const H = INTRO_BEAT.H;
    const O = INTRO_BEAT.O;

    const loopLen = 16 * sixteenth;

    function scheduleLoop() {
        if (!titleDrumStarted || !audioCtx || !titleDrumGain) return;
        const now = audioCtx.currentTime;
        const dest = titleDrumGain;

        for (let i = 0; i < 16; i++) {
            const t = now + i * sixteenth;

            if (K[i]) {
                // Kick
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
                gain.gain.setValueAtTime(1.0, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                osc.connect(gain);
                gain.connect(dest);
                osc.start(t);
                osc.stop(t + 0.3);
            }

            if (S[i]) {
                // Snare (noise burst + body)
                const bufSz = audioCtx.sampleRate * 0.15;
                const buf = audioCtx.createBuffer(1, bufSz, audioCtx.sampleRate);
                const data = buf.getChannelData(0);
                for (let s = 0; s < bufSz; s++) data[s] = Math.random() * 2 - 1;
                const noise = audioCtx.createBufferSource();
                noise.buffer = buf;
                const nGain = audioCtx.createGain();
                nGain.gain.setValueAtTime(0.6, t);
                nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                const filt = audioCtx.createBiquadFilter();
                filt.type = "highpass";
                filt.frequency.value = 1000;
                noise.connect(filt);
                filt.connect(nGain);
                nGain.connect(dest);
                noise.start(t);
                noise.stop(t + 0.15);
                // body
                const osc = audioCtx.createOscillator();
                const oGain = audioCtx.createGain();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(180, t);
                osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
                oGain.gain.setValueAtTime(0.5, t);
                oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.connect(oGain);
                oGain.connect(dest);
                osc.start(t);
                osc.stop(t + 0.1);
            }

            if (H[i]) {
                // Closed hi-hat
                const bufSz = audioCtx.sampleRate * 0.06;
                const buf = audioCtx.createBuffer(1, bufSz, audioCtx.sampleRate);
                const data = buf.getChannelData(0);
                for (let s = 0; s < bufSz; s++) data[s] = Math.random() * 2 - 1;
                const noise = audioCtx.createBufferSource();
                noise.buffer = buf;
                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.25, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                const filt = audioCtx.createBiquadFilter();
                filt.type = "bandpass";
                filt.frequency.value = 10000;
                filt.Q.value = 1.0;
                noise.connect(filt);
                filt.connect(gain);
                gain.connect(dest);
                noise.start(t);
                noise.stop(t + 0.06);
            }

            if (O[i]) {
                // Open hi-hat
                const bufSz2 = audioCtx.sampleRate * 0.15;
                const buf2 = audioCtx.createBuffer(1, bufSz2, audioCtx.sampleRate);
                const data2 = buf2.getChannelData(0);
                for (let s = 0; s < bufSz2; s++) data2[s] = Math.random() * 2 - 1;
                const noise2 = audioCtx.createBufferSource();
                noise2.buffer = buf2;
                const gain2 = audioCtx.createGain();
                gain2.gain.setValueAtTime(0.15, t);
                gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                const filt2 = audioCtx.createBiquadFilter();
                filt2.type = "highpass";
                filt2.frequency.value = 4000;
                noise2.connect(filt2);
                filt2.connect(gain2);
                gain2.connect(dest);
                noise2.start(t);
                noise2.stop(t + 0.15);
            }
        }

        titleDrumTimer = setTimeout(scheduleLoop, loopLen * 1000);
    }

    scheduleLoop();
}

function stopTitleDrums() {
    titleDrumStarted = false;
    if (titleDrumTimer !== null) {
        clearTimeout(titleDrumTimer);
        titleDrumTimer = null;
    }
    if (titleDrumGain && audioCtx) {
        titleDrumGain.gain.setValueAtTime(0, audioCtx.currentTime);
        titleDrumGain.disconnect();
        titleDrumGain = null;
    }
}

// ---- Title Screen (page 1: live gameplay scene) ----
let titleStep = 0;        // simulated sequencer step (0-15)
let titleStepTimer = 0;   // frame counter for step advance
let titleKickPump = 0;    // 0-1 speaker pump intensity on kick hits
titleEntrancePhase = 0;   // reset entrance animation
const TITLE_STEP_FRAMES = 8.2; // frames per sixteenth note at 110bpm @ 60fps

// Title screen drum pattern (matches audio)

function renderTitleScreen() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    titleBlink++;

    // Advance simulated playhead
    titleStepTimer++;
    if (titleStepTimer >= TITLE_STEP_FRAMES) {
        titleStepTimer -= TITLE_STEP_FRAMES;
        titleStep = (titleStep + 1) % 16;
        if (INTRO_BEAT.K[titleStep]) titleKickPump = 1;
    }
    titleKickPump = Math.max(0, titleKickPump - 0.08);

    const beatOn = titleStep % 4 === 0;

    // === CAVE SCENE BACKGROUND ===
    drawRect(0, 0, W, H, "#0d150d"); // dark stone floor

    // Cave rock walls
    for (let c = 0; c < COLS; c++) {
        const stoneCol = (c * 7 + 3) % 3 === 0 ? "#1e2e1e" : ((c * 7 + 3) % 3 === 1 ? "#1a2a1a" : "#162616");
        drawRect(c * TILE, 0, TILE, TILE, stoneCol);
        const botCol = (c * 11 + 5) % 3 === 0 ? "#152015" : ((c * 11 + 5) % 3 === 1 ? "#1a2a1a" : "#111911");
        drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, botCol);
    }
    for (let r = 0; r < ROWS; r++) {
        const lCol = (r * 7) % 3 === 0 ? "#152015" : ((r * 7) % 3 === 1 ? "#1a2a1a" : "#111911");
        drawRect(0, r * TILE, TILE, TILE, lCol);
        const rCol = (r * 11) % 3 === 0 ? "#152015" : ((r * 11) % 3 === 1 ? "#1a2a1a" : "#111911");
        drawRect((COLS - 1) * TILE, r * TILE, TILE, TILE, rCol);
    }

    // Mushroom lights (animated, bioluminescent)
    const TITLE_MUSH_COLORS = ["#33ff33", "#22dd44", "#44ee88", "#22cc66", "#33ff55", "#44ff44"];
    for (let c = 1; c < COLS - 1; c++) {
        const mushY = TILE + 4;
        const mushX = c * TILE + TILE / 2;
        const mushCol = TITLE_MUSH_COLORS[c % TITLE_MUSH_COLORS.length];
        const chase = Math.sin(titleBlink * 0.05 + c * 0.6) * 0.5 + 0.5;
        const isCrystal = c % 4 === 0;
        // Stem
        ctx.strokeStyle = "#1e2e1e";
        ctx.lineWidth = 1 * SCALE;
        ctx.beginPath();
        ctx.moveTo(mushX * SCALE, TILE * SCALE);
        ctx.lineTo(mushX * SCALE, (mushY - 1) * SCALE);
        ctx.stroke();
        ctx.globalAlpha = 0.5 + chase * 0.5;
        if (isCrystal) {
            ctx.fillStyle = mushCol;
            ctx.beginPath();
            ctx.moveTo(mushX * SCALE, (mushY - 1) * SCALE);
            ctx.lineTo((mushX + 3) * SCALE, (mushY + 2) * SCALE);
            ctx.lineTo(mushX * SCALE, (mushY + 5) * SCALE);
            ctx.lineTo((mushX - 3) * SCALE, (mushY + 2) * SCALE);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = "#2a4a2a";
            ctx.fillRect((mushX - 0.5) * SCALE, (mushY - 1) * SCALE, 1 * SCALE, 4 * SCALE);
            ctx.fillStyle = mushCol;
            ctx.beginPath();
            ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, 2.5 * SCALE, Math.PI, 0);
            ctx.fill();
        }
        // Glow
        ctx.fillStyle = mushCol;
        ctx.globalAlpha = 0.08 + chase * 0.1;
        ctx.beginPath();
        ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, 5 * SCALE, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // DJ Booth (center) — full setup with all equipment
    const boothX = W / 2 - 24;
    const boothY = GRID_Y * TILE - 8;
    drawLightRig(boothX - 8, boothY - 18, titleKickPump);
    drawDiscoBall(boothX + 20, boothY - 30);
    drawRect(boothX - 8, boothY + 12, 64, 8, "#2a3a2a");
    drawRect(boothX - 8, boothY + 12, 64, 2, "#3a4a3a");
    drawSubwoofer(boothX - 12, boothY - 2, titleKickPump, -1);
    drawSubwoofer(boothX + 44, boothY - 2, titleKickPump, 1);
    drawTurntable(boothX + 1, boothY - 2);
    drawMixer(boothX + 18, boothY + 2);

    // DJ (player sprite behind booth)
    const djFrame = Math.floor(titleBlink / 10) % 4;
    const djBob = beatOn ? 3 : 0;
    drawPlayerSprite(W / 2 - 8, boothY - 10 - djBob, djFrame, 0, {});

    // Beat grid (small, showing the beat)
    const miniGridY = GRID_Y * TILE + GRID_Y_OFFSET;
    const miniGridX = 3 * TILE;
    const patterns = [INTRO_BEAT.O, INTRO_BEAT.H, INTRO_BEAT.S, INTRO_BEAT.K];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 16; c++) {
            const gx = miniGridX + c * TILE;
            const gy = miniGridY + r * TILE;
            const on = patterns[r][c];
            drawRect(gx, gy, TILE, TILE, PAL.gridBorder);
            drawRect(gx + 1, gy + 1, TILE - 2, TILE - 2, on ? PAL.gridOn[r] : PAL.gridOff);
        }
    }
    // Playhead
    const phX = miniGridX + titleStep * TILE;
    ctx.fillStyle = PAL.playhead;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(phX * SCALE, miniGridY * SCALE, TILE * SCALE, (4 * TILE) * SCALE);
    ctx.globalAlpha = 1;

    // Dancers (crowd on the dance floor — gameplay-quality animation)
    const danceFloorY = (GRID_Y + 5) * TILE;
    const crowdPositions = [
        // Back row
        { x: 2 * TILE, yOfs: 0, pal: 0, phase: 0 },
        { x: 4 * TILE, yOfs: 4, pal: 1, phase: 3 },
        { x: 6 * TILE, yOfs: 2, pal: 2, phase: 7 },
        { x: 8 * TILE, yOfs: 0, pal: 3, phase: 11 },
        { x: 10 * TILE, yOfs: 3, pal: 4, phase: 5 },
        { x: 12 * TILE, yOfs: 1, pal: 5, phase: 9 },
        { x: 14 * TILE, yOfs: 4, pal: 0, phase: 2 },
        { x: 16 * TILE, yOfs: 0, pal: 3, phase: 13 },
        { x: 18 * TILE, yOfs: 2, pal: 1, phase: 6 },
        // Front row
        { x: 3 * TILE, yOfs: 14, pal: 2, phase: 4 },
        { x: 5 * TILE, yOfs: 16, pal: 5, phase: 8 },
        { x: 7 * TILE, yOfs: 14, pal: 4, phase: 12 },
        { x: 11 * TILE, yOfs: 15, pal: 1, phase: 1 },
        { x: 13 * TILE, yOfs: 14, pal: 0, phase: 10 },
        { x: 15 * TILE, yOfs: 16, pal: 3, phase: 14 },
        { x: 17 * TILE, yOfs: 14, pal: 5, phase: 6 },
    ];
    for (let di = 0; di < crowdPositions.length; di++) {
        const dp = crowdPositions[di];
        const step = (titleStep + dp.phase) % 16;
        const stepProgress = titleStepTimer / TITLE_STEP_FRAMES;
        const smoothStep = step + stepProgress;

        // Continuous bob — bounces every beat (4 steps)
        const bobWave = Math.sin(smoothStep * Math.PI / 2);
        const bob = Math.abs(bobWave) * 3;

        // Arms up on peaks
        const armBlend = Math.abs(bobWave);
        const footOffset = bobWave * 1.5;

        drawDancerSprite(dp.x, danceFloorY + dp.yOfs, DANCER_PALETTES[dp.pal], { bob, armBlend, footOffset });
    }

    // Beat pulse background — removed for accessibility

    // === TITLE TEXT (in the dance floor empty space) ===
    titleEntrancePhase++;

    // Handle fade-out when transitioning to intro
    if (titleFadingOut) {
        titleFadeTimer++;
        if (titleFadeTimer >= TITLE_FADE_DURATION) {
            titleFadingOut = false;
            titleFadeTimer = 0;
            // Now switch to intro
            stopTitleDrums();
            gameState = "intro";
            introScene = 0;
            introTimer = 0;
            introGlobalTimer = 0;
            introBeatStep = 0;
            introBeatTimer = 0;
            introGoblins = [];
            introGridState = null;
            introGridFlash = null;
            introCorruptOrder = [];
            introCorruptedSoFar = 0;
            introKickPump = 0;
            startIntroDrums();
            return;
        }
    }
    const titleTextAlpha = titleFadingOut ? Math.max(0, 1 - titleFadeTimer / TITLE_FADE_DURATION) : 1;

    function drawCentered(text, y, color, scale) {
        ctx.font = `${scale * SCALE}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    // Entrance animation easing (smooth overshoot)
    function entranceEase(t) {
        if (t >= 1) return 1;
        return 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 0.5);
    }

    // Dance floor title area — positioned below the dancers
    const titleBaseY = (GRID_Y + 7) * TILE + 12; // in the open dance floor space

    // "ATTACK OF THE" subtitle — fades in
    const subAlpha = Math.min(1, titleEntrancePhase / 30) * titleTextAlpha;
    ctx.globalAlpha = subAlpha;
    const subY = titleBaseY;
    drawCentered("ATTACK OF THE", subY + 1, "#000000", 5);
    drawCentered("ATTACK OF THE", subY, "#ab5c1c", 5);
    ctx.globalAlpha = 1.0;

    // "GROOVE" — slams in from the left
    const bigFontSize = 18;
    const grooveText = "GROOVE";
    ctx.font = `${bigFontSize * SCALE}px monospace`;
    const grooveMeasured = ctx.measureText(grooveText).width;
    const grooveCharW = grooveMeasured / (SCALE * grooveText.length);
    const grooveY = titleBaseY + 20;
    const grooveStartX = ((W * SCALE) - grooveMeasured) / (2 * SCALE);
    const grooveEntrance = entranceEase(Math.min(1, Math.max(0, (titleEntrancePhase - 10) / 25)));
    const grooveSlideX = (1 - grooveEntrance) * -W * 0.6;
    // Logo shimmer — traveling highlight across GROOVE periodically
    const shimmerCycle = 180;
    const shimmerPos = (titleBlink % shimmerCycle) / shimmerCycle;
    const shimmerActive = grooveEntrance >= 1;
    for (let i = 0; i < grooveText.length; i++) {
        const charX = grooveStartX + i * grooveCharW + grooveSlideX;
        const bounce = grooveEntrance >= 1 ? Math.sin(titleBlink * 0.07 + i * 0.9) * 3 : 0;
        const col = i % 2 === 0 ? "#ff8822" : "#cc5500";
        ctx.globalAlpha = grooveEntrance * titleTextAlpha;
        // Shadow
        drawText(grooveText[i], charX + 1, grooveY + bounce + 2, "#000000", bigFontSize);
        drawText(grooveText[i], charX - 1, grooveY + bounce + 2, "#000000", bigFontSize);
        // Glow layer
        ctx.globalAlpha = 0.3 * grooveEntrance * titleTextAlpha;
        drawText(grooveText[i], charX, grooveY + bounce - 1, "#ff8822", bigFontSize);
        ctx.globalAlpha = grooveEntrance * titleTextAlpha;
        // Main text
        drawText(grooveText[i], charX, grooveY + bounce, col, bigFontSize);
        // Shimmer highlight pass
        if (shimmerActive) {
            const charNorm = i / grooveText.length;
            const dist = Math.abs(shimmerPos - charNorm);
            if (dist < 0.15) {
                const shimmerAlpha = (1 - dist / 0.15) * 0.5 * titleTextAlpha;
                ctx.globalAlpha = shimmerAlpha;
                drawText(grooveText[i], charX, grooveY + bounce, "#ffffff", bigFontSize);
            }
        }
    }
    ctx.globalAlpha = 1.0;
    // Impact flash when GROOVE lands — removed

    // "GOBLINS" — slams in from the right
    const goblinsText = "GOBLINS";
    const gobMeasured = ctx.measureText(goblinsText).width;
    const gobCharW = gobMeasured / (SCALE * goblinsText.length);
    const gobY = grooveY + 26;
    const gobStartX = ((W * SCALE) - gobMeasured) / (2 * SCALE);
    const gobEntrance = entranceEase(Math.min(1, Math.max(0, (titleEntrancePhase - 25) / 25)));
    const gobSlideX = (1 - gobEntrance) * W * 0.6;
    for (let i = 0; i < goblinsText.length; i++) {
        const charX = gobStartX + i * gobCharW + gobSlideX;
        const bounce = gobEntrance >= 1 ? Math.sin(titleBlink * 0.07 + i * 0.9 + 3) * 3 : 0;
        const col = i % 2 === 0 ? "#39FF14" : "#00CC00";
        ctx.globalAlpha = gobEntrance * titleTextAlpha;
        // Shadow
        drawText(goblinsText[i], charX + 1, gobY + bounce + 2, "#000000", bigFontSize);
        drawText(goblinsText[i], charX - 1, gobY + bounce + 2, "#000000", bigFontSize);
        // Glow
        ctx.globalAlpha = 0.25 * gobEntrance * titleTextAlpha;
        drawText(goblinsText[i], charX, gobY + bounce - 1, "#39FF14", bigFontSize);
        ctx.globalAlpha = gobEntrance * titleTextAlpha;
        // Main text
        drawText(goblinsText[i], charX, gobY + bounce, col, bigFontSize);
    }
    ctx.globalAlpha = 1.0;
    // Impact flash when GOBLINS lands — removed

    // === Mode selector above "PRESS ENTER" ===
    if (!titleFadingOut) {
        const modeY = titleBaseY + 58;
        const modeLabel = gameMode === "thrill" ? "THRILL MODE" : "CHILL MODE";
        const modeCol = gameMode === "thrill" ? "#ff4400" : "#33dd88";
        const arrowPulse = 0.5 + Math.sin(titleBlink * 0.08) * 0.3;
        ctx.globalAlpha = titleTextAlpha * arrowPulse;
        drawCentered("<              >", modeY, "#88cc88", 6);
        ctx.globalAlpha = titleTextAlpha;
        drawCentered(modeLabel, modeY, modeCol, 6);
        ctx.globalAlpha = 1.0;
    }

    // === "PRESS ENTER" below the title ===
    const pressY = titleBaseY + 72;

    // Blink the text with a faster, more urgent rhythm
    if (titleBlink % 45 < 32 && !titleFadingOut) {
        drawCentered("PRESS ENTER", pressY + 1, "#000000", 6);
        const enterCol = (titleStep % 4 === 0) ? "#44ff44" : "#88cc88";
        drawCentered("PRESS ENTER", pressY, enterCol, 6);
    }
}

// ---- Marching Snare Cadence (plays during tutorial, level complete, etc.) ----
let storyDrumTimer = null;
let storyDrumStarted = false;
let storyDrumGain = null; // master gain node to mute on stop

// Marching snare cadence — plays a looping military-style pattern during story
function startStoryDrums() {
    if (storyDrumStarted) return;
    storyDrumStarted = true;
    ensureAudio();
    if (!audioCtx) return;

    // Master gain for all drum sounds so we can cut them instantly
    storyDrumGain = audioCtx.createGain();
    storyDrumGain.gain.setValueAtTime(1, audioCtx.currentTime);
    storyDrumGain.connect(audioCtx.destination);

    const bpm = 120;
    const beat = 60 / bpm; // 0.5s per beat
    const sixteenth = beat / 4;

    // Classic marching cadence pattern (16th note grid, 2 bars of 4/4 = 32 sixteenths):
    // Beat:   1 e & a 2 e & a 3 e & a 4 e & a | 1 e & a 2 e & a 3 e & a 4 e & a
    const pattern = [
        1,0,1,1, 1,0,1,1, 1,0,1,0, 1,1,1,0,
        1,0,1,1, 1,0,1,1, 1,1,0,0, 1,0,0,0,
    ];
    const accents = [
        3,0,1,1, 2,0,1,1, 2,0,1,0, 1,1,2,0,
        3,0,1,1, 2,0,1,1, 2,1,0,0, 3,0,0,0,
    ];

    const loopLen = pattern.length * sixteenth; // exactly 4.0s at 120bpm

    function scheduleLoop() {
        if (!storyDrumStarted || !audioCtx || !storyDrumGain) return;
        const now = audioCtx.currentTime;
        const dest = storyDrumGain;

        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i]) {
                const t = now + i * sixteenth;
                const vol = accents[i] / 3;

                // Snare noise burst
                const bufferSize = audioCtx.sampleRate * 0.1;
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let s = 0; s < bufferSize; s++) data[s] = Math.random() * 2 - 1;
                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;
                const noiseGain = audioCtx.createGain();
                noiseGain.gain.setValueAtTime(0.25 * vol, t);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                const filt = audioCtx.createBiquadFilter();
                filt.type = "highpass";
                filt.frequency.value = 1200;
                noise.connect(filt);
                filt.connect(noiseGain);
                noiseGain.connect(dest);
                noise.start(t);
                noise.stop(t + 0.1);

                // Snare body (lower tone for accented hits)
                if (accents[i] >= 2) {
                    const osc = audioCtx.createOscillator();
                    const oscGain = audioCtx.createGain();
                    osc.type = "triangle";
                    osc.frequency.setValueAtTime(200, t);
                    osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
                    oscGain.gain.setValueAtTime(0.2 * vol, t);
                    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                    osc.connect(oscGain);
                    oscGain.connect(dest);
                    osc.start(t);
                    osc.stop(t + 0.06);
                }
            }
        }

        // Schedule next loop after this one finishes (exact timing)
        storyDrumTimer = setTimeout(scheduleLoop, loopLen * 1000);
    }

    scheduleLoop();
}

function stopStoryDrums() {
    storyDrumStarted = false;
    if (storyDrumTimer !== null) {
        clearTimeout(storyDrumTimer);
        storyDrumTimer = null;
    }
    // Instantly silence any pre-scheduled drum hits
    if (storyDrumGain && audioCtx) {
        storyDrumGain.gain.setValueAtTime(0, audioCtx.currentTime);
        storyDrumGain.disconnect();
        storyDrumGain = null;
    }
}

// ---- Animated Intro Cutscene ----
function startIntroDrums() {
    if (introDrumStarted) return;
    introDrumStarted = true;
    ensureAudio();
    if (!audioCtx) return;
    introDrumGain = audioCtx.createGain();
    introDrumGain.gain.setValueAtTime(1, audioCtx.currentTime);
    introDrumGain.connect(audioCtx.destination);
    const bpm = 110;
    const beat = 60 / bpm;
    const sixteenth = beat / 4;
    const loopLen = 16 * sixteenth;
    function scheduleLoop() {
        if (!introDrumStarted || !audioCtx || !introDrumGain) return;
        const now = audioCtx.currentTime;
        const dest = introDrumGain;
        for (let i = 0; i < 16; i++) {
            const t = now + i * sixteenth;
            // Kick
            if (INTRO_BEAT.K[i]) {
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
                g.gain.setValueAtTime(0.6, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.connect(g); g.connect(dest);
                osc.start(t); osc.stop(t + 0.2);
            }
            // Snare
            if (INTRO_BEAT.S[i]) {
                const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
                const d = buf.getChannelData(0);
                for (let s = 0; s < d.length; s++) d[s] = Math.random() * 2 - 1;
                const n = audioCtx.createBufferSource(); n.buffer = buf;
                const g = audioCtx.createGain();
                g.gain.setValueAtTime(0.35, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                const f = audioCtx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1000;
                n.connect(f); f.connect(g); g.connect(dest);
                n.start(t); n.stop(t + 0.1);
                const osc = audioCtx.createOscillator();
                const og = audioCtx.createGain();
                osc.type = "triangle"; osc.frequency.setValueAtTime(180, t);
                osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
                og.gain.setValueAtTime(0.2, t);
                og.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                osc.connect(og); og.connect(dest);
                osc.start(t); osc.stop(t + 0.05);
            }
            // Hi-hat
            if (INTRO_BEAT.H[i]) {
                const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.03, audioCtx.sampleRate);
                const d = buf.getChannelData(0);
                for (let s = 0; s < d.length; s++) d[s] = Math.random() * 2 - 1;
                const n = audioCtx.createBufferSource(); n.buffer = buf;
                const g = audioCtx.createGain();
                const vol = i % 2 === 0 ? 0.12 : 0.06;
                g.gain.setValueAtTime(vol, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
                const f = audioCtx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6000;
                n.connect(f); f.connect(g); g.connect(dest);
                n.start(t); n.stop(t + 0.03);
            }
            // Open hat
            if (INTRO_BEAT.O[i]) {
                const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
                const d = buf.getChannelData(0);
                for (let s = 0; s < d.length; s++) d[s] = Math.random() * 2 - 1;
                const n = audioCtx.createBufferSource(); n.buffer = buf;
                const g = audioCtx.createGain();
                g.gain.setValueAtTime(0.15, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                const f = audioCtx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 4000;
                n.connect(f); f.connect(g); g.connect(dest);
                n.start(t); n.stop(t + 0.15);
            }
        }
        introDrumTimer = setTimeout(scheduleLoop, loopLen * 1000);
    }
    scheduleLoop();
}

function stopIntroDrums() {
    introDrumStarted = false;
    if (introDrumTimer !== null) { clearTimeout(introDrumTimer); introDrumTimer = null; }
    if (introDrumGain && audioCtx) {
        introDrumGain.gain.setValueAtTime(0, audioCtx.currentTime);
        introDrumGain.disconnect();
        introDrumGain = null;
    }
}

function playEarthquakeRumble() {
    if (!audioCtx) return;
    // Deep rumble: low-frequency oscillator + noise
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(30, audioCtx.currentTime);
    osc.frequency.setValueAtTime(25, audioCtx.currentTime + 1);
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 1);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 3);
    // Crumbling noise
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let s = 0; s < d.length; s++) d[s] = (Math.random() * 2 - 1) * Math.exp(-s / (audioCtx.sampleRate * 0.8));
    const n = audioCtx.createBufferSource(); n.buffer = buf;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.06, audioCtx.currentTime);
    ng.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.5);
    ng.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.5);
    const lp = audioCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 200;
    n.connect(lp); lp.connect(ng); ng.connect(audioCtx.destination);
    n.start(audioCtx.currentTime); n.stop(audioCtx.currentTime + 2.5);
}

function playGoblinCackle() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // Quick ascending cackle notes
    [0, 0.08, 0.16, 0.24, 0.32].forEach((offset, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(300 + i * 80, now + offset);
        g.gain.setValueAtTime(0.1, now + offset);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now + offset); osc.stop(now + offset + 0.07);
    });
}

// Advance intro to the next scene, or finish intro if on the last scene
function advanceIntroScene() {
    introScene++;
    introTimer = 0;
    if (introScene >= INTRO_SCENE_DURATIONS.length) {
        // All scenes complete — start gameplay
        stopStoryDrums();
        gameState = "playing";
        currentStep = 0;
        lastStepTime = performance.now();
        sceneTransition = { active: true, from: "intro", to: "playing", progress: 0, duration: 20 };
        return;
    }
    // Scene-specific triggers
    if (introScene === 1) {
        playEarthquakeRumble();
        // Initialize mutable grid for display (goblins don't flip cells until Scene 2)
        introGridState = [
            INTRO_BEAT.O.slice(),
            INTRO_BEAT.H.slice(),
            INTRO_BEAT.S.slice(),
            INTRO_BEAT.K.slice(),
        ];
        introGridFlash = Array.from({ length: 4 }, () => new Array(16).fill(0));
    }
    if (introScene === 2) {
        playGoblinCackle();
        // Fade intro drums
        if (introDrumGain) introDrumGain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 1);
        // Ensure introGridState exists (fallback if Scene 1 was skipped)
        if (!introGridState) {
            introGridState = [
                INTRO_BEAT.O.slice(),
                INTRO_BEAT.H.slice(),
                INTRO_BEAT.S.slice(),
                INTRO_BEAT.K.slice(),
            ];
            introGridFlash = Array.from({ length: 4 }, () => new Array(16).fill(0));
        }
        // Spawn 6 goblins: 5 green from caves (cycling), then 1 elite from top cave
        // Caves cycle: right(0), top(1), left(2), right(0), left(2), top(1)
        const goblinCaveAssign = [0, 1, 2, 0, 2, 1];
        introGoblins = goblinCaveAssign.map((ci, gi) => {
            const cave = CAVES[ci];
            const spawnX = cave.tileX * TILE;
            const spawnY = cave.tileY * TILE;
            return {
                x: spawnX, y: spawnY,
                destX: spawnX, destY: spawnY,
                dir: 0, frame: 0, frameTimer: 0,
                caveIdx: ci, emerged: false, speed: 0.5,
                targetRow: -1, targetCol: -1,
                moveSteps: 0,
                isElite: gi === 5,
                // Theft state (used after knockback)
                carrying: false, gone: false,
                targetCave: CAVES[ci],
                pieceIndex: gi,
            };
        });
        // Pre-compute corruption order: sort all 64 cells by cellSeed so they flip deterministically
        introCorruptOrder = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 16; c++) {
                const cellSeed = (r * 100 + c * 37 + 7) % 16;
                introCorruptOrder.push({ r, c, seed: cellSeed });
            }
        }
        introCorruptOrder.sort((a, b) => a.seed - b.seed || a.r - b.r || a.c - b.c);
        introCorruptedSoFar = 0;
    }
    if (introScene === 3) stopIntroDrums();
}

function renderIntro() {
    const W = COLS * TILE;
    const H = ROWS * TILE;
    introTimer++;
    introGlobalTimer++;

    // Advance simulated beat
    introBeatTimer++;
    const INTRO_BEAT_FRAMES = 8.2; // ~110bpm
    if (introBeatTimer >= INTRO_BEAT_FRAMES) {
        introBeatTimer -= INTRO_BEAT_FRAMES;
        introBeatStep = (introBeatStep + 1) % 16;
        if (INTRO_BEAT.K[introBeatStep]) introKickPump = 1;
    }
    introKickPump = Math.max(0, introKickPump - 0.08);

    // Helper
    function drawCentered(text, y, color, scale) {
        ctx.font = `${scale * SCALE}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    const t = introTimer;
    const beatOn = introBeatStep % 4 === 0; // downbeat

    // ==================== SCENE 0: THE GOOD TIMES ====================
    if (introScene === 0) {
        // Full cave venue scene: floor, walls, DJ booth, dancers
        drawRect(0, 0, W, H, "#0d150d"); // dark stone floor

        // Cave walls
        for (let c = 0; c < COLS; c++) {
            const stoneCol = (c * 7 + 3) % 3 === 0 ? "#1e2e1e" : ((c * 7 + 3) % 3 === 1 ? "#1a2a1a" : "#162616");
            drawRect(c * TILE, 0, TILE, TILE, stoneCol);
            const botCol = (c * 11 + 5) % 3 === 0 ? "#152015" : ((c * 11 + 5) % 3 === 1 ? "#1a2a1a" : "#111911");
            drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, botCol);
        }
        for (let r = 0; r < ROWS; r++) {
            const lCol = (r * 7) % 3 === 0 ? "#152015" : ((r * 7) % 3 === 1 ? "#1a2a1a" : "#111911");
            drawRect(0, r * TILE, TILE, TILE, lCol);
            const rCol = (r * 11) % 3 === 0 ? "#152015" : ((r * 11) % 3 === 1 ? "#1a2a1a" : "#111911");
            drawRect((COLS - 1) * TILE, r * TILE, TILE, TILE, rCol);
        }

        // Mushroom lights (animated)
        const INTRO_MUSH = ["#33ff33", "#22dd44", "#44ee88", "#22cc66", "#33ff55", "#44ff44"];
        for (let c = 1; c < COLS - 1; c++) {
            const mushY = TILE + 4;
            const mushX = c * TILE + TILE / 2;
            const mushCol = INTRO_MUSH[c % INTRO_MUSH.length];
            const chase = Math.sin(introGlobalTimer * 0.05 + c * 0.6) * 0.5 + 0.5;
            ctx.strokeStyle = "#1e2e1e";
            ctx.lineWidth = 1 * SCALE;
            ctx.beginPath();
            ctx.moveTo(mushX * SCALE, TILE * SCALE);
            ctx.lineTo(mushX * SCALE, (mushY - 1) * SCALE);
            ctx.stroke();
            ctx.globalAlpha = 0.5 + chase * 0.5;
            ctx.fillStyle = mushCol;
            if (c % 4 === 0) {
                ctx.beginPath();
                ctx.moveTo(mushX * SCALE, (mushY - 1) * SCALE);
                ctx.lineTo((mushX + 3) * SCALE, (mushY + 2) * SCALE);
                ctx.lineTo(mushX * SCALE, (mushY + 5) * SCALE);
                ctx.lineTo((mushX - 3) * SCALE, (mushY + 2) * SCALE);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, 2.5 * SCALE, Math.PI, 0);
                ctx.fill();
            }
            ctx.fillStyle = mushCol;
            ctx.globalAlpha = 0.08 + chase * 0.1;
            ctx.beginPath();
            ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, 5 * SCALE, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // DJ Booth (center) — full setup with all equipment
        const boothX = W / 2 - 24;
        const boothY = GRID_Y * TILE - 8;
        drawLightRig(boothX - 8, boothY - 18, introKickPump);
        drawDiscoBall(boothX + 20, boothY - 30);
        drawRect(boothX - 8, boothY + 12, 64, 8, "#2a3a2a");
        drawRect(boothX - 8, boothY + 12, 64, 2, "#3a4a3a");
        drawSubwoofer(boothX - 12, boothY - 2, introKickPump, -1);
        drawSubwoofer(boothX + 44, boothY - 2, introKickPump, 1);
        drawTurntable(boothX + 1, boothY - 2);
        drawMixer(boothX + 18, boothY + 2);

        // DJ (player sprite behind booth)
        const djFrame = Math.floor(introGlobalTimer / 10) % 4;
        const djBob = beatOn ? 3 : 0;
        drawPlayerSprite(W / 2 - 8, boothY - 10 - djBob, djFrame, 0, {});

        // Beat grid (small, showing the beat is perfect)
        const miniGridY = GRID_Y * TILE + GRID_Y_OFFSET;
        const miniGridX = 3 * TILE;
        const patterns = [INTRO_BEAT.O, INTRO_BEAT.H, INTRO_BEAT.S, INTRO_BEAT.K];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 16; c++) {
                const gx = miniGridX + c * TILE;
                const gy = miniGridY + r * TILE;
                const on = patterns[r][c];
                drawRect(gx, gy, TILE, TILE, PAL.gridBorder);
                drawRect(gx + 1, gy + 1, TILE - 2, TILE - 2, on ? PAL.gridOn[r] : PAL.gridOff);
            }
        }
        // Playhead
        const phX = miniGridX + introBeatStep * TILE;
        ctx.fillStyle = "#efac28";
        ctx.globalAlpha = 0.35;
        ctx.fillRect(phX * SCALE, miniGridY * SCALE, TILE * SCALE, (4 * TILE) * SCALE);
        ctx.globalAlpha = 1;

        // Dancers (crowd on the dance floor — gameplay-quality animation)
        const danceFloorY = (GRID_Y + 5) * TILE;
        const crowdPositions = [
            // Back row (higher up, slightly smaller feel from stagger)
            { x: 2 * TILE, yOfs: 0, pal: 0, phase: 0 },
            { x: 4 * TILE, yOfs: 4, pal: 1, phase: 3 },
            { x: 6 * TILE, yOfs: 2, pal: 2, phase: 7 },
            { x: 8 * TILE, yOfs: 0, pal: 3, phase: 11 },
            { x: 10 * TILE, yOfs: 3, pal: 4, phase: 5 },
            { x: 12 * TILE, yOfs: 1, pal: 5, phase: 9 },
            { x: 14 * TILE, yOfs: 4, pal: 0, phase: 2 },
            { x: 16 * TILE, yOfs: 0, pal: 3, phase: 13 },
            { x: 18 * TILE, yOfs: 2, pal: 1, phase: 6 },
            // Front row
            { x: 3 * TILE, yOfs: 14, pal: 2, phase: 4 },
            { x: 5 * TILE, yOfs: 16, pal: 5, phase: 8 },
            { x: 7 * TILE, yOfs: 14, pal: 4, phase: 12 },
            { x: 11 * TILE, yOfs: 15, pal: 1, phase: 1 },
            { x: 13 * TILE, yOfs: 14, pal: 0, phase: 10 },
            { x: 15 * TILE, yOfs: 16, pal: 3, phase: 14 },
            { x: 17 * TILE, yOfs: 14, pal: 5, phase: 6 },
        ];
        for (let di = 0; di < crowdPositions.length; di++) {
            const dp = crowdPositions[di];
            // Smooth animation synced to beat
            const step = (introBeatStep + dp.phase) % 16;
            const stepProgress = introBeatTimer / INTRO_BEAT_FRAMES;
            const smoothStep = step + stepProgress;

            // Continuous bob — bounces every beat (4 steps)
            const bobWave = Math.sin(smoothStep * Math.PI / 2);
            const bob = Math.abs(bobWave) * 3;

            // Arms up on peaks
            const armBlend = Math.abs(bobWave);
            const footOffset = bobWave * 1.5;

            drawDancerSprite(dp.x, danceFloorY + dp.yOfs, DANCER_PALETTES[dp.pal], { bob, armBlend, footOffset });
        }

        // Beat pulse background — smooth sine wave, peaks every 4 steps
        const beatPhase = ((introBeatStep % 4) + introBeatTimer / INTRO_BEAT_FRAMES) / 4;
        const pulse = Math.cos(beatPhase * Math.PI * 2) * 0.5 + 0.5;
        ctx.fillStyle = "#efac28";
        ctx.globalAlpha = pulse * 0.04;
        ctx.fillRect(0, 0, W * SCALE, H * SCALE);
        ctx.globalAlpha = 1;

        // Caption
        if (t > 60) {
            const capAlpha = Math.min(1, (t - 60) / 30);
            ctx.globalAlpha = capAlpha;
            drawCentered("EVERY FRIDAY NIGHT, THE UNDERGROUND CAME ALIVE.", H - 60, "#44ff44", 5);
            drawCentered("THE DJ SPUN BEATS THAT MADE THE WALLS SHAKE", H - 50, "#44ff44", 5);
            drawCentered("AND THE FLOOR PULSE.", H - 40, "#44ff44", 5);
            ctx.globalAlpha = 1;
        }
    }

    // ==================== SCENE 1 (1A): THE EARTHQUAKE ====================
    else if (introScene === 1) {
        // Earthquake begins, lights die, dancers flee, caves open, eyes glow
        // Phase 1 (t 0-180): Shake ramps up, lights flicker & fade out, dancers stumble
        // Phase 2 (t 180-480): Cracks spread, caves open, eyes glow in darkness
        // Ends on eerie cliffhanger — just glowing eyes watching from the dark

        // Shake ramps up over the first phase, stays strong in second
        const shakeAmt = Math.min(1, t / 120);
        const shX = (Math.random() - 0.5) * shakeAmt * 6 * SCALE;
        const shY = (Math.random() - 0.5) * shakeAmt * 6 * SCALE;
        ctx.save();
        ctx.translate(shX, shY);

        // Cave darkens as power fades — floor dims over time
        const powerFade = Math.min(1, t / 180); // 0→1 over first 3 seconds
        const floorR = Math.round(0x0d * (1 - powerFade * 0.5));
        const floorG = Math.round(0x15 * (1 - powerFade * 0.5));
        const floorB = Math.round(0x0d * (1 - powerFade * 0.5));
        drawRect(0, 0, W, H, `rgb(${floorR},${floorG},${floorB})`);

        // Cave walls (dim with power)
        for (let c = 0; c < COLS; c++) {
            const topR = (c * 7 + 3) % 3 === 0 ? 0x1e : 0x1a, topG = (c * 7 + 3) % 3 === 0 ? 0x2e : 0x2a, topB = (c * 7 + 3) % 3 === 0 ? 0x1e : 0x1a;
            const botR = 0x15, botG = 0x20, botB = 0x15;
            const dim = 1 - powerFade * 0.5;
            drawRect(c * TILE, 0, TILE, TILE, `rgb(${Math.round(topR*dim)},${Math.round(topG*dim)},${Math.round(topB*dim)})`);
            drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, `rgb(${Math.round(botR*dim)},${Math.round(botG*dim)},${Math.round(botB*dim)})`);
        }
        for (let r = 0; r < ROWS; r++) {
            const sR = 0x15, sG = 0x20, sB = 0x15;
            const dim = 1 - powerFade * 0.5;
            drawRect(0, r * TILE, TILE, TILE, `rgb(${Math.round(sR*dim)},${Math.round(sG*dim)},${Math.round(sB*dim)})`);
            drawRect((COLS - 1) * TILE, r * TILE, TILE, TILE, `rgb(${Math.round(sR*dim)},${Math.round(sG*dim)},${Math.round(sB*dim)})`);
        }

        // Mushroom lights — flicker like losing power, then go dark
        const QUAKE_MUSH = ["#33ff33", "#22dd44", "#44ee88", "#22cc66", "#33ff55", "#44ff44"];
        for (let c = 1; c < COLS - 1; c++) {
            const mushX = c * TILE + TILE / 2;
            const mushY = TILE + 4;
            const mushCol = QUAKE_MUSH[c % QUAKE_MUSH.length];

            // Each mushroom dims at different times — outer first, center last
            const distFromCenter = Math.abs(c - COLS / 2) / (COLS / 2);
            const dieFrame = 60 + (1 - distFromCenter) * 120;
            const flickerZone = dieFrame - 40;

            // Stem always visible
            ctx.strokeStyle = "#1e2e1e";
            ctx.lineWidth = 1 * SCALE;
            ctx.beginPath();
            ctx.moveTo(mushX * SCALE, TILE * SCALE);
            ctx.lineTo(mushX * SCALE, (mushY - 1) * SCALE);
            ctx.stroke();

            if (t < flickerZone) {
                const chase = Math.sin(introGlobalTimer * 0.05 + c * 0.6) * 0.5 + 0.5;
                ctx.globalAlpha = 0.5 + chase * 0.5;
                ctx.fillStyle = mushCol;
                ctx.beginPath();
                ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, 2.5 * SCALE, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = mushCol;
                ctx.globalAlpha = 0.08 + chase * 0.1;
                ctx.beginPath();
                ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, 5 * SCALE, 0, Math.PI * 2);
                ctx.fill();
            } else if (t < dieFrame) {
                const sputter = (t - flickerZone) / (dieFrame - flickerZone);
                const dimming = 1 - sputter * 0.7;
                const flick = Math.sin(t * 0.7 + c * 3.1) * Math.sin(t * 1.3 + c * 1.7) > -0.2;
                if (flick) {
                    ctx.globalAlpha = dimming * 0.5;
                    ctx.fillStyle = mushCol;
                    ctx.beginPath();
                    ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, 2.5 * SCALE, Math.PI, 0);
                    ctx.fill();
                } else {
                    ctx.fillStyle = "#0d150d";
                    ctx.beginPath();
                    ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, 2.5 * SCALE, Math.PI, 0);
                    ctx.fill();
                }
            } else {
                // Dead mushroom — dark
                ctx.fillStyle = "#0a0f0a";
                ctx.beginPath();
                ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, 2.5 * SCALE, Math.PI, 0);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        // DJ booth — full setup (power fading)
        const boothX = W / 2 - 24;
        const boothY = GRID_Y * TILE - 8;
        drawLightRig(boothX - 8, boothY - 18, introKickPump);
        drawDiscoBall(boothX + 20, boothY - 30);
        drawRect(boothX - 8, boothY + 12, 64, 8, "#2a3a2a");
        drawRect(boothX - 8, boothY + 12, 64, 2, "#3a4a3a");
        drawSubwoofer(boothX - 12, boothY - 2, introKickPump, -1);
        drawSubwoofer(boothX + 44, boothY - 2, introKickPump, 1);
        drawTurntable(boothX + 1, boothY - 2);
        drawMixer(boothX + 18, boothY + 2);

        // Beat grid — uses mutable state so goblins can flip cells
        const miniGridY = GRID_Y * TILE + GRID_Y_OFFSET;
        const miniGridX = 3 * TILE;
        const patterns = introGridState || [INTRO_BEAT.O, INTRO_BEAT.H, INTRO_BEAT.S, INTRO_BEAT.K];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 16; c++) {
                const gx = miniGridX + c * TILE;
                const gy = miniGridY + r * TILE;
                const on = patterns[r][c];
                drawRect(gx, gy, TILE, TILE, PAL.gridBorder);
                drawRect(gx + 1, gy + 1, TILE - 2, TILE - 2, on ? PAL.gridOn[r] : PAL.gridOff);
                // Goblin sabotage flash
                if (introGridFlash && introGridFlash[r][c] > 0) {
                    ctx.fillStyle = "#39FF14";
                    ctx.globalAlpha = (introGridFlash[r][c] / 30) * 0.5;
                    ctx.fillRect(gx * SCALE, gy * SCALE, TILE * SCALE, TILE * SCALE);
                    ctx.globalAlpha = 1;
                    introGridFlash[r][c]--;
                }
            }
        }
        // Playhead
        const phX = miniGridX + introBeatStep * TILE;
        ctx.fillStyle = "#efac28";
        ctx.globalAlpha = 0.35;
        ctx.fillRect(phX * SCALE, miniGridY * SCALE, TILE * SCALE, (4 * TILE) * SCALE);
        ctx.globalAlpha = 1;

        // DJ — looks confused early, then ducks as caves open
        if (t < 240) {
            const djLook = Math.floor(t / 15) % 4;
            const djDir = djLook < 2 ? 2 : 3;
            drawPlayerSprite(W / 2 - 8, boothY - 10, 0, djDir, {});
        } else {
            drawPlayerSprite(W / 2 - 8, boothY - 2, 0, 0, {});
        }

        // Dancers — stumble during phase 1, then flee once caves emerge
        const danceFloorY = (GRID_Y + 5) * TILE;
        const crowdPositions = [
            // Back row
            { x: 2 * TILE, yOfs: 0, pal: 0, phase: 0, dx: -1, dy: 0 },
            { x: 4 * TILE, yOfs: 4, pal: 1, phase: 3, dx: -0.7, dy: -0.7 },
            { x: 6 * TILE, yOfs: 2, pal: 2, phase: 7, dx: -1, dy: 0.4 },
            { x: 8 * TILE, yOfs: 0, pal: 3, phase: 11, dx: 0.2, dy: -1 },
            { x: 10 * TILE, yOfs: 3, pal: 4, phase: 5, dx: -0.3, dy: 1 },
            { x: 12 * TILE, yOfs: 1, pal: 5, phase: 9, dx: 0.8, dy: -0.6 },
            { x: 14 * TILE, yOfs: 4, pal: 0, phase: 2, dx: 0.5, dy: 1 },
            { x: 16 * TILE, yOfs: 0, pal: 3, phase: 13, dx: 1, dy: 0 },
            { x: 18 * TILE, yOfs: 2, pal: 1, phase: 6, dx: 1, dy: -0.5 },
            // Front row
            { x: 3 * TILE, yOfs: 14, pal: 2, phase: 4, dx: -1, dy: 0.3 },
            { x: 5 * TILE, yOfs: 16, pal: 5, phase: 8, dx: -0.6, dy: 1 },
            { x: 7 * TILE, yOfs: 14, pal: 4, phase: 12, dx: 0.3, dy: 1 },
            { x: 11 * TILE, yOfs: 15, pal: 1, phase: 1, dx: -0.4, dy: -0.8 },
            { x: 13 * TILE, yOfs: 14, pal: 0, phase: 10, dx: 1, dy: 0.5 },
            { x: 15 * TILE, yOfs: 16, pal: 3, phase: 14, dx: 0.7, dy: 1 },
            { x: 17 * TILE, yOfs: 14, pal: 5, phase: 6, dx: 1, dy: -0.3 },
        ];
        const fleeStart = 210;
        for (let di = 0; di < crowdPositions.length; di++) {
            const dp = crowdPositions[di];
            const dancerFleeStart = fleeStart + di * 8;
            const fleeProgress = t >= dancerFleeStart ? Math.min(1, (t - dancerFleeStart) / 180) : 0;
            const baseY = danceFloorY + dp.yOfs;
            if (fleeProgress <= 0) {
                // Stumbling in place with smooth animation
                const step = (introBeatStep + dp.phase) % 16;
                const stepProgress = introBeatTimer / INTRO_BEAT_FRAMES;
                const smoothStep = step + stepProgress;

                const bobWave = Math.sin(smoothStep * Math.PI / 2);
                const bob = Math.abs(bobWave) * 3;

                const stumble = Math.sin(t * 0.2 + di * 2) * shakeAmt * 4;
                const armBlend = Math.abs(bobWave);
                const footOffset = bobWave * 1.5 + stumble * 0.3;

                drawDancerSprite(dp.x + stumble, baseY, DANCER_PALETTES[dp.pal], { bob, armBlend, footOffset });
            } else {
                // Fleeing off-screen in varied directions (normalize so all exit viewport)
                const fleeSpeed = W * 1.2 / Math.max(Math.abs(dp.dx), Math.abs(dp.dy));
                const fleeX = dp.x + dp.dx * fleeProgress * fleeSpeed;
                const fleeY = baseY + dp.dy * fleeProgress * fleeSpeed;
                const onScreen = fleeX > -TILE * 2 && fleeX < W + TILE * 2 && fleeY > -TILE * 2 && fleeY < H + TILE * 2;
                if (onScreen) {
                    const runFrame = Math.floor(introGlobalTimer / 5) % 4;
                    drawDancerSprite(fleeX, fleeY, DANCER_PALETTES[dp.pal], { bob: runFrame % 2 * 2, armBlend: 0.5, footOffset: runFrame % 2 * 2 - 1 });
                }
            }
        }

        // === Phase 2: Cracks and caves (starts around t=180) ===
        if (t > 150) {
            const caveT = t - 150; // local timer for cave phase
            const crackProgress = Math.min(1, caveT / 180);
            const caveLocations = CAVES;
            for (let ci = 0; ci < caveLocations.length; ci++) {
                const cave = caveLocations[ci];
                const cx = cave.tileX * TILE;
                const cy = cave.tileY * TILE;
                const caveReveal = Math.min(1, Math.max(0, (caveT - 30 - ci * 60) / 120));

                // Cracks radiating outward
                if (crackProgress > ci * 0.2) {
                    const cp = Math.min(1, (crackProgress - ci * 0.2) / 0.6);
                    ctx.strokeStyle = "#1f240a";
                    ctx.lineWidth = 2 * SCALE;
                    ctx.globalAlpha = cp;
                    for (let cr = 0; cr < 4; cr++) {
                        const angle = (ci * 1.5 + cr * 1.2);
                        const len = cp * 20;
                        ctx.beginPath();
                        ctx.moveTo((cx + 8) * SCALE, (cy + 8) * SCALE);
                        ctx.lineTo((cx + 8 + Math.cos(angle) * len) * SCALE, (cy + 8 + Math.sin(angle) * len) * SCALE);
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                }

                // Cave opens
                if (caveReveal > 0) {
                    const holeSize = caveReveal * TILE;
                    drawRect(cx + (TILE - holeSize) / 2, cy + (TILE - holeSize) / 2, holeSize, holeSize + 4, "#050805");
                    if (caveReveal > 0.5) {
                        drawRect(cx - 2, cy - 4, TILE + 4, 3, "#243024");
                        drawRect(cx - 2, cy + TILE + 1, TILE + 4, 3, "#243024");
                    }
                    // Falling rubble
                    if (caveReveal < 0.8) {
                        for (let ri = 0; ri < 5; ri++) {
                            const rx = cx + (ri * 7 + t) % TILE;
                            const ry = cy + TILE + (t * 0.5 + ri * 11) % 20;
                            drawRect(rx, ry, 2, 2, "#243024");
                        }
                    }
                    // Glowing eyes in darkness — no goblins emerge in this scene
                    if (caveReveal > 0.7) {
                        const eyeAlpha = (caveReveal - 0.7) / 0.3;
                        ctx.globalAlpha = eyeAlpha * (0.5 + Math.sin(t * 0.1 + ci) * 0.5);
                        drawRect(cx + 5, cy + 5, 2, 2, "#39FF14");
                        drawRect(cx + 9, cy + 5, 2, 2, "#39FF14");
                        ctx.globalAlpha = 1;
                    }
                }
            }

            // DJ booth sparks (only once caves are opening)
            if (caveT > 60 && t % 12 < 3) {
                const sparkX = boothX + 20 + Math.random() * 12;
                const sparkY = boothY + Math.random() * 8;
                drawRect(sparkX, sparkY, 2, 2, "#efac28");
                drawRect(sparkX + 1, sparkY - 2, 1, 2, "#ffffff");
            }

        }

        ctx.restore();

        // Caption — changes as scene progresses
        if (t > 60 && t < 300) {
            const capAlpha = Math.min(1, (t - 60) / 30) * Math.max(0, 1 - (t - 240) / 60);
            ctx.globalAlpha = Math.max(0, capAlpha);
            drawCentered("BUT DEEP BENEATH THE DANCE FLOOR,", H - 54, "#ef3a0c", 5);
            drawCentered("SOMETHING HAD BEEN LISTENING.", H - 44, "#ef3a0c", 5);
            ctx.globalAlpha = 1;
        }
        if (t > 300) {
            const capAlpha = Math.min(1, (t - 300) / 30);
            ctx.globalAlpha = capAlpha;
            drawCentered("THE EARTH SPLIT OPEN.", H - 54, "#ef3a0c", 5);
            drawCentered("CRACKS TORE THROUGH THE WALLS LIKE JAGGED TEETH.", H - 44, "#ef3a0c", 5);
            ctx.globalAlpha = 1;
        }
    }

    // ==================== SCENE 2 (1B): GOBLIN EMERGENCE + ATTACK ====================
    else if (introScene === 2) {
        // Phase 1 (0-180): 5 green goblins emerge one by one, sabotage grid
        // Phase 2 (200-260): Elite goblin charges from top cave, tackles DJ
        // Phase 3 (260+): All 6 goblins grab equipment and flee to caves

        // Residual shake from earthquake, fading out
        const shAmt = Math.max(0, 1 - t / 120);
        const shX = (Math.random() - 0.5) * shAmt * 4 * SCALE;
        const shY = (Math.random() - 0.5) * shAmt * 4 * SCALE;
        ctx.save();
        ctx.translate(shX, shY);

        drawRect(0, 0, W, H, "#161615");
        // Walls with caves now open (dimmed — power died in Scene 1A)
        for (let c = 0; c < COLS; c++) {
            drawRect(c * TILE, 0, TILE, TILE, (c * 7 + 3) % 3 === 0 ? "#1e2e1e" : "#1a2a1a");
            drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, (c * 11 + 5) % 3 === 0 ? "#152015" : "#1a2a1a");
        }
        for (let r = 0; r < ROWS; r++) {
            drawRect(0, r * TILE, TILE, TILE, (r * 7) % 3 === 0 ? "#152015" : "#1a2a1a");
            drawRect((COLS - 1) * TILE, r * TILE, TILE, TILE, (r * 11) % 3 === 0 ? "#152015" : "#1a2a1a");
        }
        // Open caves with glowing eyes (eyes fade as goblins emerge)
        for (let ci = 0; ci < CAVES.length; ci++) {
            const cave = CAVES[ci];
            const cx = cave.tileX * TILE, cy = cave.tileY * TILE;
            drawRect(cx, cy - 2, TILE, TILE + 4, "#050805");
            drawRect(cx - 2, cy - 4, TILE + 4, 3, "#243024");
            drawRect(cx - 2, cy + TILE + 1, TILE + 4, 3, "#243024");
            // Eyes glow until first goblin from this cave emerges
            const gobEmerged = introGoblins.some(g => g.caveIdx === ci && g.emerged);
            if (!gobEmerged) {
                const eyeAlpha = 0.5 + Math.sin(t * 0.1 + ci) * 0.5;
                ctx.globalAlpha = eyeAlpha;
                drawRect(cx + 5, cy + 5, 2, 2, "#39FF14");
                drawRect(cx + 9, cy + 5, 2, 2, "#39FF14");
                ctx.globalAlpha = 1;
            }
        }

        // Dead mushroom lights (all dark — power died in earthquake)
        for (let c = 1; c < COLS - 1; c++) {
            drawRect(c * TILE + TILE / 2 - 2, TILE + 6, 4, 4, "#0a0f0a");
        }

        // Beat grid — corruption starts after goblins reach it (~frame 120)
        const miniGridY = GRID_Y * TILE + GRID_Y_OFFSET;
        const miniGridX = 3 * TILE;
        const corruptStart = 120;
        if (t > corruptStart) {
            const corruptProgress = Math.min(1, (t - corruptStart) / 300);
            const targetCorrupted = Math.floor(corruptProgress * introCorruptOrder.length);
            while (introCorruptedSoFar < targetCorrupted && introCorruptedSoFar < introCorruptOrder.length) {
                const cell = introCorruptOrder[introCorruptedSoFar];
                introGridState[cell.r][cell.c] = introGridState[cell.r][cell.c] ? 0 : 1;
                introGridFlash[cell.r][cell.c] = 30;
                introCorruptedSoFar++;
            }
        }
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 16; c++) {
                const gx = miniGridX + c * TILE;
                const gy = miniGridY + r * TILE;
                const cellOn = introGridState[r][c];
                drawRect(gx, gy, TILE, TILE, PAL.gridBorder);
                drawRect(gx + 1, gy + 1, TILE - 2, TILE - 2, cellOn ? PAL.gridOn[r] : PAL.gridOff);
                // Green flash on recently corrupted cells
                if (introGridFlash[r][c] > 0) {
                    ctx.globalAlpha = 0.4 * (introGridFlash[r][c] / 30);
                    drawRect(gx, gy, TILE, TILE, "#39FF14");
                    ctx.globalAlpha = 1;
                    introGridFlash[r][c]--;
                }
            }
        }

        // === 6 goblins emerge one by one from caves ===
        // First 5 are green and sabotage the grid; 6th is the elite (index 5)
        const goblinEmergeTime = 30; // first goblin steps out after brief pause
        const goblinStagger = 30;    // frames between each spawn
        for (let gi = 0; gi < introGoblins.length; gi++) {
            const gob = introGoblins[gi];
            if (gob.gone) continue;
            const cave = CAVES[gob.caveIdx];
            const caveReady = t > goblinEmergeTime + gi * goblinStagger;
            if (!caveReady) continue;

            // Elite goblin (index 5) is handled separately as the tackler
            if (gob.isElite) continue;

            if (!gob.emerged) {
                // Set initial destination: walk from cave toward the grid
                gob.emerged = true;
                if (cave.tileX === 0) {
                    gob.destX = miniGridX;
                    gob.destY = miniGridY + (gi % 4) * TILE;
                    gob.dir = 3; // right
                } else if (cave.tileX === COLS - 1) {
                    gob.destX = miniGridX + 15 * TILE;
                    gob.destY = miniGridY + (gi % 4) * TILE;
                    gob.dir = 2; // left
                } else {
                    gob.destX = miniGridX + 8 * TILE;
                    gob.destY = miniGridY;
                    gob.dir = 0; // down
                }
            }

            // Move toward destination (gameplay-style smooth movement)
            const dx = gob.destX - gob.x;
            const dy = gob.destY - gob.y;
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist > 1) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    gob.x += Math.sign(dx) * gob.speed;
                    gob.dir = dx < 0 ? 2 : 3;
                } else {
                    gob.y += Math.sign(dy) * gob.speed;
                    gob.dir = dy < 0 ? 1 : 0;
                }
                gob.frameTimer++;
                if (gob.frameTimer >= 8) {
                    gob.frameTimer = 0;
                    gob.frame = (gob.frame + 1) % 4;
                }
            } else {
                // Arrived — pick a grid cell to sabotage
                gob.x = gob.destX;
                gob.y = gob.destY;
                const gc = Math.round((gob.x - miniGridX) / TILE);
                const gr = Math.round((gob.y - miniGridY) / TILE);
                if (gc === gob.targetCol && gr === gob.targetRow &&
                    gr >= 0 && gr < 4 && gc >= 0 && gc < 16 && introGridState) {
                    introGridState[gr][gc] = introGridState[gr][gc] ? 0 : 1;
                    introGridFlash[gr][gc] = 30;
                    if (audioCtx) playSabotageSound(audioCtx.currentTime);
                    gob.targetRow = -1;
                    gob.targetCol = -1;
                }
                if (gob.targetRow < 0 || gob.moveSteps > 5) {
                    gob.targetRow = Math.floor(Math.random() * 4);
                    gob.targetCol = Math.floor(Math.random() * 16);
                    gob.moveSteps = 0;
                }
                const goalX = miniGridX + gob.targetCol * TILE;
                const goalY = miniGridY + gob.targetRow * TILE;
                const gdx = goalX - gob.x;
                const gdy = goalY - gob.y;
                if (Math.abs(gdx) > Math.abs(gdy)) {
                    gob.destX = gob.x + Math.sign(gdx) * TILE;
                    gob.destY = gob.y;
                } else {
                    gob.destX = gob.x;
                    gob.destY = gob.y + Math.sign(gdy) * TILE;
                }
                gob.destX = Math.max(miniGridX, Math.min(miniGridX + 15 * TILE, gob.destX));
                gob.destY = Math.max(miniGridY, Math.min(miniGridY + 3 * TILE, gob.destY));
                gob.moveSteps++;
            }
            drawGoblinSprite("normal", gob.x, gob.y, gob.frame, { dir: gob.dir, showShadow: false });
        }

        // DJ booth — sparks flying, then explodes on tackle
        const boothX = W / 2 - 24;
        const boothY = GRID_Y * TILE - 8;
        const knockStart = 260;

        if (t < knockStart) {
            // Intact booth — full setup (with damage after swarm)
            drawLightRig(boothX - 8, boothY - 18, introKickPump);
            drawDiscoBall(boothX + 20, boothY - 30);
            drawRect(boothX - 8, boothY + 12, 64, 8, "#2a3a2a");
            drawRect(boothX - 8, boothY + 12, 64, 2, "#3a4a3a");
            drawSubwoofer(boothX - 12, boothY - 2, 0, -1);
            drawSubwoofer(boothX + 44, boothY - 2, 0, 1);
            drawTurntable(boothX + 1, boothY - 2);
            drawMixer(boothX + 18, boothY + 2);
            if (t > 120) {
                drawRect(boothX + 5, boothY + 6, 10, 6, "#0d150d");
                drawRect(boothX + 35, boothY + 8, 8, 4, "#0d150d");
                drawRect(boothX + 18, boothY + 2, 12, 10, "#0d150d");
                if (t % 8 < 2) {
                    drawRect(boothX + 10 + Math.random() * 30, boothY + Math.random() * 10, 2, 3, "#efac28");
                }
            }
        } else {
            // Initialize debris on first explosion frame
            if (t === knockStart) {
                playBoothExplosion();
                // Piece origins relative to booth (matching drawDJSetupPiece offsets)
                const pieceOrigins = [
                    { x: boothX - 12, y: boothY - 2 },   // left speaker
                    { x: boothX + 44, y: boothY - 2 },   // right speaker
                    { x: boothX + 1,  y: boothY - 2 },   // turntable
                    { x: boothX + 18, y: boothY + 2 },   // mixer
                    { x: boothX - 8,  y: boothY - 18 },  // light rig
                    { x: boothX + 20, y: boothY - 30 },  // disco ball
                ];
                introBoothDebris = pieceOrigins.map((p, i) => ({
                    pieceIndex: i,
                    x: p.x, y: p.y,
                    vx: (Math.random() - 0.5) * 4 + (p.x < boothX + 16 ? -1.5 : 1.5),
                    vy: -(3 + Math.random() * 3),
                    landed: false,
                    carriedBy: -1,
                }));
                // Assign each of the 6 introGoblins a debris piece to steal
                for (let gi = 0; gi < introGoblins.length; gi++) {
                    const gob = introGoblins[gi];
                    gob.pieceIndex = gi;
                    gob.carrying = false;
                    gob.gone = false;
                    gob.waitUntil = knockStart + 90 + gi * 15; // staggered grab times
                }
            }

            // Destroyed booth platform (scorch marks)
            drawRect(boothX - 8, boothY + 12, 64, 8, "#2a1a0a");
            drawRect(boothX - 8, boothY + 12, 64, 2, "#3a2a1a");
            // Scorch marks
            drawRect(boothX + 5, boothY + 4, 15, 8, "#0a0f0a");
            drawRect(boothX + 25, boothY + 6, 12, 6, "#0a0f0a");

            // Update and draw debris pieces
            const gravity = 0.12;
            for (let di = 0; di < introBoothDebris.length; di++) {
                const d = introBoothDebris[di];
                if (d.carriedBy >= 0) continue; // being carried by goblin
                if (!d.landed) {
                    d.vy += gravity;
                    d.x += d.vx;
                    d.y += d.vy;
                    // Land on the floor
                    if (d.y > boothY + 20) {
                        d.y = boothY + 20;
                        d.landed = true;
                        d.vx = 0;
                        d.vy = 0;
                    }
                }
            }

            // Draw debris pieces at their scattered positions
            const origOffsets = [
                { x: -12, y: -2 }, { x: 44, y: -2 }, { x: 1, y: -2 },
                { x: 18, y: 2 }, { x: -8, y: -18 }, { x: 20, y: -30 }
            ];
            for (let di = 0; di < introBoothDebris.length; di++) {
                const d = introBoothDebris[di];
                if (d.carriedBy >= 0) continue;
                ctx.save();
                const ofsX = d.x - (boothX + origOffsets[d.pieceIndex].x);
                const ofsY = d.y - (boothY + origOffsets[d.pieceIndex].y);
                ctx.translate(ofsX * SCALE, ofsY * SCALE);
                drawDJSetupPiece(d.pieceIndex, boothX, boothY, { alpha: 0.9 });
                ctx.restore();
            }

            // Smoke rising from destroyed booth
            for (let si = 0; si < 4; si++) {
                const smokeX = boothX + 5 + si * 14;
                const smokeAnim = ((t - knockStart) * 0.3 + si * 20) % 40;
                const smokeY = boothY + 8 - smokeAnim;
                ctx.globalAlpha = Math.max(0, 0.2 - smokeAnim / 200);
                if (ctx.globalAlpha > 0) drawRect(smokeX, smokeY, 3, 3, "#888888");
            }
            ctx.globalAlpha = 1;
        }

        // DJ — ducking once goblins appear, then LAUNCHED across the venue
        const djStartX = W / 2 - 8, djStartY = boothY - 2;
        // Landing spot: deep in the dance floor (open field area)
        const djEndX = W / 2 - 8, djEndY = (GRID_Y + 8) * TILE;
        // knockStart already declared above in booth section
        const knockFlyEnd = 360;    // 100 frames of glorious airtime
        const knockLandEnd = 420;   // 60 frames of dust settling
        const aftermathStart = 420;

        // Tackling goblin — elite (index 5) charges from top cave, hits DJ
        const tackleGob = introGoblins[5];
        const tackleGobStart = 200;
        const topCave = CAVES[tackleGob.caveIdx]; // top cave
        const tackleGobX0 = topCave.tileX * TILE;
        const tackleGobY0 = topCave.tileY * TILE;
        const tackleGobXEnd = djStartX + 10;
        const tackleGobYEnd = boothY;
        if (t >= tackleGobStart && t < knockStart + 60 && !tackleGob.gone) {
            // Tackle goblin: charge → impact → idle until theft phase takes over
            if (!tackleGob.emerged) tackleGob.emerged = true;
            let tgx, tgy, tgDir = 0;
            if (t < knockStart) {
                // Charge from top cave down to booth
                const tackleT = Math.min(1, (t - tackleGobStart) / (knockStart - tackleGobStart));
                tgx = tackleGobX0 + (tackleGobXEnd - tackleGobX0) * tackleT;
                tgy = tackleGobY0 + (tackleGobYEnd - tackleGobY0) * tackleT;
                tgDir = 0; // facing down
            } else {
                // Stays at impact point until theft phase
                tgx = tackleGobXEnd;
                tgy = tackleGobYEnd;
            }
            tackleGob.x = tgx;
            tackleGob.y = tgy;
            drawGoblinSprite("elite", tgx, tgy, Math.floor(t / 6) % 4, { dir: tgDir, showShadow: false });
        }

        if (t < knockStart) {
            // Ducking behind booth, looking around nervously
            const djLook = Math.floor(t / 15) % 4;
            const djDir = djLook < 2 ? 2 : 3;
            drawPlayerSprite(djStartX, djStartY, 0, djDir, {});
        } else if (t < knockFlyEnd) {
            // === DRAMATIC LAUNCH — DJ flies across the entire venue ===
            const knockT = (t - knockStart) / (knockFlyEnd - knockStart); // 0→1 over 100 frames

            // X: slight drift toward center
            const djX = djStartX + (djEndX - djStartX) * knockT;
            // Y: massive parabolic arc — launches UP then crashes DOWN into dance floor
            // Arc peaks at ~40% of flight (launched hard, gravity pulls down)
            const arcHeight = -90 * Math.sin(knockT * Math.PI * 0.85);
            const djY = djStartY + (djEndY - djStartY) * Math.pow(knockT, 1.8) + arcHeight;

            // Comic perspective scaling — sprite grows as DJ "flies toward camera" at apex
            const flyScale = 1 + 0.9 * Math.sin(knockT * Math.PI);

            // Tumbling rapidly — direction changes every 3 frames
            const tumbleDir = [3, 0, 2, 1][Math.floor(t / 3) % 4];
            const djFrame = Math.floor(t / 2) % 4; // fast leg cycling = flailing

            // Impact flash on first frame
            if (t === knockStart) {
                ctx.globalAlpha = 0.8;
                drawRect(djStartX - 8, djStartY - 8, 32, 32, "#FFFFFF");
                ctx.globalAlpha = 1;
            }

            // Draw scaled DJ with flailing limbs
            ctx.save();
            const spriteCX = djX * SCALE + 24 * SCALE * 0.5; // center of 16px sprite
            const spriteCY = djY * SCALE + 21 * SCALE * 0.5;
            ctx.translate(spriteCX, spriteCY);
            ctx.scale(flyScale, flyScale);
            ctx.translate(-spriteCX, -spriteCY);
            drawPlayerSprite(djX, djY, djFrame, tumbleDir, {});

            // Flailing arms — skin-colored lines thrashing around the sprite
            const flailAngle = t * 0.8; // rapid rotation
            const flailLen = (8 + Math.sin(t * 0.5) * 4) * SCALE;
            ctx.strokeStyle = "#efb775";
            ctx.lineWidth = 3 * SCALE;
            ctx.lineCap = "round";
            // Left arm flailing
            const armBaseX = (djX + 4) * SCALE;
            const armBaseY = (djY + 6) * SCALE;
            ctx.beginPath();
            ctx.moveTo(armBaseX, armBaseY);
            ctx.lineTo(armBaseX + Math.cos(flailAngle) * flailLen, armBaseY + Math.sin(flailAngle) * flailLen);
            ctx.stroke();
            // Right arm flailing (offset phase)
            const armBaseX2 = (djX + 12) * SCALE;
            ctx.beginPath();
            ctx.moveTo(armBaseX2, armBaseY);
            ctx.lineTo(armBaseX2 + Math.cos(flailAngle + 2.5) * flailLen, armBaseY + Math.sin(flailAngle + 2.5) * flailLen);
            ctx.stroke();
            // Flailing fists at arm ends
            ctx.fillStyle = "#efb775";
            ctx.beginPath();
            ctx.arc(armBaseX + Math.cos(flailAngle) * flailLen, armBaseY + Math.sin(flailAngle) * flailLen, 2.5 * SCALE, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(armBaseX2 + Math.cos(flailAngle + 2.5) * flailLen, armBaseY + Math.sin(flailAngle + 2.5) * flailLen, 2.5 * SCALE, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Speed lines trailing behind the DJ
            if (knockT > 0.05 && knockT < 0.9) {
                ctx.strokeStyle = "#efd8a1";
                ctx.lineWidth = 1 * SCALE;
                ctx.globalAlpha = 0.4 * (1 - knockT);
                for (let sl = 0; sl < 5; sl++) {
                    const slX = (djX + 8 + (sl - 2) * 4) * SCALE;
                    const slY = djY * SCALE;
                    const slLen = (10 + sl * 5) * SCALE * flyScale;
                    ctx.beginPath();
                    ctx.moveTo(slX, slY);
                    ctx.lineTo(slX - (djX - djStartX) * 0.3 * SCALE, slY - slLen);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }

            // Shadow on the ground grows/shrinks with height
            const shadowY = djEndY + 4;
            const shadowWidth = 10 + flyScale * 6;
            const shadowAlpha = 0.15 + (1 - Math.abs(arcHeight) / 90) * 0.15;
            ctx.globalAlpha = shadowAlpha;
            ctx.fillStyle = "#000000";
            ctx.beginPath();
            ctx.ellipse((djX + 8) * SCALE, shadowY * SCALE, shadowWidth * SCALE, 2 * SCALE, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        } else if (t < knockLandEnd) {
            // === CRASH LANDING — dust cloud erupts ===
            const landT = (t - knockFlyEnd) / (knockLandEnd - knockFlyEnd); // 0→1 over 60 frames

            // Screen shake on impact (strong, fading)
            if (t - knockFlyEnd < 20) {
                const impactShake = (1 - (t - knockFlyEnd) / 20) * 8;
                ctx.save();
                ctx.translate(
                    (Math.random() - 0.5) * impactShake * SCALE,
                    (Math.random() - 0.5) * impactShake * SCALE
                );
            }

            // DJ lying collapsed in crater
            drawPlayerSprite(djEndX, djEndY, 0, 0, {});

            // Dust cloud — particles burst outward then rise and fade
            const dustCount = 16;
            for (let di = 0; di < dustCount; di++) {
                const angle = (di / dustCount) * Math.PI * 2 + di * 0.7;
                const burstSpeed = 15 + (di % 5) * 8;
                const burstDist = burstSpeed * landT;
                const riseAmt = landT * landT * 20; // dust rises over time
                const dustX = (djEndX + 8 + Math.cos(angle) * burstDist) * SCALE;
                const dustY = (djEndY + 4 + Math.sin(angle) * burstDist * 0.5 - riseAmt) * SCALE;
                const dustSize = (3 + di % 3) * (1 - landT * 0.6) * SCALE;
                const dustAlpha = Math.max(0, 0.6 * (1 - landT));
                if (dustAlpha > 0 && dustSize > 0) {
                    ctx.globalAlpha = dustAlpha;
                    ctx.fillStyle = di % 3 === 0 ? "#b8a888" : di % 3 === 1 ? "#8a7a60" : "#c8b898";
                    ctx.beginPath();
                    ctx.arc(dustX, dustY, dustSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            // Central dust cloud (big billowing mass)
            const cloudAlpha = Math.max(0, 0.5 * (1 - landT * 0.8));
            if (cloudAlpha > 0) {
                ctx.globalAlpha = cloudAlpha;
                const cloudR = (20 + landT * 30) * SCALE;
                const cloudRise = landT * 15;
                ctx.fillStyle = "#a09070";
                ctx.beginPath();
                ctx.ellipse((djEndX + 8) * SCALE, (djEndY + 4 - cloudRise) * SCALE, cloudR, cloudR * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                // Lighter inner cloud
                ctx.fillStyle = "#c8b898";
                ctx.beginPath();
                ctx.ellipse((djEndX + 8) * SCALE, (djEndY + 2 - cloudRise) * SCALE, cloudR * 0.6, cloudR * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Impact flash on first landing frame
            if (t === knockFlyEnd) {
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = "#FFFFFF";
                ctx.beginPath();
                ctx.arc((djEndX + 8) * SCALE, (djEndY + 4) * SCALE, 30 * SCALE, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            if (t - knockFlyEnd < 20) {
                ctx.restore(); // restore screen shake
            }
        } else {
            // Collapsed — lying still where he landed
            drawPlayerSprite(djEndX, djEndY, 0, 0, {});
        }

        // Aftermath: the same 6 goblins grab debris pieces and flee to caves
        // (starts at +60 so debris has fully landed before goblins scramble)
        if (t >= knockStart + 60) {
            const origOffsets2 = [
                { x: -12, y: -2 }, { x: 44, y: -2 }, { x: 1, y: -2 },
                { x: 18, y: 2 }, { x: -8, y: -18 }, { x: 20, y: -30 }
            ];
            for (let gi = 0; gi < introGoblins.length; gi++) {
                const gob = introGoblins[gi];
                if (gob.gone) continue;
                const d = introBoothDebris[gob.pieceIndex];

                if (t < gob.waitUntil) {
                    // Goblin running toward the fallen piece
                    const targetX = d.x;
                    const targetY = d.y;
                    gob.x = gob.x + (targetX - gob.x) * 0.08;
                    gob.y = gob.y + (targetY - gob.y) * 0.08;
                    gob.dir = targetX > gob.x ? 3 : 2;
                } else if (!gob.carrying) {
                    // Grab the piece
                    gob.carrying = true;
                    d.carriedBy = gi;
                } else {
                    // Flee toward home cave
                    const caveX = gob.targetCave.tileX * TILE;
                    const caveY = gob.targetCave.tileY * TILE;
                    const dx = caveX - gob.x;
                    const dy = caveY - gob.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 3) {
                        gob.gone = true;
                        continue;
                    }
                    const speed = 2.5;
                    gob.x += (dx / dist) * speed;
                    gob.y += (dy / dist) * speed;
                    gob.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1);
                    // Move the carried piece with the goblin
                    d.x = gob.x;
                    d.y = gob.y - 8;
                }

                // Draw the goblin
                gob.frameTimer++;
                if (gob.frameTimer > 6) { gob.frameTimer = 0; gob.frame = (gob.frame + 1) % 4; }
                drawGoblinSprite(gob.isElite ? "elite" : "normal", gob.x, gob.y, gob.frame, { dir: gob.dir, showShadow: false });

                // Draw carried piece above goblin
                if (gob.carrying && !gob.gone) {
                    ctx.save();
                    const ofsX = d.x - (boothX + origOffsets2[d.pieceIndex].x);
                    const ofsY = d.y - (boothY + origOffsets2[d.pieceIndex].y);
                    ctx.translate(ofsX * SCALE, ofsY * SCALE);
                    ctx.scale(0.6, 0.6);
                    drawDJSetupPiece(d.pieceIndex, boothX, boothY, { alpha: 0.9 });
                    ctx.restore();
                }
            }
        }

        ctx.restore();

        // Dark vignette (fades in during aftermath)
        if (t >= aftermathStart) {
            const vigAlpha = Math.min(0.6, (t - aftermathStart) / 180);
            const W_v = W * SCALE;
            const H_v = H * SCALE;
            const vGrad = ctx.createRadialGradient(W_v / 2, H_v / 2, W_v * 0.2, W_v / 2, H_v / 2, W_v * 0.6);
            vGrad.addColorStop(0, "rgba(0,0,0,0)");
            vGrad.addColorStop(1, `rgba(0,0,0,${vigAlpha})`);
            ctx.fillStyle = vGrad;
            ctx.fillRect(0, 0, W_v, H_v);
        }

        // Green tint overlay
        ctx.fillStyle = "#39FF14";
        ctx.globalAlpha = 0.03 + Math.sin(t * 0.1) * 0.02;
        ctx.fillRect(0, 0, W * SCALE, H * SCALE);
        ctx.globalAlpha = 1;

        // Caption — appears once goblins are swarming, changes after theft
        if (t > 180 && t < aftermathStart) {
            const capAlpha = Math.min(1, (t - 180) / 30);
            ctx.globalAlpha = capAlpha;
            drawCentered("THEY CAME POURING OUT. SMALL, VICIOUS, AND FAST.", H - 60, "#39FF14", 5);
            drawCentered("THEY SWARMED THE BEAT GRID AND TORE IT APART,", H - 50, "#39FF14", 5);
            drawCentered("NOTE BY NOTE. THE MUSIC TWISTED INTO NOISE.", H - 40, "#39FF14", 5);
            ctx.globalAlpha = 1;
        }
        if (t >= aftermathStart) {
            const capAlpha = Math.min(1, (t - aftermathStart) / 30);
            ctx.globalAlpha = capAlpha;
            drawCentered("THEY TORE THE SETUP APART AND DRAGGED IT", H - 50, "#FF4400", 5);
            drawCentered("BACK INTO THE CAVES, PIECE BY PIECE.", H - 40, "#FF4400", 5);
            ctx.globalAlpha = 1;
        }
    }

    // ==================== SCENE 3: CALL TO ACTION ====================
    else if (introScene === 3) {
        // DJ crawls from collapsed position to center, then rises and clenches fists
        // Crawl phase (0-120): crawls up from dance floor landing spot toward center
        // Rise phase (120+): existing stand-up and fist-clench sequence
        const CRAWL_FRAMES = 120;
        const crawlStartX = W / 2 - 8;   // Scene 2 landing X (center of venue)
        const crawlStartY = (GRID_Y + 8) * TILE; // Scene 2 landing Y (deep in dance floor)
        const crawlEndX = (GRID_X + 7) * TILE;   // Match level 1 player start X
        const crawlEndY = (GRID_Y + LEVELS[0].activeRows + 1) * TILE + GRID_Y_OFFSET;
        const crawlT = Math.min(1, t / CRAWL_FRAMES);

        let djX, djY, djDir, djFrame;
        if (t < CRAWL_FRAMES) {
            // Crawl from landing spot to final position
            djX = crawlStartX + (crawlEndX - crawlStartX) * crawlT;
            djY = crawlStartY + (crawlEndY - crawlStartY) * crawlT;
            djDir = 1; // facing up (crawling upward)
            djFrame = Math.floor(t / 10) % 4; // slow crawl animation
        } else {
            // Rise in place — DJ stands up and faces forward (toward camera)
            djX = crawlEndX;
            djY = crawlEndY;
            const rt = t - CRAWL_FRAMES;
            const riseProgress = Math.min(1, rt / 90);
            djDir = 0; // now facing down (toward player)
            djFrame = riseProgress < 0.5 ? 0 : Math.floor((rt - 45) / 8) % 4;
        }

        drawRect(0, 0, W, H, "#050805");

        // Spotlight follows DJ position — green-tinted cave glow
        const spotW = W * SCALE;
        const spotH = H * SCALE;
        const spotCX = (djX + 8) * SCALE;
        const spotCY = (djY + 8) * SCALE;
        const spotGrad = ctx.createRadialGradient(spotCX, spotCY, 10, spotCX, spotCY, spotW * 0.3);
        spotGrad.addColorStop(0, "#0d1a0d");
        spotGrad.addColorStop(1, "#050805");
        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, spotW, spotH);

        drawPlayerSprite(djX, djY, djFrame, djDir, {});

        // Fist clench punch animation after standing (shifted by CRAWL_FRAMES)
        if (t > CRAWL_FRAMES + 120) {
            const punchT = Math.min(1, (t - CRAWL_FRAMES - 120) / 30);
            // Draw raised fists
            const fistY = (djY - 4) * SCALE;
            const fistSize = (3 + punchT * 2) * SCALE;
            ctx.fillStyle = "#efb775";
            // Left fist
            ctx.beginPath();
            ctx.arc((djX + 2) * SCALE, fistY, fistSize, 0, Math.PI * 2);
            ctx.fill();
            // Right fist
            ctx.beginPath();
            ctx.arc((djX + 14) * SCALE, fistY, fistSize, 0, Math.PI * 2);
            ctx.fill();

            // Determination sparkles
            if (punchT > 0.5) {
                for (let si = 0; si < 6; si++) {
                    const angle = (si / 6) * Math.PI * 2 + t * 0.05;
                    const dist = 15 + Math.sin(t * 0.1 + si) * 5;
                    const sx = (djX + 8 + Math.cos(angle) * dist) * SCALE;
                    const sy = (djY - 4 + Math.sin(angle) * dist) * SCALE;
                    ctx.fillStyle = si % 2 === 0 ? "#44ff44" : "#88ee88";
                    ctx.globalAlpha = 0.6 + Math.sin(t * 0.2 + si) * 0.4;
                    ctx.fillRect(sx - SCALE, sy - SCALE, 2 * SCALE, 2 * SCALE);
                }
                ctx.globalAlpha = 1;
            }
        }

        // Text builds up (shifted by CRAWL_FRAMES)
        if (t > CRAWL_FRAMES + 60) {
            const txtAlpha = Math.min(1, (t - CRAWL_FRAMES - 60) / 30);
            ctx.globalAlpha = txtAlpha;
            drawCentered("BUT THE DJ DIDN'T RUN.", 20, "#44ff44", 5);
            drawCentered("ALONE IN THE WRECKAGE, SOMETHING STIRRED.", 30, "#44ff44", 5);
            drawCentered("A RHYTHM, DEEP IN THE CHEST, THAT REFUSED TO DIE.", 40, "#44ff44", 5);
        }
        if (t > CRAWL_FRAMES + 150) {
            const txtAlpha2 = Math.min(1, (t - CRAWL_FRAMES - 150) / 30);
            ctx.globalAlpha = txtAlpha2;
            drawCentered("TWO FISTS. ONE BEAT.", H - 36, "#ff6611", 8);
            drawCentered("THAT'S ALL IT WOULD TAKE.", H - 24, "#ff6611", 6);
        }
        ctx.globalAlpha = 1;

        // Scene loops in place — no fade out
    }

    // HUD "PRESS ENTER" prompt — appears 60 frames after each scene's last story beat
    const lastBeatFrame = [60, 300, 180, 90][introScene] || 60;
    const hudPromptDelay = lastBeatFrame + 60;
    if (t > hudPromptDelay) {
        const promptText = introScene >= 3 ? "PRESS ENTER TO BEGIN" : "PRESS ENTER";
        // Draw HUD background (matches cave style)
        drawHudRect(0, 0, COLS * TILE, HUD_H, "#0a0f0a");
        // Stone border along top
        for (let c = 0; c < COLS; c++) {
            drawHudRect(c * TILE, 0, TILE, 2, c % 2 === 0 ? "#1a2a1a" : "#1e2e1e");
        }
        hudCtx.fillStyle = "rgba(255,255,255,0.08)";
        hudCtx.fillRect(0, 0, COLS * TILE * SCALE, 1 * SCALE);
        // Subtle grain texture
        for (let c = 0; c < COLS; c++) {
            let seed = c * 37 + 7;
            for (let i = 0; i < 4; i++) {
                seed = (seed * 9301 + 49297) % 233280;
                const gx = c * TILE + (seed % TILE);
                seed = (seed * 9301 + 49297) % 233280;
                const gy = 3 + (seed % (HUD_H - 4));
                const bright = (seed % 2) === 0;
                hudCtx.fillStyle = bright ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)";
                hudCtx.fillRect(gx * SCALE, gy * SCALE, SCALE, SCALE);
            }
        }
        // Centered prompt text with gentle pulse
        const promptPulse = Math.sin(t * 0.06) * 0.3 + 0.7;
        hudCtx.globalAlpha = promptPulse;
        hudCtx.font = `${5 * SCALE}px monospace`;
        hudCtx.fillStyle = "#efd8a1";
        hudCtx.textAlign = "center";
        hudCtx.fillText(promptText, (COLS * TILE * SCALE) / 2, (HUD_H / 2 + 2) * SCALE);
        hudCtx.textAlign = "start";
        hudCtx.globalAlpha = 1;
    }
}


function renderHighScoreEntry() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background with starfield
    drawRect(0, 0, W, H, "#050805");
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(initialsBlink * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#44ff44" : "#88cc88");
    }
    ctx.globalAlpha = 1;

    initialsBlink++;

    // "NEW HIGH SCORE!" header — prominent, celebratory
    const header = "NEW HIGH SCORE!";
    ctx.textAlign = "center";
    ctx.font = `${8 * SCALE}px monospace`;
    ctx.fillStyle = "#000";
    ctx.fillText(header, (W / 2) * SCALE + SCALE, 20 * SCALE + SCALE);
    ctx.fillStyle = "#efac28";
    ctx.fillText(header, (W / 2) * SCALE, 20 * SCALE);

    // Score display — big and proud
    const scoreStr = String(finalScore);
    ctx.font = `${8 * SCALE}px monospace`;
    ctx.fillStyle = "#000";
    ctx.fillText(scoreStr, (W / 2) * SCALE + SCALE, 42 * SCALE + SCALE);
    ctx.fillStyle = "#efd8a1";
    ctx.fillText(scoreStr, (W / 2) * SCALE, 42 * SCALE);

    // "ENTER YOUR INITIALS" label — readable instruction
    const label = "ENTER YOUR INITIALS";
    ctx.font = `${5 * SCALE}px monospace`;
    ctx.fillStyle = "#efb775";
    ctx.fillText(label, (W / 2) * SCALE, 68 * SCALE);
    ctx.textAlign = "start";

    // Three letter slots — large and centered
    const letterScale = 18;
    const letterSpacing = letterScale * 2;
    const totalLettersW = 3 * letterScale + 2 * letterSpacing;
    const startX = W / 2 - totalLettersW / 2;
    const ly = H / 2 - letterScale / 2;

    for (let i = 0; i < 3; i++) {
        const lx = startX + i * (letterScale + letterSpacing);

        // Active letter blinks with arrows
        if (i === initialsPos) {
            const blinkAlpha = Math.sin(initialsBlink * 0.12) * 0.3 + 0.7;
            ctx.globalAlpha = blinkAlpha;

            // Up arrow indicator above
            drawText("^", lx + letterScale * 0.1, ly - 20, "#efac28", 8);
            // Down arrow indicator below
            drawText("v", lx + letterScale * 0.1, ly + letterScale + 10, "#efac28", 8);
        }

        // Draw the letter
        const color = i < initialsPos ? "#44aa44" : (i === initialsPos ? "#44ff44" : "#1a2a1a");
        drawText(initialsEntry[i], lx, ly, color, letterScale);
        ctx.globalAlpha = 1;

        // Underline
        drawRect(lx, ly + letterScale + 4, letterScale, 2, i === initialsPos ? "#44ff44" : "#1a2a1a");
    }

    // Existing high scores list
    if (highScores.length > 0) {
        const scoreX = 16;
        const scoreStartY = H / 2 - 20;
        drawText("HIGH SCORES", scoreX, scoreStartY - 12, "#efac28", 3);
        for (let i = 0; i < highScores.length; i++) {
            const entry = highScores[i];
            const rank = (i + 1) + "." + entry.name + " " + String(entry.score).padStart(5, "0");
            const color = i === 0 ? "#efac28" : "#efb775";
            drawText(rank, scoreX, scoreStartY + i * 9, color, 3);
        }
    }

    // "PRESS ENTER TO CONFIRM" blinking — standard CTA size
    const confirmText = "PRESS ENTER TO CONFIRM";
    if (initialsBlink % 60 < 40) {
        ctx.textAlign = "center";
        ctx.font = `${5 * SCALE}px monospace`;
        ctx.fillStyle = "#efb775";
        ctx.fillText(confirmText, (W / 2) * SCALE, (H - 24) * SCALE);
        ctx.textAlign = "start";
    }

    // Controls hint — minimum readable size
    const hint = "UP/DOWN: LETTER   ENTER: CONFIRM";
    ctx.textAlign = "center";
    ctx.font = `${3 * SCALE}px monospace`;
    ctx.fillStyle = "#243024";
    ctx.fillText(hint, (W / 2) * SCALE, (H - 12) * SCALE);
    ctx.textAlign = "start";
}

function renderLevelComplete() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    levelCelebrateTimer++;
    if (screenFlash > 0) screenFlash--;
    // Advance sequencer step to keep dancers dancing
    if (levelCelebrateTimer % 8 === 0) {
        currentStep = (currentStep + 1) % GRID_COLS;
    }

    // Render the game map underneath, then fade to black over time
    render();
    const fadeAlpha = Math.min(1, levelCelebrateTimer / 90);
    ctx.globalAlpha = fadeAlpha;
    drawRect(0, 0, COLS * TILE, ROWS * TILE, "#050805");
    ctx.globalAlpha = 1.0;

    // Keep dancers dancing on top of the dark overlay
    for (const d of dancers) {
        drawDancer(d);
    }

    // "LEVEL X COMPLETE!" text
    if (levelCelebrateTimer > 30) {
        const textAlpha = Math.min(1, (levelCelebrateTimer - 30) / 30);
        ctx.globalAlpha = textAlpha;

        const levelText = "LEVEL " + (currentLevel + 1);
        const completeText = "COMPLETE!";
        const textScale = 14;
        const ty = H / 2 - 30;
        const bounce = Math.sin(levelCelebrateTimer * 0.05) * 2;

        // Draw centered using textAlign
        ctx.textAlign = "center";
        ctx.font = `${textScale * SCALE}px monospace`;
        // Shadow
        ctx.fillStyle = "#000000";
        ctx.fillText(levelText, (W * SCALE) / 2 + SCALE, (ty + bounce + 1) * SCALE);
        // Main
        ctx.fillStyle = "#efac28";
        ctx.fillText(levelText, (W * SCALE) / 2, (ty + bounce) * SCALE);

        // "COMPLETE!" below
        const cy = ty + 20;
        ctx.fillStyle = "#000000";
        ctx.fillText(completeText, (W * SCALE) / 2 + SCALE, (cy + bounce + 1) * SCALE);
        ctx.fillStyle = "#efac28";
        ctx.fillText(completeText, (W * SCALE) / 2, (cy + bounce) * SCALE);

        // Time bonus and score below
        const bonusScale = 8;
        ctx.font = `${bonusScale * SCALE}px monospace`;
        if (lastTimeBonus > 0) {
            const by = cy + 28;
            const bonusText = "TIME BONUS: +" + lastTimeBonus;
            ctx.fillStyle = "#000000";
            ctx.fillText(bonusText, (W * SCALE) / 2 + SCALE, (by + 1) * SCALE);
            ctx.fillStyle = "#3c9f9c";
            ctx.fillText(bonusText, (W * SCALE) / 2, by * SCALE);
        }
        const sy = cy + (lastTimeBonus > 0 ? 42 : 28);
        // Score count-up animation — ramp toward final score
        const countUpSpeed = Math.max(1, Math.ceil(score / 90)); // reaches target in ~1.5s
        if (levelCelebrateDisplayScore < score) {
            levelCelebrateDisplayScore = Math.min(score, levelCelebrateDisplayScore + countUpSpeed);
        }
        const scoreText = "SCORE: " + levelCelebrateDisplayScore;
        ctx.fillStyle = "#000000";
        ctx.fillText(scoreText, (W * SCALE) / 2 + SCALE, (sy + 1) * SCALE);
        ctx.fillStyle = "#efd8a1";
        ctx.fillText(scoreText, (W * SCALE) / 2, sy * SCALE);

        // Narrative breadcrumb — brief one-liner about progress
        if (levelCelebrateTimer > 90) {
            const narrativeAlpha = Math.min(1, (levelCelebrateTimer - 90) / 40);
            ctx.globalAlpha = narrativeAlpha;
            ctx.font = `${4 * SCALE}px monospace`;
            let narrative = "";
            const earned = djSetupEarned.length;
            const lvl = currentLevel + 1;
            if (lvl === 1) narrative = "The rhythm returns...";
            else if (lvl === 2) narrative = "The beat grows stronger.";
            else if (lvl === 5 || lvl === 10 || lvl === 15 || lvl === 20 || lvl === 25 || lvl === 30)
                narrative = earned > 0 ? earned + " / 6 pieces recovered." : "Something stirs in the caves...";
            else if (lvl === 10) narrative = "Rock fundamentals mastered.";
            else if (lvl === 20) narrative = "Funk and soul reclaimed.";
            else if (lvl === 30) narrative = "The underground remembers.";
            else if (earned > 0 && earned < 6) narrative = earned + " / 6 pieces recovered.";
            if (narrative) {
                ctx.fillStyle = "#000000";
                ctx.fillText(narrative, (W * SCALE) / 2 + SCALE, (sy + 18) * SCALE);
                ctx.fillStyle = "#8a9a6a";
                ctx.fillText(narrative, (W * SCALE) / 2, (sy + 17) * SCALE);
            }
            ctx.globalAlpha = 1.0;
        }

        ctx.textAlign = "start";

        ctx.globalAlpha = 1.0;
    }

    // Firework bursts + confetti
    const fwColors = ["#efac28", "#ef3a0c", "#3c9f9c", "#ef692f", "#efd8a1", "#39FF14", "#FF00FF", "#00FFFF", "#FFD700"];
    // Launch new fireworks periodically — more frequent
    if (levelCelebrateTimer % 18 === 0 && levelCelebrateTimer < 240) {
        fireworks.push({
            x: W * 0.2 + Math.random() * W * 0.6,
            y: H + 5,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -(2.5 + Math.random() * 1.5),
            life: 40 + Math.random() * 20,
            maxLife: 40 + Math.random() * 20,
            color: fwColors[Math.floor(Math.random() * fwColors.length)],
            exploded: false,
            particles: [],
        });
    }

    // Update fireworks
    for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        if (!fw.exploded) {
            fw.x += fw.vx;
            fw.y += fw.vy;
            fw.vy += 0.03; // slight gravity on rocket
            fw.life--;
            // Draw rocket trail
            drawRect(fw.x, fw.y, 2, 2, fw.color);
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = 0.6;
            drawRect(fw.x, fw.y + 2, 1, 3, "#ffffff");
            ctx.globalAlpha = 1.0;
            // Explode when life runs out or velocity slows
            if (fw.life <= 0 || fw.vy > -0.5) {
                fw.exploded = true;
                // Spawn explosion particles in a starburst
                const particleCount = 28 + Math.floor(Math.random() * 18);
                for (let p = 0; p < particleCount; p++) {
                    const angle = (p / particleCount) * Math.PI * 2 + Math.random() * 0.3;
                    const speed = 1 + Math.random() * 2;
                    fw.particles.push({
                        x: fw.x, y: fw.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 35 + Math.random() * 35,
                        maxLife: 35 + Math.random() * 35,
                        color: Math.random() > 0.3 ? fw.color : "#ffffff",
                        size: 1 + Math.random() * 2.5,
                    });
                }
            }
        } else {
            // Update explosion particles
            let allDead = true;
            for (const ep of fw.particles) {
                ep.x += ep.vx;
                ep.y += ep.vy;
                ep.vy += 0.04; // gravity
                ep.vx *= 0.98; // drag
                ep.life--;
                if (ep.life > 0) {
                    allDead = false;
                    ctx.globalAlpha = Math.min(1, ep.life / ep.maxLife);
                    const twinkle = Math.sin(levelCelebrateTimer * 0.3 + ep.x) > 0.3;
                    const sz = twinkle ? ep.size * 1.5 : ep.size;
                    drawRect(ep.x, ep.y, sz, sz, ep.color);
                }
            }
            ctx.globalAlpha = 1.0;
            if (allDead) fireworks.splice(i, 1);
        }
    }

    // Confetti — varied shapes (rectangles, triangles, pennants)
    if (levelCelebrateTimer % 5 === 0 && levelCelebrateTimer < 240) {
        const confColors = ["#efac28", "#ef3a0c", "#3c9f9c", "#ef692f", "#efd8a1", "#ab5c1c", "#FFD700", "#FF69B4"];
        for (let ci = 0; ci < 4; ci++) {
            deathParticles.push({
                x: Math.random() * W,
                y: -5,
                vx: (Math.random() - 0.5) * 1.5,
                vy: Math.random() * 1.5 + 0.5,
                life: 80 + Math.random() * 40,
                color: confColors[Math.floor(Math.random() * confColors.length)],
                size: 1 + Math.random() * 3,
                sparkle: Math.random() > 0.5,
                confShape: Math.floor(Math.random() * 3), // 0=rect, 1=triangle, 2=pennant
                confRot: Math.random() * Math.PI * 2,
            });
        }
    }
    // Update & render confetti particles with varied shapes
    for (let ci = deathParticles.length - 1; ci >= 0; ci--) {
        const p = deathParticles[ci];
        p.x += p.vx;
        p.y += p.vy;
        p.vx += (Math.random() - 0.5) * 0.05; // flutter
        p.life--;
        if (p.life <= 0) { deathParticles.splice(ci, 1); continue; }
        ctx.globalAlpha = Math.min(1, p.life / 20);
        const sz = p.sparkle && Math.sin(levelCelebrateTimer * 0.2 + ci) > 0 ? p.size * 1.5 : p.size;
        ctx.fillStyle = p.color;
        if (p.confShape === 1) {
            // Triangle
            ctx.beginPath();
            ctx.moveTo(p.x * SCALE, (p.y - sz) * SCALE);
            ctx.lineTo((p.x - sz) * SCALE, (p.y + sz) * SCALE);
            ctx.lineTo((p.x + sz) * SCALE, (p.y + sz) * SCALE);
            ctx.closePath();
            ctx.fill();
        } else if (p.confShape === 2) {
            // Pennant (tall narrow triangle)
            ctx.beginPath();
            ctx.moveTo(p.x * SCALE, (p.y - sz * 1.5) * SCALE);
            ctx.lineTo((p.x - sz * 0.5) * SCALE, (p.y + sz) * SCALE);
            ctx.lineTo((p.x + sz * 0.5) * SCALE, (p.y + sz) * SCALE);
            ctx.closePath();
            ctx.fill();
        } else {
            // Rectangle (wider than tall)
            drawRect(p.x - sz * 0.5, p.y, sz * 1.5, sz * 0.7, p.color);
        }
    }
    ctx.globalAlpha = 1.0;

    // Start marching snare after fanfare finishes (~2s = 180 frames at 90fps)
    if (levelCelebrateTimer === 180) {
        startStoryDrums();
    }

    // "PRESS ENTER" to continue
    if (levelCelebrateTimer > 120) {
        const blink = levelCelebrateTimer % 60 < 40;
        if (blink) {
            const pressText = "PRESS ENTER TO CONTINUE";
            ctx.textAlign = "center";
            ctx.font = `${5 * SCALE}px monospace`;
            ctx.fillStyle = "#efd8a1";
            ctx.fillText(pressText, (W * SCALE) / 2, (H - 12) * SCALE);
            ctx.textAlign = "start";
        }
    }
}

function renderGameOverScreen() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Handle hit freeze (dramatic pause at the start)
    if (hitFreeze > 0) {
        hitFreeze--;
        // During freeze, just render the frozen game world + shake
        render();

        if (screenShake > 0) screenShake--;
        return;
    }

    gameOverTimer++;

    // === TIMELINE ===
    // 0-75:    Screen fades to black (except player stays visible)
    // 75:      "well… shit." appears
    // 90:      Sad song starts
    // 90-690:  Song plays, everything slowly visible
    // 600-690: Player + text fade out
    // 690:     Auto-reset to title

    // Phase 1: Render frozen game world + fade to black around player
    if (gameOverTimer <= 150) {
        render(); // draw the frozen world
    }

    // Fade overlay — everything goes black except a spotlight on the player
    const fadeProgress = Math.min(1, gameOverTimer / 75); // 0→1 over ~1.25 seconds

    if (fadeProgress > 0) {
        // Full dark overlay
        ctx.fillStyle = "#000";
        ctx.globalAlpha = fadeProgress * 0.95;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;

        // Update player death animation
        if (playerDeathAnim.active) {
            const da = playerDeathAnim;
            // Phase 1 (frames 0-30): Player bounces and collapses
            if (da.collapseProgress < 1) {
                da.collapseProgress = Math.min(1, da.collapseProgress + 0.033); // ~30 frames
                // Bounce physics
                da.bounceY += da.bounceVel;
                da.bounceVel += 0.4; // gravity
                if (da.bounceY >= 0 && da.bounceVel > 0) {
                    da.bounceY = 0;
                    da.bounceCount++;
                    da.bounceVel = -da.bounceVel * 0.4; // dampen
                    if (Math.abs(da.bounceVel) < 0.5) da.bounceVel = 0;
                }
            }
            // Phase 2 (frames 30-150): Soul rises from body
            if (da.collapseProgress >= 0.5 && da.soulAlpha < 1) {
                da.soulAlpha = Math.min(1, da.soulAlpha + 0.04);
            }
            if (da.soulAlpha > 0) {
                da.soulY += 0.35;
                da.soulWobble += 0.08;
            }
            // Phase 3 (frames 150+): Soul fades away
            if (da.soulY > 40) {
                da.soulAlpha = Math.max(0, da.soulAlpha - 0.015);
                if (da.soulAlpha <= 0) da.active = false;
            }
            // Red flash
            if (da.flashTimer > 0) da.flashTimer--;
        }

        // Redraw the player on top of the darkness (spotlight effect)
        if (gameOverTimer < 600) {
            const playerAlpha = gameOverTimer >= 540 ? Math.max(0, 1 - (gameOverTimer - 540) / 150) : 1.0;
            ctx.globalAlpha = playerAlpha;

            const da = playerDeathAnim;
            const px = player.x;
            const py = player.y;
            const pw = player.w;
            const ph = player.h;

            // Draw collapsed player body (squish effect)
            const squish = da.collapseProgress;
            const scaleY = 1 - squish * 0.6; // squish to 40% height
            const scaleX = 1 + squish * 0.3;  // stretch wider
            const cx = (px + pw / 2) * SCALE;
            const baseY = (py + ph) * SCALE + da.bounceY * SCALE;
            ctx.save();
            ctx.translate(cx, baseY);
            ctx.scale(scaleX, scaleY);
            ctx.translate(-cx, -baseY);
            // Player shadow (wider as squished)
            drawRect(px + 2 - squish * 3, py + ph - 2, pw - 4 + squish * 6, 4, PAL.shadow);
            drawPlayer();
            ctx.restore();

            // Draw soul/ghost floating up from body
            if (da.soulAlpha > 0) {
                ctx.globalAlpha = playerAlpha * da.soulAlpha * 0.6;
                const wobbleX = Math.sin(da.soulWobble) * 3;
                const soulX = px + wobbleX;
                const soulY = py - da.soulY;
                // Ghost is a translucent white version of the player
                const ghostCx = (soulX + pw / 2) * SCALE;
                const ghostCy = (soulY + ph / 2) * SCALE;
                ctx.save();
                ctx.translate(ghostCx, ghostCy);
                // Slight stretch vertically for ghostly look
                ctx.scale(0.9, 1.1);
                ctx.translate(-ghostCx, -ghostCy);
                drawPlayerSprite(soulX, soulY, 0, 0, { isBlinking: false, ghostMode: true });
                ctx.restore();

                // Ghost trail particles
                if (gameOverTimer % 4 === 0 && da.soulAlpha > 0.2) {
                    deathParticles.push({
                        x: soulX + pw / 2 + (Math.random() - 0.5) * 8,
                        y: soulY + ph / 2 + Math.random() * 5,
                        vx: (Math.random() - 0.5) * 0.3,
                        vy: -0.2 - Math.random() * 0.3,
                        life: 20 + Math.random() * 15,
                        color: Math.random() > 0.5 ? "#aaddff" : "#ffffff",
                        size: 1 + Math.random() * 2,
                        sparkle: true,
                    });
                }
            }
            ctx.globalAlpha = 1.0;

            // Red flash overlay on initial impact
            if (da.flashTimer > 0) {
                ctx.fillStyle = "#FF00FF";
                ctx.globalAlpha = (da.flashTimer / 8) * 0.35;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalAlpha = 1.0;
            }
        }

        // Update & render death particles in game over
        for (let i = deathParticles.length - 1; i >= 0; i--) {
            const dp = deathParticles[i];
            dp.x += dp.vx;
            dp.y += dp.vy;
            if (dp.sparkle) dp.vx *= 0.98;
            dp.vy += 0.02; // very light gravity for ghost particles
            dp.life--;
            if (dp.life <= 0) { deathParticles.splice(i, 1); continue; }
            ctx.globalAlpha = Math.min(1, dp.life / 15);
            const sz = dp.sparkle && Math.sin(gameOverTimer * 0.2 + i) > 0 ? dp.size * 1.5 : dp.size;
            drawRect(dp.x, dp.y, sz, sz, dp.color);
        }
        ctx.globalAlpha = 1.0;
    }

    // Start sad song
    if (gameOverTimer >= 90 && !sadSongStarted) {
        sadSongStarted = true;
        ensureAudio();
        playSadSong();
    }

    // "well… shit." text — appears at frame 75, stays until fade
    if (gameOverTimer >= 75 && gameOverTimer < 600) {
        const textAlpha = gameOverTimer >= 540 ? Math.max(0, 1 - (gameOverTimer - 540) / 60) : Math.min(1, (gameOverTimer - 75) / 30);
        ctx.globalAlpha = textAlpha;
        const shitText = "ummmmm RUDE!";
        const shitW = shitText.length * 7;
        // Position below the player (offset by collapse)
        const textY = player.y + player.h + 20;
        drawText(shitText, W / 2 - shitW / 2 + 1, textY + 1, "#000000", 7);
        drawText(shitText, W / 2 - shitW / 2, textY, "#efb775", 7);
        ctx.globalAlpha = 1.0;
    }

    // Narrative context — goblins win (appears after "RUDE!" has sunk in)
    if (gameOverTimer >= 200 && gameOverTimer < 600) {
        const narAlpha = gameOverTimer < 230 ? (gameOverTimer - 200) / 30
            : gameOverTimer >= 540 ? Math.max(0, 1 - (gameOverTimer - 540) / 60) : 1;
        ctx.globalAlpha = narAlpha;
        const narText = "THE GOBLINS RECLAIMED THE STAGE.";
        const narW = narText.length * 5;
        const narY = player.y + player.h + 34;
        drawText(narText, W / 2 - narW / 2 + 1, narY + 1, "#000000", 5);
        drawText(narText, W / 2 - narW / 2, narY, "#39FF14", 5);
        ctx.globalAlpha = 1.0;
    }

    // Final full black
    if (gameOverTimer >= 600) {
        const finalAlpha = Math.min(1, (gameOverTimer - 600) / 60);
        ctx.fillStyle = "#000";
        ctx.globalAlpha = finalAlpha;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    // Auto-reset after ~11 seconds (660 frames at 60fps)
    if (gameOverTimer >= 690) {
        if (scoreQualifies(finalScore)) {
            enterHighScoreState();
        } else {
            resetGame();
            gameState = "title";
            startTitleDrums();
        }
    }
}

function renderSabotageAnim() {
    // Keep the drum sequencer playing during the scramble
    tickSequencer();

    sabotageAnimTimer++;
    const t = sabotageAnimTimer;

    // Determine which cell the goblin is "at"
    const cellIndex = Math.floor(t / SABOTAGE_FRAMES_PER_CELL);

    // Flip cells as the goblin passes them
    while (sabotageFlipIndex < sabotageCells.length && sabotageFlipIndex <= cellIndex) {
        const cell = sabotageCells[sabotageFlipIndex];
        if (cell.flip) {
            grid[cell.r][cell.c] = !grid[cell.r][cell.c];
            cellFlash[cell.r][cell.c] = 30;
            if (sabotageFlipIndex % 4 === 0) screenShake = 2;
        }
        sabotageFlipIndex++;
    }

    // Render the normal game board (grid reflects real-time flips)
    render();

    // Red alert overlay on edges during sabotage
    {
        const W_s = COLS * TILE * SCALE;
        const H_s = ROWS * TILE * SCALE;
        const alertPulse = 0.08 + Math.sin(t * 0.15) * 0.06;
        const grad_s = ctx.createRadialGradient(W_s / 2, H_s / 2, W_s * 0.35, W_s / 2, H_s / 2, W_s * 0.65);
        grad_s.addColorStop(0, "rgba(0,0,0,0)");
        grad_s.addColorStop(1, "#FF00FF");
        ctx.fillStyle = grad_s;
        ctx.globalAlpha = alertPulse;
        ctx.fillRect(0, 0, W_s, H_s);
        ctx.globalAlpha = 1.0;
    }

    // "SABOTAGE!" text flash at start
    if (t < 30) {
        const flashAlpha = 1 - t / 30;
        ctx.globalAlpha = flashAlpha;
        const W_s2 = COLS * TILE;
        ctx.font = `${12 * SCALE}px monospace`;
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.fillText("SABOTAGE!", (W_s2 * SCALE) / 2 + SCALE, (ROWS * TILE / 2) * SCALE + SCALE);
        ctx.fillStyle = "#FF00FF";
        ctx.fillText("SABOTAGE!", (W_s2 * SCALE) / 2, (ROWS * TILE / 2) * SCALE);
        ctx.textAlign = "start";
        ctx.globalAlpha = 1.0;
    }

    // Draw goblin sprite on top at current position with green trail
    if (cellIndex < sabotageCells.length) {
        const current = sabotageCells[Math.min(cellIndex, sabotageCells.length - 1)];
        const gx = (GRID_X + current.c) * TILE;
        const gy = rowPixelY(current.r);
        const frame = Math.floor(t / 6) % 4;
        const dir = current.r % 2 === 0 ? 3 : 2; // 3=right, 2=left

        // Green smoke trail behind goblin
        for (let trail = 1; trail <= 3; trail++) {
            const trailIdx = Math.max(0, sabotageFlipIndex - trail);
            if (trailIdx < sabotageCells.length) {
                const tc = sabotageCells[trailIdx];
                const tx = (GRID_X + tc.c) * TILE;
                const ty = rowPixelY(tc.r);
                ctx.fillStyle = "#39FF14";
                ctx.globalAlpha = (4 - trail) / 4 * 0.45;
                ctx.fillRect((tx + 2) * SCALE, (ty + 2) * SCALE, (TILE - 4) * SCALE, (TILE - 4) * SCALE);
            }
        }
        ctx.globalAlpha = 1.0;

        drawGoblinSprite("normal", gx, gy, frame, { dir: dir, showShadow: false });
    }

    // Animation complete — wait a brief pause then transition
    if (sabotageFlipIndex >= sabotageCells.length) {
        const endFrame = sabotageCells.length * SABOTAGE_FRAMES_PER_CELL;
        if (t > endFrame + 20) {
            if (sabotageNextState === "enemywarning-intro") {
                // Sound already played when setting up the warning
            }
            gameState = sabotageNextState;
        }
    }
}

function renderEnemyWarningIntro() {
    const INTRO_FRAMES = 50; // brief dramatic pause before warning screen
    enemyWarningIntroTimer++;
    const t = enemyWarningIntroTimer;
    const progress = Math.min(1, t / INTRO_FRAMES); // 0 to 1

    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background
    drawRect(0, 0, W, H, "#050805");

    // Dramatic flash effect — bright flash that fades
    if (progress < 0.4) {
        ctx.fillStyle = "#ef3a0c";
        ctx.globalAlpha = (1 - progress / 0.4) * 0.6;
        ctx.fillRect(0, 0, W * SCALE, H * SCALE);
        ctx.globalAlpha = 1;
    }

    // Auto-transition to the actual warning screen
    if (t >= INTRO_FRAMES) {
        gameState = "enemywarning";
        enemyWarningBlink = 0;
    }
}

function renderEnemyWarning() {
    enemyWarningBlink++;
    const t = enemyWarningBlink;
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background with threat color tint by enemy type
    drawRect(0, 0, W, H, "#050805");
    // Threat color tint — subtle background hue based on enemy type
    const threatCol = enemyWarningType === "normal" ? "#39FF14" : (enemyWarningType === "elite" ? "#FF00FF" : "#00FFFF");
    const threatPulse = 0.03 + Math.sin(t * 0.06) * 0.02;
    ctx.fillStyle = threatCol;
    ctx.globalAlpha = threatPulse;
    ctx.fillRect(0, 0, W * SCALE, H * SCALE);
    ctx.globalAlpha = 1.0;

    // Starfield
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(t * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#44ff44" : "#88cc88");
    }
    ctx.globalAlpha = 1;

    // Centered text helper (same as story/tutorial screens)
    function drawCenteredText(text, y, color, scale) {
        ctx.font = `${scale * SCALE}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    // Bobbing sprite offset
    const bobOffset = Math.round(Math.sin(t * 0.08) * 3);
    const gobFrame = Math.floor(t / 10) % 4;
    const gobBob = gobFrame % 2 === 1 ? 1 : 0;

    // Dramatic zoom-in on sprite: starts small, zooms to full size
    const zoomDuration = 30;
    const zoomProgress = Math.min(1, t / zoomDuration);
    // Overshoot easing for dramatic punch
    const zoomEase = zoomProgress < 1 ? 1 - Math.pow(1 - zoomProgress, 3) * (1 - 0.3 * Math.sin(zoomProgress * Math.PI)) : 1;
    const spriteScale = 0.2 + zoomEase * 0.8; // 0.2 → 1.0

    // Danger border effect — animated hazard stripes pulsing on edges
    const borderPulse = 0.3 + Math.sin(t * 0.1) * 0.2;
    const borderCol = enemyWarningType === "normal" ? "#39FF14" : (enemyWarningType === "elite" ? "#FF00FF" : "#00FFFF");
    const stripeW = 8; // stripe width in game pixels
    const borderThick = 4;
    const stripeOffset = (t * 0.5) % (stripeW * 2); // animation offset
    ctx.globalAlpha = borderPulse;
    // Top border hazard stripes
    for (let sx = -stripeW * 2; sx < W; sx += stripeW * 2) {
        drawRect(sx + stripeOffset, 0, stripeW, borderThick, borderCol);
    }
    // Bottom border hazard stripes
    for (let sx = -stripeW * 2; sx < W; sx += stripeW * 2) {
        drawRect(sx - stripeOffset + stripeW, H - borderThick, stripeW, borderThick, borderCol);
    }
    // Left border hazard stripes
    for (let sy = -stripeW * 2; sy < H; sy += stripeW * 2) {
        drawRect(0, sy + stripeOffset, borderThick, stripeW, borderCol);
    }
    // Right border hazard stripes
    for (let sy = -stripeW * 2; sy < H; sy += stripeW * 2) {
        drawRect(W - borderThick, sy - stripeOffset + stripeW, borderThick, stripeW, borderCol);
    }
    ctx.globalAlpha = 1.0;

    if (enemyWarningType === "normal") {
        drawCenteredText("WATCH OUT!", 30, "#39FF14", 8);
        drawCenteredText("GOBLINS!", 55, "#39FF14", 6);
        ctx.save();
        const cx_w = (W / 2) * SCALE;
        const cy_w = (80 + bobOffset + 8) * SCALE;
        ctx.translate(cx_w, cy_w);
        ctx.scale(spriteScale, spriteScale);
        ctx.translate(-cx_w, -cy_w);
        drawGoblinSprite("normal", W / 2 - 8, 80 + bobOffset, gobFrame, { showShadow: false });
        ctx.restore();
        drawCenteredText("THEY'LL SCRAMBLE YOUR BEATS THE MOMENT", 115, "#efb775", 5);
        drawCenteredText("YOUR BACK IS TURNED. DON'T LET THEM.", 132, "#efac28", 5);

    } else if (enemyWarningType === "elite") {
        drawCenteredText("WARNING!", 30, "#FF00FF", 8);
        drawCenteredText("ELITE GOBLIN", 55, "#FF44FF", 6);
        ctx.save();
        const cx_w = (W / 2) * SCALE;
        const cy_w = (80 + bobOffset + 8) * SCALE;
        ctx.translate(cx_w, cy_w);
        ctx.scale(spriteScale, spriteScale);
        ctx.translate(-cx_w, -cy_w);
        drawGoblinSprite("elite", W / 2 - 8, 80 + bobOffset, gobFrame, { showShadow: false });
        ctx.restore();
        drawCenteredText("BIGGER. MEANER. THIS ONE DOESN'T GO DOWN EASY.", 115, "#efb775", 5);
        drawCenteredText("THREE SOLID HITS TO PUT IT ON THE FLOOR.", 132, "#FF44FF", 5);
        drawCenteredText("AND IT'S FAST.", 149, "#efb775", 5);

    } else if (enemyWarningType === "catapult") {
        drawCenteredText("WARNING!", 30, "#FF00FF", 8);
        drawCenteredText("CATAPULT GOBLIN", 55, "#00FFFF", 6);
        ctx.save();
        const cx_w = (W / 2) * SCALE;
        const cy_w = (80 + bobOffset + 8) * SCALE;
        ctx.translate(cx_w, cy_w);
        ctx.scale(spriteScale, spriteScale);
        ctx.translate(-cx_w, -cy_w);
        drawGoblinSprite("catapult", W / 2 - 8, 80 + bobOffset, gobFrame, { showShadow: false });
        ctx.restore();
        drawCenteredText("THIS ONE FIGHTS DIRTY, HURLING BOULDERS", 115, "#efb775", 5);
        drawCenteredText("AT YOUR GRID FROM ACROSS THE ROOM.", 132, "#efb775", 5);
        drawCenteredText("YOU CAN'T KILL IT. BUT IT CAN SURE KILL YOU.", 149, "#FF00FF", 5);
    }

    // Blinking "PRESS ENTER TO CONTINUE"
    if (t > 60 && t % 60 < 40) {
        drawCenteredText("PRESS ENTER TO CONTINUE", H - 12, "#88cc88", 5);
    }

}

// ---- New Instrument Screen (full instruction style) ----
function renderNewInstrument() {
    newInstrumentTimer++;
    const t = newInstrumentTimer;
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background (same as tutorial)
    drawRect(0, 0, W, H, "#050805");

    // Starfield
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(t * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#44ff44" : "#88cc88");
    }
    ctx.globalAlpha = 1;

    function drawCenteredText(text, y, color, scale) {
        ctx.font = `${scale * SCALE}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    if (newInstrumentType === "cowbell") {
        // Title with entrance animation
        const titleAlpha = Math.min(1, t / 30);
        ctx.globalAlpha = titleAlpha;
        drawCenteredText("NEW INSTRUMENT!", 28, "#44ff44", 8);
        ctx.globalAlpha = 1;

        // Instrument name
        const nameAlpha = Math.min(1, Math.max(0, (t - 15) / 30));
        ctx.globalAlpha = nameAlpha;
        drawCenteredText("COWBELL", 52, "#ef3a0c", 7);
        ctx.globalAlpha = 1;

        // Animated cowbell icon — larger, centered
        if (t > 20) {
            const iconAlpha = Math.min(1, (t - 20) / 20);
            ctx.globalAlpha = iconAlpha;
            const cx = (W * SCALE) / 2;
            const cy = 88 * SCALE;
            const bob = Math.sin(t * 0.1) * 3 * SCALE;
            const swing = Math.sin(t * 0.12) * 0.15;
            ctx.save();
            ctx.translate(cx, cy + bob);
            ctx.rotate(swing);
            // Bell body (trapezoid) — bigger
            ctx.fillStyle = "#ef3a0c";
            ctx.beginPath();
            ctx.moveTo(-12 * SCALE, -9 * SCALE);
            ctx.lineTo(12 * SCALE, -9 * SCALE);
            ctx.lineTo(15 * SCALE, 9 * SCALE);
            ctx.lineTo(-15 * SCALE, 9 * SCALE);
            ctx.closePath();
            ctx.fill();
            // Highlight stripe
            ctx.fillStyle = "#efb775";
            ctx.fillRect(-9 * SCALE, -6 * SCALE, 18 * SCALE, 3 * SCALE);
            // Handle on top
            ctx.fillStyle = "#efd8a1";
            ctx.fillRect(-4 * SCALE, -15 * SCALE, 8 * SCALE, 6 * SCALE);
            // Clapper at bottom
            ctx.fillStyle = "#efd8a1";
            ctx.beginPath();
            ctx.arc(0, 12 * SCALE, 3 * SCALE, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
        }

        // Description text with staggered reveal
        if (t > 40) {
            const descAlpha = Math.min(1, (t - 40) / 30);
            ctx.globalAlpha = descAlpha;
            drawCenteredText("A NEW VOICE JOINS THE MIX.", 135, "#efb775", 5);
            ctx.globalAlpha = 1;
        }
        if (t > 55) {
            const desc2Alpha = Math.min(1, (t - 55) / 30);
            ctx.globalAlpha = desc2Alpha;
            drawCenteredText("THE GROOVE GROWS DEEPER.", 155, "#ef3a0c", 5);
            drawCenteredText("FILL IN THE COWBELL PATTERN TO MAKE IT SING.", 170, "#ef3a0c", 5);
            ctx.globalAlpha = 1;
        }

        // Mini sequencer demo strip (cowbell pattern preview)
        if (t > 60) {
            const stripAlpha = Math.min(1, (t - 60) / 20);
            ctx.globalAlpha = stripAlpha;
            const stripY = 198;
            const stripX = W / 2 - 8 * (TILE / 2);
            const cellW = TILE / 2;
            const cowbellPattern = [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0]; // typical cowbell pattern
            const demoStep = Math.floor(t / 6) % 16;
            for (let c = 0; c < 16; c++) {
                const cx_s = stripX + c * cellW;
                drawRect(cx_s, stripY, cellW, cellW, PAL.gridBorder);
                drawRect(cx_s + 1, stripY + 1, cellW - 2, cellW - 2,
                    cowbellPattern[c] ? "#ef3a0c" : PAL.gridOff);
                // Playhead
                if (c === demoStep) {
                    ctx.fillStyle = "#efac28";
                    ctx.globalAlpha = stripAlpha * 0.4;
                    ctx.fillRect(cx_s * SCALE, stripY * SCALE, cellW * SCALE, cellW * SCALE);
                    ctx.globalAlpha = stripAlpha;
                }
            }
            // Row label
            drawText("B", stripX - 8, stripY + 6, "#ef3a0c", 4);
            ctx.globalAlpha = 1;
        }

    } else if (newInstrumentType === "tom") {
        // Title with entrance animation
        const titleAlpha = Math.min(1, t / 30);
        ctx.globalAlpha = titleAlpha;
        drawCenteredText("NEW INSTRUMENT!", 28, "#44ff44", 8);
        ctx.globalAlpha = 1;

        // Instrument name
        const nameAlpha = Math.min(1, Math.max(0, (t - 15) / 30));
        ctx.globalAlpha = nameAlpha;
        drawCenteredText("TOM DRUM", 52, "#3c9f9c", 7);
        ctx.globalAlpha = 1;

        // Animated tom drum icon — larger, centered
        if (t > 20) {
            const iconAlpha = Math.min(1, (t - 20) / 20);
            ctx.globalAlpha = iconAlpha;
            const cx = (W * SCALE) / 2;
            const cy = 88 * SCALE;
            const bob = Math.sin(t * 0.1) * 3 * SCALE;
            const hitFlash = (t % 30 < 5 && t > 50) ? 1 : 0;
            ctx.save();
            ctx.translate(cx, cy + bob);
            // Drum body — bigger
            ctx.fillStyle = hitFlash ? "#efac28" : "#3c9f9c";
            ctx.fillRect(-15 * SCALE, -6 * SCALE, 30 * SCALE, 18 * SCALE);
            // Drum head (top ellipse)
            ctx.fillStyle = hitFlash ? "#FFFFFF" : "#efd8a1";
            ctx.beginPath();
            ctx.ellipse(0, -6 * SCALE, 15 * SCALE, 6 * SCALE, 0, 0, Math.PI * 2);
            ctx.fill();
            // Drum bottom rim
            ctx.fillStyle = "#276468";
            ctx.beginPath();
            ctx.ellipse(0, 12 * SCALE, 15 * SCALE, 6 * SCALE, 0, 0, Math.PI);
            ctx.fill();
            // Side stripes
            ctx.fillStyle = "#276468";
            ctx.fillRect(-15 * SCALE, -6 * SCALE, 3 * SCALE, 18 * SCALE);
            ctx.fillRect(12 * SCALE, -6 * SCALE, 3 * SCALE, 18 * SCALE);
            ctx.restore();
            ctx.globalAlpha = 1;
        }

        // Description text with staggered reveal
        if (t > 40) {
            const descAlpha = Math.min(1, (t - 40) / 30);
            ctx.globalAlpha = descAlpha;
            drawCenteredText("THE RHYTHM IS GETTING RICHER.", 135, "#efb775", 5);
            ctx.globalAlpha = 1;
        }
        if (t > 55) {
            const desc2Alpha = Math.min(1, (t - 55) / 30);
            ctx.globalAlpha = desc2Alpha;
            drawCenteredText("THE UNDERGROUND IS WAKING UP.", 155, "#3c9f9c", 5);
            drawCenteredText("EVEN MORE BEATS TO MASTER.", 170, "#3c9f9c", 5);
            ctx.globalAlpha = 1;
        }

        // Mini sequencer demo strip (tom pattern preview)
        if (t > 60) {
            const stripAlpha = Math.min(1, (t - 60) / 20);
            ctx.globalAlpha = stripAlpha;
            const stripY = 198;
            const stripX = W / 2 - 8 * (TILE / 2);
            const cellW = TILE / 2;
            const tomPattern = [0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0]; // typical tom fill
            const demoStep = Math.floor(t / 6) % 16;
            for (let c = 0; c < 16; c++) {
                const cx_s = stripX + c * cellW;
                drawRect(cx_s, stripY, cellW, cellW, PAL.gridBorder);
                drawRect(cx_s + 1, stripY + 1, cellW - 2, cellW - 2,
                    tomPattern[c] ? "#3c9f9c" : PAL.gridOff);
                if (c === demoStep) {
                    ctx.fillStyle = "#efac28";
                    ctx.globalAlpha = stripAlpha * 0.4;
                    ctx.fillRect(cx_s * SCALE, stripY * SCALE, cellW * SCALE, cellW * SCALE);
                    ctx.globalAlpha = stripAlpha;
                }
            }
            drawText("T", stripX - 8, stripY + 6, "#3c9f9c", 4);
            ctx.globalAlpha = 1;
        }
    }

    // Blinking "PRESS ENTER TO CONTINUE"
    if (t > 80 && t % 60 < 40) {
        drawCenteredText("PRESS ENTER TO CONTINUE", H - 12, "#88cc88", 5);
    }
}

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    frameAccum += dt;
    // Cap accumulated time to prevent spiral (max 3 catch-up frames)
    if (frameAccum > FRAME_MS * 3) frameAccum = FRAME_MS * 3;
    while (frameAccum >= FRAME_MS) {
        frameAccum -= FRAME_MS;
        try {
            // Clear HUD canvas when not in gameplay
            if (gameState !== "playing") {
                hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
                // DEV: Show scene label in HUD during intro (remove before launch)
                if (gameState === "intro" || gameState === "title") {
                    const sceneLabels = [
                        "Scene 0: The Good Times",
                        "Scene 1: Earthquake + Caves",
                        "Scene 2: Goblin Attack",
                        "Scene 3: Call to Action",
                    ];
                    const label = gameState === "title"
                        ? "Title Screen"
                        : (sceneLabels[introScene] || "Scene " + introScene);
                    hudCtx.font = `${3 * SCALE}px monospace`;
                    hudCtx.fillStyle = "#efac28";
                    hudCtx.textAlign = "center";
                    hudCtx.fillText(label, hudCanvas.width / 2, 10 * SCALE);
                    hudCtx.textAlign = "start";
                }
            }
            if (gameState === "title") {
                renderTitleScreen();
            } else if (gameState === "intro") {
                renderIntro();
            } else if (gameState === "enemywarning-intro") {
                renderEnemyWarningIntro();
            } else if (gameState === "enemywarning") {
                renderEnemyWarning();
            } else if (gameState === "newinstrument") {
                renderNewInstrument();
            } else if (gameState === "sabotage-anim") {
                renderSabotageAnim();
            } else if (gameState === "cave-return") {
                updateCaveReturn();
                renderCaveReturn();
            } else if (gameState === "levelcomplete") {
                renderLevelComplete();
            } else if (gameState === "minigame") {
                if (minigameState === "kidnap") {
                    updateMinigameKidnap();
                    renderMinigameKidnap();
                } else if (minigameState === "boarding") {
                    updateMinigameBoarding();
                    renderMinigameBoarding();
                } else if (minigameState === "playing") {
                    updateMinigameArena();
                    renderMinigameArena();
                    spaceJustPressed = false;
                } else if (minigameState === "rescue") {
                    updateMinigameRescue();
                    renderMinigameRescue();
                } else if (minigameState === "reward") {
                    updateMinigameReward();
                    renderMinigameReward();
                }
            } else if (gameState === "ending") {
                updateEnding();
                renderEnding();
            } else if (gameState === "gameover") {
                renderGameOverScreen();
            } else if (gameState === "highscore") {
                renderHighScoreEntry();
            } else if (gameState === "paused") {
                // Render the frozen game frame + pause overlay
                if (pausedFromState === "minigame") {
                    renderMinigameArena();
                } else {
                    render();
                }
                // Dark overlay
                const W_p = COLS * TILE * SCALE;
                const H_p = ROWS * TILE * SCALE;
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(0, 0, W_p, H_p);
                // "PAUSED" text
                ctx.font = `${10 * SCALE}px monospace`;
                ctx.textAlign = "center";
                ctx.fillStyle = "#000000";
                ctx.fillText("PAUSED", W_p / 2 + 2 * SCALE, H_p / 2 - 6 * SCALE);
                ctx.fillStyle = "#efac28";
                ctx.fillText("PAUSED", W_p / 2, H_p / 2 - 8 * SCALE);
                // Subtitle
                ctx.font = `${4 * SCALE}px monospace`;
                ctx.fillStyle = "#efd8a1";
                ctx.fillText("PRESS ESC TO RESUME", W_p / 2, H_p / 2 + 6 * SCALE);
                ctx.textAlign = "start";
            } else {
                update(dt);
                render();
            }
            // Scene transition overlay
            if (sceneTransition.active) {
                sceneTransition.progress += 1 / sceneTransition.duration;
                if (sceneTransition.progress >= 1) {
                    sceneTransition.active = false;
                    sceneTransition.progress = 0;
                } else {
                    const W_t = COLS * TILE * SCALE;
                    const H_t = ROWS * TILE * SCALE;
                    if (sceneTransition.from === "title" && sceneTransition.to === "intro") {
                        // Quick fade for title→intro (same visual scene, iris wipe looks wrong)
                        const fadeAlpha = sceneTransition.progress < 0.5
                            ? sceneTransition.progress * 2   // fade to black
                            : (1 - sceneTransition.progress) * 2; // fade from black
                        ctx.save();
                        ctx.fillStyle = "#000";
                        ctx.globalAlpha = fadeAlpha;
                        ctx.fillRect(0, 0, W_t, H_t);
                        ctx.globalAlpha = 1;
                        ctx.restore();
                    } else {
                        // Iris-in effect: circle expands from center revealing new scene
                        const maxRadius = Math.sqrt(W_t * W_t + H_t * H_t) / 2;
                        const radius = sceneTransition.progress * maxRadius;
                        ctx.save();
                        ctx.fillStyle = "#000";
                        ctx.beginPath();
                        ctx.rect(0, 0, W_t, H_t);
                        ctx.arc(W_t / 2, H_t / 2, radius, 0, Math.PI * 2, true);
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
        } catch (e) {
            console.error("Game loop error:", e);
        }
    }
    requestAnimationFrame(gameLoop);
}

loadHighScores();
function startGame() { requestAnimationFrame(gameLoop); }
if (assetsReady) startGame(); // if assets loaded before we got here
