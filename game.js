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
const GRID_Y = 4;          // grid start tile-y
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
ctx.imageSmoothingEnabled = false;

// ---- HUD canvas (below game canvas) ----
const hudCanvas = document.getElementById("hud");
const hudCtx = hudCanvas.getContext("2d");
const HUD_H = 2 * TILE; // logical height for HUD strip
hudCanvas.width = COLS * TILE * SCALE;
hudCanvas.height = HUD_H * SCALE;
hudCtx.imageSmoothingEnabled = false;

// ---- Colors (earthy dungeon palette) ----
// #efd8a1 Pale Cream, #efac28 Amber Gold, #efb775 Peach Buff
// #276468 Dark Teal, #ab5c1c Burnt Sienna, #927e6a Warm Khaki
const PAL = {
    bg:        "#2a1d0d",
    wall:      "#392a1c",
    wallTop:   "#45230d",
    floor:     "#300f0a",
    floorAlt:  "#36170c",
    gridOff:   "#45230d",
    gridOn:    ["#efd8a1", "#efac28", "#ef692f", "#276468", "#ef3a0c", "#3c9f9c"], // per-row colors (O,H,S,K,B,T)
    gridX:     ["#ef3a0c", "#550f0a", "#efd8a1", "#efac28", "#efd8a1", "#ef3a0c"], // bright X indicators visible on colored blocks
    gridBorder:"#684c3c",
    playhead:  "#efac28",
    player:    "#efd8a1",
    playerDark:"#927e6a",
    punch:     "#efac28",
    punchGlow: "#ab5c1c",
    shadow:    "rgba(0,0,0,0.3)",
    startBtn:  "#efb775",
    stopBtn:   "#9b1a0a",
    labelText: "#efd8a1",
    titleText: "#efd8a1",
};

const DRUM_LABELS = ["OPEN-HH", "HI-HAT", "SNARE", "KICK"];

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
    { body: "#ef3a0c", dark: "#9b1a0a", head: "#efb775", hair: "#724113" },
    { body: "#3c9f9c", dark: "#276468", head: "#efb775", hair: "#2a1d0d" },
    { body: "#efac28", dark: "#a58c27", head: "#efb775", hair: "#ab5c1c" },
    { body: "#39571c", dark: "#1f240a", head: "#efb775", hair: "#efac28" },
    { body: "#ab5c1c", dark: "#773421", head: "#efb775", hair: "#2a1d0d" },
    { body: "#ef692f", dark: "#a56243", head: "#efb775", hair: "#392a1c" },
];

// ---- Player State ----
const player = {
    x: (GRID_X + 7) * TILE,   // current position (smooth, pixel-level)
    y: (GRID_Y + LEVELS[0].activeRows + 1) * TILE,
    destX: (GRID_X + 7) * TILE, // movement destination
    destY: (GRID_Y + LEVELS[0].activeRows + 1) * TILE,
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

let gamePaused = false;
let gameState = "title"; // "title", "story", "playing", "gameover", "highscore", "levelcomplete", "enemywarning-intro", "enemywarning", "newinstrument", "sabotage-anim"
let enemyWarningType = null;   // "elite" or "catapult"
let enemyWarningShown = { normal: false, elite: false, catapult: false }; // track which warnings have been shown
let enemyWarningBlink = 0;     // blink timer for "PRESS ENTER"
let enemyWarningIntroTimer = 0; // transition timer before warning popup
let currentLevel = 0;
let levelTimer = LEVELS[0].timerSeconds * 90; // countdown in frames (seconds * 90)
let levelComplete = false;
let patternMatched = false; // pattern correct but goblins may still be alive
let levelCelebrateTimer = 0;
let titleBlink = 0; // blink timer for "PRESS ENTER"
let tutorialTimer = 0; // animation frame counter for tutorial screen
let tutorialPage = 0;  // current tutorial page (0-1)
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

    // Enemy warning screens
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
window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        e.preventDefault();
        if (gameState === "enemywarning" || gameState === "enemywarning-intro") return; // ignore Space on warning screen
        if (gameState === "newinstrument") return; // ignore Space on instrument screen
        if (gameState === "sabotage-anim") return; // ignore input during sabotage animation
        if (!keys[e.code]) spaceJustPressed = true; // only on initial press
    }
    keys[e.code] = true;

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

    if (e.code === "Enter") {
        e.preventDefault();
        if (gameState === "sabotage-anim") return; // ignore input during sabotage animation
        if (gameState === "enemywarning") {
            // Check if there's another warning or instrument screen queued
            if (checkPendingFeatureScreens()) return;
            advanceLevel();
            return;
        }
        if (gameState === "newinstrument") {
            // Check if there's an enemy warning queued for the next level
            if (checkPendingFeatureScreens()) return;
            advanceLevel();
            return;
        }
        if (gameState === "title") {
            ensureAudio();
            stopTitleDrums();
            gameState = "story";
            storyBlink = 0;
            startStoryDrums();
            return;
        }
        if (gameState === "story") {
            gameState = "tutorial";
            tutorialTimer = 0;
            tutorialPage = 0;
            return;
        }
        if (gameState === "tutorial") {
            tutorialPage++;
            tutorialTimer = 0;
            if (tutorialPage > 1) {
                stopStoryDrums();
                gameState = "playing";
                currentStep = 0;
                lastStepTime = performance.now();
            }
            return;
        }
        if (gameState === "levelcomplete" && levelCelebrateTimer > 120) {
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
        ensureAudio();
        gamePaused = !gamePaused;
        // Reset sequencer timing so it doesn't fast-forward on unpause
        if (!gamePaused) lastStepTime = performance.now();
        // Pause/unpause sound
        if (audioCtx) {
            const now = audioCtx.currentTime;
            if (gamePaused) {
                // Descending two-tone "pause" chime
                const o1 = audioCtx.createOscillator();
                const g1 = audioCtx.createGain();
                o1.type = "square";
                o1.frequency.setValueAtTime(440, now);
                g1.gain.setValueAtTime(0.1, now);
                g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                o1.connect(g1); g1.connect(audioCtx.destination);
                o1.start(now); o1.stop(now + 0.15);
                const o2 = audioCtx.createOscillator();
                const g2 = audioCtx.createGain();
                o2.type = "square";
                o2.frequency.setValueAtTime(330, now + 0.12);
                g2.gain.setValueAtTime(0.1, now + 0.12);
                g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                o2.connect(g2); g2.connect(audioCtx.destination);
                o2.start(now + 0.12); o2.stop(now + 0.3);
            } else {
                // Ascending two-tone "unpause" chime
                const o1 = audioCtx.createOscillator();
                const g1 = audioCtx.createGain();
                o1.type = "square";
                o1.frequency.setValueAtTime(330, now);
                g1.gain.setValueAtTime(0.1, now);
                g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                o1.connect(g1); g1.connect(audioCtx.destination);
                o1.start(now); o1.stop(now + 0.15);
                const o2 = audioCtx.createOscillator();
                const g2 = audioCtx.createGain();
                o2.type = "square";
                o2.frequency.setValueAtTime(440, now + 0.12);
                g2.gain.setValueAtTime(0.1, now + 0.12);
                g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                o2.connect(g2); g2.connect(audioCtx.destination);
                o2.start(now + 0.12); o2.stop(now + 0.3);
            }
        }
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
    return (GRID_Y + r) * TILE;
}

// ---- Helper: tile Y of the bottom of the active grid ----
function gridBottomTileY() {
    return GRID_Y + getActiveRows();
}

// ---- Helper: convert tile Y back to grid row (inverse of rowPixelY) ----
function tileYToRow(tileY) {
    return tileY - GRID_Y;
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
                    if (grid[r][currentStep]) drumFns[r](t);
                }
            }
            currentStep = (currentStep + 1) % GRID_COLS;
        }
    }
}

// ---- Update ----
function update(dt) {
    if (gamePaused) return;

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

    // Attack (single press only)
    if (spaceJustPressed && !p.attacking) {
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
        if (row >= 0 && row < getActiveRows() && col >= 0 && col < GRID_COLS) {
            grid[row][col] = !grid[row][col];
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


        // Check goblin hit using punch hitbox vs goblin bounding box
        const punchBox = getPunchBox();
        for (const hitGob of goblins) {
            const gobBox = { x: hitGob.x, y: hitGob.y, w: hitGob.w, h: hitGob.h };
            if (!hitGob.dead && aabb(punchBox, gobBox)) {
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
                    if (killCount % 3 === 0) {
                        spawnDancers(3);
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
    }
    spaceJustPressed = false;

    if (p.attacking) {
        p.attackTimer--;
        if (p.attackTimer <= 0) p.attacking = false;
    }

    // Movement (smooth pixel-by-pixel, destination-based)
    const atDest = Math.abs(p.x - p.destX) < 0.5 && Math.abs(p.y - p.destY) < 0.5;

    if (atDest && !p.attacking) {
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
                p.turnDelay = 10;
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

    // Move toward destination smoothly
    if (!atDest) {
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
        // No goblins on practice levels (1-2)
        if (currentLevel < 2) {
            gob.respawnTimer = 300;
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
            const burstCount = wasElite ? 4 : 2;
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
            const particleCount = wasElite ? 35 : 15;
            const spreadMul = wasElite ? 3 : 2;
            for (let i = 0; i < particleCount; i++) {
                const isSparkle = wasElite && Math.random() > 0.5;
                deathParticles.push({
                    x: gob.x + gob.w / 2,
                    y: gob.y + gob.h / 2,
                    vx: (Math.random() - 0.5) * spreadMul,
                    vy: (Math.random() - 0.5) * spreadMul - 1,
                    life: wasElite ? 50 + Math.random() * 50 : 30 + Math.random() * 30,
                    color: wasElite
                        ? (isSparkle ? "#00FFFF" : Math.random() > 0.3 ? "#FF00FF" : "#FF44FF")
                        : (Math.random() > 0.3 ? "#39FF14" : "#00CC00"),
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
    player.y = (GRID_Y + LEVELS[0].activeRows + 1) * TILE;
    player.destX = player.x;
    player.destY = player.y;
    player.dir = 0;
    player.turnDelay = 0;
    player.frame = 0;
    player.attacking = false;
    player.attackTimer = 0;
    player.punchHit = false;
    player.blinkTimer = 0;

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
    playerDeathAnim.active = false;
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

function triggerLevelComplete() {
    levelComplete = true;
    levelCelebrateTimer = 0;
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

function advanceLevel() {
    currentLevel++;
    if (currentLevel >= LEVELS.length) {
        // Player beat all levels — victory!
        finalScore = score;
        if (scoreQualifies(finalScore)) {
            enterHighScoreState();
        } else {
            resetGame();
            gameState = "title";
            startTitleDrums();
        }
        return;
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
    player.y = (gridBottomTileY() + 1) * TILE;
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

            // Check if player is in the 3x3 impact zone — GAME OVER
            const pGridCol = Math.round(player.x / TILE) - GRID_X;
            const pGridRow = tileYToRow(Math.round(player.y / TILE));
            if (pGridCol >= cc - 1 && pGridCol <= cc + 1 && pGridRow >= cr - 1 && pGridRow <= cr + 1) {
                // Player crushed by boulder!
                triggerGameOver();
                return;
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
            } else {
                // Survived the full catapult barrage — earn some fans!
                spawnDancers(2);
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

// ---- HUD Render (separate canvas below game) ----
function renderHUD() {
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    // Background fill
    drawHudRect(0, 0, COLS * TILE, HUD_H, "#2a1d0d");

    const pxSz = 3;
    const digitW = 3 * pxSz + pxSz;
    const panelH = 5 * pxSz + 6;
    const panelGap = 4;

    const kcY = Math.floor((HUD_H - panelH) / 2);
    const baseX = 1 * TILE;

    // --- Level counter ---
    const iconW = 3 * pxSz + 2;
    const lvlStr = String(currentLevel + 1);
    const lvlPanelW = iconW + lvlStr.length * digitW + 6;
    drawHudRect(baseX - 2, kcY - 2, lvlPanelW + 4, panelH + 4, "#2a1d0d");
    drawHudRect(baseX, kcY, lvlPanelW, panelH, "#392a1c");
    drawHudRect(baseX, kcY, lvlPanelW, 1, "#684c3c");
    // "L" icon
    const fx = baseX + 2, fy = kcY + 3;
    drawHudRect(fx, fy, pxSz, 5 * pxSz, "#efd8a1");
    drawHudRect(fx + pxSz, fy + 4 * pxSz, 2 * pxSz, pxSz, "#efd8a1");
    // Level digits
    const lvlNumX = baseX + iconW;
    const numY = kcY + 3;
    drawHudPixelDigits(lvlStr, lvlNumX + (lvlStr.length * digitW) / 2, numY, "#efd8a1", pxSz);

    // --- Score counter ---
    const kcX = baseX + lvlPanelW + panelGap;
    const scoreStr = String(score).padStart(7, "0");
    const skullW = 5 * pxSz + 2;
    const killPanelW = skullW + 7 * digitW + 6;
    drawHudRect(kcX - 2, kcY - 2, killPanelW + 4, panelH + 4, "#2a1d0d");
    drawHudRect(kcX, kcY, killPanelW, panelH, "#392a1c");
    drawHudRect(kcX, kcY, killPanelW, 1, "#684c3c");
    // Skull icon
    const sx = kcX + 2, sy = kcY + 3;
    const p = pxSz;
    const skullBg = "#392a1c";
    drawHudRect(sx + p, sy, 3 * p, p, "#efd8a1");
    drawHudRect(sx, sy + p, 5 * p, 2 * p, "#efd8a1");
    drawHudRect(sx + p, sy + 3 * p, 3 * p, p, "#efd8a1");
    drawHudRect(sx + p, sy + 4 * p, p, p, "#efd8a1");
    drawHudRect(sx + 3 * p, sy + 4 * p, p, p, "#efd8a1");
    drawHudRect(sx + p, sy + p, p, p, skullBg);
    drawHudRect(sx + 3 * p, sy + p, p, p, skullBg);
    drawHudRect(sx + 2 * p, sy + 2 * p, p, p, skullBg);
    drawHudRect(sx + 2 * p, sy + 4 * p, p, p, skullBg);
    // Score digits
    const killNumX = kcX + skullW;
    drawHudPixelDigits(scoreStr, killNumX + (scoreStr.length * digitW) / 2, numY, "#efd8a1", pxSz);

    // --- Timer counter ---
    const timerSec = Math.max(0, Math.ceil(levelTimer / 90));
    const timerStr = timerSec < 10 ? "0" + timerSec : String(timerSec);
    const timerX = kcX + killPanelW + panelGap;
    const timerPanelW = iconW + timerStr.length * digitW + 6;
    const isUrgent = timerSec <= 30;
    const isCritical = timerSec <= 10;
    const blinkRate = isCritical ? 15 : 30;
    const blinkOn = !isUrgent || Math.floor(levelTimer / blinkRate) % 2 === 0;
    const timerColor = isUrgent ? "#ef3a0c" : "#efd8a1";
    const timerBorderColor = isUrgent ? "#550f0a" : "#2a1d0d";
    const timerBgColor = isUrgent ? "#45230d" : "#392a1c";
    const timerHighlight = isUrgent ? "#9b1a0a" : "#684c3c";
    drawHudRect(timerX - 2, kcY - 2, timerPanelW + 4, panelH + 4, timerBorderColor);
    drawHudRect(timerX, kcY, timerPanelW, panelH, timerBgColor);
    drawHudRect(timerX, kcY, timerPanelW, 1, timerHighlight);
    // "T" icon
    const tx2 = timerX + 2, ty2 = kcY + 3;
    drawHudRect(tx2, ty2, 3 * pxSz, pxSz, blinkOn ? timerColor : timerBgColor);
    drawHudRect(tx2 + pxSz, ty2 + pxSz, pxSz, 4 * pxSz, blinkOn ? timerColor : timerBgColor);
    // Timer digits
    if (blinkOn) {
        const tNumX = timerX + iconW;
        drawHudPixelDigits(timerStr, tNumX + (timerStr.length * digitW) / 2, numY, timerColor, pxSz);
    }

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

    // Clear
    drawRect(0, 0, COLS * TILE, ROWS * TILE, PAL.bg);

    // Solid floor — charcoal
    drawRect(0, 0, COLS * TILE, ROWS * TILE, "#2C2C2A");
    // Subtle noise/grain texture
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let seed = r * 1000 + c * 37;
            for (let i = 0; i < 10; i++) {
                seed = (seed * 9301 + 49297) % 233280;
                const gx = (seed % TILE);
                seed = (seed * 9301 + 49297) % 233280;
                const gy = (seed % (TILE - 1));
                seed = (seed * 9301 + 49297) % 233280;
                const bright = seed / 233280 > 0.5;
                const grainCol = bright ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.10)";
                drawRect(c * TILE + gx, r * TILE + gy, 1, 1, grainCol);
            }
        }
    }

    // Tent-style walls — striped top border (red/cream carnival stripes)
    for (let c = 0; c < COLS; c++) {
        const stripe = c % 2 === 0 ? "#724113" : "#927e6a";
        drawRect(c * TILE, 0, TILE, TILE, stripe);

        // Bottom wall — ticket booth style
        drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, c % 2 === 0 ? "#2e4a4e" : "#384f54");
    }
    // Side walls — booth posts
    for (let r = 0; r < ROWS; r++) {
        drawRect(0, r * TILE, TILE, TILE, r % 2 === 0 ? "#2e4a4e" : "#384f54");
        drawRect((COLS - 1) * TILE, r * TILE, TILE, TILE, r % 2 === 0 ? "#2e4a4e" : "#384f54");
        // Post highlight
        drawRect(2, r * TILE, 2, TILE, "rgba(255,255,255,0.1)");
        drawRect((COLS - 1) * TILE + 2, r * TILE, 2, TILE, "rgba(255,255,255,0.1)");
    }

    // Cave openings (goblin spawn points)
    for (let ci = 0; ci < CAVES.length; ci++) {
        const cave = CAVES[ci];
        const cx = cave.tileX * TILE;
        const cy = cave.tileY * TILE;
        // Dark cave hole
        drawRect(cx, cy - 2, TILE, TILE + 4, "#2a1d0d");
        // Rocky arch around cave
        drawRect(cx - 2, cy - 4, TILE + 4, 3, "#684c3c");  // top rocks
        drawRect(cx - 2, cy + TILE + 1, TILE + 4, 3, "#684c3c");  // bottom rocks
        if (cave.tileX > 0) drawRect(cx - 3, cy - 2, 3, TILE + 4, "#45230d"); // left edge
        if (cave.tileX < COLS - 1) drawRect(cx + TILE, cy - 2, 3, TILE + 4, "#45230d"); // right edge
        // Stalactites
        drawRect(cx + 3, cy - 2, 2, 4, "#724113");
        drawRect(cx + 9, cy - 2, 2, 3, "#724113");
        // Stalagmites
        drawRect(cx + 5, cy + TILE - 2, 2, 4, "#724113");
        drawRect(cx + 11, cy + TILE - 1, 2, 3, "#724113");
        // Eye gleam inside cave (if any goblin is about to respawn from this cave)
        for (const g of goblins) {
            if (g.dead && g.respawnTimer < 90 && g.respawnTimer < 60 && ci === g.spawnCave) {
                const caveEyeCol = g.elite ? "#00FFFF" : "#FF00FF";
                drawRect(cx + 5, cy + 5, 2, 2, caveEyeCol);
                drawRect(cx + 9, cy + 5, 2, 2, caveEyeCol);
                break; // only show one pair of eyes per cave
            }
        }
    }

    // Carnival string lights along top (skip cave entrance column)
    const topCaveCol = Math.floor(COLS / 2);
    for (let c = 1; c < COLS - 1; c++) {
        if (c === topCaveCol) continue;
        const bulbY = TILE + 6;
        const bulbX = c * TILE + TILE / 2;
        // Bulb
        const bulbColors = ["#efac28", "#ef692f", "#3c9f9c", "#ef3a0c"];
        const bulbCol = bulbColors[c % bulbColors.length];
        drawRect(bulbX - 2, bulbY, 4, 4, bulbCol);
        // Glow
        ctx.fillStyle = bulbCol;
        ctx.globalAlpha = 0.15;
        ctx.fillRect((bulbX - 4) * SCALE, (bulbY - 2) * SCALE, 8 * SCALE, 8 * SCALE);
        ctx.globalAlpha = 1.0;
    }

    // Banner lights along bottom wall
    for (let c = 1; c < COLS - 1; c++) {
        const lx = c * TILE + TILE / 2;
        const ly = (ROWS - 1) * TILE + 2;
        const bulbColors2 = ["#efac28", "#ef692f", "#3c9f9c", "#ef3a0c"];
        drawRect(lx - 1, ly, 3, 3, bulbColors2[(c + 2) % bulbColors2.length]);
    }

    // Row labels (O, H, S, K, B, T) in the column just left of the first beat block
    const ROW_LETTERS = ["O", "H", "S", "K", "B", "T"];
    const ar = getActiveRows();
    for (let r = 0; r < ar; r++) {
        const lx = (GRID_X - 1) * TILE + 3;
        const ly = rowPixelY(r) + 12;
        drawText(ROW_LETTERS[r], lx, ly, PAL.gridOn[r], 7);
    }

    // Grid blocks
    for (let r = 0; r < ar; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const bx = (GRID_X + c) * TILE;
            const by = rowPixelY(r);
            const on = grid[r][c];

            // Block background
            drawRect(bx, by, TILE, TILE, PAL.gridBorder);
            drawRect(bx + 1, by + 1, TILE - 2, TILE - 2, on ? PAL.gridOn[r] : PAL.gridOff);

            // Beat markers (every 4th column)
            if (!on && c % 4 === 0) {
                drawRect(bx + 1, by + 1, TILE - 2, TILE - 2, "#3a6068");
            }

            // 3D highlight for on-blocks
            if (on) {
                ctx.fillStyle = "rgba(255,255,255,0.2)";
                ctx.fillRect((bx + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, 2 * SCALE);
                ctx.fillStyle = "rgba(0,0,0,0.2)";
                ctx.fillRect((bx + 1) * SCALE, (by + TILE - 3) * SCALE, (TILE - 2) * SCALE, 2 * SCALE);
            }

            // Sabotage flash overlay
            if (cellFlash[r][c] > 0) {
                ctx.fillStyle = "#FF00FF";
                ctx.globalAlpha = cellFlash[r][c] / 30 * 0.6;
                ctx.fillRect((bx + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, (TILE - 2) * SCALE);
                ctx.globalAlpha = 1.0;
                // "!" indicator for first half of flash
                if (cellFlash[r][c] > 15) {
                    drawText("!", bx + 5, by - 4, "#39FF14", 4);
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
                    drawRect(bx + 3, by + 3, 2, 2, xCol);
                    drawRect(bx + 5, by + 5, 2, 2, xCol);
                    drawRect(bx + 7, by + 7, 2, 2, xCol);
                    drawRect(bx + 9, by + 9, 2, 2, xCol);
                    drawRect(bx + 9, by + 3, 2, 2, xCol);
                    drawRect(bx + 7, by + 5, 2, 2, xCol);
                    drawRect(bx + 5, by + 7, 2, 2, xCol);
                    drawRect(bx + 3, by + 9, 2, 2, xCol);
                    ctx.globalAlpha = 1.0;
                }
            }
        }
    }

    // Playhead
    if (playing) {
        const px = (GRID_X + currentStep) * TILE;
        ctx.fillStyle = PAL.playhead;
        ctx.globalAlpha = 0.25;
        const playheadH = (gridBottomTileY() - GRID_Y) * TILE;
        ctx.fillRect(px * SCALE, GRID_Y * TILE * SCALE, TILE * SCALE, playheadH * SCALE);
        ctx.globalAlpha = 1.0;
        // Top marker
        drawRect(px + 2, (GRID_Y - 1) * TILE + 10, TILE - 4, 4, PAL.playhead);
    }

    // Step numbers (below grid)
    for (let c = 0; c < GRID_COLS; c++) {
        const num = String(c + 1);
        const tx = (GRID_X + c) * TILE + (c < 9 ? 4 : 1);
        drawText(num, tx, gridBottomTileY() * TILE + 8, c === currentStep && playing ? PAL.playhead : "#5a8a8f", 3);
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
        // Shadow on ground
        ctx.globalAlpha = 0.25;
        drawRect(t.x - 1, t.y + 1, 3, 1, "#000");
        ctx.globalAlpha = 1;
        // Tumble: one lazy rotation over the entire flight
        const rot = Math.floor(t.progress * 4) % 4;
        if (rot === 0) {
            // Upright
            drawRect(drawX - 2, drawY - 1, 4, 3, "#FF00FF");
            drawRect(drawX - 1, drawY - 2, 2, 1, "#FF00FF");
            drawRect(drawX, drawY - 3, 1, 1, "#39FF14");
            drawRect(drawX - 2, drawY - 1, 1, 1, "#FF44FF");
        } else if (rot === 1) {
            // Tilted right
            drawRect(drawX - 1, drawY - 2, 3, 4, "#FF00FF");
            drawRect(drawX + 2, drawY - 1, 1, 2, "#FF00FF");
            drawRect(drawX + 3, drawY, 1, 1, "#39FF14");
            drawRect(drawX - 1, drawY - 2, 1, 1, "#FF44FF");
        } else if (rot === 2) {
            // Upside down
            drawRect(drawX - 2, drawY - 1, 4, 3, "#FF00FF");
            drawRect(drawX - 1, drawY + 2, 2, 1, "#FF00FF");
            drawRect(drawX, drawY + 3, 1, 1, "#39FF14");
            drawRect(drawX + 1, drawY + 1, 1, 1, "#FF44FF");
        } else {
            // Tilted left
            drawRect(drawX - 1, drawY - 2, 3, 4, "#FF00FF");
            drawRect(drawX - 2, drawY - 1, 1, 2, "#FF00FF");
            drawRect(drawX - 3, drawY, 1, 1, "#39FF14");
            drawRect(drawX + 1, drawY - 2, 1, 1, "#FF44FF");
        }
    }

    // Tomato splats
    for (const s of tomatoSplats) {
        const a = s.timer / 25;
        ctx.globalAlpha = a;
        // Splat — irregular red blobs
        drawRect(s.x - 3, s.y - 1, 6, 3, "#FF00FF");
        drawRect(s.x - 1, s.y - 3, 3, 6, "#CC00CC");
        drawRect(s.x - 5, s.y, 2, 2, "#FF00FF");
        drawRect(s.x + 4, s.y - 2, 2, 2, "#CC00CC");
        drawRect(s.x - 2, s.y + 3, 2, 1, "#FF00FF");
        // Seeds
        drawRect(s.x + 1, s.y - 1, 1, 1, "#00FFFF");
        drawRect(s.x - 2, s.y + 1, 1, 1, "#00FFFF");
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
        const pty = Math.round(player.y / TILE);
        let ttx = ptx, tty = pty;
        switch (player.dir) {
            case 0: tty += 1; break;
            case 1: tty -= 1; break;
            case 2: ttx -= 1; break;
            case 3: ttx += 1; break;
        }
        const tx = ttx * TILE;
        const ty = tty * TILE;
        const pulse = 0.25 + Math.sin(performance.now() * 0.004) * 0.15;
        ctx.globalAlpha = pulse;
        const c = PAL.punch; // "#efac28"
        const s = 1; // bracket stroke width
        const L = 4; // bracket arm length
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

    // Player shadow
    drawRect(player.x + 2, player.y + player.h - 2, player.w - 4, 4, PAL.shadow);

    // Punch (draw behind player for up-facing, in front otherwise)
    if (player.attacking && player.dir === 1) drawPunch();

    // Player sprite
    drawPlayer();

    // Punch (in front for down/left/right)
    if (player.attacking && player.dir !== 1) drawPunch();

    // "SLAY THE GOBLIN!" indicator when pattern is done but goblins remain
    if (patternMatched && !levelComplete && areGoblinsAlive()) {
        const blink = Math.floor(performance.now() / 400) % 2 === 0;
        if (blink) {
            drawCenteredText("SLAY THE GOBLIN!", 14, "#ef3a0c", 6);
        }
    }

    // Pause overlay
    if (gamePaused) {
        // Dim the screen
        ctx.fillStyle = "#000";
        ctx.globalAlpha = 0.55;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;

        // Pixel-art style banner background
        const bannerX = 3 * TILE;
        const bannerY = 5 * TILE;
        const bannerW = (COLS - 6) * TILE;
        const bannerH = 8 * TILE;
        // Outer border (dark)
        drawRect(bannerX - 2, bannerY - 2, bannerW + 4, bannerH + 4, "#2a1d0d");
        // Inner fill (matches carnival tent style)
        drawRect(bannerX, bannerY, bannerW, bannerH, "#392a1c");
        // Highlight edge top
        drawRect(bannerX, bannerY, bannerW, 2, "#684c3c");
        // Highlight edge bottom
        drawRect(bannerX, bannerY + bannerH - 2, bannerW, 2, "#1f240a");
        // Striped accents (carnival style)
        for (let i = 0; i < bannerW; i += 8) {
            if (Math.floor(i / 8) % 2 === 0) {
                drawRect(bannerX + i, bannerY, Math.min(8, bannerW - i), 2, "#9b1a0a");
            }
        }

        // "PAUSED" text centered
        const pauseText = "PAUSED";
        const textScale = 7;
        const textW = pauseText.length * textScale * 1.1;
        const textX = bannerX + bannerW / 2 - textW / 2;
        const textY = bannerY + 12;
        // Shadow
        drawText(pauseText, textX + 1, textY + 1, "#1f240a", textScale);
        // Main text
        drawText(pauseText, textX, textY, "#efac28", textScale);

        // Controls section
        const ctrlX = bannerX + 16;
        const ctrlY = textY + 22;
        const ctrlCol = "#efb775";
        const labelCol = "#efac28";
        drawText("CONTROLS:", ctrlX, ctrlY, labelCol, 4);
        drawText("ARROWS", ctrlX, ctrlY + 12, labelCol, 4);
        drawText("Move around", ctrlX + 32, ctrlY + 12, ctrlCol, 4);
        drawText("SPACE", ctrlX, ctrlY + 22, labelCol, 4);
        drawText("Punch attack", ctrlX + 28, ctrlY + 22, ctrlCol, 4);
        drawText("ENTER", ctrlX, ctrlY + 32, labelCol, 4);
        drawText("Pause / Unpause", ctrlX + 28, ctrlY + 32, ctrlCol, 4);

        // Tips
        drawText("TIPS:", ctrlX, ctrlY + 48, labelCol, 4);
        drawText("Hit blocks to toggle beats", ctrlX, ctrlY + 58, ctrlCol, 4);
        drawText("Slay goblins to earn dancers", ctrlX, ctrlY + 68, ctrlCol, 4);

        // "PRESS ENTER" hint at bottom
        const hintText = "PRESS ENTER TO RESUME";
        const hintScale = 3;
        const hintW = hintText.length * hintScale * 1.1;
        const hintX = bannerX + bannerW / 2 - hintW / 2;
        const hintY = bannerY + bannerH - 10;
        drawText(hintText, hintX, hintY, "#8ab0b4", hintScale);
    }

    // Restore screen shake transform
    if (screenShake > 0) {
        ctx.restore();
    }
}

// Draw at screen-pixel resolution (1:1) — for high-detail 48x48 sprites
function drawPx(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
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

// Reusable 48x48 player sprite for all screens
// gx, gy: top-left position (game coords)
// frame: animation frame (0-3), dir: facing direction (0-3)
// options: { isBlinking, punchThrust }
function drawPlayerSprite(gx, gy, frame, dir, options) {
    const opts = options || {};
    const sx = gx * SCALE;
    const sy = gy * SCALE;
    const bob = (frame % 2 === 1 ? 1 : 0) * SCALE;
    const ghost = opts.ghostMode || false;

    // Punch lean: upper body shifts toward punch direction
    const punch = opts.punchThrust || 0; // 0-1, peaks at mid-punch
    let leanX = 0, leanY = 0;
    if (punch > 0) {
        switch (dir) {
            case 0: leanY = punch * 4; break;  // lean down
            case 1: leanY = -punch * 4; break; // lean up
            case 2: leanX = -punch * 5; break; // lean left
            case 3: leanX = punch * 5; break;  // lean right
        }
    }

    function px(x, y, w, h, color) {
        drawPx(sx + x, sy + y - bob, w, h, ghost ? ghostTint(color) : color);
    }
    // Shifted version for upper body during punch
    function pxLean(x, y, w, h, color) {
        drawPx(sx + x + leanX * SCALE, sy + y + leanY * SCALE - bob, w, h, ghost ? ghostTint(color) : color);
    }

    // === BODY (teal shirt — Studioland style) ===
    // Lower body stays planted (extended upward to fill gap when upper body leans)
    px(9, 9, 30, 27, "#724113");        // Lower torso (stays put)
    px(9, 9, 6, 27, "#45230d");          // Lower left dark side
    px(33, 9, 6, 27, "#45230d");         // Lower right dark side
    px(12, 30, 24, 3, "#45230d");       // Shirt bottom hem
    // Upper body leans into punch
    pxLean(9, 6, 30, 18, "#724113");    // Upper torso
    pxLean(9, 6, 6, 18, "#45230d");     // Upper left dark side
    pxLean(33, 6, 6, 18, "#45230d");    // Upper right dark side
    pxLean(15, 9, 18, 3, "#a56243");    // Shirt chest highlight
    // Collar detail
    pxLean(15, 6, 18, 3, "#392a1c");
    pxLean(18, 3, 12, 3, "#392a1c");

    // === HEAD (bald, round) — leans with upper body ===
    pxLean(6, -15, 36, 21, "#efb775");      // Main head block
    pxLean(9, -18, 30, 3, "#efb775");       // Rounded top
    pxLean(12, -21, 24, 3, "#efb775");      // More rounding
    pxLean(15, -24, 18, 3, "#efb775");      // Top of dome
    // Bald shine highlight
    pxLean(15, -24, 18, 3, "#efd8a1");
    pxLean(12, -21, 24, 3, "#efd8a1");
    pxLean(15, -18, 18, 3, "#F0D8BA");
    // Ears (flush with head edge — no protrusion)
    pxLean(6, -6, 3, 6, "#a58c27");
    pxLean(39, -6, 3, 6, "#a58c27");

    // === EYES & BEARD (direction-aware — beard only on front of face) ===
    const isBlinking = opts.isBlinking || false;
    const eyeDir = [
        [0, 3],   // down
        [0, -6],  // up
        [-3, 0],  // left
        [3, 0],   // right
    ][dir];

    if (dir === 1) {
        // Facing UP — show back of bald head, no eyes, no beard
        pxLean(12, -18, 24, 6, "#a58c27");
        pxLean(15, -3, 18, 6, "#efb775");
    } else {
        // Facing DOWN, LEFT, or RIGHT — show beard and eyes
        pxLean(9, -3, 30, 12, "#ab5c1c");
        pxLean(6, -3, 6, 9, "#ab5c1c");
        pxLean(36, -3, 6, 9, "#ab5c1c");
        pxLean(12, 9, 24, 6, "#ab5c1c");
        pxLean(15, 15, 18, 3, "#773421");
        pxLean(12, 0, 3, 3, "#a56243");
        pxLean(21, 3, 3, 3, "#a56243");
        pxLean(30, 0, 3, 3, "#a56243");
        pxLean(12, -6, 24, 3, "#773421");
        const mouthOfs = dir === 2 ? -3 : dir === 3 ? 3 : 0;
        pxLean(16 + mouthOfs, 1, 16, 5, "#9b1a0a");        // mouth outline (red)
        pxLean(17 + mouthOfs, 2, 14, 3, "#300f0a");       // inner mouth (dark)
        pxLean(18 + mouthOfs, 2, 12, 1, "#efd8a1");       // teeth (white)
        pxLean(16 + mouthOfs, 0, 16, 1, "#773421");       // upper lip
        pxLean(16 + mouthOfs, 6, 16, 1, "#773421");       // lower lip

        if (isBlinking) {
            pxLean(12 + eyeDir[0], -7 + eyeDir[1], 8, 2, "#2a1d0d");
            pxLean(28 + eyeDir[0], -7 + eyeDir[1], 8, 2, "#2a1d0d");
        } else {
            pxLean(11 + eyeDir[0], -12 + eyeDir[1], 10, 8, "#efd8a1");
            pxLean(27 + eyeDir[0], -12 + eyeDir[1], 10, 8, "#efd8a1");
            pxLean(14 + eyeDir[0], -10 + eyeDir[1], 5, 5, "#2a1d0d");
            pxLean(30 + eyeDir[0], -10 + eyeDir[1], 5, 5, "#2a1d0d");
            pxLean(15 + eyeDir[0], -10 + eyeDir[1], 2, 2, "#efd8a1");
            pxLean(31 + eyeDir[0], -10 + eyeDir[1], 2, 2, "#efd8a1");
            pxLean(10 + eyeDir[0], -14 + eyeDir[1], 12, 2, "#927e6a");
            pxLean(26 + eyeDir[0], -14 + eyeDir[1], 12, 2, "#927e6a");
        }
    }

    // === FEET / SHOES (tan) — stay planted ===
    const walkPx = (frame === 1 ? 2 : frame === 3 ? -2 : 0) * SCALE;
    px(12 + walkPx, 36, 9, 6, "#927e6a");
    px(27 - walkPx, 36, 9, 6, "#927e6a");
    px(12 + walkPx, 40, 9, 2, "#684c3c");
    px(27 - walkPx, 40, 9, 2, "#684c3c");
    px(12 + walkPx, 34, 9, 3, "#45230d");
    px(27 - walkPx, 34, 9, 3, "#45230d");
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
        // Impact burst lines
        const burstCount = 6;
        for (let i = 0; i < burstCount; i++) {
            const angle = (i / burstCount) * Math.PI * 2 + progress * 2;
            const innerR = 5 * SCALE;
            const outerR = (8 + thrust * 4) * SCALE;
            ctx.strokeStyle = "#efd8a1";
            ctx.lineWidth = 2 * SCALE;
            ctx.globalAlpha = thrust * 0.8;
            ctx.beginPath();
            ctx.moveTo(fistX + Math.cos(angle) * innerR, fistY + Math.sin(angle) * innerR);
            ctx.lineTo(fistX + Math.cos(angle) * outerR, fistY + Math.sin(angle) * outerR);
            ctx.stroke();
        }
        // Impact flash
        ctx.fillStyle = "#FFF";
        ctx.globalAlpha = thrust * 0.4;
        ctx.beginPath();
        ctx.arc(fistX, fistY, 7 * SCALE, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // === MOTION LINES (whoosh trail) ===
    if (thrust > 0.3) {
        ctx.strokeStyle = "#efb775";
        ctx.lineWidth = 1 * SCALE;
        ctx.globalAlpha = thrust * 0.4;
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

// Reusable goblin sprite for all screens (story, warnings, gameplay)
// type: "normal", "elite", "catapult"
// gx, gy: top-left position (game coords)
// frame: animation frame (0-3)
// options: { dir, showShadow, bodyCol, darkCol, headCol, eyeCol }
function drawGoblinSprite(type, gx, gy, frame, options) {
    const opts = options || {};
    const dir = opts.dir !== undefined ? opts.dir : 0;
    const showShadow = opts.showShadow !== false;
    const bob = (frame % 2 === 1 ? 1 : 0) * SCALE;

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

    // === BODY (squat, stocky — Studioland style) ===
    px(12, 9, 24, 27, bodyCol);        // Main torso
    px(12, 9, 6, 27, darkCol);         // Left dark side
    px(30, 9, 6, 27, darkCol);         // Right dark side
    px(18, 12, 12, 3, bodyCol);        // Chest area (lighter)
    // Tattered vest/tunic edge
    px(12, 33, 24, 3, darkCol);

    // === HEAD (round, expressive) ===
    px(6, -12, 36, 21, headCol);       // Main head
    px(9, -15, 30, 3, headCol);        // Rounded top
    px(12, -18, 24, 3, headCol);       // More rounding
    // Head shading
    px(9, -15, 6, 3, darkCol);         // Left shadow
    px(33, -15, 6, 3, darkCol);        // Right shadow

    // === POINTY EARS (iconic goblin feature) ===
    px(0, -6, 9, 9, headCol);          // Left ear base
    px(-3, -9, 6, 6, headCol);         // Left ear point
    px(-6, -12, 3, 3, headCol);        // Left ear tip
    px(39, -6, 9, 9, headCol);         // Right ear base
    px(45, -9, 6, 6, headCol);         // Right ear point
    px(51, -12, 3, 3, headCol);        // Right ear tip
    // Inner ear
    px(0, -3, 6, 3, darkCol);
    px(42, -3, 6, 3, darkCol);

    // === EYES (direction-aware) ===
    const eyeOfs = [[0, 3], [0, -6], [-3, 0], [3, 0]][dir];

    if (dir !== 1) {
        // Eye sockets (dark recesses)
        px(10 + eyeOfs[0], -9 + eyeOfs[1], 10, 8, "#1a2a1a");
        px(28 + eyeOfs[0], -9 + eyeOfs[1], 10, 8, "#1a2a1a");
        // Glowing eye color
        px(12 + eyeOfs[0], -7 + eyeOfs[1], 6, 5, eyeCol);
        px(30 + eyeOfs[0], -7 + eyeOfs[1], 6, 5, eyeCol);
        // Bright pupil centers
        px(13 + eyeOfs[0], -6 + eyeOfs[1], 3, 3, "#ffffff");
        px(31 + eyeOfs[0], -6 + eyeOfs[1], 3, 3, "#ffffff");
        // Angry brow ridge
        px(9 + eyeOfs[0], -12 + eyeOfs[1], 12, 3, darkCol);
        px(27 + eyeOfs[0], -12 + eyeOfs[1], 12, 3, darkCol);
    }

    // === MOUTH / FANGS (direction-aware) ===
    if (dir !== 1) {
        const mOfs = dir === 2 ? -3 : dir === 3 ? 3 : 0;
        // Wide grin
        px(12 + mOfs, 0, 24, 6, "#2a1a1a");
        px(15 + mOfs, 6, 18, 3, "#2a1a1a");
        // Fangs (white, pointy)
        px(14 + mOfs, 0, 3, 6, "#efd8a1");
        px(21 + mOfs, 0, 3, 6, "#efd8a1");
        px(28 + mOfs, 0, 3, 6, "#efd8a1");
        // Fang tips extend below
        px(15 + mOfs, 6, 2, 3, "#efd8a1");
        px(29 + mOfs, 6, 2, 3, "#efd8a1");
    }

    // === FEET (clawed) ===
    const walkPx = (frame === 1 ? 2 : frame === 3 ? -2 : 0) * SCALE;
    px(12 + walkPx, 36, 9, 6, darkCol);     // Left foot
    px(27 - walkPx, 36, 9, 6, darkCol);     // Right foot
    px(10 + walkPx, 40, 4, 3, darkCol);     // Left claws
    px(33 - walkPx, 40, 4, 3, darkCol);     // Right claws

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

    const sx = gx * SCALE;
    const sy = gy * SCALE;

    function px(x, y, w, h, color) {
        drawPx(sx + x, sy + y - bob, w, h, color);
    }

    // === BODY (outfit) ===
    px(9, 12, 18, 21, pal.body);        // Main torso
    px(9, 12, 3, 21, pal.dark);         // Left dark side
    px(24, 12, 3, 21, pal.dark);        // Right dark side
    px(12, 15, 12, 3, pal.body);        // Chest highlight
    px(9, 30, 18, 3, pal.dark);         // Hem

    // === HEAD (round, friendly) ===
    px(6, -6, 24, 18, pal.head);        // Main head
    px(9, -9, 18, 3, pal.head);         // Rounded top
    px(12, -12, 12, 3, pal.head);       // More rounding

    // === HAIR ===
    px(3, -6, 30, 6, pal.hair);         // Main hair
    px(6, -9, 24, 3, pal.hair);         // Hair top
    px(9, -12, 18, 3, pal.hair);        // Hair crown
    px(12, -15, 12, 3, pal.hair);       // Hair peak
    // Side hair tufts
    px(3, 0, 3, 6, pal.hair);
    px(30, 0, 3, 6, pal.hair);

    // === FACE ===
    // Eyes (friendly, round)
    px(10, 0, 6, 5, "#efd8a1");         // Left eye white
    px(20, 0, 6, 5, "#efd8a1");         // Right eye white
    px(12, 1, 3, 3, "#2a1d0d");         // Left pupil
    px(22, 1, 3, 3, "#2a1d0d");         // Right pupil
    px(12, 1, 1, 1, "#efd8a1");         // Left highlight
    px(22, 1, 1, 1, "#efd8a1");         // Right highlight
    // Friendly smile
    px(12, 7, 12, 2, "#a56243");        // Mouth
    px(14, 9, 8, 1, "#a56243");         // Lower lip

    // Rosy cheeks
    px(6, 4, 3, 3, "#a56243");
    px(27, 4, 3, 3, "#a56243");

    // === ARMS (position based on armBlend) ===
    const armDownY = 15;
    const armUpY = 6;
    const armY = armDownY + (armUpY - armDownY) * armBlend;
    const armH = 12 + (9 - 12) * armBlend;
    px(3, armY, 6, armH, pal.body);      // Left arm
    px(27, armY, 6, armH, pal.body);     // Right arm
    // Hands
    px(3, armY, 4, 3, pal.head);         // Left hand (skin)
    px(29, armY, 4, 3, pal.head);        // Right hand (skin)

    // === FEET (smooth offset) ===
    px(9 - footOfs, 33, 8, 6, pal.dark);    // Left shoe
    px(19 + footOfs, 33, 8, 6, pal.dark);   // Right shoe
    px(9 - footOfs, 37, 8, 2, pal.body);    // Left shoe accent
    px(19 + footOfs, 37, 8, 2, pal.body);   // Right shoe accent
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

    const bpm = 120;
    const sixteenth = 60 / bpm / 4;

    //         1 . . . 2 . . . 3 . . . 4 . . .
    const K = [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0];
    const S = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0];
    const H = [0,1,1,1,0,1,1,0,1,1,0,1,0,1,1,1];
    // O is all rests

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

// ---- Title Screen (page 1: logo only) ----
function renderTitleScreen() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background
    drawRect(0, 0, W, H, "#1f240a");

    // Starfield
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(titleBlink * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#efac28" : "#efd8a1");
    }
    ctx.globalAlpha = 1;

    // === Centered Logo ===
    const logoColor1 = "#ab5c1c";
    const logoColor2 = "#efac28";

    // Use measureText for accurate centering
    const bigFontSize = 20; // font size for GROOVE/GOBLINS

    // "REVENGE OF THE" — smaller, well above GROOVE
    const subTitle = "ATTACK OF THE";
    const subFontSize = 4;
    ctx.font = `${subFontSize * SCALE}px monospace`;
    const subMeasured = ctx.measureText(subTitle).width;
    const subY = H / 2 - 90;
    // Draw static centered subtitle
    const subStartX = ((W * SCALE) - subMeasured) / (2 * SCALE);
    drawText(subTitle, subStartX, subY, logoColor1, subFontSize);

    // Big "GROOVE" — use textAlign center for the whole word block
    const grooveText = "GROOVE";
    ctx.font = `${bigFontSize * SCALE}px monospace`;
    const grooveMeasured = ctx.measureText(grooveText).width;
    const grooveCharW = grooveMeasured / (SCALE * grooveText.length);
    const grooveY = H / 2 - 66;
    const grooveStartX = ((W * SCALE) - grooveMeasured) / (2 * SCALE);
    for (let i = 0; i < grooveText.length; i++) {
        const charX = grooveStartX + i * grooveCharW;
        const bounce = Math.sin(titleBlink * 0.06 + i * 0.8) * 3;
        const col = i % 2 === 0 ? logoColor2 : logoColor1;
        drawText(grooveText[i], charX + 1, grooveY + bounce + 1, "#000000", bigFontSize);
        drawText(grooveText[i], charX, grooveY + bounce, col, bigFontSize);
    }

    // Big "GOBLINS"
    const goblinsText = "GOBLINS";
    const gobMeasured = ctx.measureText(goblinsText).width;
    const gobCharW = gobMeasured / (SCALE * goblinsText.length);
    const gobY = grooveY + 30;
    const gobStartX = ((W * SCALE) - gobMeasured) / (2 * SCALE);
    for (let i = 0; i < goblinsText.length; i++) {
        const charX = gobStartX + i * gobCharW;
        const bounce = Math.sin(titleBlink * 0.06 + i * 0.8 + 3) * 3;
        const col = i % 2 === 0 ? "#39FF14" : "#00CC00";
        drawText(goblinsText[i], charX + 1, gobY + bounce + 1, "#000000", bigFontSize);
        drawText(goblinsText[i], charX, gobY + bounce, col, bigFontSize);
    }

    // Pixel art goblin face below logo
    const fp = 3;
    const faceX = W / 2 - 4*fp;
    const faceY = gobY + 40;
    drawRect(faceX + 2*fp, faceY, 4*fp, fp, "#00CC00");
    drawRect(faceX + fp, faceY + fp, 6*fp, fp, "#00CC00");
    drawRect(faceX, faceY + 2*fp, 8*fp, 3*fp, "#39FF14");
    drawRect(faceX + fp, faceY + 5*fp, 6*fp, fp, "#39FF14");
    drawRect(faceX + 2*fp, faceY + 6*fp, 4*fp, fp, "#00CC00");
    drawRect(faceX - fp, faceY + 2*fp, fp, 2*fp, "#00CC00");
    drawRect(faceX + 8*fp, faceY + 2*fp, fp, 2*fp, "#00CC00");
    drawRect(faceX + 2*fp, faceY + 3*fp, fp, fp, "#FF00FF");
    drawRect(faceX + 5*fp, faceY + 3*fp, fp, fp, "#FF00FF");
    drawRect(faceX + 2*fp, faceY + 5*fp, 4*fp, fp, "#1a1a1a");
    drawRect(faceX + 3*fp, faceY + 5*fp, fp, fp, "#efd8a1");
    drawRect(faceX + 5*fp, faceY + 5*fp, fp, fp, "#efd8a1");
    drawRect(faceX - fp, faceY + fp, fp, 3*fp, "#333");
    drawRect(faceX + 8*fp, faceY + fp, fp, 3*fp, "#333");
    drawRect(faceX + fp, faceY - fp, 6*fp, fp, "#333");
    drawRect(faceX - 2*fp, faceY + fp, 2*fp, 2*fp, "#FF00FF");
    drawRect(faceX + 8*fp, faceY + fp, 2*fp, 2*fp, "#FF00FF");

    // Musical notes floating around the face
    const notePositions = [
        { x: faceX - 16, y: faceY - 10 },
        { x: faceX + 38, y: faceY - 5 },
        { x: faceX - 12, y: faceY + 20 },
        { x: faceX + 36, y: faceY + 15 },
    ];
    for (let i = 0; i < notePositions.length; i++) {
        const np = notePositions[i];
        const ny = np.y + Math.sin(titleBlink * 0.1 + i * 2) * 4;
        const noteCol = ["#efac28", "#ab5c1c", "#ef3a0c", "#3c9f9c"][i];
        ctx.globalAlpha = 0.6 + Math.sin(titleBlink * 0.08 + i) * 0.4;
        drawRect(np.x, ny, 3, 2, noteCol);
        drawRect(np.x + 3, ny - 5, 1, 6, noteCol);
        drawRect(np.x + 3, ny - 5, 2, 1, noteCol);
    }
    ctx.globalAlpha = 1;

    // Helper to draw centered text
    function drawCentered(text, y, color, scale) {
        ctx.font = `${scale * SCALE}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    // Blinking "PRESS ENTER"
    titleBlink++;
    const hasScores = highScores.length > 0;
    const pressY = hasScores ? H - 80 : H - 30;
    if (titleBlink % 60 < 40) {
        drawCentered("PRESS ENTER", pressY, "#efd8a1", 5);
    }

    // High score leaderboard
    if (hasScores) {
        drawCentered("HIGH SCORES", H - 68, "#efac28", 3);

        for (let i = 0; i < highScores.length; i++) {
            const entry = highScores[i];
            const rank = (i + 1) + ". " + entry.name + "  " + String(entry.score).padStart(7, "0");
            const color = i === 0 ? "#efac28" : "#efb775";
            drawCentered(rank, H - 58 + i * 10, color, 3);
        }
    }
}

// ---- Story Screen (page 2: backstory + instructions + characters) ----
let storyBlink = 0;
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

function renderStoryScreen() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background
    drawRect(0, 0, W, H, "#1f240a");

    // Starfield
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(storyBlink * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#efac28" : "#efd8a1");
    }
    ctx.globalAlpha = 1;

    // Helper to center text using canvas textAlign
    function drawCenteredText(text, y, color, scale) {
        ctx.font = `${scale * SCALE}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    // Story text
    const storyLines = [
        { text: "ONCE UPON A TIME,", color: "#efac28", scale: 7, gap: 18 },
        { text: "SICK BEATS ECHOED THROUGH STUDIOLAND.", color: "#efb775", scale: 5, gap: 22 },
        { text: "UNTIL THE GOBLINS BECAME JEALOUS", color: "#39FF14", scale: 5, gap: 16 },
        { text: "AND STARTED TO SABOTAGE THE MUSIC.", color: "#ef3a0c", scale: 5, gap: 24 },
        { text: "YOU ARE THE DJ, AND YOU HAVE FISTS OF FURY.", color: "#efac28", scale: 5, gap: 24 },
        { text: "IT'S TIME TO GET PUNCHIN'!", color: "#ef3a0c", scale: 7, gap: 0 },
    ];

    // Calculate total height to vertically center story block
    let totalTextH = 0;
    for (let i = 0; i < storyLines.length; i++) {
        totalTextH += storyLines[i].scale + (i < storyLines.length - 1 ? storyLines[i].gap : 0);
    }
    const charY = H - 36;
    const availableH = charY - 30;
    let textY = Math.max(10, 15 + (availableH - totalTextH) / 2);

    for (let i = 0; i < storyLines.length; i++) {
        const line = storyLines[i];
        drawCenteredText(line.text, textY, line.color, line.scale);
        textY += line.scale + line.gap;
    }

    // Characters at the bottom — evenly spaced across center area
    const charMargin = W * 0.15; // 15% margin on each side
    const charArea = W - charMargin * 2;
    const charSlots = 5;
    const slotW = charArea / (charSlots - 1); // space between characters
    const gobFrame = Math.floor(storyBlink / 10) % 4;
    const gobBob = gobFrame % 2 === 1 ? 1 : 0;

    // Elite goblin (slot 0 — left)
    const eliteX = charMargin + slotW * 0 - 8 + Math.sin(storyBlink * 0.025 + 1) * 3;
    const eliteFrame = (gobFrame + 1) % 4;
    drawGoblinSprite("elite", eliteX, charY, eliteFrame, { showShadow: false });

    // Goblin (slot 1)
    const gobX = charMargin + slotW * 1 - 8 + Math.sin(storyBlink * 0.03) * 3;
    drawGoblinSprite("normal", gobX, charY, gobFrame, { showShadow: false });

    // Player (center, slot 2)
    const playerX = charMargin + slotW * 2 - 8;
    const playerFrame = Math.floor(storyBlink / 12) % 4;
    drawPlayerSprite(playerX, charY, playerFrame, 0, {});

    // Dancers (slots 4 and 5)
    const dancerPals = [
        { body: "#ef3a0c", dark: "#9b1a0a", head: "#efb775", hair: "#724113" },
        { body: "#3c9f9c", dark: "#276468", head: "#efb775", hair: "#2a1d0d" },
    ];
    for (let d = 0; d < 2; d++) {
        const dx = charMargin + slotW * (3 + d) - 6;
        const dBob = Math.floor((storyBlink + d * 5) / 8) % 2 === 0 ? 0 : 2;
        const armUp = Math.floor((storyBlink + d * 5) / 8) % 2 === 0;
        const dfo = (Math.floor((storyBlink + d * 5) / 8) % 2 === 0) ? 1 : -1;
        drawDancerSprite(dx, charY, dancerPals[d], { bob: dBob, armBlend: armUp ? 1 : 0, footOffset: dfo });
    }

    // Blinking "PRESS ENTER TO BEGIN"
    storyBlink++;
    if (storyBlink % 60 < 40) {
        drawCenteredText("PRESS ENTER TO BEGIN", H - 10, "#efd8a1", 5);
    }

}

function renderHighScoreEntry() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background with starfield
    drawRect(0, 0, W, H, "#1f240a");
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(initialsBlink * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#efac28" : "#efd8a1");
    }
    ctx.globalAlpha = 1;

    initialsBlink++;

    // "NEW HIGH SCORE!" header
    const header = "NEW HIGH SCORE!";
    const headerW = header.length * 5;
    drawText(header, W / 2 - headerW / 2, 20, "#efac28", 5);

    // Score display
    const scoreStr = String(finalScore);
    const scoreW = scoreStr.length * 6;
    drawText(scoreStr, W / 2 - scoreW / 2, 40, "#efd8a1", 6);

    // "ENTER YOUR INITIALS" label
    const label = "ENTER YOUR INITIALS";
    const labelW = label.length * 3;
    drawText(label, W / 2 - labelW / 2, 65, "#efb775", 3);

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
        const color = i < initialsPos ? "#a58c27" : (i === initialsPos ? "#efac28" : "#392a1c");
        drawText(initialsEntry[i], lx, ly, color, letterScale);
        ctx.globalAlpha = 1;

        // Underline
        drawRect(lx, ly + letterScale + 4, letterScale, 2, i === initialsPos ? "#efac28" : "#392a1c");
    }

    // "PRESS ENTER TO CONFIRM" blinking
    const confirmText = "PRESS ENTER TO CONFIRM";
    const confirmW = confirmText.length * 3;
    if (initialsBlink % 60 < 40) {
        drawText(confirmText, W / 2 - confirmW / 2, H - 30, "#efb775", 3);
    }

    // Controls hint
    const hint = "UP/DOWN: LETTER   ENTER: CONFIRM";
    const hintW = hint.length * 2;
    drawText(hint, W / 2 - hintW / 2, H - 18, "#684c3c", 2);
}

function renderLevelComplete() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    levelCelebrateTimer++;
    if (screenFlash > 0) screenFlash--;

    // Render the game map underneath, then fade to black over time
    render();
    const fadeAlpha = Math.min(1, levelCelebrateTimer / 90);
    ctx.globalAlpha = fadeAlpha;
    drawRect(0, 0, COLS * TILE, ROWS * TILE, "#1f240a");
    ctx.globalAlpha = 1.0;

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
        const scoreText = "SCORE: " + score;
        ctx.fillStyle = "#000000";
        ctx.fillText(scoreText, (W * SCALE) / 2 + SCALE, (sy + 1) * SCALE);
        ctx.fillStyle = "#efd8a1";
        ctx.fillText(scoreText, (W * SCALE) / 2, sy * SCALE);

        ctx.textAlign = "start";

        ctx.globalAlpha = 1.0;
    }

    // Celebration particles
    if (levelCelebrateTimer % 5 === 0 && levelCelebrateTimer < 240) {
        const colors = ["#efac28", "#ef3a0c", "#3c9f9c", "#ef692f", "#efd8a1", "#ab5c1c"];
        for (let i = 0; i < 5; i++) {
            deathParticles.push({
                x: Math.random() * W,
                y: -5,
                vx: (Math.random() - 0.5) * 1.5,
                vy: Math.random() * 1.5 + 0.5,
                life: 80 + Math.random() * 40,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 2 + Math.random() * 3,
                sparkle: Math.random() > 0.5,
            });
        }
    }

    // Update & render particles
    for (let i = deathParticles.length - 1; i >= 0; i--) {
        const p = deathParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) { deathParticles.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, p.life / 20);
        const sz = p.sparkle && Math.sin(levelCelebrateTimer * 0.2 + i) > 0 ? p.size * 1.5 : p.size;
        drawRect(p.x, p.y, sz, sz, p.color);
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
            ctx.fillText(pressText, (W * SCALE) / 2, (H / 2 + 30) * SCALE);
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
        const shitW = shitText.length * 5;
        // Position below the player (offset by collapse)
        const textY = player.y + player.h + 20;
        drawText(shitText, W / 2 - shitW / 2 + 1, textY + 1, "#000000", 5);
        drawText(shitText, W / 2 - shitW / 2, textY, "#efb775", 5);
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

function renderTutorialScreen() {
    tutorialTimer++;
    const W = COLS * TILE;
    const H = ROWS * TILE;
    const t = tutorialTimer;

    // Dark background
    drawRect(0, 0, W, H, "#1f240a");

    // Starfield
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(t * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#efac28" : "#efd8a1");
    }
    ctx.globalAlpha = 1;

    function drawCenteredText(text, y, color, scale) {
        ctx.font = `${scale * SCALE}px monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    // Page indicator dots (2 pages)
    const dotY = H - 22;
    for (let i = 0; i < 2; i++) {
        const dx = W / 2 - 6 + i * 8;
        const active = i === tutorialPage;
        drawRect(dx, dotY, 3, 3, active ? "#efac28" : "#392a1c");
    }

    // ======== PAGE 0: PUNCH BLOCKS ========
    if (tutorialPage === 0) {
        // Title
        drawCenteredText("PUNCH BLOCKS TO TOGGLE BEATS", 25, "#efac28", 7);

        // Animated demo grid — player walks to blocks and hits them
        const gridStartX = W / 2 - 4 * TILE / 2;
        const gridStartY = 58;
        const miniRows = 2;
        const rowColors = ["#efac28", "#efb775"];
        const demoTarget = [[true, false, true, false], [false, true, false, true]];
        const toggleOrder = [[0,0], [0,2], [1,1], [1,3]];
        const WALK_FRAMES = 35, ATTACK_AT = 38, ATTACK_DUR = 15, HIT_OFFSET = 45;
        const ATTACK_STEP_LEN = 80, WALK_STEP_LEN = 40;
        const demoSteps = [
            { x: gridStartX - TILE, y: gridStartY, attack: true, toggleIdx: 0, dur: ATTACK_STEP_LEN },
            { x: gridStartX + TILE, y: gridStartY, attack: true, toggleIdx: 1, dur: ATTACK_STEP_LEN },
            { x: gridStartX + TILE, y: gridStartY + TILE, attack: false, toggleIdx: -1, dur: WALK_STEP_LEN },
            { x: gridStartX, y: gridStartY + TILE, attack: true, toggleIdx: 2, dur: ATTACK_STEP_LEN },
            { x: gridStartX + 2 * TILE, y: gridStartY + TILE, attack: true, toggleIdx: 3, dur: ATTACK_STEP_LEN },
        ];
        const stepStart = [0];
        for (let i = 1; i < demoSteps.length; i++) stepStart.push(stepStart[i - 1] + demoSteps[i - 1].dur);
        const STEPS_TOTAL = stepStart[demoSteps.length - 1] + demoSteps[demoSteps.length - 1].dur;
        const CYCLE = STEPS_TOTAL + 60;
        const hitFrames = [];
        for (let i = 0; i < demoSteps.length; i++) {
            if (demoSteps[i].attack) hitFrames.push({ toggleIdx: demoSteps[i].toggleIdx, frame: stepStart[i] + HIT_OFFSET });
        }

        {
            const demoAlpha = 1;
            const demoT = t;
            const cycleT = demoT % CYCLE;
            const blockOn = [false, false, false, false];
            for (const hf of hitFrames) {
                if (cycleT >= hf.frame && cycleT < CYCLE - 30) blockOn[hf.toggleIdx] = true;
            }

            // Draw grid cells
            for (let r = 0; r < miniRows; r++) {
                for (let c = 0; c < 4; c++) {
                    const bx = gridStartX + c * TILE;
                    const by = gridStartY + r * TILE;
                    let isOn = false;
                    for (let i = 0; i < toggleOrder.length; i++) {
                        if (toggleOrder[i][0] === r && toggleOrder[i][1] === c && blockOn[i]) isOn = true;
                    }
                    drawRect(bx, by, TILE, TILE, PAL.gridBorder);
                    drawRect(bx + 1, by + 1, TILE - 2, TILE - 2, isOn ? rowColors[r] : PAL.gridOff);
                    if (demoTarget[r][c] && !isOn) {
                        const pulse = 0.3 + Math.sin(t * 0.06) * 0.15;
                        ctx.globalAlpha = pulse;
                        drawRect(bx + 1, by + 1, TILE - 2, 1, rowColors[r]);
                        drawRect(bx + 1, by + TILE - 2, TILE - 2, 1, rowColors[r]);
                        drawRect(bx + 1, by + 1, 1, TILE - 2, rowColors[r]);
                        drawRect(bx + TILE - 2, by + 1, 1, TILE - 2, rowColors[r]);
                        drawRect(bx + 6, by + 6, 4, 4, rowColors[r]);
                        ctx.globalAlpha = demoAlpha;
                    }
                    if (isOn) {
                        for (const hf of hitFrames) {
                            if (toggleOrder[hf.toggleIdx][0] === r && toggleOrder[hf.toggleIdx][1] === c) {
                                const flashAge = cycleT - hf.frame;
                                if (flashAge >= 0 && flashAge < 10) {
                                    ctx.globalAlpha = (1 - flashAge / 10) * 0.6;
                                    drawRect(bx, by, TILE, TILE, "#ffffff");
                                    ctx.globalAlpha = demoAlpha;
                                }
                            }
                        }
                    }
                }
            }

            // Animated player
            {
                const playerAlpha = 1;
                let stepIdx = demoSteps.length - 1;
                for (let i = 0; i < demoSteps.length; i++) {
                    if (cycleT < stepStart[i] + demoSteps[i].dur) { stepIdx = i; break; }
                }
                const step = demoSteps[stepIdx];
                const stepT = cycleT - stepStart[stepIdx];
                const prevPos = stepIdx === 0 ? { x: gridStartX - 3 * TILE, y: gridStartY } : demoSteps[stepIdx - 1];
                const ddx = step.x - prevPos.x;
                const ddy = step.y - prevPos.y;
                let walkDir = Math.abs(ddx) >= Math.abs(ddy) ? (ddx >= 0 ? 3 : 2) : (ddy >= 0 ? 0 : 1);
                let px, py, isWalking = false, isAttacking = false;
                if (cycleT >= STEPS_TOTAL) {
                    px = demoSteps[demoSteps.length - 1].x; py = demoSteps[demoSteps.length - 1].y; walkDir = 3;
                } else if (stepT < WALK_FRAMES) {
                    const prog = stepT / WALK_FRAMES; const eased = prog * prog * (3 - 2 * prog);
                    px = prevPos.x + (step.x - prevPos.x) * eased; py = prevPos.y + (step.y - prevPos.y) * eased; isWalking = true;
                } else if (step.attack && stepT >= ATTACK_AT && stepT < ATTACK_AT + ATTACK_DUR) {
                    px = step.x; py = step.y; isAttacking = true;
                } else { px = step.x; py = step.y; }
                const walkFrame = isWalking ? Math.floor(t / 6) % 4 : 0;
                const bob = walkFrame % 2 === 1 ? 1 : 0;
                const faceDir = isAttacking ? 3 : (isWalking ? walkDir : 3);
                const punchProg = isAttacking ? Math.sin(((stepT - ATTACK_AT) / ATTACK_DUR) * Math.PI) : 0;
                drawPlayerSprite(px, py, walkFrame, faceDir, { punchThrust: punchProg });
                if (isAttacking) {
                    // Draw punch arm + fist (matching drawPunch style)
                    const thrust = punchProg;
                    const pDir = faceDir;
                    let ddx2 = 0, ddy2 = 0;
                    switch (pDir) { case 0: ddy2 = 1; break; case 1: ddy2 = -1; break; case 2: ddx2 = -1; break; case 3: ddx2 = 1; break; }
                    const pLeanX = ddx2 !== 0 ? ddx2 * thrust * 5 : 0;
                    const pLeanY = ddy2 !== 0 ? ddy2 * thrust * 4 : 0;
                    const pcx = px + 8, pcy = py + 6;
                    let shOX, shOY;
                    switch (pDir) { case 0: shOX = -5; shOY = 2; break; case 1: shOX = 5; shOY = -8; break; case 2: shOX = -8; shOY = -2; break; case 3: shOX = 8; shOY = -2; break; }
                    const armLen = 3 + thrust * 6;
                    const shX = (pcx + pLeanX + shOX) * SCALE, shY = (pcy + pLeanY + shOY) * SCALE;
                    const fiX = (pcx + pLeanX + shOX + ddx2 * armLen) * SCALE, fiY = (pcy + pLeanY + shOY + ddy2 * armLen) * SCALE;
                    ctx.strokeStyle = "#efb775"; ctx.lineWidth = 4 * SCALE; ctx.lineCap = "round";
                    ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(fiX, fiY); ctx.stroke();
                    // Fist
                    ctx.fillStyle = "#efb775"; ctx.beginPath(); ctx.arc(fiX, fiY, 3.5 * SCALE, 0, Math.PI * 2); ctx.fill();
                    // Impact flash
                    if (thrust > 0.5) {
                        const burstCount = 6;
                        for (let bi = 0; bi < burstCount; bi++) {
                            const angle = (bi / burstCount) * Math.PI * 2 + (stepT - ATTACK_AT) * 0.3;
                            ctx.strokeStyle = "#efd8a1"; ctx.lineWidth = 2 * SCALE; ctx.globalAlpha = thrust * 0.8;
                            ctx.beginPath();
                            ctx.moveTo(fiX + Math.cos(angle) * 5 * SCALE, fiY + Math.sin(angle) * 5 * SCALE);
                            ctx.lineTo(fiX + Math.cos(angle) * (8 + thrust * 4) * SCALE, fiY + Math.sin(angle) * (8 + thrust * 4) * SCALE);
                            ctx.stroke();
                        }
                        ctx.globalAlpha = demoAlpha * playerAlpha;
                    }
                }
                // Gold bracket indicator
                if (!isAttacking && step.attack && step.toggleIdx >= 0 && cycleT < STEPS_TOTAL && !blockOn[step.toggleIdx]) {
                    const btx = gridStartX + toggleOrder[step.toggleIdx][1] * TILE;
                    const bty = gridStartY + toggleOrder[step.toggleIdx][0] * TILE;
                    ctx.globalAlpha = demoAlpha * playerAlpha * (0.25 + Math.sin(t * 0.1) * 0.15);
                    const bc = "#efac28";
                    drawRect(btx, bty, 4, 1, bc); drawRect(btx, bty, 1, 4, bc);
                    drawRect(btx + TILE - 4, bty, 4, 1, bc); drawRect(btx + TILE - 1, bty, 1, 4, bc);
                    drawRect(btx, bty + TILE - 1, 4, 1, bc); drawRect(btx, bty + TILE - 4, 1, 4, bc);
                    drawRect(btx + TILE - 4, bty + TILE - 1, 4, 1, bc); drawRect(btx + TILE - 1, bty + TILE - 4, 1, 4, bc);
                }
                ctx.globalAlpha = demoAlpha;
            }
            ctx.globalAlpha = 1;
        }

        // Control instructions
        {
            const ky = gridStartY + miniRows * TILE + 18;
            const ks = 9; // key size
            const kg = 2; // key gap
            const keyCol = "#392a1c";
            const keyHi = "#684c3c";
            const labelCol = "#efd8a1";
            const arrowGroupW = 3 * ks + 2 * kg; // width of arrow key cluster
            const spW = 28; // space bar width
            const gap = 14; // gap between arrow keys and space bar
            const totalW = arrowGroupW + gap + spW;
            const kx = W / 2 - totalW / 2; // left edge of arrow keys

            // Up arrow
            drawRect(kx + ks + kg, ky, ks, ks, keyCol);
            drawRect(kx + ks + kg + 1, ky + 1, ks - 2, ks - 2, keyHi);
            drawRect(kx + ks + kg + 3, ky + 3, 3, 1, labelCol);
            drawRect(kx + ks + kg + 4, ky + 2, 1, 1, labelCol);
            // Down arrow
            drawRect(kx + ks + kg, ky + ks + kg, ks, ks, keyCol);
            drawRect(kx + ks + kg + 1, ky + ks + kg + 1, ks - 2, ks - 2, keyHi);
            drawRect(kx + ks + kg + 3, ky + ks + kg + 5, 3, 1, labelCol);
            drawRect(kx + ks + kg + 4, ky + ks + kg + 6, 1, 1, labelCol);
            // Left arrow
            drawRect(kx, ky + ks + kg, ks, ks, keyCol);
            drawRect(kx + 1, ky + ks + kg + 1, ks - 2, ks - 2, keyHi);
            drawRect(kx + 3, ky + ks + kg + 4, 1, 1, labelCol);
            drawRect(kx + 4, ky + ks + kg + 3, 1, 3, labelCol);
            // Right arrow
            drawRect(kx + 2 * (ks + kg), ky + ks + kg, ks, ks, keyCol);
            drawRect(kx + 2 * (ks + kg) + 1, ky + ks + kg + 1, ks - 2, ks - 2, keyHi);
            drawRect(kx + 2 * (ks + kg) + 5, ky + ks + kg + 4, 1, 1, labelCol);
            drawRect(kx + 2 * (ks + kg) + 4, ky + ks + kg + 3, 1, 3, labelCol);

            // Space bar icon (to the right of arrow keys)
            const spX = kx + arrowGroupW + gap;
            drawRect(spX, ky + ks + kg, spW, ks, keyCol);
            drawRect(spX + 1, ky + ks + kg + 1, spW - 2, ks - 2, keyHi);
            ctx.font = `${3 * SCALE}px monospace`;
            ctx.fillStyle = labelCol;
            ctx.textAlign = "center";
            ctx.fillText("SPACE", (spX + spW / 2) * SCALE, (ky + ks + kg + 7) * SCALE);

            // Labels below each group
            ctx.font = `${5 * SCALE}px monospace`;
            ctx.fillStyle = "#efb775";
            const arrowCenterX = kx + ks + kg + ks / 2;
            ctx.fillText("MOVE", arrowCenterX * SCALE, (ky + 2 * ks + 2 * kg + 8) * SCALE);
            ctx.fillText("ATTACK", (spX + spW / 2) * SCALE, (ky + 2 * ks + 2 * kg + 8) * SCALE);
            ctx.textAlign = "start";
        }
    }

    // ======== PAGE 1: MATCH THE PATTERN + BEAT THE CLOCK ========
    else if (tutorialPage === 1) {
        drawCenteredText("MATCH THE PATTERN", 15, "#efac28", 7);

        // --- TOP LEFT: Pulsing outlines (beats to ADD) ---
        const gx = W / 2 - 4 * TILE;
        const gy = 36;
        const patCols = 4;
        const addColor = "#efac28";
        const addTarget = [true, false, true, false];
        const addFillOrder = [0, 2];
        const ADD_INTERVAL = 60;
        const ADD_CYCLE = addFillOrder.length * ADD_INTERVAL + 80;
        const addT = Math.max(0, t - 40) % ADD_CYCLE;
        const addFilled = Math.min(addFillOrder.length, Math.floor(addT / ADD_INTERVAL));

        for (let c = 0; c < patCols; c++) {
            const bx = gx + c * TILE, by = gy;
            let isOn = false;
            for (let i = 0; i < addFilled; i++) {
                if (addFillOrder[i] === c) isOn = true;
            }
            drawRect(bx, by, TILE, TILE, PAL.gridBorder);
            drawRect(bx + 1, by + 1, TILE - 2, TILE - 2, isOn ? addColor : PAL.gridOff);
            if (addTarget[c] && !isOn) {
                ctx.globalAlpha = 0.3 + Math.sin(t * 0.06) * 0.15;
                drawRect(bx + 1, by + 1, TILE - 2, 1, addColor);
                drawRect(bx + 1, by + TILE - 2, TILE - 2, 1, addColor);
                drawRect(bx + 1, by + 1, 1, TILE - 2, addColor);
                drawRect(bx + TILE - 2, by + 1, 1, TILE - 2, addColor);
                drawRect(bx + 6, by + 6, 4, 4, addColor);
                ctx.globalAlpha = 1;
            }
            if (isOn) {
                const fIdx = addFillOrder.indexOf(c);
                if (fIdx >= 0) {
                    const flashAge = addT - fIdx * ADD_INTERVAL;
                    if (flashAge >= 0 && flashAge < 12) {
                        ctx.globalAlpha = (1 - flashAge / 12) * 0.5;
                        drawRect(bx, by, TILE, TILE, "#ffffff");
                        ctx.globalAlpha = 1;
                    }
                }
            }
        }
        drawText("OUTLINES = ADD", gx - 2, gy + TILE + 10, "#efb775", 4);

        // --- TOP RIGHT: X marks (beats to REMOVE) ---
        const xgx = W / 2 + TILE;
        const xColor = "#efb775";
        const xIndicatorColor = "#9b1a0a";
        const xStartOn = [true, true, false, true];
        const xTarget = [true, false, false, true];
        const xRemoveOrder = [1];
        const X_INTERVAL = 80;
        const X_CYCLE = xRemoveOrder.length * X_INTERVAL + 100;
        const xT = Math.max(0, t - 60) % X_CYCLE;
        const xRemoved = Math.min(xRemoveOrder.length, Math.floor(xT / X_INTERVAL));

        for (let c = 0; c < patCols; c++) {
            const bx = xgx + c * TILE, by = gy;
            let isOn = xStartOn[c];
            for (let i = 0; i < xRemoved; i++) {
                if (xRemoveOrder[i] === c) isOn = false;
            }
            drawRect(bx, by, TILE, TILE, PAL.gridBorder);
            drawRect(bx + 1, by + 1, TILE - 2, TILE - 2, isOn ? xColor : PAL.gridOff);
            if (isOn && !xTarget[c]) {
                ctx.globalAlpha = 0.6 + Math.sin(t * 0.04) * 0.15;
                drawRect(bx + 3, by + 3, 2, 2, xIndicatorColor);
                drawRect(bx + 5, by + 5, 2, 2, xIndicatorColor);
                drawRect(bx + 7, by + 7, 2, 2, xIndicatorColor);
                drawRect(bx + 9, by + 9, 2, 2, xIndicatorColor);
                drawRect(bx + 9, by + 3, 2, 2, xIndicatorColor);
                drawRect(bx + 7, by + 5, 2, 2, xIndicatorColor);
                drawRect(bx + 5, by + 7, 2, 2, xIndicatorColor);
                drawRect(bx + 3, by + 9, 2, 2, xIndicatorColor);
                ctx.globalAlpha = 1;
            }
            if (!isOn && xStartOn[c]) {
                const fIdx = xRemoveOrder.indexOf(c);
                if (fIdx >= 0) {
                    const flashAge = xT - fIdx * X_INTERVAL;
                    if (flashAge >= 0 && flashAge < 12) {
                        ctx.globalAlpha = (1 - flashAge / 12) * 0.5;
                        drawRect(bx, by, TILE, TILE, "#ffffff");
                        ctx.globalAlpha = 1;
                    }
                }
            }
        }
        drawText("X MARKS = REMOVE", xgx, gy + TILE + 10, "#efb775", 4);

        // --- BOTTOM: Timer countdown ---
        const timerY = gy + TILE + 30;
        const TIMER_CYCLE = 180;
        const cT = Math.max(0, t - 30) % TIMER_CYCLE;
        const timerVal = Math.max(5, 30 - Math.floor(cT / 6));
        const isLow = timerVal <= 10;
        const isUrgent = timerVal <= 20;
        const timerColor = isUrgent ? "#ef3a0c" : "#efd8a1";
        const borderCol = isUrgent ? "#550f0a" : "#2a1d0d";
        const bgCol = isUrgent ? "#45230d" : "#392a1c";
        const hlCol = isUrgent ? "#9b1a0a" : "#684c3c";
        const blinkOn = !isUrgent || Math.floor(cT / (isLow ? 8 : 15)) % 2 === 0;

        const pxSz = 4;
        const digitW = 3 * pxSz + pxSz;
        const timerStr = timerVal < 10 ? "0" + timerVal : String(timerVal);
        const panelW = 16 + timerStr.length * digitW + 10;
        const panelH = 5 * pxSz + 8;
        const tpx = W / 2 - panelW / 2;
        const tpy = timerY;

        drawRect(tpx - 2, tpy - 2, panelW + 4, panelH + 4, borderCol);
        drawRect(tpx, tpy, panelW, panelH, bgCol);
        drawRect(tpx, tpy, panelW, 2, hlCol);

        const tix = tpx + 3, tiy = tpy + 4;
        drawRect(tix, tiy, 10, 2, blinkOn ? timerColor : bgCol);
        drawRect(tix + 4, tiy + 2, 2, 10, blinkOn ? timerColor : bgCol);

        if (blinkOn) {
            const numX = tpx + 16;
            const numY2 = tpy + 4;
            drawPixelDigits(timerStr, numX + (timerStr.length * digitW) / 2, numY2, timerColor, pxSz);
        }

        if (isLow && !blinkOn) {
            ctx.globalAlpha = 0.08;
            drawRect(0, 0, W, H, "#ef3a0c");
        }
        ctx.globalAlpha = 1;

        drawCenteredText("COMPLETE THE PATTERN BEFORE TIME RUNS OUT!", timerY + panelH + 12, "#efb775", 4);
    }

    // Blinking prompt
    const promptText = tutorialPage < 1 ? "PRESS ENTER" : "PRESS ENTER TO START";
    if (t > 20 && t % 60 < 40) {
        drawCenteredText(promptText, H - 10, "#efd8a1", 5);
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

    // Draw goblin sprite on top at current position
    if (cellIndex < sabotageCells.length) {
        const current = sabotageCells[Math.min(cellIndex, sabotageCells.length - 1)];
        const gx = (GRID_X + current.c) * TILE;
        const gy = rowPixelY(current.r);
        const frame = Math.floor(t / 6) % 4;
        const dir = current.r % 2 === 0 ? 3 : 2; // 3=right, 2=left
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
    drawRect(0, 0, W, H, "#1f240a");

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

    // Dark background (same as tutorial/instrument screens)
    drawRect(0, 0, W, H, "#1f240a");

    // Starfield
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(t * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#efac28" : "#efd8a1");
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

    if (enemyWarningType === "normal") {
        drawCenteredText("WATCH OUT!", 30, "#39FF14", 8);
        drawCenteredText("GOBLINS!", 55, "#39FF14", 6);
        drawGoblinSprite("normal", W / 2 - 8, 80 + bobOffset, gobFrame, { showShadow: false });
        drawCenteredText("THEY SABOTAGE YOUR BEATS!", 115, "#efb775", 5);
        drawCenteredText("PUNCH THEM TO DEFEAT THEM!", 132, "#efac28", 5);

    } else if (enemyWarningType === "elite") {
        drawCenteredText("WARNING!", 30, "#FF00FF", 8);
        drawCenteredText("ELITE GOBLIN", 55, "#FF44FF", 6);
        drawGoblinSprite("elite", W / 2 - 8, 80 + bobOffset, gobFrame, { showShadow: false });
        drawCenteredText("THIS GOBLIN IS EXTRA STRONG!", 115, "#efb775", 5);
        drawCenteredText("IT TAKES 3 HITS TO DEFEAT!", 132, "#FF44FF", 5);
        drawCenteredText("IT ALSO MOVES FASTER THAN NORMAL GOBLINS.", 155, "#efb775", 4);

    } else if (enemyWarningType === "catapult") {
        drawCenteredText("WARNING!", 30, "#FF00FF", 8);
        drawCenteredText("CATAPULT GOBLIN", 55, "#00FFFF", 6);
        drawGoblinSprite("catapult", W / 2 - 8, 80 + bobOffset, gobFrame, { showShadow: false });
        drawCenteredText("THIS GOBLIN THROWS BOULDERS!", 115, "#efb775", 5);
        drawCenteredText("IT HURLS ROCKS AT YOUR BEAT GRID FROM A DISTANCE.", 138, "#efb775", 4);
        drawCenteredText("IT CAN'T BE KILLED, BUT IT CAN KILL YOU!", 172, "#FF00FF", 4);
    }

    // Blinking "PRESS ENTER TO CONTINUE"
    if (t > 60 && t % 60 < 40) {
        drawCenteredText("PRESS ENTER TO CONTINUE", H - 10, "#efd8a1", 5);
    }

}

// ---- New Instrument Screen (full instruction style) ----
function renderNewInstrument() {
    newInstrumentTimer++;
    const t = newInstrumentTimer;
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background (same as tutorial)
    drawRect(0, 0, W, H, "#1f240a");

    // Starfield
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(t * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#efac28" : "#efd8a1");
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
        drawCenteredText("NEW INSTRUMENT!", 28, "#efac28", 8);
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
            drawCenteredText("A NEW ROW APPEARS BELOW THE KICK!", 135, "#efb775", 5);
            ctx.globalAlpha = 1;
        }
        if (t > 55) {
            const desc2Alpha = Math.min(1, (t - 55) / 30);
            ctx.globalAlpha = desc2Alpha;
            drawCenteredText("FILL IN THE COWBELL BEATS", 160, "#ef3a0c", 5);
            drawCenteredText("TO COMPLETE THE PATTERN!", 178, "#ef3a0c", 5);
            ctx.globalAlpha = 1;
        }

    } else if (newInstrumentType === "tom") {
        // Title with entrance animation
        const titleAlpha = Math.min(1, t / 30);
        ctx.globalAlpha = titleAlpha;
        drawCenteredText("NEW INSTRUMENT!", 28, "#efac28", 8);
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
            drawCenteredText("THE TOM DRUM JOINS THE MIX!", 135, "#efb775", 5);
            ctx.globalAlpha = 1;
        }
        if (t > 55) {
            const desc2Alpha = Math.min(1, (t - 55) / 30);
            ctx.globalAlpha = desc2Alpha;
            drawCenteredText("EVEN MORE BEATS TO MASTER!", 160, "#3c9f9c", 5);
            ctx.globalAlpha = 1;
        }
    }

    // Blinking "PRESS ENTER TO CONTINUE"
    if (t > 80 && t % 60 < 40) {
        drawCenteredText("PRESS ENTER TO CONTINUE", H - 12, "#efd8a1", 5);
    }
}

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    frameAccum += dt;
    if (frameAccum >= FRAME_MS) {
        frameAccum -= FRAME_MS;
        if (frameAccum > FRAME_MS) frameAccum = 0; // prevent spiral
        try {
            // Clear HUD canvas when not in gameplay
            if (gameState !== "playing") {
                hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
            }
            if (gameState === "title") {
                renderTitleScreen();
            } else if (gameState === "story") {
                renderStoryScreen();
            } else if (gameState === "tutorial") {
                renderTutorialScreen();
            } else if (gameState === "enemywarning-intro") {
                renderEnemyWarningIntro();
            } else if (gameState === "enemywarning") {
                renderEnemyWarning();
            } else if (gameState === "newinstrument") {
                renderNewInstrument();
            } else if (gameState === "sabotage-anim") {
                renderSabotageAnim();
            } else if (gameState === "levelcomplete") {
                renderLevelComplete();
            } else if (gameState === "gameover") {
                renderGameOverScreen();
            } else if (gameState === "highscore") {
                renderHighScoreEntry();
            } else {
                update(dt);
                render();
            }
        } catch (e) {
            console.error("Game loop error:", e);
        }
    }
    requestAnimationFrame(gameLoop);
}

loadHighScores();
requestAnimationFrame(gameLoop);
