// ============================================================
// BUZZ'S RHYTHM RAMPAGE - a drum-sequencer game in the StudioLand style
// ============================================================

const canvas = document.getElementById("game");
// `let`, not `const`: the ground-plane projection redirects every floor draw to
// an offscreen canvas and then maps that canvas onto the tilted plane. Every
// draw helper in this file reads the global at call time, so the swap is
// invisible to all of them. See PROJ.
let ctx = canvas.getContext("2d");
const MAIN_CTX = ctx;

// The single-file bundle inlines every asset as a data URI into window.__ASSETS
// and shims Image.src to look them up. Fonts and patterns don't go through
// Image.src, so they ask here instead — one branch, and the source keeps working
// unchanged from disk.
const assetURL = (p) => (window.__ASSETS && (window.__ASSETS[p] || window.__ASSETS[p.toLowerCase()])) || p;

// ---- The two StudioLand faces (shared with BUZZ's Wild Ride) ---------------
// Declared once and used only through these two constants, so nothing in the
// game hardcodes a family name. The fallback stacks are close in width to keep
// font-display:swap from reflowing much.
const FONT_DISP = "'DWFairfield','Arial Narrow',sans-serif";       // titles, big numbers
const FONT_BODY = "'TAYWingman','Segoe UI',system-ui,sans-serif";  // everything else
const fdisp = (px) => `${px}px ${FONT_DISP}`;
const fbody = (px) => `${px}px ${FONT_BODY}`;
// Every call site sizes text in logical units x SCALE, so one threshold sorts
// "titles and big numbers" from "everything else" without auditing 40 call
// sites by hand — and it keeps sorting them correctly when a size is animated.
const gfont = (px) => (px >= 7 * SCALE ? fdisp(px) : fbody(px));
(function declareFonts() {
    // The headless harnesses run game.js against a stubbed DOM with no <head>,
    // and a font declaration is not worth taking a whole test run down for.
    if (typeof document === "undefined" || !document.head) return;
    const s = document.createElement("style");
    s.textContent =
        `@font-face{font-family:'DWFairfield';src:url(${assetURL("assets/shared/dwfairfield.woff2")}) format('woff2');font-display:swap;}` +
        `@font-face{font-family:'TAYWingman';src:url(${assetURL("assets/shared/taywingman.woff2")}) format('woff2');font-display:swap;}`;
    document.head.appendChild(s);
})();

// ---- Constants ----
const TILE = 16;
const SCALE = 5;           // 80 device px per tile — cells 25% larger than the
                           // old SCALE 4, which is what the sequencer needed to
                           // stay readable on a phone
// The slack was all horizontal. A 16-column grid in a 24-column room left FOUR
// tiles of empty floor on each side — a third of the room was margin — and that
// is what made it read as too widescreen. Two tiles a side is enough to frame
// it, which takes the room to 2.00:1, cuts the letterboxing on a 16:9 desktop,
// and makes everything about 20% bigger on screen since the canvas is scaled to
// fit the window.
//
// The vertical axis is NOT the same story and is deliberately untouched: the
// grid already sits 2 rows down with 2 below it, one of those is the HUD, and
// BUZZ at 1.46 tiles already overlaps the grid's bottom edge. What looks like
// empty space down there on early levels is rows 5 and 6 of the grid waiting
// for cowbell (L11) and tom (L23).
const COLS = 20;           // room width in tiles
const ROWS = 10;           // room height in tiles
const GRID_COLS = 16;      // sequencer steps
const GRID_ROWS = 6;       // max drum channels (O, H, S, K, B, T)
const GRID_X = 2;          // grid start tile-x (centered: 2 + 16 + 2 = 20)
const GRID_Y = 2;          // grid start tile-y (centered: 2 + 6 + 2 = 10)
// Character rigs are authored in a 58-unit space and converted straight to
// device px, so they'd shrink relative to the room when SCALE changes. This
// pins them to the tile instead.
const RIG = SCALE / 4;
// The ceiling and the side walls are HALF a tile, not a full one. BUZZ is 1.46
// tiles tall and wider than a tile, so full-thickness bands spent a whole row
// and column on masonry he could never stand in — and once the page frame came
// off, those bands WERE the frame. Thinning them hands the space back to the
// room.
//
// The movement clamps stay where they are (one whole tile in from each edge):
// everything walks on the tile lattice, so a clamp at the new wall face would
// have to be a half-tile, which is not a position anything can occupy. The
// half tile that opens up beyond the clamp is walked *over* rather than stood
// on — it's the overhang his sprite already spilled into, now reading as floor
// instead of as wall. The top wall has worked exactly this way since it was
// thinned, and the floor keeps its full tile because the HUD band sits on it.
const WALL_TOP = TILE / 2;
const WALL_SIDE = TILE / 2;
// The walkable band, top and bottom, in pixels on the tile lattice.
//
// The top used to be row 1, and that dates from the procedural ceiling: a
// half-tile masonry band painted onto the floor plate, with the clamp a whole
// tile in because half a tile is not a position anything can stand on. The room
// has a real standing wall now and its foot IS the floor's far edge, so row 0 is
// floor all the way to the skirting — Carl's call, and the right one: the strip
// between the pads and the back wall is part of the room, not part of the
// scenery. The Donks get it too, or they cannot follow him up there.
//
// The bottom still gives up two rows. The last one is under the HUD band.
const WALK_TOP = 0;
const WALK_BOTTOM = (ROWS - 2) * TILE;
const GRID_Y_OFFSET = 0;   // no offset needed with centered layout
// The row BUZZ enters a new room on. It was the exit door's row; there is no
// exit door now, but the middle of the wall is still where you walk in.
const DOOR_TILE_Y = Math.floor(ROWS / 2);
// (gap row after kick removed)

// ============================================================
// STUDIOLAND INK — palette + line-boil engine
// Ported from BUZZ's Coaster Run: hand-inked charcoal on cream paper,
// re-inked on a 3-phase ~8fps clock so every line breathes as one hand.
// ============================================================
const INK = {
    paper:    "#fcf7e8", // BUZZ off-white
    charcoal: "#2C2C2A",
    mustard:  "#F6CC60", // Midway Mustard
    teal:     "#3A6168", // Harbor Teal
    mint:     "#BFCDC0", // Foggy Mint
    rust:     "#BF7538", // Rusty Turnstile
    red:      "#c05838", // decorative red
    green:    "#50ad33", // neon green
    silverL:  "#BFC9C1", // robot silver light
    silverD:  "#7A8F85", // robot silver dark
    alert:    "#FE3636", // DEADLY ONLY — never decorative (design bible)
};

// Every derived tone goes through here. The rule from the style doc is that
// nothing outside the palette may hardcode a tone: a shade written as a literal
// is orphaned the moment the palette moves, and this file had 208 distinct hex
// literals against a nine-colour system when that was last counted.
function mixC(a, b, t) {
    const p = (h) => {
        h = h.replace("#", "");
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
    const m = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
    return "#" + m(r1, r2) + m(g1, g2) + m(b1, b2);
}
// Shorthands for the two mixes that come up constantly: toward the ink, and
// toward the paper.
const darker = (c, t) => mixC(c, INK.charcoal, t);
const lighter = (c, t) => mixC(c, INK.paper, t);

// The boil clock + noise (verbatim from the coaster; amplitudes in device px)
//
// Every boiling surface exists as THREE baked copies and drawing is a swap —
// nothing is displaced inside the render loop. That is the same discipline the
// coaster uses when it re-seeds its filters only on a phase flip, and it is why
// turning the whole game's linework on costs nothing per frame.
//
// Sources are set independently because they are not equally good ideas: dense
// repeating marks (the 96 grid cells) can read as strobe rather than as a drawn
// line, which is why they were frozen to begin with. These are Carl's settings,
// arrived at on a switchboard that has since been retired now that the judgement
// is made. The room, the HUD and the text are deliberately still: with grain on
// and the linework boiling, everything moving at once was too much.
const BOIL = {
    on: true, rate: 130, amp: 0.7, freeze: false, frozenPhase: 0,
    room: false, grid: true, chars: true, hud: false, text: false,
    grain: true, grainAlpha: 0.56,
};
let perfNow = 0; // advanced once per frame in gameLoop
// Three drawings, stepped 0,1,2,1 — a PING-PONG, not a cycle. Counting
// 0,1,2,0,1,2 makes the wobble crawl in one direction, which is the giveaway
// that it's a loop; bouncing off the end is how boil is held on paper.
const BOIL_ORDER = [0, 1, 2, 1];
const boil = () => (!BOIL.on ? 0
    : BOIL.freeze ? BOIL.frozenPhase
    : BOIL_ORDER[Math.floor(perfNow / BOIL.rate) % 4]);
// Which baked phase a given surface should show. Off -> phase 0, frozen forever.
const boilPhase = (src) => (BOIL.on && BOIL[src]) ? boil() : 0;
function hashN(i, seed) { const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, seed) {
    const c = 46, i = Math.floor(x / c), t = x / c - i;
    const a = hashN(i, seed), b = hashN(i + 1, seed), u = (1 - Math.cos(t * Math.PI)) / 2;
    return a + (b - a) * u;
}
function jit(x, seed, amp) { return (vnoise(x, seed + boil() * 7.31) - 0.5) * 2 * amp * BOIL.amp; }
// Phase-explicit jitter for pre-rendered boil variants (textures are baked
// once per level in 3 phases, so they can't read the live clock)
function pjit(x, seed, phase, amp) { return (vnoise(x, seed + phase * 7.31) - 0.5) * 2 * amp * BOIL.amp; }


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
    // BGM disabled for now — sync issues to resolve later
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
        timerSeconds: 150,
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
        timerSeconds: 150,
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
        timerSeconds: 150,
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
        timerSeconds: 150,
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
        timerSeconds: 150,
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
        timerSeconds: 150,
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
        timerSeconds: 150,
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
        timerSeconds: 150,
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
        timerSeconds: 150,
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
        timerSeconds: 150,
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
        timerSeconds: 145,
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
        timerSeconds: 145,
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
        timerSeconds: 145,
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
        timerSeconds: 145,
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
        timerSeconds: 135,
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
        timerSeconds: 135,
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
        timerSeconds: 135,
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
        timerSeconds: 135,
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
        timerSeconds: 135,
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
        timerSeconds: 135,
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
        timerSeconds: 130,
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
        timerSeconds: 130,
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
        timerSeconds: 130,
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
        timerSeconds: 130,
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
        timerSeconds: 130,
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
        timerSeconds: 120,
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
        timerSeconds: 120,
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
        timerSeconds: 120,
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
        timerSeconds: 115,
    },
    // L30: Endless mode — no target pattern, survive until timer expires
    {
        name: "Level 30",
        activeRows: 6,
        noPattern: true, // special flag: no win condition, no hints
        pattern: [
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
            [false,false,false,false, false,false,false,false, false,false,false,false, false,false,false,false],
        ],
        goblinSpeed: 0.82,
        timerSeconds: 999,
    },
];

canvas.width = COLS * TILE * SCALE;
canvas.height = ROWS * TILE * SCALE;
ctx.imageSmoothingEnabled = true;

// ---- HUD canvas (below game canvas) ----
const hudCanvas = document.getElementById("hud");
const hudCtx = hudCanvas.getContext("2d");
// The HUD is a single tile tall and OVERLAYS the room's bottom wall band
// rather than claiming its own strip below the canvas. That band is
// impassable scenery, so the readout costs no play area at all — and on a
// height-limited screen (any phone in landscape) every cell gets ~15% bigger
// for free, on top of the tile change.
const HUD_H = 1 * TILE;
hudCanvas.width = COLS * TILE * SCALE;
hudCanvas.height = HUD_H * SCALE;
hudCtx.imageSmoothingEnabled = true;

// Each voice holds a LIST of takes, and a hit picks one. Real drums never
// repeat a hit exactly; one buffer fired sixteen times a bar is the sound of a
// machine, which is the one thing a kit sampled from a room should not be.
//
// The list is written out here rather than discovered, because a browser cannot
// read a directory — and neither can the published bundle, which has no
// filesystem at all, only the inlined table.
const AUDIO_BUFFERS = {};
// VOICE -> the folder it plays out of, and how many takes are in there.
//
// The two are kept apart on purpose. A voice is a ROW of the sequencer and its
// name is fixed by the code that triggers it; a folder is named for the sound
// actually in it. Pointing one at the other is then a one-line decision rather
// than a rename that leaves a directory called "snare" full of woodblocks.
//
// The S row plays the BLOCKS, per Carl. The B row picks up the snare he sent,
// so six rows still make six different sounds.
// [folder, takes, trim]. Trim is a linear gain applied at playback, NOT baked
// into the files — a fader on the mixer rather than a re-render, so it stays a
// number you can move and the samples keep every bit of the level Carl mixed
// them at. 0.5 is half amplitude, which is -6 dB.
const AUDIO_KIT = {
    openhat: ["openhat", 4, 0.5],   // -6 dB: it sat on top of everything else
    hihat:   ["hihat",   4, 1.0],
    snare:   ["block",   3, 1.0],
    kick:    ["kick",    4, 1.0],
    cowbell: ["snare",   1, 1.0],
    tom:     ["tom",     3, 1.0],
};
const AUDIO_TAKES = {};
const AUDIO_TRIM = {};
const AUDIO_SAMPLES = [];
for (const [voice, [folder, n, trim]] of Object.entries(AUDIO_KIT)) {
    AUDIO_TAKES[voice] = n;
    AUDIO_TRIM[voice] = trim === undefined ? 1 : trim;
    for (let i = 1; i <= n; i++) {
        AUDIO_SAMPLES.push([`${voice}#${i}`,
            `assets/audio/${folder}/${String(i).padStart(2, "0")}.wav`]);
    }
}
// Optional crowd call-and-response samples (synth fallback if missing)
AUDIO_SAMPLES.push(["yeah", "assets/audio/yeah.wav"], ["crowd", "assets/audio/crowd.wav"]);

// Which take each voice played last, so the picker never repeats one twice in
// a row. NOT a round-robin: the patterns here loop on 16 steps, so cycling a
// fixed order of N takes against a hit every M steps beats out a super-pattern
// of its own — three kicks against a four-on-the-floor gives you an audible
// twelve-step cycle. It is the same reason the line boil ping-pongs 0,1,2,1
// instead of counting 0,1,2. Random-without-immediate-repeat gives the variety
// with no order to hear.
const lastTake = {};
function pickTake(voice) {
    const n = AUDIO_TAKES[voice] || 0;
    if (n <= 1) return n ? 0 : -1;
    let i;
    if (lastTake[voice] === undefined) {
        // First hit of the session has nothing to avoid, so it draws from all
        // n. Falling through to the branch below would have compared against
        // undefined, quietly never picking the last take.
        i = Math.floor(Math.random() * n);
    } else {
        // Draw from the n-1 takes that are not the one just played, and map
        // that onto the real index. No re-rolling, so it cannot stall.
        i = Math.floor(Math.random() * (n - 1));
        if (i >= lastTake[voice]) i++;
    }
    lastTake[voice] = i;
    return i;
}

function loadAudioSample(key, src) {
    return fetch(src)
        .then(response => {
            if (!response.ok) throw new Error("Not found");
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            // Defer decoding until audioCtx exists
            AUDIO_BUFFERS[key] = arrayBuffer;
        })
        .catch(() => {
            AUDIO_BUFFERS[key] = null; // fallback to synthesized
        });
}

// Decode raw array buffers into AudioBuffers (must happen after audioCtx is created)
function decodeAudioSamples() {
    if (!audioCtx) return Promise.resolve();
    const promises = AUDIO_SAMPLES.map(([key]) => {
        if (AUDIO_BUFFERS[key] && !(AUDIO_BUFFERS[key] instanceof AudioBuffer)) {
            return audioCtx.decodeAudioData(AUDIO_BUFFERS[key].slice(0))
                .then(decoded => { AUDIO_BUFFERS[key] = decoded; })
                .catch(() => { AUDIO_BUFFERS[key] = null; });
        }
        return Promise.resolve();
    });
    return Promise.all(promises);
}

// Play a loaded audio sample at a specific time
function playSample(key, time, volume) {
    // A voice with takes resolves to one of them here, at trigger time, and
    // picks up its mixer trim on the way. Keys without takes (the crowd
    // samples) pass straight through at whatever the caller asked for.
    let trim = 1;
    if (AUDIO_TAKES[key]) {
        const i = pickTake(key);
        if (i < 0) return false;
        trim = AUDIO_TRIM[key];
        key = `${key}#${i + 1}`;
    }
    if (!AUDIO_BUFFERS[key] || !(AUDIO_BUFFERS[key] instanceof AudioBuffer)) return false;
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = AUDIO_BUFFERS[key];
    gain.gain.setValueAtTime((volume === undefined ? 1 : volume) * trim, time);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(time);
    return true; // sample played successfully
}

// ---- Background Music System ----





// The PNG preloader is gone: it was gated off, every image lookup was
// undefined, and every sprite branch fell through to the procedural drawing
// that is actually on screen. BUZZ and the Donks load separately, further down.
let assetsReady = true;
// Load audio samples in background — they'll be available when ready
Promise.all(AUDIO_SAMPLES.map(([key, src]) => loadAudioSample(key, src))).catch(() => {});

// The two hand-rolled speckle canvases that used to live here are gone. One
// (grainCanvas) was generated every load and never drawn at all; the other
// grained only the HUD. Both are replaced by the real StudioLand paper tile,
// which overlays the whole container on its own canvas — see PAPER GRAIN.

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

// The goblin rune alphabet lived here — a real substitution cipher, one rune
// per letter, feeding the glyph cutscenes and the carvings in the wall bands.
// The cutscenes went with the lore and the carvings have now gone too, so it
// had no callers left.



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

    // `plain` skips every one of the mottled patches, blobs and cracks below.
    // They are cave-stone leftovers: 4-16px rectangles and 6-20px circles on an
    // 80px tile, which at the size a sequencer cell is actually displayed read
    // as big procedural smudges rather than as paper. The real paper grain is
    // the 512px StudioLand tile, and it is already laid over the whole screen by
    // the #grain canvas — a cell wants to be a flat wash and let that do the
    // texturing. The fine pixel noise at the end still runs.
    if (o.plain) return finishStoneTile(g, c, size, rng);

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
            g.fillStyle = o.mossColor || "#55554f";
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

    return finishStoneTile(g, c, size, rng);
}

// Fine per-pixel roughness — the one texture pass that survives on a plain tile,
// because its marks are 1px. Mark size is what makes a texture subtle, not ink
// coverage (StudioLand grain notes).
function finishStoneTile(g, c, size, rng) {
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

// Generate stone tile for the grid — paper stone with a hand-inked
// charcoal border. Static wonk, not boil: 96 repeating tiles boiling in
// lockstep reads as strobe (coaster bible, the rail-ties lesson).
// ============================================================
// GROUND PLANE — 2D sprites standing in a 3D room
// ============================================================
// The room is drawn exactly as it always was, flat and square, into an
// offscreen canvas — then that whole canvas is laid down onto a tilted plane
// and the characters are stood back up on it as billboards.
//
// Doing it as a post-process rather than a rewrite is what makes it affordable.
// Every draw helper in this file positions in logical units and multiplies by
// SCALE at draw time, so the entire floor pipeline — room art, procedural cave,
// grid pads, lattice, playhead — needs no changes at all. Movement, collision
// and punch targeting never leave logical space either, so the GAME is
// completely untouched: this is a camera, not a rule.
//
// The plane is mapped in horizontal strips. A strip's distance decides how wide
// it is and how much screen height it gets, which is a receding floor and costs
// ~160 blits a frame.
const PROJ = {
    on: true,
    mode: "rake",    // "rake" | "oblique" | "iso" | "flat"

    // ---- The camera, as a camera ----------------------------------------
    // These two are a real pinhole looking at a real floor, and everything else
    // — the horizon, the convergence, the squash — falls out of them. They used
    // to be `tilt` and `lift`, which were a convergence ratio and a horizon
    // position: two independent fudges that between them could describe a view
    // no camera can take. Measured, `tilt` moved the far edge from 1040px to
    // 560px and never once changed the apparent camera angle, which stayed at
    // 35.5 degrees the whole way because that came from `lift` instead. A real
    // camera has one elevation and it decides both.
    //
    // It also fixes the curve. In a true view of a ground plane, apparent width
    // is linear in SCREEN Y; the old one was linear in the floor coordinate
    // with screen height accruing quadratically, so it compressed on a subtly
    // wrong law that read as perspective but would not sit beside a 3D
    // reference.
    angleDeg: 38,    // camera elevation above the floor. 90 = straight down.
    distance: 3.4,   // how far back, in room-depths. Near = wide and convergent,
                     // far = long lens, approaching no convergence at all.

    strips: 160,     // rake only — horizontal slices the plane is laid down in
    isoRatio: 0.5,   // iso only — 0.5 is classic 2:1
    squash: 0.55,    // oblique only — how far the floor lies away from you
};

// ---- The rake, as a pinhole camera ----------------------------------------
// Camera pitched down by `angleDeg`, placed so its axis meets the middle of the
// floor, far enough back that the floor's near edge exactly fills the frame's
// width. Depth v runs 0 at the far edge to 1 at the near edge.
function camParams() {
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    const phi = Math.max(4, Math.min(85, PROJ.angleDeg)) * Math.PI / 180;
    const D = H;                       // the room is as deep as it is tall flat
    const R = Math.max(0.6, PROJ.distance) * D;   // ground distance to its middle
    const h = R * Math.tan(phi);       // so the axis lands on the middle
    const f = h * Math.sin(phi) + (R - D / 2) * Math.cos(phi);  // near edge = full width
    return { W, H, phi, D, R, h, f };
}
function camScale(v, p) {
    const Z = p.R + p.D / 2 - v * p.D;
    return p.f / (p.h * Math.sin(p.phi) + Z * Math.cos(p.phi));
}
// Screen y already increases downward in this form: a near point has a positive
// value and a far one a negative, so it must NOT be negated again. It was, and
// the floor came out inside out — the far edge landing below the near one.
function camYRaw(v, p) {
    return camScale(v, p) * p.h / Math.cos(p.phi) - p.f * Math.tan(p.phi);
}
// The floor's near edge parks on the HUD band; the horizon lands wherever the
// camera puts it, which is the point — it is no longer a number anyone chose.
function camFit() {
    const p = camParams();
    const bottom = p.H - HUD_H * SCALE;
    const yNear = camYRaw(1, p);
    return { p, bottom, yNear };
}
const projScale = (v) => camScale(v, camParams());
function projY(v) {
    const f = camFit();
    return f.bottom - (f.yNear - camYRaw(v, f.p));
}

// ---- Oblique --------------------------------------------------------------
// The camera drops toward the floor without turning. The room stays square to
// the screen — sixteen steps still run left to right, every cell the same width
// as every other — and depth comes entirely from the floor lying away from you
// and from everything on it standing up.
//
// It keeps the one property of isometric that is worth having here: NO
// convergence and NO depth scaling, so the far end of the sequencer is exactly
// as legible as the near end. It drops the one that costs: the 45 degree turn
// that puts the timeline on a diagonal.
//
// The floor's bottom edge parks on top of the HUD band, so the headroom it
// gains is at the TOP — which is where a back wall goes when the room is
// redrawn.
function obliqueFit() {
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    const floorH = H * PROJ.squash;
    const bottom = H - HUD_H * SCALE;
    return { W, H, floorH, top: bottom - floorH };
}

function obliquePoint(dx, dy) {
    const f = obliqueFit();
    return { x: dx, y: f.top + dy * PROJ.squash, s: 1 };
}

function blitOblique() {
    const f = obliqueFit();
    MAIN_CTX.drawImage(PLANE, 0, 0, f.W, f.H, 0, f.top, f.W, f.floorH);
}

// ---- Isometric ------------------------------------------------------------
// The room turned 45 degrees in plan and squashed vertically, which is the
// projection people mean by "isometric": a square floor becomes a diamond, and
// there is NO convergence and NO depth scaling — a tile at the back is exactly
// the size of a tile at the front. That is the property that makes it readable,
// and it is why sprites in an isometric game are never scaled by distance.
//
// It is a pure affine map, so unlike the rake it needs no strips at all: one
// setTransform and one drawImage puts the whole floor down, exactly.
function isoFit() {
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    const k = PROJ.isoRatio;
    const bw = (W + H) * 0.5;          // projected bounding box
    const bh = (W + H) * 0.5 * k;
    // Keep clear of the bottom band: the HUD is its own canvas printed there.
    const avail = H - HUD_H * SCALE;
    const s = Math.min(W / bw, avail / bh);
    return {
        s, k, H,
        padX: (W - bw * s) / 2,
        padY: (avail - bh * s) / 2,
    };
}

// A floor point in device px -> where it lands on screen, isometric.
function isoPoint(dx, dy) {
    const f = isoFit();
    return {
        x: f.padX + f.s * ((dx - dy) * 0.5 + f.H / 2),
        y: f.padY + f.s * ((dx + dy) * 0.5 * f.k),
        s: 1,     // isometric does not scale with distance. That is the point.
    };
}

function blitIso() {
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    const f = isoFit();
    MAIN_CTX.save();
    MAIN_CTX.setTransform(
        f.s * 0.5, f.s * 0.5 * f.k,     // what one step along the room's X does
        -f.s * 0.5, f.s * 0.5 * f.k,    // and one step along its Y
        f.padX + f.s * f.H / 2, f.padY);
    MAIN_CTX.drawImage(PLANE, 0, 0);
    MAIN_CTX.restore();
}

const PLANE = document.createElement("canvas");
let PLANE_CTX = null;
function planeCtx() {
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    if (PLANE.width !== W || PLANE.height !== H) { PLANE.width = W; PLANE.height = H; PLANE_CTX = null; }
    if (!PLANE_CTX) PLANE_CTX = PLANE.getContext("2d");
    return PLANE_CTX;
}

// A point on the floor, in device px, to where it lands on screen.
function projPoint(dx, dy) {
    if (PROJ.mode === "oblique") return obliquePoint(dx, dy);
    if (PROJ.mode === "iso") return isoPoint(dx, dy);
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    const v = Math.max(0, Math.min(1, dy / H));
    const s = projScale(v);
    return { x: W / 2 + (dx - W / 2) * s, y: projY(v), s };
}

// What sits behind and around the room once it no longer fills the frame.
//
// Flat, warm and dark — the paper's own charcoal biased a little toward the
// paper, never a pure grey and never black. A projected room leaves real space
// around it and that space has to be a decision: cleared canvas reads as a hole
// cut in the page, which is the same mistake the title card's missing shadow
// made.
function paintSurround() {
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    MAIN_CTX.fillStyle = mixC(INK.charcoal, INK.paper, 0.06);
    MAIN_CTX.fillRect(0, 0, W, H);
}

// The back wall STANDS UP. It is not part of the plane and is never projected —
// that is the whole reason it is a separate image. It is scaled to meet the
// floor's far edge exactly: same width as the horizon, its foot on the horizon
// line, and whatever height its own proportions give it. Cropped by the top of
// the frame is correct; you do not see the ceiling of a room you are standing
// in.
function drawBackWall() {
    const b = currentBiome;
    if (!b || PROJ.mode !== "rake") return;
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    const hw = W * projScale(0);          // the horizon: how wide the far wall is
    const y = projY(0);                   // and where its foot sits
    const x0 = (W - hw) / 2;

    // A REPEATING PANEL, which is a better object than one wide plate.
    //
    // The horizon's width is a function of the tilt, so a single image has to be
    // stretched to whatever that happens to be — and stretched DOWN, since the
    // plate was authored wider than the horizon ever is. A panel is drawn once
    // at its own size and repeated, so it keeps its resolution, it fits any
    // tilt, and one panel recoloured gives all six biomes a wall.
    //
    // Repeats are a whole number. A wall that ends on two thirds of a panel is a
    // wall someone built wrong, and the eye finds that seam immediately — so the
    // panel width bends to the room rather than the room being left with a
    // remainder. Measured on Carl's panel, the left and right edges differ by
    // 3.2 of a possible 765, so the joins do not need hiding.
    // ONE DRAW, from a wall that was already stitched in the file.
    //
    // Carl's idea, and it removes the whole class of bug rather than another
    // instance of it: every seam so far came from the game joining panels at
    // run time. Panels joined in the image have no joins left for the renderer
    // to get wrong — no per-panel rounding, no interpolation at the butt, and
    // for the side walls no slice can straddle a panel edge because there are
    // no edges inside the strip.
    const strip = b.wallStrip ? ROOM_ART[b.wallStrip] : null;
    const tile = b.wallTile ? ROOM_ART[b.wallTile] : null;
    if (strip && tile) {
        const want = y;
        const ideal = tile.width * (want / tile.height);
        const n = Math.max(1, Math.min(b.stripPanels, Math.round(hw / ideal)));
        const th = strip.height * ((hw / n) / tile.width);
        // take the first n panels of the strip, and lay them across in one go
        MAIN_CTX.drawImage(strip, 0, 0, tile.width * n, strip.height,
                           x0, y - th, hw, th);
        drawWallProps(x0, y - th, hw, th);
        return;
    }
    if (tile) {
        const want = y;                                   // fill the headroom
        const ideal = tile.width * (want / tile.height);
        const n = Math.max(1, Math.round(hw / ideal));
        const tw = hw / n;
        const th = tile.height * (tw / tile.width);
        // WHOLE PIXELS, and a pixel of overlap.
        //
        // The room does not boil — BOIL.room is false and always was — so the
        // seams between panels were never boil. They are resampling: a panel
        // landing on a fractional x gets its edge column interpolated against
        // whatever is behind it, and sixteen of those in a row is a set of
        // faint vertical rules down the wall. Snapping each panel to an integer
        // and letting it overlap its neighbour by one pixel removes both the
        // interpolation and the hairline the rounding would otherwise leave.
        const yT = Math.round(y - th), hT = Math.ceil(th);
        for (let i = 0; i < n; i++) {
            const xa = Math.round(x0 + i * tw);
            const xb = Math.round(x0 + (i + 1) * tw);
            MAIN_CTX.drawImage(tile, xa, yT, (xb - xa) + 1, hT);
        }
        drawWallProps(x0, y - th, hw, th);
        return;
    }

    const art = b.wallArt ? ROOM_ART[b.wallArt] : null;
    if (!art) return;
    const h = hw * (art.height / art.width);
    MAIN_CTX.drawImage(art, x0, y - h, hw, h);
}

// The side walls, rising from the floor's left and right edges and running away
// from the camera.
//
// They are built from the same panel as the back wall, sliced BY DEPTH: each
// strip is a vertical slice of the panel stood up at the floor's edge, as tall
// as the wall is at that distance. Their height is not chosen — it is derived
// from the back wall's, so the three meet exactly at the corners however the
// camera moves.
//
// The doorways are holes in this, not decoration. The Donks spawn at tile row 3
// because the drawn room cut its openings at rows 1.7 to 4.0, so those rows are
// where the wall does not get drawn — move them and the spawn row moves.
const DOOR_V0 = 1.7 / ROWS, DOOR_V1 = 4.0 / ROWS;

// The side walls, baked once and blitted.
//
// Carl asked why they slice at all instead of drawing one image into the
// trapezoid. The answer is that Canvas 2D cannot: drawImage's transform is
// AFFINE — six numbers — and an affine map turns a rectangle into a
// parallelogram, never a trapezoid, because it cannot make two opposite edges
// different lengths. A wall receding from the camera is exactly that. The
// transform that can do it is projective, which this renderer does not have.
//
// But the camera is fixed, so the trapezoid is fixed. The slicing is a
// CONSTANT, and constants belong in a cache: it runs once into an offscreen
// canvas and every frame after that is a single blit of one static bitmap.
//
// That also settles the shimmer for good. A bitmap drawn at the same integer
// position every frame cannot differ between frames, whatever the slicing did
// while it was being built — and it can afford far finer slices than a
// per-frame version could, because it pays for them once.
const SIDE_WALLS = { parts: [], key: "" };

// What the bake was made FROM — including whether each piece had actually
// arrived, not just which piece was asked for.
//
// This matters now that the bake is kicked off by the art loader rather than by
// the first frame that draws it. Images land in whatever order the network
// returns them, so the first one to arrive fires the bake; when that happened
// before the door sprite had loaded, the wall was baked with an empty doorway —
// and a key naming only `doorArt` could not tell that apart from the door being
// there, so the door never appeared. Presence is part of the identity.
function sideWallKey() {
    const b = currentBiome;
    const have = (k) => (k && ROOM_ART[k] ? 1 : 0);
    return [PROJ.mode, PROJ.angleDeg, PROJ.distance, COLS, ROWS, TILE, SCALE,
            b && b.wallTile, have(b && b.wallTile),
            b && b.wallStrip, have(b && b.wallStrip),
            b && b.doorArt, have((b && b.doorArt) || "props/door")].join("|");
}

function buildSideWalls() {
    const b = currentBiome;
    const tile = b && b.wallTile ? ROOM_ART[b.wallTile] : null;
    const strip = b && b.wallStrip ? ROOM_ART[b.wallStrip] : null;
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;

    // SUPERSAMPLED, because this is baked once and resolution is free here.
    //
    // Everything on this wall is a thin line meeting the screen at a shallow
    // angle — the panel's own outline, the dado rail, the skirting, the edges
    // of the doorway — and every one of them lands on a fraction of a pixel.
    // At 1:1 that is a dotted line and no amount of slicing fixes it, because
    // the information is smaller than the pixel it has to live in. Drawn at
    // double and boxed down, each of those fractions becomes a grey, which is
    // what a drawn line looks like at this size.
    // Each wall gets its own canvas, sized to the wall — supersampling the whole
    // 1600x800 frame spent 63ms of the bake boxing down empty space, and the two
    // walls between them occupy about a ninth of it.
    const SS = 2;
    if (!tile) return [];

    const hw = W * projScale(0);
    const ideal = tile.width * (projY(0) / tile.height);
    const nBack = Math.max(1, Math.round(hw / ideal));
    const wallH = (tile.height * ((hw / nBack) / tile.width)) / projScale(0);
    const nSide = Math.max(1, Math.round(H / (W / nBack)));
    const at = (v, side) => {
        const sc = projScale(v);
        return { x: W / 2 + side * (W / 2) * sc, y: projY(v), h: wallH * sc };
    };

    // MINIFY THE SHEET FIRST, HORIZONTALLY ONLY.
    //
    // The side wall shows nSide panels — around 2100 pixels of drawing — inside
    // about 130 pixels of screen, because it is seen at a glancing angle. That
    // is a 16:1 reduction across, and a reduction that severe cannot be left to
    // the draw: bilinear sampling takes two texels out of every sixteen and the
    // wall arrives as a picket fence. It has to be a box filter, and it has to
    // be horizontal only — vertically the wall is barely reduced at all, so a
    // proportional mip would throw away the linework it is trying to protect.
    const span = Math.abs(at(1, -1).x - at(0, -1).x);   // the wall's screen run

    // Without a pre-composed strip, compose one — nSide copies of the panel side
    // by side. One code path, and no slice can straddle a join.
    let sheet = strip;
    if (!sheet) {
        const c = document.createElement("canvas");
        c.width = tile.width * nSide; c.height = tile.height;
        const gg = c.getContext("2d");
        mipping = true;
        try { for (let i = 0; i < nSide; i++) gg.drawImage(tile, i * tile.width, 0); }
        finally { mipping = false; }
        sheet = c;
    }
    const usedFrac = (tile.width * nSide) / sheet.width; // how much of it the wall uses
    // Halve until one panel is about twice its screen width, so the slices
    // resample DOWN by a hair rather than up.
    const wantPanel = Math.max(24, (span / nSide) * 2 * SS);
    let panelW = tile.width;
    while (panelW / 2 >= wantPanel && sheet.width > 16) {
        sheet = mipStep(sheet, Math.max(1, Math.round(sheet.width / 2)), sheet.height);
        panelW /= 2;
    }
    const usedW = sheet.width * usedFrac;               // sheet px the wall spans

    // ONE SLICE PER SCREEN COLUMN, not one per fixed fraction of the wall.
    //
    // A slice narrower than a pixel has two soft edges and covers neither of
    // them fully, so where two of them meet the wall is drawn twice at partial
    // strength and never reaches full. Hundreds of those in a row is why every
    // line on the wall came out dotted. A slice that lands on whole pixel
    // columns has no horizontal seam to soften at all — the only antialiasing
    // left is at its top and bottom, which is where it belongs.
    //
    // The whole-pixel columns a span covers, in the order they are to be drawn.
    // One per FINAL pixel, not per supersampled one: the supersampling is what
    // softens the edges, and doubling the slice count doubles a bake that is
    // already the most expensive thing in the frame it lands on.
    const STEP = 1;
    const columns = (lo, hi, backwards) => {
        const out = [];
        for (let c = Math.floor(lo / STEP) * STEP; c < hi; c += STEP) out.push(c);
        return backwards ? out.reverse() : out;
    };

    // x(v) is monotonic, so the v at a column edge comes back by bisection.
    const vOfX = (x, side) => {
        let lo = 0, hi = 1;
        for (let k = 0; k < 30; k++) {
            const mid = (lo + hi) / 2;
            if ((W / 2 + side * (W / 2) * projScale(mid) < x) === (side < 0)) hi = mid;
            else lo = mid;
        }
        return (lo + hi) / 2;
    };
    const parts = [];
    for (const side of [-1, 1]) {
        const F = at(0, side), N = at(1, side);
        const lo = Math.min(F.x, N.x), hi = Math.max(F.x, N.x);
        // whole-pixel bounds with a pixel of margin, so the blit lands 1:1 and
        // the column grid still falls on device pixels after the translate
        const bx = Math.floor(lo) - 1, by = Math.floor(Math.min(F.y - F.h, N.y - N.h)) - 1;
        const bw = Math.ceil(hi) + 1 - bx, bh = Math.ceil(Math.max(F.y, N.y)) + 1 - by;
        const big = document.createElement("canvas");
        big.width = bw * SS; big.height = bh * SS;
        const g = big.getContext("2d");
        g.scale(SS, SS); g.translate(-bx, -by);
        // ...and drawn in the direction the slice runs. Each one overhangs its
        // neighbour by half its width, and that overhang carries the wrong
        // depth's art — so it has to land on ground not painted yet. Marching
        // the other way, every column was half overwritten by the next one's
        // overhang, which is what was dotting the lines on the wall.
        for (const c of columns(lo, hi, side < 0)) {
            const xL = Math.max(lo, c), xR = Math.min(hi, c + STEP);
            if (xR <= xL) continue;
            // the far end of the column first, so the slice runs far -> near
            const vL = vOfX(side < 0 ? xR : xL, side), vR = vOfX(side < 0 ? xL : xR, side);
            const A = at(vL, side), B = at(vR, side);
            const sw = Math.max(1e-6, (vR - vL) * usedW);
            const sx = vL * usedW;
            const bleed = sw * 0.5;      // generous: it is baked, not composited
            g.save();
            g.transform((B.x - A.x) / sw, ((B.y - B.h) - (A.y - A.h)) / sw,
                        0, A.h / sheet.height, A.x, A.y - A.h);
            g.drawImage(sheet, sx, 0, Math.min(sw + bleed, sheet.width - sx), sheet.height,
                        0, 0, sw + bleed, sheet.height);
            g.restore();
        }
        // The opening, cut INTO a wall that was drawn all the way across.
        //
        // It used to be a gap: the slices in the doorway's depth range were
        // skipped entirely, so the hole ran from the floor to the ceiling and
        // the strip above the door — where a real room has a lintel and more
        // wall — was left showing the void behind. Painting the wall first and
        // the recess over it puts that strip back and costs nothing, because
        // this is baked.
        const D0 = at(DOOR_V0, side), D1 = at(DOOR_V1, side), top = 0.86;
        g.beginPath();
        g.moveTo(D0.x, D0.y); g.lineTo(D1.x, D1.y);
        g.lineTo(D1.x, D1.y - D1.h * top); g.lineTo(D0.x, D0.y - D0.h * top);
        g.closePath();
        g.fillStyle = mixC(INK.charcoal, INK.paper, 0.08); g.fill();

        // The door art is sliced by depth too, for the same reason the wall is.
        // Drawn as ONE affine image it is a parallelogram: both its edges get
        // the height of the far one, so it falls short of the opening at the
        // near end and leaves a bare strip between the top of the door and the
        // top of the wall. Sliced, it fills the trapezoid it is standing in.
        const dArt = ROOM_ART[b.doorArt || "props/door"];
        if (dArt) {
            // Same two rules as the wall: squeeze the sheet horizontally first,
            // then slice it on whole screen columns. A door is 350 pixels of
            // drawing landing in about 28, so it needs both at least as much.
            const dLo = Math.min(D0.x, D1.x), dHi = Math.max(D0.x, D1.x);
            let dSheet = dArt;
            while (dSheet.width / 2 >= Math.max(16, (dHi - dLo) * 2 * SS) && dSheet.width > 16) {
                dSheet = mipStep(dSheet, Math.max(1, Math.round(dSheet.width / 2)), dSheet.height);
            }
            const dv = DOOR_V1 - DOOR_V0;
            for (const c of columns(dLo, dHi, side < 0)) {
                const xL = Math.max(dLo, c), xR = Math.min(dHi, c + STEP);
                if (xR <= xL) continue;
                const vL = vOfX(side < 0 ? xR : xL, side), vR = vOfX(side < 0 ? xL : xR, side);
                const A = at(vL, side), B = at(vR, side);
                const sw = Math.max(1e-6, ((vR - vL) / dv) * dSheet.width);
                const sx = ((vL - DOOR_V0) / dv) * dSheet.width;
                const bleed = sw * 0.5;
                g.save();
                g.transform((B.x - A.x) / sw,
                            ((B.y - B.h * top) - (A.y - A.h * top)) / sw,
                            0, (A.h * top) / dSheet.height, A.x, A.y - A.h * top);
                g.drawImage(dSheet, sx, 0, Math.min(sw + bleed, dSheet.width - sx), dSheet.height,
                            0, 0, sw + bleed, dSheet.height);
                g.restore();
            }
        }
        parts.push({ canvas: SS === 1 ? big : mipStep(big, bw, bh), x: bx, y: by });
    }
    return parts;
}

// Bake as soon as the art lands rather than on the first frame that draws it.
// The bake is ~60ms, and on the first frame of a level that lands inside the
// audio scheduler's 100ms lookahead — a stall there is a dropped drum, not just
// a dropped frame. Called from the room-art loader, which runs on the title
// screen where there is nothing to drop.
function warmSideWalls(needed) {
    const b = currentBiome;
    if (!b || !b.wallTile || !ROOM_ART[b.wallTile] || !PROJ.on || PROJ.mode !== "rake") return false;
    // From the loader, hold off until every piece has landed — otherwise it
    // bakes once per arrival. From a frame, bake with whatever is there, which
    // is also the fallback if a piece never arrives at all.
    if (!needed && ((b.wallStrip && !ROOM_ART[b.wallStrip]) ||
                    !ROOM_ART[b.doorArt || "props/door"])) return false;
    const key = sideWallKey();
    if (SIDE_WALLS.key !== key) { SIDE_WALLS.parts = buildSideWalls(); SIDE_WALLS.key = key; }
    return true;
}

function drawSideWalls() {
    const b = currentBiome;
    if (!warmSideWalls(true)) return;
    for (const p of SIDE_WALLS.parts) ctx.drawImage(p.canvas, p.x, p.y);

    // The spawn tell is the one live part, so it stays out of the bake.
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    const hw = W * projScale(0);
    const tile = ROOM_ART[b.wallTile];
    const ideal = tile.width * (projY(0) / tile.height);
    const nBack = Math.max(1, Math.round(hw / ideal));
    const wallH = (tile.height * ((hw / nBack) / tile.width)) / projScale(0);
    for (const side of [-1, 1]) {
        const vm = (DOOR_V0 + DOOR_V1) / 2, sc = projScale(vm);
        const x = W / 2 + side * (W / 2) * sc, y = projY(vm), h = wallH * sc;
        const cave = CAVES[side < 0 ? 0 : 1];
        for (const g of goblins) {
            if (!g.dead || g.respawnTimer >= 60 || CAVES[g.spawnCave] !== cave) continue;
            const er = 2 * SCALE * sc;
            ctx.fillStyle = g.elite ? INK.mint : "#50ad33";
            ctx.beginPath(); ctx.arc(x - er * 1.2, y - h * 0.5, er, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + er * 1.2, y - h * 0.5, er, 0, Math.PI * 2); ctx.fill();
            break;
        }
    }
}

// Lit pads, waiting to be stood up once the floor is down. Cleared each frame.
let padRises = [];

// The pads' rise, drawn in screen space so it is genuinely vertical. A pad's
// top face travels with the floor; its front face is the wall between that face
// and the pad's footprint, and that wall is upright no matter how the floor is
// raked.
function drawPadRises() {
    if (!PROJ.on) { padRises.length = 0; return; }
    const size = TILE * SCALE;
    const w = size - PAD_INSET * 2;
    for (const pr of padRises) {
        const face = pr.struck ? PAD_FACE_PRESSED : PAD_FACE;
        // the pad's own bottom edge, on the floor
        const yFoot = pr.bys + size - PAD_FOOT;
        const L = projPoint(pr.bxs + PAD_INSET, yFoot);
        const R = projPoint(pr.bxs + PAD_INSET + w, yFoot);
        const rise = face * L.s;
        ctx.fillStyle = mixC(GLOW_COLORS[pr.r], INK.charcoal, 0.42);
        ctx.fillRect(L.x, L.y - rise, R.x - L.x, rise);
        ctx.fillStyle = "rgba(44,44,42,0.5)";
        ctx.fillRect(L.x, L.y - rise, R.x - L.x, 1);
    }
    padRises.length = 0;
}

// The door, the clock, the safety poster and the rest, hung on the wall rather
// than drawn into it. Cut out of the busy plate as transparent sprites, they can
// be placed anywhere, reused on any biome's wall, and never stretch when the
// wall's panel count changes — which a wall that IS one drawing cannot do.
function drawWallProps(wx, wy, ww, wh) {
    const list = (currentBiome && currentBiome.wallProps) || [];
    for (const pr of list) {
        const art = ROOM_ART["props/" + pr.art];
        if (!art) continue;
        const h = wh * pr.h;
        const w = h * (art.width / art.height);
        // A door stands ON the floor. Saying that, rather than giving it a y
        // that happens to land there, is what keeps it standing there when the
        // art is redrawn a few pixels taller — a hovering door reads as a lip
        // you would have to step over.
        const cy = pr.foot ? wh - h / 2 : wh * pr.y;
        MAIN_CTX.drawImage(art, wx + ww * pr.x - w / 2, wy + cy - h / 2, w, h);
    }
    drawWallScoreboard(wx, wy, ww, wh);
}

// Is the wall carrying the readouts this level? Five of the six biomes have no
// wall art yet, and a room with no wall to hang a board on still needs its
// numbers — so the bottom band stays the fallback rather than being deleted.
function hudOnWall(biome) {
    const b = biome || currentBiome;
    return !!(b && b.scoreboard && b.wallTile && ROOM_ART[b.wallTile]
              && PROJ.on && PROJ.mode === "rake");
}

// THE READOUTS, HUNG ON THE WALL.
//
// Carl's call, and it solves a problem rather than moving one. The pale band
// along the bottom of the room was not scenery: the numbers printed straight
// onto it, and they measure 1.4:1 against the floor planks versus 8.38:1 against
// that band, so the band existed to be something for type to sit on. Put the
// numbers on the wall and it has no job left.
//
// It is drawn, not blitted, for the same reason the pads are: the numbers change
// every frame and a baked board would have to be rebaked every frame. The PLATE
// is what makes it read as an object — a cream board screwed to the wall, in the
// room's own ink — and the plate is cheap.
//
// Placement is in WALL SPACE, like the props: fractions of the wall's width and
// height, so it survives a change of tilt, of horizon, or of panel count.
function drawWallScoreboard(wx, wy, ww, wh) {
    // Nothing to report before the shift starts. A board reading SCORE 00000 on
    // the attract screen is not wrong, but an empty one would look broken and a
    // filled one is a claim about a run that has not happened.
    if (!hudOnWall() || gameState === "title") return;
    const sb = currentBiome.scoreboard;
    const g = MAIN_CTX;

    // CARL'S PLAQUE, with the game printing into it.
    //
    // The art carries its own LEVEL / SCORE / TIME lettering and three empty
    // wells, so the game supplies numbers and nothing else. The wells were
    // MEASURED off the file rather than typed by eye — they are cream on a cream
    // plate, so no colour key can find them, but their outlines SEAL them: flood
    // the non-ink pixels in from the border and the only region you reach is the
    // background, which leaves every well as its own walled-in component. All
    // three came back at a fill ratio of 1.00. See tools/cut-scoreboard.py.
    const art = sb.art ? ROOM_ART[sb.art] : null;
    if (art) {
        // sized by WIDTH, with the height from the art's own proportions, so a
        // redrawn plaque of a different shape still hangs correctly
        const w = ww * sb.w, h = w * (art.height / art.width);
        const x = wx + ww * sb.x - w / 2, y = wy + wh * sb.y - h / 2;
        g.drawImage(art, x, y, w, h);

        const put = (key, text, col, hero) => {
            const q = sb.wells[key];
            const rx = x + q[0] * w, ry = y + q[1] * h;
            const rw = (q[2] - q[0]) * w, rh = (q[3] - q[1]) * h;
            g.save();
            g.textAlign = "center"; g.textBaseline = "middle";
            g.font = fdisp(rh * 0.78);
            // the mustard offset belongs to the hero number alone — on a well
            // this small it turns the two-digit readouts to mush
            if (hero) {
                g.fillStyle = INK.mustard;
                g.fillText(text, rx + rw / 2 + rh * 0.07, ry + rh / 2 + rh * 0.07);
            }
            g.fillStyle = col;
            g.fillText(text, rx + rw / 2, ry + rh / 2);
            g.restore();
        };

        put("score", String(score).padStart(5, "0"), INK.charcoal, true);
        put("level", String(currentLevel + 1).padStart(2, "0"), INK.charcoal, false);

        // The clock is the only way to lose, so it keeps the warning states it
        // had: rust from 30 seconds, alert red only at 10 — the reserved colour,
        // for the one thing in this game that can end a run.
        const timerSec = Math.max(0, Math.ceil(levelTimer / 60));
        const isUrgent = timerSec <= 30, isCritical = timerSec <= 10;
        const blinkOn = !isUrgent || Math.floor(levelTimer / (isCritical ? 15 : 30)) % 2 === 0;
        if (blinkOn) {
            put("time", timerSec < 10 ? "0" + timerSec : String(timerSec),
                isCritical ? INK.alert : isUrgent ? INK.rust : INK.charcoal, false);
        }

        // Equipment recovered. The plaque has no well for this, so it is the
        // one thing on here I placed rather than measured: the crest above the
        // score, where they read as indicator lamps. Easy to move — the spot is
        // two numbers on the biome.
        const earned = djSetupEarned.length, total = DJ_SETUP_PIECES.length;
        if (earned > 0 || currentLevel >= 4) {
            const pip = Math.max(2, h * 0.040), gap = pip * 1.9;
            const cx2 = x + sb.pips[0] * w, cy2 = y + sb.pips[1] * h;
            for (let i = 0; i < total; i++) {
                g.fillStyle = i < earned ? INK.mustard : mixC(INK.charcoal, INK.paper, 0.62);
                g.fillRect(cx2 + (i - (total - 1) / 2) * gap - pip / 2, cy2 - pip / 2, pip, pip);
            }
        }
        return;
    }

    // Fallback while the plaque is still loading, or for a biome that has none:
    // a plain board in the room's own ink, laid out the same way. A slow load
    // should be a plainer board, not a hole in the wall.
    const w = ww * sb.w, h = wh * (sb.hFallback || 0.36);
    const x = wx + ww * sb.x - w / 2, y = wy + wh * sb.y - h / 2;
    const r = Math.max(2, h * 0.06);

    g.save();
    // the board itself: cream plate, charcoal outline, a screw in each top corner
    g.fillStyle = INK.paper;
    g.strokeStyle = INK.charcoal;
    g.lineWidth = Math.max(1.5, h * 0.022);
    g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); g.stroke();
    g.fillStyle = mixC(INK.charcoal, INK.paper, 0.45);
    for (const sx of [x + w * 0.035, x + w * 0.965]) {
        g.beginPath(); g.arc(sx, y + h * 0.12, Math.max(1.2, h * 0.028), 0, Math.PI * 2); g.fill();
    }

    // SCORE, the hero — same hierarchy as the band it replaces: size and face do
    // the work, and the mustard offset stands the numerals off the plate.
    const numPx = h * 0.40, labPx = h * 0.115;
    const cx = x + w / 2, scoreY = y + h * 0.53;
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.font = fbody(labPx);
    g.fillStyle = mixC(INK.charcoal, INK.paper, 0.38);
    g.fillText("SCORE", cx, y + h * 0.19);
    g.font = fdisp(numPx);
    const scoreStr = String(score).padStart(5, "0");
    g.fillStyle = INK.mustard; g.fillText(scoreStr, cx + numPx * 0.06, scoreY + numPx * 0.06);
    g.fillStyle = INK.charcoal; g.fillText(scoreStr, cx, scoreY);

    // LEVEL and TIME along the foot, small, flanking the equipment tracker
    const footY = y + h * 0.85, smallPx = h * 0.17;
    g.font = fbody(labPx);
    g.fillStyle = mixC(INK.charcoal, INK.paper, 0.38);
    g.textAlign = "left";  g.fillText("LEVEL", x + w * 0.05, footY - smallPx * 0.92);
    g.textAlign = "right"; g.fillText("TIME", x + w * 0.95, footY - smallPx * 0.92);
    g.font = fdisp(smallPx);
    g.fillStyle = INK.charcoal;
    g.textAlign = "left";
    g.fillText(String(currentLevel + 1).padStart(2, "0"), x + w * 0.05, footY);

    // The clock is the only way to lose, so it keeps the warning states it had:
    // rust from 30 seconds, and alert red only at 10 — which is the reserved
    // colour used for the one thing in this game that can actually end a run.
    const timerSec = Math.max(0, Math.ceil(levelTimer / 60));
    const isUrgent = timerSec <= 30, isCritical = timerSec <= 10;
    const blinkOn = !isUrgent || Math.floor(levelTimer / (isCritical ? 15 : 30)) % 2 === 0;
    g.textAlign = "right";
    if (blinkOn) {
        g.fillStyle = isCritical ? INK.alert : isUrgent ? INK.rust : INK.charcoal;
        g.fillText(timerSec < 10 ? "0" + timerSec : String(timerSec), x + w * 0.95, footY);
    }

    // Equipment recovered, as pips between them
    const earned = djSetupEarned.length, total = DJ_SETUP_PIECES.length;
    if (earned > 0 || currentLevel >= 4) {
        const pip = Math.max(2, h * 0.055), gap = pip * 1.7;
        const px0 = cx - (total - 1) * gap / 2;
        for (let i = 0; i < total; i++) {
            g.fillStyle = i < earned ? INK.mustard : mixC(INK.charcoal, INK.paper, 0.62);
            g.fillRect(px0 + i * gap - pip / 2, footY - pip * 1.4, pip, pip);
        }
    }
    g.textAlign = "start"; g.textBaseline = "alphabetic";
    g.restore();
}

// Lay the finished floor canvas down onto the plane.
function blitPlane() {
    if (PROJ.mode === "oblique") { paintSurround(); return blitOblique(); }
    if (PROJ.mode === "iso") { paintSurround(); return blitIso(); }
    const W = COLS * TILE * SCALE, H = ROWS * TILE * SCALE;
    paintSurround();
    drawBackWall();
    const n = PROJ.strips, sh = H / n;
    for (let i = 0; i < n; i++) {
        const v0 = i / n, v1 = (i + 1) / n;
        const s = projScale(v0);
        const y0 = projY(v0), y1 = projY(v1);
        const w = W * s;
        // +1 on the height closes the hairline seams between strips that
        // rounding would otherwise leave as scan lines across the floor.
        MAIN_CTX.drawImage(PLANE, 0, i * sh, W, sh,
                           W / 2 - w / 2, y0, w, (y1 - y0) + 1);
    }
}

// Stand a sprite up at its own ground point. It keeps its full height and its
// upright pose — only its position and its size follow the floor — which is the
// whole idea: 2D characters in a 3D room, not characters lying on the floor.
function billboard(groundX, groundY, draw) {
    if (!PROJ.on) { draw(); return; }
    const gx = groundX * SCALE, gy = groundY * SCALE;
    const p = projPoint(gx, gy);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.s, p.s);
    ctx.translate(-gx, -gy);
    draw();
    ctx.restore();
}


// ============================================================
// CAMERA RIG — a frozen room with the camera on sliders
// ============================================================
// So the angle can be found by looking at it, instead of by asking for another
// render every time there is an idea.
//
// It drives THE GAME's own projection, on a real frame, with the real art. A
// separate viewer that reimplemented the maths would agree with the game right
// up until it quietly stopped, which is the failure mode this codebase's
// harnesses have hit before.
//
// Off unless enabled. The rig build calls CAMRIG.enable() and nothing else
// differs. (`RIG` was taken — it is the character rig's unit scale.)
const CAMRIG = { on: false };

CAMRIG.enable = function () {
    CAMRIG.on = true;
    try { resetGame(); } catch (e) {}
    // A scene worth judging needs BOTH the drawn room and a full grid, and no
    // level has both: the warm-up room is the only biome with art and it runs
    // four rows. So the rig borrows the art's level and widens it to six. It is
    // a rig — the point is to see the camera against the real room, and a
    // procedural cave would be judging it against scenery that is on its way
    // out.
    currentLevel = 0;
    LEVELS[0].activeRows = 6;
    const pat = LEVELS[20].pattern;
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++) grid[r][c] = pat[r][c];
    rebuildCaveTextures(0);
    setLevelTempo(0);
    levelTimer = 150 * 60;
    // One Donk at the back and one at the front, so the depth scaling is
    // visible on the same sprite rather than inferred.
    goblins[0].dead = false; goblins[0].x = 4 * TILE;  goblins[0].y = 2 * TILE;
    goblins[1].dead = false; goblins[1].x = 15 * TILE; goblins[1].y = 7 * TILE;
    player.x = 9 * TILE; player.y = 8 * TILE;
    player.destX = player.x; player.destY = player.y;
    gameState = "playing";
    CAMRIG.buildUI();
};

CAMRIG.buildUI = function () {
    const wrap = document.createElement("div");
    wrap.id = "rig";
    wrap.innerHTML = `
      <style>
        #rig { position:fixed; left:0; right:0; bottom:0; z-index:50;
               background:#2C2C2A; color:#fcf7e8; padding:10px 14px 12px;
               font-family:ui-monospace,Menlo,monospace; font-size:13px;
               display:flex; flex-wrap:wrap; gap:14px 22px; align-items:center; }
        #rig .row { display:flex; align-items:center; gap:8px; }
        #rig label { min-width:88px; opacity:.75; }
        #rig input[type=range] { width:190px; accent-color:#F6CC60; }
        #rig output { min-width:56px; color:#F6CC60; font-variant-numeric:tabular-nums; }
        #rig select { background:#3a3a37; color:#fcf7e8; border:1px solid #55554f;
                      padding:3px 6px; font-family:inherit; }
        #rig .note { opacity:.55; flex-basis:100%; font-size:11px; }
      </style>`;
    const add = (label, min, max, step, get, set, fmt) => {
        const row = document.createElement("div");
        row.className = "row";
        const l = document.createElement("label"); l.textContent = label;
        const i = document.createElement("input");
        i.type = "range"; i.min = min; i.max = max; i.step = step; i.value = get();
        const o = document.createElement("output"); o.textContent = fmt(get());
        i.addEventListener("input", () => { set(parseFloat(i.value)); o.textContent = fmt(parseFloat(i.value)); });
        row.append(l, i, o); wrap.appendChild(row);
    };
    add("angle", 8, 85, 1, () => PROJ.angleDeg, (v) => PROJ.angleDeg = v, (v) => v + "\u00b0");
    add("distance", 0.8, 8, 0.1, () => PROJ.distance, (v) => PROJ.distance = v, (v) => v.toFixed(1) + "D");

    const modeRow = document.createElement("div");
    modeRow.className = "row";
    const ml = document.createElement("label"); ml.textContent = "projection";
    const sel = document.createElement("select");
    for (const m of ["rake", "oblique", "iso", "flat"]) {
        const op = document.createElement("option"); op.value = m; op.textContent = m;
        if (m === PROJ.mode) op.selected = true;
        sel.appendChild(op);
    }
    sel.addEventListener("change", () => { PROJ.mode = sel.value; PROJ.on = sel.value !== "flat"; });
    modeRow.append(ml, sel); wrap.appendChild(modeRow);

    const note = document.createElement("div");
    note.className = "note";
    note.textContent = "Frozen room, live camera. angle = elevation above the floor (90\u00b0 would be straight down). distance = how far back in room-depths; near is a wide convergent lens, far approaches no convergence at all.";
    wrap.appendChild(note);
    document.body.appendChild(wrap);
};

// ---- Pad extrusion -------------------------------------------------------
// A sequencer cell is a BLOCK standing on the floor, not a coloured square
// painted on it. Cabinet projection, the cheap half: a top face and a front
// face, hard keyline between them, no gradient anywhere — a printed block, not
// a rendered one.
//
// The whole block stays inside its own 80px footprint, which is the point. The
// grid is a 16 x 6 matrix the player has to SCAN, so nothing here moves a cell,
// resizes one, or lets one overlap its neighbour; the lattice still rules the
// true boundaries and the front face sits just inside the bottom edge, which
// reads as the base of the block.
//
// It is baked into the tile rather than drawn per cell, for the reason the
// glow is: per-cell draw-time work on 96 cells was measured as a large frame
// cost once already.
//
// It also does a job the palette cannot. The six rows are told apart by hue
// alone, and two pairs measure 1.05:1 and 1.08:1 against each other — the front
// face gives every row a second, darker band of its own colour, so the field
// has luminance structure where it used to have only hue.
// The pads are INSET, with floor visible between them. That is what makes the
// height read: a block looks like a block because its top face is offset from
// its footprint, and flush cells have nowhere to put the offset. Darkening the
// bottom strip of a full-bleed cell was tried first and reads as a thicker
// border, not as a block.
//
// It cannot be done by drawing the top face above the cell either — rows are
// 80px apart and draw top to bottom, so each row would cover the previous row's
// front face exactly, and only the last row would have any height at all.
//
// So: a gutter, and the pads stand in it. Which is also the right object. This
// is a drum machine, the player is a producer, and sixteen inset pads in a grid
// with the board showing between them is what one looks like.
const PAD_INSET = 3;         // floor gutter around each pad
const PAD_FACE = 13;         // front face height — the block's rise
const PAD_FACE_PRESSED = 4;  // struck: it sinks into the board
const PAD_FOOT = 4;          // gutter under the face, so rows never touch

// Take a fully painted 80x80 cell and stand it up as a block: top face inset
// and lifted, front face below it in a darker tone of the same colour, floor
// showing everywhere else. One hard keyline at the fold — a fold is an edge,
// and edges in this world are drawn, not shaded.
function extrudePad(src, faceCol, pressed) {
    const size = TILE * SCALE;
    const face = pressed ? PAD_FACE_PRESSED : PAD_FACE;
    const drop = PAD_FACE - face;               // how far the struck pad sinks
    const w = size - PAD_INSET * 2;
    const topH = size - PAD_INSET - PAD_FACE - PAD_FOOT;
    const topY = PAD_INSET + drop;

    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');

    // Top face: the cell's own art, cropped to the pad and moved onto it.
    g.drawImage(src, PAD_INSET, PAD_INSET, w, topH, PAD_INSET, topY, w, topH);

    // The front face is NOT baked when the room is projected. Baked, it is part
    // of the floor plane, so the camera squashes a 13px rise down to about 5 and
    // the block stops reading — which is why the pads stopped visibly moving.
    // Height is vertical in the world; it has to be drawn after the transform.
    if (!PROJ.on) {
        g.fillStyle = faceCol;
        g.fillRect(PAD_INSET, topY + topH, w, face);
    }

    // The fold only. NO outline around the pad: the lattice is already ruled
    // along every cell boundary, and a pad that closes its own rectangle put a
    // second line a few pixels inside the first — the same doubling that made
    // the field read as tram-lines when each cell drew its own border, arrived
    // at from the other direction.
    g.fillStyle = "rgba(44,44,42,0.5)";
    g.fillRect(PAD_INSET, topY + topH, w, 1);
    return c;
}

function generateGridStoneTile(seed, biome) {
    const gs = biome.gridStone;
    // Plain: a sequencer cell is a flat wash, textured by the paper grain that
    // already covers the screen — not by cave-stone blobs of its own.
    // No border. Every tile used to close its own rectangle, so each boundary
    // in the field carried TWO lines — one from the cell on each side — boiling
    // independently of one another. At a glance that reads as tram-lines rather
    // than as a ruled grid. The lattice is one set of lines now, drawn across
    // the whole field by drawGridLattice.
    const t = generateStoneTile(seed, gs.base, gs.dark, gs.hi, { mossColor: gs.moss, plain: true });
    // AN UNLIT STEP STAYS FLAT. It is an empty slot in the board, not a pad
    // with the light off.
    //
    // Extruding it was tried at three different face tones and all three failed
    // the same way: sixteen identical faces side by side in a row do not read as
    // sixteen blocks, they read as one stripe running the width of the field.
    // That is the eye grouping them, so no amount of darkening fixes it — pale
    // gave a cream band, dark gave a grey one.
    //
    // Leaving them flat is also the better game. Only the ON steps stand up, so
    // the pattern is in RELIEF against the board: the shape of the beat is
    // something you can see in the height of the field, not only in its colour.
    // It changes shape as you play it, which is the point rather than the cost.
    return t;
}

// Generate an active grid tile — flat ink-wash fill in the row's color,
// paper-white veins, and a hand-inked charcoal border (static wonk).
function generateGlowTile(seed, glowColor, pressed) {
    const size = TILE * SCALE;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const rng = texRNG(seed);

    // Paper stone base
    g.fillStyle = "#f3ecd8";
    g.fillRect(0, 0, size, size);

    // Gouache wash — EDGE TO EDGE, and square.
    // It used to be inset 3px with rounded corners, which was invisible while
    // every tile drew its own border on top of the inset. With the border gone
    // and the lattice ruled between cells instead, that inset was exposed as a
    // rounded colour square floating in a cream frame — the cell read as an
    // object sitting in its container rather than as the container being lit.
    g.fillStyle = glowColor;
    g.globalAlpha = 0.92;
    g.fillRect(0, 0, size, size);
    g.globalAlpha = 1;

    // The paper-white "energy veins" that used to scribble across every lit cell
    // are gone. They were cave-crystal decoration, they were the size of a
    // finger at the scale a cell is actually displayed, and they read as random
    // marks rather than as paint. The wash is a wash; the paper grain over the
    // top is what gives it a surface.

    // Brush-light hotspot — the one unevenness worth keeping, because it is what
    // stops a flat fill reading as a flat fill

    const hx = rng() * size;
    const hy = rng() * size;
    const hr = 5 + rng() * 8;
    const grad = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
    grad.addColorStop(0, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);

    // No border here either — see generateGridStoneTile. A lit cell is a block
    // of colour and the lattice is ruled over the top of it.

    // Stand it up. The front face is a darker tone of the pad's own colour, so
    // the light reads as coming from above the room rather than out of the pad,
    // and every row gains a second luminance band of its own hue — which is the
    // only thing in the field that tells the six channels apart without relying
    // on you separating their colours.
    return extrudePad(c, mixC(glowColor, INK.charcoal, 0.42), pressed);
}

// Generate a wall-band tile. Plain, for the same reason the grid cells are:
// the mottled patches, blobs, cracks and moss spots are 4-20px marks on an
// 80px tile, and the band is only half a tile deep now, so they read as
// procedural smudge rather than as paper. The edge bevels go with them — those
// were the worst of it, because every tile drew a highlight down its left edge
// and a shadow down its right, which is what made the seams between tiles
// visible and turned a continuous wall into a row of bricks.
//
// The band is a flat wash and the real StudioLand grain over the whole screen
// does the texturing. Same argument, same call, as generateGridStoneTile.
// ...and one colour, not three. Each biome carries three wall palettes and every
// tile picked one of them, which was fine when each tile was also a mottled
// stone with its own cracks — the variation hid inside the texture. On a flat
// wash it has nowhere to hide: the palettes are 13 luminance levels apart, so
// the band reads as a row of slightly mismatched panels. `variant` is kept in
// the signature because the seed still varies the per-pixel roughness, which is
// the one difference between tiles that is meant to be invisible.
function generateCaveWallTile(seed, variant, biome) {
    const pal = biome.walls[0];
    return generateStoneTile(seed, pal.base, pal.dark, pal.hi, { mossColor: biome.wallMoss, plain: true });
}

// Generate cave floor tile (dark, with subtle variation)
function generateFloorTile(seed, biome) {
    const f = biome.floor;
    return generateStoneTile(seed, f.base, f.dark, f.hi, { mossColor: f.moss });
}

// ============================================================
// BIOMES — six cavern zones, one per stolen DJ setup piece.
// Each zone is five levels deep and ends with recovering its piece
// (levels 5/10/15/20/25/30). Palettes stay dark so sprites and the
// beat grid keep their readability; only the ambience shifts.
// ============================================================
const BIOMES = [
    { // Levels 1-5 → THE LEFT SPEAKER (soft mint, closest to plain paper)
        name: "THE WARM-UP ROOM",
        tagline: "WHERE THE GROOVE BEGINS",
        art: "warm-up-floor",  // assets/room/warm-up-floor.png — see ROOM_ART
        floorArt: true,        // the plate is the FLOOR only; no walls in it
        wallTile: "wall-panel",  // the single panel — still the source of truth
        wallStrip: "wall-strip",  // eight of it, pre-composed: see drawBackWall
        stripPanels: 8,
        // Props hang ON the wall, in WALL SPACE: x and y are the prop's centre
        // as a fraction of the wall's width and height, h is its height as a
        // fraction of the wall's. Nothing here is in pixels, so the whole
        // dressing survives a change of tilt, of horizon, or of panel count.
        wallProps: [
            { art: "door",      x: 0.117, foot: true, h: 0.848 },
            { art: "switch",    x: 0.241, y: 0.471, h: 0.081 },
            // The poster and the clock moved outward to make room for the
            // scoreboard. Both x values were mine — measured off Carl's plate
            // when I cut the props out — not his composition, so widening the
            // gap between them is a layout change rather than an edit to his
            // drawing. 0.328 -> 0.275 and 0.683 -> 0.735.
            { art: "poster",    x: 0.275, y: 0.311, h: 0.311 },
            { art: "clock",     x: 0.735, y: 0.203, h: 0.185 },
            { art: "clipboard", x: 0.825, y: 0.381, h: 0.234 },
            { art: "phone",     x: 0.930, y: 0.395, h: 0.284 },
        ],
        // The readouts hang here, in the same wall space as the props.
        //
        // Carl: bigger, and crossing the chair rail. Both were geometry
        // problems. Measured off the wall: the rail is a band at y 0.538..0.569
        // and the skirting starts at 0.904, so a board that stopped at 0.535
        // was resting on the rail rather than hanging over it. And the width was
        // capped by the props either side — 0.350 to 0.664 was all the clear
        // wall there was, which is why it could not grow.
        //
        // So the props moved and the board did too. 0.38 was too big — this is
        // halfway back, 0.3325, with the TOP held exactly where it was at 0.186
        // so only the foot moves: the centre y falls out of that rather than
        // being chosen, which is why it is 0.461 and not a round number. The
        // rail still passes behind it, now about two thirds of the way down.
        //
        // `wells` are the three empty boxes in Carl's plaque, as fractions of
        // the sprite: x0, y0, x1, y1. They were measured off the file by
        // tools/cut-scoreboard.py, which finds them as sealed regions rather
        // than by eye — re-run it if the art is redrawn and paste the numbers
        // it prints. `pips` is the one placed-not-measured spot on here.
        scoreboard: {
            art: "props/scoreboard", x: 0.500, y: 0.461, w: 0.3325, hFallback: 0.36,
            wells: {
                level: [0.0767, 0.5026, 0.2420, 0.6868],
                score: [0.3105, 0.4000, 0.6895, 0.6868],
                time:  [0.7580, 0.5026, 0.9233, 0.6868],
            },
            pips: [0.5, 0.085],   // the crest, above SCORE
        },
        floor: { base: mixC(INK.charcoal, INK.mint, 0.07), dark: INK.charcoal, hi: lighter(INK.charcoal, 0.11), moss: mixC(INK.charcoal, INK.mint, 0.17) },
        walls: [
            { base: "#BFCDC0", dark: "#93a89a", hi: "#e9eee9" },
            { base: "#b7c6b8", dark: "#8aa091", hi: "#e4eae4" },
            { base: "#c6d2c7", dark: "#9cb0a3", hi: "#eef2ee" },
        ],
        wallMoss: "#93a89a",
        gridStone: { base: "#f3ecd8", dark: "#b3aa96", hi: "#ffffff", moss: "#dfe7df" },
        gridWall: { base: "#e9eee9", dark: "#93a89a", hi: "#ffffff" },
        lights: ["#50ad33", "#8fbf7a", "#BFCDC0", "#6fae57", "#a5c99a", "#50ad33"],
        lightHi: "#ffffff",
        caveGlow: "143,168,150",
        stal: { a: "#BFCDC0", b: "#a9bcab", hi: "#e9eee9", drip: "rgba(44,44,42,0.25)" },
    },
    { // Levels 6-10 → THE RIGHT SPEAKER (harbor teal wash)
        name: "THE ECHO CHAMBER",
        tagline: "EVERY BEAT ECHOES TWICE",
        floor: { base: mixC(INK.charcoal, INK.teal, 0.07), dark: INK.charcoal, hi: lighter(INK.charcoal, 0.11), moss: mixC(INK.charcoal, INK.teal, 0.17) },
        walls: [
            { base: "#7fa0a4", dark: "#3A6168", hi: "#d5e0e1" },
            { base: "#75989c", dark: "#35595f", hi: "#cfdcdd" },
            { base: "#88a8ac", dark: "#40686f", hi: "#dbe5e6" },
        ],
        wallMoss: "#3A6168",
        gridStone: { base: "#f3ecd8", dark: "#b3aa96", hi: "#ffffff", moss: "#d5e0e1" },
        gridWall: { base: "#d5e0e1", dark: "#3A6168", hi: "#ffffff" },
        lights: ["#3A6168", "#5d8a90", "#7fb2b8", "#4a777e", "#6d9ba1", "#3A6168"],
        lightHi: "#ffffff",
        caveGlow: "58,97,104",
        stal: { a: "#7fa0a4", b: "#527d82", hi: "#d5e0e1", drip: "rgba(44,44,42,0.25)" },
    },
    { // Levels 11-15 → THE TURNTABLE (midway mustard wash)
        name: "THE AMBER LOUNGE",
        tagline: "GOLDEN WALLS, WARMER GROOVES",
        floor: { base: mixC(INK.charcoal, INK.mustard, 0.07), dark: INK.charcoal, hi: lighter(INK.charcoal, 0.11), moss: mixC(INK.charcoal, INK.mustard, 0.17) },
        walls: [
            { base: "#e5bd57", dark: "#b8923a", hi: "#faeec9" },
            { base: "#ddb44e", dark: "#ad8834", hi: "#f7e9bd" },
            { base: "#ecc667", dark: "#c29a3f", hi: "#fbf1d3" },
        ],
        wallMoss: "#b8923a",
        gridStone: { base: "#f3ecd8", dark: "#b3aa96", hi: "#ffffff", moss: "#f5ecd0" },
        gridWall: { base: "#faeec9", dark: "#b8923a", hi: "#ffffff" },
        lights: ["#F6CC60", "#e0b34a", "#f2d788", "#d3a63f", "#f8dfa0", "#F6CC60"],
        lightHi: "#ffffff",
        caveGlow: "246,204,96",
        stal: { a: "#e5bd57", b: "#c9a13e", hi: "#faeec9", drip: "rgba(44,44,42,0.25)" },
    },
    { // Levels 16-20 → THE MIXER (neon green wash — the funk is green)
        name: "THE FUNK HOUSE",
        tagline: "THE FUNK GROWS THICK IN HERE",
        floor: { base: mixC(INK.charcoal, INK.green, 0.07), dark: INK.charcoal, hi: lighter(INK.charcoal, 0.11), moss: mixC(INK.charcoal, INK.green, 0.17) },
        walls: [
            { base: "#7dba66", dark: "#3c8226", hi: "#dcedd2" },
            { base: "#74b15d", dark: "#377a22", hi: "#d5e9ca" },
            { base: "#87c271", dark: "#428c2b", hi: "#e3f1da" },
        ],
        wallMoss: "#3c8226",
        gridStone: { base: "#f3ecd8", dark: "#b3aa96", hi: "#ffffff", moss: "#e2efdb" },
        gridWall: { base: "#dcedd2", dark: "#3c8226", hi: "#ffffff" },
        lights: ["#50ad33", "#71c153", "#8fd077", "#3c8226", "#a8dc94", "#50ad33"],
        lightHi: "#ffffff",
        caveGlow: "80,173,51",
        stal: { a: "#7dba66", b: "#4f9739", hi: "#dcedd2", drip: "rgba(44,44,42,0.25)" },
    },
    { // Levels 21-25 → THE LIGHT RIG (robot silver — crystal as chrome)
        name: "THE MIRRORBALL HALL",
        tagline: "A THOUSAND LIGHTS, ONE BEAT",
        floor: { base: mixC(INK.charcoal, INK.silverL, 0.07), dark: INK.charcoal, hi: lighter(INK.charcoal, 0.11), moss: mixC(INK.charcoal, INK.silverL, 0.17) },
        walls: [
            { base: "#BFC9C1", dark: "#7A8F85", hi: "#e6eae7" },
            { base: "#b4c0b8", dark: "#71867c", hi: "#e0e5e1" },
            { base: "#c8d1ca", dark: "#83988e", hi: "#eceeec" },
        ],
        wallMoss: "#7A8F85",
        gridStone: { base: "#f3ecd8", dark: "#b3aa96", hi: "#ffffff", moss: "#e6eae7" },
        gridWall: { base: "#e6eae7", dark: "#7A8F85", hi: "#ffffff" },
        lights: ["#BFC9C1", "#9fb0a6", "#d5dcd6", "#8ba095", "#c8d1ca", "#BFC9C1"],
        lightHi: "#ffffff",
        caveGlow: "122,143,133",
        stal: { a: "#BFC9C1", b: "#93a69b", hi: "#e6eae7", drip: "rgba(44,44,42,0.25)" },
    },
    { // Levels 26-30 → THE DISCO BALL (rusty turnstile — the finale burns)
        name: "THE MAIN STAGE",
        tagline: "THE LOUDEST ROOM IN THE PARK",
        floor: { base: mixC(INK.charcoal, INK.rust, 0.07), dark: INK.charcoal, hi: lighter(INK.charcoal, 0.11), moss: mixC(INK.charcoal, INK.rust, 0.17) },
        walls: [
            { base: "#cf8f55", dark: "#9a5426", hi: "#f0d9c2" },
            { base: "#c98547", dark: "#8f4d21", hi: "#ecd2b8" },
            { base: "#d69a64", dark: "#a55c2c", hi: "#f4e0cc" },
        ],
        wallMoss: "#9a5426",
        gridStone: { base: "#f3ecd8", dark: "#b3aa96", hi: "#ffffff", moss: "#f2e2cf" },
        gridWall: { base: "#f0d9c2", dark: "#9a5426", hi: "#ffffff" },
        lights: ["#BF7538", "#c05838", "#d99a5e", "#a85f2a", "#c98547", "#c05838"],
        lightHi: "#ffffff",
        caveGlow: "191,117,56",
        stal: { a: "#cf8f55", b: "#a05a28", hi: "#f0d9c2", drip: "rgba(44,44,42,0.25)" },
    },
];

function biomeForLevel(levelIdx) {
    return BIOMES[Math.min(BIOMES.length - 1, Math.max(0, Math.floor(levelIdx / 5)))];
}
let currentBiome = BIOMES[0];


// ---- Texture atlas (rebuilt per level — every room gets its own layout & biome) ----
let TEX_FLOOR = [];
let TEX_WALL_TOP = [], TEX_WALL_BOT = [], TEX_WALL_LEFT = [], TEX_WALL_RIGHT = [];
let TEX_GRID_OFF = [];
let TEX_GRID_WALL = null;
let TEX_CAVE_BG = null;
let texturesBuiltForLevel = -1;

// ---- Hand-drawn rooms -----------------------------------------------------
// A biome can supply a drawn room instead of the procedural cave. The art is
// the whole floor plus the top and side walls, painted 1:1 into the 1600x800
// room, and where it exists the procedural floor tiles and those three wall
// bands are not drawn at all.
//
// The BOTTOM band is deliberately NOT the art's job, and this is the one part
// worth not being clever about. The HUD prints on it, and its legibility was
// measured against a pale wall: 7.66:1 under LEVEL, 6.99:1 under the score.
// Measured against the first drawn room, charcoal type on what the art puts
// there came out at 1.30:1 under the score — no contrast at all, because that
// part of the picture is dark floor. So the game keeps painting its own bottom
// band over whatever the art has down there, and the readout keeps the numbers
// it was designed against. Art below y=720 will not be seen; that strip is the
// HUD's.
//
// Keyed by biome, so rooms can arrive one at a time and every biome without one
// simply stays a cave.
const ROOM_ART = {};

// Cached per-frame gradients (biome colors bake in — cleared on rebuild)
const gradCache = {};

// Grid glow tiles (active blocks — per row color, multiple variants per row)
const GLOW_COLORS = [INK.green, INK.mustard, INK.teal, INK.red, INK.silverD, INK.rust];
// Grid tiles are noise, so a POOL of variants indexed by cell is visually
// identical to one bake per cell, at 32 canvases rather than 192.
//
// The index is HASHED, not arithmetic. It used to be `(r*7 + c*5) % 8`, which
// repeats every 8 columns in a 16-column grid, and the eye locks onto a repeat
// at a fixed spacing long before it notices the tiles themselves.
//
// There is no phase dimension here any more. The tiles carry no linework now —
// only stone texture — so there was nothing in them for a phase to change, and
// the three "phases" were three identical canvases. What boils is the lattice
// ruled over the top of them, which is where the ink actually is.
const GRID_VARIANTS = 16;
const gridVariantTbl = [];   // [r][c] -> variant
function buildCellVariantTable() {
    for (let r = 0; r < GRID_ROWS; r++) {
        gridVariantTbl[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            gridVariantTbl[r][c] = Math.floor(hashN(r * 131.7 + c, 4.2) * GRID_VARIANTS) % GRID_VARIANTS;
        }
    }
}
buildCellVariantTable();
const gridVariant = (r, c) => gridVariantTbl[r][c];
const TEX_GRID_ON = [];   // [variant][row]
const TEX_GRID_HIT = [];  // [variant][row] — the same pad, struck and sunk
function bakeGridOnTiles() {
    for (let v = 0; v < GRID_VARIANTS; v++) {
        TEX_GRID_ON[v] = [];
        TEX_GRID_HIT[v] = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            // Same seed for both, so a pad does not change its brush hotspot on
            // the frame it is struck — only its height.
            TEX_GRID_ON[v][r] = generateGlowTile(r * 100 + v * 17 + 7777, GLOW_COLORS[r]);
            TEX_GRID_HIT[v][r] = generateGlowTile(r * 100 + v * 17 + 7777, GLOW_COLORS[r], true);
        }
    }
}
bakeGridOnTiles();

// Grid wall background texture (stone slab behind the grid)
function buildGridWallTexture(biome, LS) {
    // This is a larger texture for the wall behind the grid
    const maxAR = 6;
    const w = (GRID_COLS * TILE + 4) * SCALE;
    const h = (maxAR * TILE + 4) * SCALE;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const rng = texRNG(LS + 88888);
    const gw = biome.gridWall;

    // Base stone slab
    g.fillStyle = gw.base;
    g.beginPath();
    g.roundRect(0, 0, w, h, 3);
    g.fill();

    // Large mottled patches
    for (let i = 0; i < 30; i++) {
        const px = rng() * w;
        const py = rng() * h;
        const pr = 10 + rng() * 30;
        g.fillStyle = rng() > 0.5 ? gw.dark : gw.hi;
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
        g.strokeStyle = gw.dark;
        g.globalAlpha = 0.6;
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
    g.globalAlpha = 1;

    // Mortar lines (horizontal and vertical grid)
    g.strokeStyle = gw.dark;
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
}

// Pre-render static cave background (floor + walls + stalactites + stalagmites)
function buildCaveBgTexture(biome, LS) {
    const w = COLS * TILE * SCALE;
    const h = ROWS * TILE * SCALE;
    const c = document.createElement('canvas'); // shared base (non-boiling)
    c.width = w; c.height = h;
    const g = c.getContext('2d');

    // Paper base fill
    g.fillStyle = INK.paper;
    g.fillRect(0, 0, w, h);

    // A drawn room replaces the floor and the top and side walls in one go.
    //
    // A FLOOR PLATE is a different thing and says so: under the rake, walls
    // painted into a top-down plate are walls painted on the floor, so the
    // plate carries no walls at all and the room's height comes from pieces
    // that stand up instead. It still owes the HUD its band — see below.
    const art = biome.art ? ROOM_ART[biome.art] : null;
    const floorOnly = art && !!biome.floorArt;

    if (art) {
        g.drawImage(art, 0, 0, w, h);
    } else {
        // Draw floor tiles
        for (let r = 0; r < ROWS; r++) {
            for (let col = 0; col < COLS; col++) {
                g.drawImage(TEX_FLOOR[r][col], col * TILE * SCALE, r * TILE * SCALE);
            }
        }

        // Top wall tiles
        for (let col = 0; col < COLS; col++) {
            g.drawImage(TEX_WALL_TOP[col], col * TILE * SCALE, 0,
                TILE * SCALE, WALL_TOP * SCALE);
        }
        // Left wall tiles — squashed into the half-tile band, same as the ceiling.
        // Squashing rather than cropping keeps every tile's whole mark pattern; a
        // crop would lop the right half off each one and the band would read as a
        // column of sliced stones.
        for (let r = 0; r < ROWS; r++) {
            g.drawImage(TEX_WALL_LEFT[r], 0, r * TILE * SCALE,
                WALL_SIDE * SCALE, TILE * SCALE);
        }
        // Right wall tiles, right-aligned against the room's edge
        for (let r = 0; r < ROWS; r++) {
            g.drawImage(TEX_WALL_RIGHT[r], (COLS * TILE - WALL_SIDE) * SCALE, r * TILE * SCALE,
                WALL_SIDE * SCALE, TILE * SCALE);
        }
    }

    // Bottom band — only where there is no drawing. A full drawn room paints its
    // own and the HUD prints straight onto it; a floor plate does not, and the
    // HUD measured 1.30:1 printed on these planks against 7.66:1 on a pale band.
    //
    // Its height depends on what it is FOR. Where the readouts are on the wall
    // it has nothing to carry, and a full tile of masonry across the bottom of a
    // drawn room is the last of the procedural border: it becomes a slim plinth,
    // there only to stop the floor bleeding into the frame's edge. Where the
    // readouts are still at the bottom — the five biomes with no wall art yet —
    // it keeps its full height, because it is the ground their type stands on.
    if (!art || floorOnly) {
        const band = hudOnWall(biome) ? TILE * 0.28 : TILE;
        const bandY = (ROWS * TILE - band) * SCALE;
        for (let col = 0; col < COLS; col++) {
            g.drawImage(TEX_WALL_BOT[col], col * TILE * SCALE, bandY,
                TILE * SCALE, band * SCALE);
        }
    }

    // Stalactites & stalagmites: positions rolled once per level, then
    // drawn in the per-phase pass below so their inked edges boil
    const stRNG = texRNG(LS + 54321);
    // Stalactites are gone: they hung as pennants into the play field, and a
    // half-tile ceiling gives them nothing to hang from. Their RNG draws go
    // with them — the cave's noise reshuffles, which doesn't matter now that
    // the whole cave/goblin dressing is on its way out for StudioLand.
    const smites = [];
    for (const p of [3, 6, 10, 15, 18]) {
        const sm = p + Math.floor(stRNG() * 3) - 1;
        const smH = 2 + Math.floor(stRNG() * 4);
        const fill = stRNG() > 0.5 ? biome.stal.a : biome.stal.b;
        if (sm < 1 || sm >= COLS - 1) continue;
        smites.push({ x: sm * TILE + TILE / 2, h: smH, fill });
    }

    // The faint carved marks in the wall bands are gone. They were the last of
    // the goblin lore — a substitution cipher spelling THUMP / CLAP / RATTLE —
    // and once the lore was retired they were letter-shaped strokes with
    // nothing behind them, scattered at random through the one band the HUD
    // also prints into. Next to a real word like LEVEL they read as a rendering
    // fault rather than as decoration, which is exactly what they became.

    // ---- Per-phase ink pass: the hand that re-inks the room 3x/sec ----
    const phases = [];
    for (let ph = 0; ph < 3; ph++) {
        const pc = document.createElement('canvas');
        pc.width = w; pc.height = h;
        const pg = pc.getContext('2d');
        pg.drawImage(c, 0, 0);
        const J = (x, seed, amp) => pjit(x, LS * 0.013 + seed, ph, amp);

        // Wall/floor boundary ink lines — the inked edge of the cave
        pg.lineJoin = "round";
        pg.lineCap = "round";
        const line = (pts, seed) => {
            pg.strokeStyle = INK.charcoal;
            pg.lineWidth = 2.5;
            pg.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const x = pts[i][0] + J(pts[i][0] + pts[i][1] * 0.37, seed, 2.2);
                const y = pts[i][1] + J(pts[i][1] + pts[i][0] * 0.61, seed + 3.3, 2.2);
                i === 0 ? pg.moveTo(x, y) : pg.lineTo(x, y);
            }
            pg.stroke();
        };
        const topY = WALL_TOP * SCALE, botY = (ROWS - 1) * TILE * SCALE;
        const hp = (y) => { const a = []; for (let x = 0; x <= w; x += 14) a.push([x, y]); return a; };
        const vp = (x) => { const a = []; for (let y = topY; y <= botY; y += 14) a.push([x, y]); return a; };
        // The boiling boundary is the inked edge of the CAVE. A drawn room has
        // already inked its own top and side walls, so re-inking them there
        // would double the line. The bottom edge still boils either way,
        // because that band is still the game's.
        if (!art) {
            line(hp(topY), 11);
            line(hp(botY), 22);
            line(vp(WALL_SIDE * SCALE), 33);
            line(vp((COLS * TILE - WALL_SIDE) * SCALE), 44);
        }

        // Stalagmites — cave dressing, so they stay out of a drawn room
        for (let si = 0; si < (art ? 0 : smites.length); si++) {
            const sm = smites[si];
            const bx = sm.x * SCALE, by = (ROWS - 1) * TILE * SCALE, hh = sm.h * SCALE;
            const pts = [
                [bx - 3 * SCALE, by], [bx + 3 * SCALE, by], [bx, by - hh],
            ].map((p, k) => [p[0] + J(si * 53 + k * 29, 77, 2), p[1] + (k === 2 ? J(si * 31, 88, 2) : 0)]);
            pg.fillStyle = sm.fill;
            pg.beginPath();
            pts.forEach((p, k) => k === 0 ? pg.moveTo(p[0], p[1]) : pg.lineTo(p[0], p[1]));
            pg.closePath();
            pg.fill();
            pg.strokeStyle = INK.charcoal;
            pg.lineWidth = 2;
            pg.stroke();
        }
        phases.push(pc);
    }
    return phases;
}

// Rebuild the whole room texture set for a given level. Seeds derive from
// the level number, so every room has its own stone layout, and the palette
// comes from the level's biome. Called at startup and on every room change.
function rebuildCaveTextures(levelIdx) {
    currentBiome = biomeForLevel(levelIdx);
    const biome = currentBiome;
    const LS = (levelIdx + 1) * 7919;

    TEX_FLOOR = [];
    for (let r = 0; r < ROWS; r++) {
        TEX_FLOOR[r] = [];
        for (let c = 0; c < COLS; c++) {
            TEX_FLOOR[r][c] = generateFloorTile(LS + r * 1000 + c * 37 + 5555, biome);
        }
    }

    TEX_WALL_TOP = []; TEX_WALL_BOT = []; TEX_WALL_LEFT = []; TEX_WALL_RIGHT = [];
    for (let c = 0; c < COLS; c++) {
        TEX_WALL_TOP[c] = generateCaveWallTile(LS + c * 73 + 111, (c * 7 + 3) % 3, biome);
        TEX_WALL_BOT[c] = generateCaveWallTile(LS + c * 91 + 222, (c * 11 + 5) % 3, biome);
    }
    for (let r = 0; r < ROWS; r++) {
        TEX_WALL_LEFT[r] = generateCaveWallTile(LS + r * 67 + 333, (r * 7) % 3, biome);
        TEX_WALL_RIGHT[r] = generateCaveWallTile(LS + r * 83 + 444, (r * 11) % 3, biome);
    }

    TEX_GRID_OFF = [];   // [variant]
    for (let v = 0; v < GRID_VARIANTS; v++) {
        TEX_GRID_OFF[v] = generateGridStoneTile(LS + v * 17 + 9999, biome);
    }

    TEX_GRID_WALL = buildGridWallTexture(biome, LS);
    TEX_CAVE_BG = buildCaveBgTexture(biome, LS);

    // Cave-glow gradient bakes the biome color — rebuild lazily on next frame
    gradCache.caveGlow = null;
    texturesBuiltForLevel = levelIdx;
}
rebuildCaveTextures(0);

// Rooms load after that first bake, so a room that lands has to ask for another
// one. Any biome without a file just stays a cave — onerror is the fallback,
// not an error.
for (const b of BIOMES) {
    // Both plates load the same way. The floor goes into the baked room texture
    // and so needs a rebuild when it lands; the wall is blitted live every frame
    // and needs nothing but to exist.
    for (const slug of [b.art, b.wallArt, b.wallTile, b.wallStrip,
                        b.scoreboard && b.scoreboard.art,
                        ...(b.wallProps || []).map(w => "props/" + w.art)]) {
        if (!slug || ROOM_ART[slug]) continue;
        const im = new Image();
        im.onload = () => {
            ROOM_ART[slug] = im;
            if (currentBiome && currentBiome.art === slug) {
                rebuildCaveTextures(Math.max(0, texturesBuiltForLevel));
            }
            warmSideWalls();
        };
        im.onerror = () => {};
        im.src = "assets/room/" + slug + ".png";
    }
}

// ============================================================
// END PROCEDURAL TEXTURE GENERATION
// ============================================================

// ---- Colors (dark cave palette — bioluminescent greens + lava oranges) ----
// Cave stone: dark gray-greens. Active grid: green energy / orange lava
const PAL = {
    bg:        INK.paper,
    wall:      "#a9b8ab",
    wallTop:   "#b6c3b8",
    floor:     INK.paper,
    floorAlt:  "#f3ecd8",
    gridOff:   "#f3ecd8",
    gridOn:    [INK.green, INK.mustard, INK.teal, INK.red, INK.silverD, INK.rust], // rows O,H,S,K,B,T
    gridX:     [INK.charcoal, INK.charcoal, INK.charcoal, INK.charcoal, INK.charcoal, INK.charcoal],
    gridBorder:"#c9c0a8",
    playhead:  INK.charcoal,
    player:    INK.paper,
    playerDark:"#927e6a",
    punch:     INK.green,
    punchGlow: "#3c8226",
    // Contact shadow. At 0.25 this was charcoal-on-charcoal once the floor was
    // inked out — about two values of separation, so everything standing on the
    // floor floated. It has to bite harder against a dark ground.
    shadow:    "rgba(20,20,19,0.5)",
    startBtn:  INK.green,
    stopBtn:   INK.red,
    labelText: INK.teal,
    titleText: INK.charcoal,
};


// ---- Audio Engine (Web Audio API with synthesized drums) ----
let audioCtx = null;

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        decodeAudioSamples(); // BGM disabled — samples decode for drum hits only
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
}

// Heavy CLANG as the thief hits the doorway on his way out
function playDoorSlam() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    // Low wooden thud
    const osc = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);
    g1.gain.setValueAtTime(0.9, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(g1);
    g1.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
    // Impact noise burst
    const len = Math.floor(audioCtx.sampleRate * 0.12);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filt = audioCtx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 900;
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0.7, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(filt);
    filt.connect(g2);
    g2.connect(audioCtx.destination);
    src.start(now);
    // Metallic ring (the padlock clanking into place)
    const ping = audioCtx.createOscillator();
    const g3 = audioCtx.createGain();
    ping.type = "square";
    ping.frequency.setValueAtTime(1400, now + 0.03);
    ping.frequency.exponentialRampToValueAtTime(700, now + 0.2);
    g3.gain.setValueAtTime(0.12, now + 0.03);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    ping.connect(g3);
    g3.connect(audioCtx.destination);
    ping.start(now + 0.03);
    ping.stop(now + 0.25);
}

function playKick(time) {
    if (playSample("kick", time)) return;
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
    if (playSample("snare", time)) return;
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
    if (playSample(open ? "openhat" : "hihat", time)) return;
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
    if (playSample("cowbell", time)) return;
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
    if (playSample("tom", time)) return;
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
// The same six rows as sample voices, for anything that needs to play a row's
// drum at a chosen volume — drumFns take a time and nothing else.
const ROW_VOICE = ["openhat", "hihat", "snare", "kick", "cowbell", "tom"];

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
let sequencerStarted = false; // true once the audio clock is running and the beat has begun

// ---- Kill Counter & Dancers ----
let killCount = 0;
let score = 0;
let lastTimeBonus = 0;
// The villagers never got the ink reskin — they were still wearing the old
// pixel-art palette (peach skin, muddy browns) next to charcoal-on-cream BUZZ,
// which is what made them read as discoloured. Rebuilt out of INK, and the
// alert red is gone: #FE3636 on a harmless villager broke the design bible's
// one hard rule, and a bystander painted DEADLY reads as a threat.
const DANCER_PALETTES = [
    { _index: 0, body: INK.mustard, dark: INK.rust,     head: INK.paper, hair: INK.charcoal },
    { _index: 1, body: INK.teal,    dark: "#27454a",    head: INK.paper, hair: INK.rust },
    { _index: 2, body: INK.rust,    dark: "#8c5326",    head: INK.paper, hair: INK.charcoal },
    { _index: 3, body: INK.mint,    dark: INK.silverD,  head: INK.paper, hair: INK.rust },
    { _index: 4, body: INK.green,   dark: "#37761f",    head: INK.paper, hair: INK.charcoal },
    { _index: 5, body: INK.silverL, dark: INK.silverD,  head: INK.paper, hair: INK.rust },
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
    punchBuffered: false, // Space pressed mid-swing queues the next punch
    // The swing HOLDS at full extension while the button is down, so the
    // impact burst needs its own clock — tied to the swing it would freeze
    // mid-flash for as long as you leaned on the button.
    punchFx: 0,
    punchVel: 0,           // fist speed this frame, drives the smear and trail
    punchHitCol: null,     // colour of whatever he connected with
    speed: 1.68, // pixels per frame at 60fps
    blinkTimer: 0, // counts up each frame, blinks at 180
    stunTimer: 0, // frames remaining in stun (can't move or punch)
    freezeTimer: 0, // frames remaining in boulder freeze (direct hit, with countdown)
};

// ---- Caves (goblin spawn points) ----
// One opening in each side wall. The drawn room cuts doorways into its side
// walls spanning tile rows 1.7 to 4.0, so row 3 puts the Donks in the lower
// half of the opening rather than clipping its top edge. The cave biomes do
// not care which row it is, so both use the drawing's.
const CAVES = [
    { tileX: 0, tileY: 3 },          // left doorway
    { tileX: COLS - 1, tileY: 3 },   // right doorway
];

// ---- Multiple Goblin System ----
// Max concurrent goblins scales with level: 1 for L3-9, 2 for L10-19, 3 for L20+
function getMaxGoblins() {
    if (currentLevel < 6) return 2;   // L3-6
    if (currentLevel < 13) return 3;  // L7-13
    return 3;                         // L14-30: fewer but more dangerous
}

// Sabotage flip chance scales with level (used during level-start scramble)
function getSabotageFlipChance() {
    // Starts at 12%, scales to 65% by level 30
    return 0.12 + (currentLevel / LEVELS.length) * 0.53;
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
    const spawnY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, cave.tileY * TILE));
    return {
        x: spawnX, y: spawnY,
        destX: spawnX, destY: spawnY,
        w: TILE, h: TILE,
        dir: 0, frame: 0, frameTimer: 0,
        wob: Math.random() * 100, // per-Donk walk-phase offset
        speed: 0.5,
        dead: true,
        respawnTimer: 300,
        respawnDelay: 600,
        spawnCave: caveIndex,
        targetRow: -1, targetCol: -1,
        sabotageTimer: 0,
        moveSteps: 0,
        stalkTimer: 0,
        gloatTimer: 0,     // elite gloating phase after punching Carl
        windupTimer: 0,    // elite punch telegraph before the stun lands
        punchNow: false,
        danceTimer: 0,     // involuntary groove — can't move or sabotage
        fleeing: false,    // running home after the pattern is restored
        elite: false,
        hp: 1,
        hurtTimer: 0,
        deathAnimTimer: 0,
        deathAnimActive: false,
        deathAnimElite: false,
    };
}

// Goblins array — up to 5 concurrent goblins
let goblins = [createGoblin(0), createGoblin(1), createGoblin(0), createGoblin(1), createGoblin(0)];
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
// Where the shake is centred, in logical units, or null for a whole-screen one.
// A punch is a local event — BUZZ hitting a pad should not rock the far end of
// the room — so punches set this and everything else (taking a hit, dying, a
// boulder landing, the door slamming) leaves it null and shakes the lot.
let shakeAt = null;
// The longest this shake was going to run, so the offset can decay across it.
// Tracked here rather than passed in, because every trigger site just writes
// screenShake directly and only ever writes it UP.
let shakeDur = 0;
const SHAKE_RADIUS = 2 * TILE;   // two grid blocks, per Carl
const playerCentre = () => ({ x: player.x + player.w / 2, y: player.y + player.h / 2 });
let pendingShake = false;  // triggers shake after freeze ends
let pendingShakeElite = false;

// Sabotage flash — per-cell timer for red flash overlay
const cellFlash = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(0));
// Longer-lived "recently sabotaged" marker (~3s fade) so flipped cells stay findable
const cellRecent = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(0));

// (gradCache is declared up in the texture-generation section — the biome
// rebuild needs to invalidate it, and that code runs before this point.)

// ---- Groove bonus state (on-beat punches) ----
let pocketRing = null;    // { x, y, timer } — expanding gold ring on a pocket hit
let entourageCheer = 0;   // frames the fan entourage throws its arms up
let carlGlowBoost = 0;    // frames of amplified amber glow after a YEAH

// ---- Room progression: exit door + fan entourage ----
// entourageCheer survives as a flourish timer on YEAH / IN THE POCKET;
// the conga line it used to animate is gone.

// Tier 1: correct toggle on the quarter-note beat — the crowd answers back
function triggerYeah() {
    score = Math.min(99999, score + 25);
    entourageCheer = 40;
    carlGlowBoost = 25;
    deathText = { x: player.x - 10, y: player.y - 16, timer: 35, text: "YEAH!", color: "#F6CC60", scale: 5 };
    if (audioCtx && !playSample("yeah", audioCtx.currentTime)) playYeahStab(audioCtx.currentTime);
}

// Tier 2: correct toggle at the block's own musical moment — the goblins
// can't resist the groove and break into an involuntary dance
function triggerPocketHit(row, col) {
    score = Math.min(99999, score + 100);
    entourageCheer = 90;
    carlGlowBoost = 45;
    pocketRing = { x: (GRID_X + col) * TILE + TILE / 2, y: rowPixelY(row) + TILE / 2, timer: 30 };
    deathText = { x: player.x - 26, y: player.y - 16, timer: 60, text: "IN THE POCKET!", color: INK.mustard, scale: 5 };
    screenShake = 5;
    shakeIntensity = 2;
    shakeAt = playerCentre();
    for (const g of goblins) {
        if (!g.dead) {
            g.danceTimer = 180;
            g.windupTimer = 0; // an elite mid-windup loses the plot and dances
        }
    }
    if (catapultGoblin) catapultGoblin.danceTimer = 180;
    if (audioCtx && !playSample("crowd", audioCtx.currentTime)) playPocketStab(audioCtx.currentTime);
}

// Funky stab chord — synth fallback for the "YEAH!" call-and-response
function playYeahStab(time) {
    const freqs = [294, 370, 440, 523]; // D F# A C — dominant 7 stab
    freqs.forEach((f, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f, time);
        g.gain.setValueAtTime(0.06, time + i * 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(time + i * 0.008); osc.stop(time + 0.2);
    });
}

// Bigger hit for IN THE POCKET — chord stab plus an upward gliss
function playPocketStab(time) {
    playYeahStab(time);
    const gliss = audioCtx.createOscillator();
    const gg = audioCtx.createGain();
    gliss.type = "square";
    gliss.frequency.setValueAtTime(440, time);
    gliss.frequency.exponentialRampToValueAtTime(1760, time + 0.35);
    gg.gain.setValueAtTime(0.08, time);
    gg.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    gliss.connect(gg); gg.connect(audioCtx.destination);
    gliss.start(time); gliss.stop(time + 0.4);
}
// ---- Friend NPC (Level 30 only) ----
let friendNPC = null; // { x, y, destX, destY, moveTimer, highlightGoblin, highlightTimer }

function spawnFriendNPC() {
    friendNPC = {
        x: (GRID_X + 8) * TILE, y: (GRID_Y + 3) * TILE,
        destX: (GRID_X + 8) * TILE, destY: (GRID_Y + 3) * TILE,
        speed: 0.7,
        moveTimer: 0,
        highlightGoblin: null,
        highlightTimer: 0,
        chaseGoblin: null,
        pointCooldown: 120,
        frame: 0, frameTimer: 0,
        palIndex: 2, // dancer palette
    };
}

function updateFriendNPC() {
    if (!friendNPC) return;
    const f = friendNPC;
    f.moveTimer++;
    if (f.highlightTimer > 0) f.highlightTimer--;
    if (f.pointCooldown === undefined) f.pointCooldown = 120;
    if (f.pointCooldown > 0) f.pointCooldown--;

    // Purposeful behavior: pick the goblin nearest Carl, walk toward it,
    // and highlight it once close — so the gesture reads as "look, that one!"
    const chaseTarget = f.chaseGoblin;
    const chaseValid = chaseTarget && !chaseTarget.dead;
    if (!chaseValid && f.pointCooldown <= 0) {
        // Choose a new goblin to point out (nearest non-elite to Carl)
        let best = null, bestDist = Infinity;
        for (const g of goblins) {
            if (g.dead || g.elite) continue;
            const d = Math.abs(g.x - player.x) + Math.abs(g.y - player.y);
            if (d < bestDist) { bestDist = d; best = g; }
        }
        if (best) {
            f.chaseGoblin = best;
        } else {
            // Nothing to point at — wander to a random grid tile
            const atDestW = Math.abs(f.x - f.destX) < 0.5 && Math.abs(f.y - f.destY) < 0.5;
            if (atDestW && f.moveTimer > 60) {
                const ar = getActiveRows();
                f.destX = (GRID_X + Math.floor(Math.random() * GRID_COLS)) * TILE;
                f.destY = rowPixelY(Math.floor(Math.random() * ar));
                f.moveTimer = 0;
            }
        }
    }

    if (f.chaseGoblin && !f.chaseGoblin.dead) {
        // Head toward a spot just beside the target goblin
        f.destX = Math.round(f.chaseGoblin.x / TILE) * TILE - TILE;
        f.destY = Math.round(f.chaseGoblin.y / TILE) * TILE;
        // Close enough? Point it out
        const distToGob = Math.abs(f.x - f.chaseGoblin.x) + Math.abs(f.y - f.chaseGoblin.y);
        if (distToGob < TILE * 2.5) {
            f.highlightGoblin = f.chaseGoblin;
            f.highlightTimer = 120;   // 2 seconds of gold brackets
            f.pointCooldown = 240;    // ~4s before picking the next target
            f.chaseGoblin = null;
        }
    } else if (f.chaseGoblin) {
        f.chaseGoblin = null; // target died mid-chase
    }
    if (f.highlightTimer <= 0) f.highlightGoblin = null;

    // Move toward destination
    const atDest = Math.abs(f.x - f.destX) < 0.5 && Math.abs(f.y - f.destY) < 0.5;
    if (!atDest) {
        const dx = f.destX - f.x;
        const dy = f.destY - f.y;
        if (Math.abs(dx) > 0.5) f.x += Math.sign(dx) * Math.min(f.speed, Math.abs(dx));
        if (Math.abs(dy) > 0.5) f.y += Math.sign(dy) * Math.min(f.speed, Math.abs(dy));
        f.frameTimer++;
        if (f.frameTimer >= 8) { f.frameTimer = 0; f.frame = (f.frame + 1) % 4; }
    } else {
        f.frame = 0;
    }
}

function renderFriendNPC() {
    if (!friendNPC) return;
    const f = friendNPC;
    // Draw using dancer sprite
    const pal = DANCER_PALETTES[f.palIndex];
    drawDancerSprite(f.x, f.y, pal, { bob: 0, armBlend: 0, footOffset: 0 });
    // Draw gold bracket indicator on highlighted goblin
    if (f.highlightGoblin && !f.highlightGoblin.dead && f.highlightTimer > 0) {
        const hg = f.highlightGoblin;
        const L = 6, s = 2;
        const pulse = 0.6 + Math.sin(performance.now() * 0.005) * 0.3;
        ctx.globalAlpha = pulse;
        const c = "#F6CC60"; // gold
        // Top-left corner
        drawRect(hg.x, hg.y, L, s, c);
        drawRect(hg.x, hg.y, s, L, c);
        // Top-right corner
        drawRect(hg.x + TILE - L, hg.y, L, s, c);
        drawRect(hg.x + TILE - s, hg.y, s, L, c);
        // Bottom-left corner
        drawRect(hg.x, hg.y + TILE - s, L, s, c);
        drawRect(hg.x, hg.y + TILE - L, s, L, c);
        // Bottom-right corner
        drawRect(hg.x + TILE - L, hg.y + TILE - s, L, s, c);
        drawRect(hg.x + TILE - s, hg.y + TILE - L, s, L, c);
        ctx.globalAlpha = 1.0;
    }
}

// ---- Catapult Goblin State ----
let catapultGoblin = null; // null when inactive
let catapultSpawnedThisCycle = false; // prevents re-spawning catapult after it finishes
// When active: { x, y, destX, destY, dir, frame, frameTimer, speed,
//   phase, phaseTimer, caveIndex, targetRow, targetCol,
//   boulder: null | { startX, startY, targetX, targetY, progress } }

// Tomato projectiles (dancers throw at goblins — purely cosmetic)

let gameState = "title";
let pausedFromState = "playing";   // gameState to restore on unpause

// --- Visual Improvement State ---
// Block toggle animation (pop/glow when punched)
const blockToggleAnim = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(0));
// Beat pulse: tracks which rows triggered on the current step (for string lights + column pulse)
const rowTrigger = new Array(GRID_ROWS).fill(0); // countdown frames per row
// Scene transition effect
let sceneTransition = { active: false, from: null, to: null, progress: 0, duration: 20 };
// Title text entrance/exit animation
let titleFadingOut = false;  // true when transitioning title→intro
let titleFadeTimer = 0;      // frames since fade-out started
const TITLE_FADE_DURATION = 20; // frames for title text to fade out
// Firework system for level complete
let fireworks = []; // { x, y, vx, vy, life, maxLife, color, exploded, particles: [] }
// Screen crack effect for game over
// Enemy warning zoom state
let enemyWarningType = null;   // "elite" or "catapult"
let enemyWarningShown = { normal: false, elite: false, catapult: false }; // track which warnings have been shown
let enemyWarningBlink = 0;     // blink timer for "PRESS ENTER"
let enemyWarningIntroTimer = 0; // transition timer before warning popup
let currentLevel = 0;
let levelTimer = LEVELS[0].timerSeconds * 60; // countdown in frames (seconds * 60 at 60fps)
let levelComplete = false;
let patternMatched = false; // pattern correct but goblins may still be alive
let levelCelebrateTimer = 0;
// Last whole second the countdown tick sounded on, so it fires on the CHANGE
// of second rather than on a modulo tested every frame. -1 = nothing yet.
let lastTickSecond = -1;
let levelCelebrateDisplayScore = 0; // for count-up animation
let titleBlink = 0; // blink timer for "PRESS ENTER"

// The groove the DJ is playing. Named for the cutscene it was written for; the
// cutscene is gone but the title screen, the DJ booth and the ending all still
// play this pattern.
const INTRO_BEAT = {
    K: [1,0,0,0,1,0,0,1,0,0,1,0,0,0,0,0],
    S: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    H: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    O: [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],
};
let newInstrumentType = null;   // "cowbell" or "tom"
let newInstrumentTimer = 0;     // animation timer for new instrument popup
let newInstrumentShown = { cowbell: false, tom: false }; // track which popups have been shown


// Sabotage animation state (goblin zigzags across grid scrambling cells)
let sabotageAnimTimer = 0;
let sabotageNextState = "playing";
let sabotageCells = [];              // [{r, c, flip: bool}] in zigzag order
let sabotageFlipIndex = 0;
const SABOTAGE_FRAMES_PER_CELL = 2;  // 2 frames/cell at 90fps

// ---- Thief door-slam (level opening) ----
// After scrambling the grid the goblin bolts through the right door and
// slams it shut — that's why the exit is barred until the beat is restored.
let thiefCarriedPiece = null; // DJ piece the thief runs off with on milestone levels
// The thief still bolts out of the room after scrambling the grid; what is
// gone is the door he used to slam behind him, and the bars and padlock that
// kept the exit shut until the pattern was restored.

// ---- Biome banner ("~ THE AMBER LOUNGE ~") ----
let biomeBannerTimer = 0;
let biomeBannerPending = false; // set during sabotage, fires when play starts

// ---- Biome transition cutscene (plays after each milestone level) ----
let biomeTransTimer = 0;
let biomeTransFrom = null;      // biome we're leaving
let biomeTransTo = null;        // biome we're descending into
let biomeTransPiece = null;     // DJ piece just recovered
let biomeTransNextPiece = null; // piece the goblins still hold (chase hook)

// ---- High Score System ----
let highScores = []; // Array of { name: "AAA", score: 0 }, max 5, sorted desc
let initialsEntry = ["A", "A", "A"];
let initialsPos = 0;       // which letter slot is active (0-2)
let initialsBlink = 0;     // blink timer for active letter
let finalScore = 0;        // killCount captured at game over

// ---- Minigame (Cave Beat 'Em Up) State ----
const MINIGAME_LEVELS = [4, 9, 14, 19, 24, 29]; // trigger after levels 5,10,15,20,25,30 (0-indexed)
const CAVE_COLS = COLS; // same as world (follows the 24x14 layout)
const CAVE_ROWS = ROWS;
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
let pieceRecoveredThisLevel = null; // piece name to announce on the level-complete screen

// Minigame state
let minigameRescueTimer = 0;
let minigameRescuePhase = 0; // 0=wall bursts, 1=dancers enter, 2=celebration

// ---- Ending Scene State ----
let endingPhase = 0;           // 0=rebuild, 1=first beat, 2=crowd, 3=missing, 4=cave rave, 5=score
let endingTimer = 0;           // frame counter within current phase
let endingGlobalTimer = 0;     // total frames since ending started
let endingPiecesPlaced = 0;    // 0-6, tracks which pieces have landed on booth
let endingDJX = 0;             // DJ position during ending
let endingDJY = 0;
let endingDancers = [];        // surface dancers for phases 0-3
let endingKickPump = 0;        // speaker pump animation
let endingBeatStep = 0;        // sequencer step for ending beat
let endingBeatTimer = 0;       // frame counter for beat stepping
let endingDrumGain = null;
let endingDrumStarted = false;
let endingDrumTimer = null;

// Cave arena entities
let caveClockPickups = []; // +5s clock pickups dropped by elite kills
let caveDeathText = null;
let caveScreenShake = 0;
let caveShakeIntensity = 0;
let caveHitFreeze = 0;
let cavePendingShake = false;
let caveScreenFlash = 0;
let caveBoulderImpacts = []; // dust cloud rings from boulder landings

// Cave player state (reuses main player object but with cave-specific position)

// Boarded-up cave entrances state (top wall)
let caveBoardedUp = false; // true after goblins board up the entrances
let boardedEntrances = []; // {x, w} positions of the 3 boarded openings at top
let boardProgress = 0; // 0→1 during boarding animation
let rescueWallProgress = 0; // 0→1 based on timer progress

// Boarding phase state
let boardingGoblins = []; // goblins that nail boards
let boardingTimer = 0;

// Rescue board-breaking state
let rescueBrokenEntrances = [false, false, false];

// Kidnap cutscene positions

// Rescue dancers with torches

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
            levelTimer = LEVELS[currentLevel].timerSeconds * 60;
    lastTickSecond = -1;
            lastTickSecond = -1;
            player.y = (gridBottomTileY() + 1) * TILE + GRID_Y_OFFSET;
            player.destY = player.y;
            setLevelTempo(currentLevel);
            ensureAudio();
            gameState = "playing";
            resetSequencerClock();
            console.log("DEBUG: Jumped to level " + (targetLevel + 1));
        }
    }
}

window.addEventListener("keydown", (e) => {
    // Unlock/resume audio on any key press — browsers only allow
    // AudioContext.resume() inside a real user gesture
    ensureAudio();

    // Feed single-char keys into cheat code buffer
    if (e.key.length === 1) handleCheatCode(e.key);

    if (e.code === "Space") {
        e.preventDefault();
        if (gameState === "enemywarning" || gameState === "enemywarning-intro") return; // ignore Space on warning screen
        if (gameState === "newinstrument") return; // ignore Space on instrument screen
        if (gameState === "sabotage-anim") return; // ignore input during animations
        if (!keys[e.code]) spaceJustPressed = true; // only on initial press
    }
    keys[e.code] = true;

    // Pause toggle (Escape key during gameplay or minigame)
    if (e.code === "Escape") {
        if (gameState === "paused") {
            gameState = pausedFromState;
            return;
        } else if (gameState === "playing") {
            pausedFromState = gameState;
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

    if (e.code === "Enter") {
        e.preventDefault();
        if (gameState === "sabotage-anim") return; // ignore input during animations
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
            // Start fading title text — state change happens when fade completes
            titleFadingOut = true;
            titleFadeTimer = 0;
            return;
        }
        // 120 for the panel, plus however long the room is held first, so it
        // still gets its full two seconds before a key can skip past it. The
        // hold is a bar now rather than a fixed 45, so this follows it instead
        // of restating it.
        if (gameState === "levelcomplete" && levelCelebrateTimer > 120 + holdFrames()) {
            // (Kidnap mini-levels retired — DJ pieces are now awarded directly
            // in triggerLevelComplete at milestone levels)
            // Show all feature screens (instruments + enemy warnings) before advancing
            if (checkPendingFeatureScreens()) return;
            // Milestone level cleared → biome transition cutscene before the next zone
            if (pieceRecoveredThisLevel && currentLevel < LEVELS.length - 1) {
                startBiomeTransition();
                return;
            }
            advanceLevel();
            return;
        }
        if (gameState === "levelcomplete") return; // let celebration play
        if (gameState === "biome-transition") {
            // Let it play a moment, then Enter skips ahead to the next zone
            if (biomeTransTimer > 60) advanceLevel();
            return;
        }
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

// The grid is RULED, not assembled out of bordered cells.
//
// Every tile used to close its own rectangle, which meant each internal
// boundary carried two lines — one drawn by the cell on each side — wobbling
// independently. Zoom in and it reads as tram-lines, not as a grid. So the
// tiles carry no border at all and the lattice is drawn here: one continuous
// line per boundary, running the full width or height of the field.
//
// This is the one place the game inks per frame rather than from a baked copy,
// and it is worth it: ~24 short polylines against 96 tiles, and it means the
// lattice does not need re-baking when the row count changes between levels.
function drawGridLattice() {
    if (!TEX_GRID_OFF.length) return;
    const ar = getActiveRows();
    const live = boilPhase("grid");
    const S = SCALE;
    const x0 = GRID_X * TILE, y0 = rowPixelY(0);
    ctx.save();
    ctx.strokeStyle = INK.charcoal;
    // The doubled per-cell borders this replaces were 2px each, so a boundary
    // carried about 4px of ink. One line has to carry that weight on its own or
    // the field reads as washed out rather than ruled.
    ctx.lineWidth = 0.8 * S;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // A lit cell's wash is a hard rectangle filling its tile exactly, so this
    // line is the only thing hiding the join between a wash and its neighbour.
    // The amplitude is therefore tied to the line's weight rather than being an
    // independent constant, and the division keeps BOIL.amp — a slider on the
    // debug panel — from compounding it.
    //
    // The 2x is measured, not guessed. Geometry says the line stops covering the
    // join once it wanders past its own half-width, which would cap this at
    // 1x. In practice the round caps and the anti-aliased edges cover
    // considerably further than the nominal half-width: checkerboarded so every
    // boundary is the visible wash-against-cream kind, a 1px sliver shows on
    // 2.0% of scanlines at 2x against 2.2% at 1x. Doubling the wobble does not
    // cost anything, so the geometric bound was the wrong thing to trust.
    const amp = 2 * (ctx.lineWidth / 2 - 0.5) / Math.max(1, BOIL.amp);
    // Two things make a hand-ruled line bump rather than drift, and the first
    // pass only had one of them:
    //   * sample often enough — every quarter tile, which is the density the
    //     per-cell borders had across their much shorter edges;
    //   * and step the noise by MORE THAN ITS WAVELENGTH (46, see vnoise) per
    //     sample. Stepping by 17 or 23 put consecutive points on the same slope
    //     of the same hump, so the line slid smoothly instead of bending. This
    //     was the bigger of the two.
    const SUB = 4;
    const STEP = 61;   // > vnoise's wavelength, so each sample is independent
    // Only the WRONG part of the grid breathes — a cell whose current state
    // disagrees with the level's target, either lit when it should be dark or
    // dark when it should be lit. That is the set of cells the player still has
    // to touch, so the ink is alive exactly where there is work to do and the
    // field goes quiet behind you as you fix it. Finish the pattern and the
    // whole lattice rules itself straight, which is the tell that you are done.
    //
    // It used to follow the LIT cells, which meant a correctly-placed hit kept
    // wobbling forever and a missing one sat dead still — the boil was busiest
    // where nothing needed doing.
    //
    // The phase is chosen PER SAMPLED POINT rather than per cell, and that is
    // the whole trick. Stroking each lit cell's outline separately would be the
    // obvious way to do it and would re-create the exact bug this lattice was
    // built to kill: two adjacent lit cells share an edge, so that edge would be
    // drawn twice. Here the lines stay single and continuous — one stroke each,
    // exactly as before — and only which phase a point samples changes. Where a
    // live stretch meets a frozen one the line interpolates, so the wobble fades
    // out along its length instead of stopping at a visible join.
    // Not boiling means STRAIGHT, not "frozen mid-wobble". A phase-0 sample is
    // still a displacement — it just stops changing — so a dead line held a
    // resting bend that read as a wonky line nobody was drawing. A dead point
    // takes no displacement at all, so the run is ruler-straight and the ink
    // only comes alive where something is happening. It also skips the noise
    // entirely for the majority of points, which is most of the field.
    // L30 has no target, so nothing there is ever "wrong" and the field stays
    // still — which is right for a level that is only a groove to play with.
    const lv = currentLevel < LEVELS.length ? LEVELS[currentLevel] : null;
    const target = lv && !lv.noPattern ? lv.pattern : null;
    const wrongAt = (r, c) => r >= 0 && r < ar && c >= 0 && c < GRID_COLS &&
        !!grid[r][c] !== !!target[r][c];
    const gridBoils = BOIL.on && BOIL.grid && !!target;
    for (let c = 0; c <= GRID_COLS; c++) {
        const x = x0 + c * TILE;
        ctx.beginPath();
        for (let i = 0; i <= ar * SUB; i++) {
            const y = y0 + (i / SUB) * TILE;
            // the up-to-four cells this point touches: the rows either side of
            // it, in the columns either side of the boundary it runs along
            const rA = Math.floor((i - 0.5) / SUB), rB = Math.floor((i + 0.5) / SUB);
            const wob = gridBoils &&
                (wrongAt(rA, c - 1) || wrongAt(rA, c) || wrongAt(rB, c - 1) || wrongAt(rB, c));
            ctx.lineTo(x * S + (wob ? pjit(c * 131 + i * STEP, 2.7, live, amp) : 0),
                       y * S + (wob ? pjit(c * 71 + i * 43, 5.3, live, 0.7) : 0));
        }
        ctx.stroke();
    }
    for (let r = 0; r <= ar; r++) {
        const y = y0 + r * TILE;
        ctx.beginPath();
        for (let i = 0; i <= GRID_COLS * SUB; i++) {
            const x = x0 + (i / SUB) * TILE;
            const cA = Math.floor((i - 0.5) / SUB), cB = Math.floor((i + 0.5) / SUB);
            const wob = gridBoils &&
                (wrongAt(r - 1, cA) || wrongAt(r, cA) || wrongAt(r - 1, cB) || wrongAt(r, cB));
            ctx.lineTo(x * S + (wob ? pjit(r * 89 + i * 53, 6.1, live, 0.7) : 0),
                       y * S + (wob ? pjit(r * 149 + i * STEP, 3.9, live, amp) : 0));
        }
        ctx.stroke();
    }
    ctx.restore();
}

// ---- Helper: tile Y of the bottom of the active grid ----
function gridBottomTileY() {
    return GRID_Y + getActiveRows();
}

// ---- Helper: convert tile Y back to grid row (inverse of rowPixelY) ----
function tileYToRow(tileY) {
    return tileY - GRID_Y - Math.round(GRID_Y_OFFSET / TILE);
}


// ---- Helper: AABB collision ----
function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}



// ---- Sequencer clock ------------------------------------------------------
// Hits are scheduled AHEAD against the audio clock, not fired at whatever
// instant an animation frame happens to land. The old tick did `lastStepTime =
// now` every step, so error never corrected and the tempo ran permanently slow,
// and it scheduled for `currentTime` exactly — zero lookahead — so every hit
// carried up to a frame of jitter. Inaudible on a 60ms synth blip; very audible
// on a real kick sample, which is where this is going.
//
// The catch is that `currentStep` and `lastStepTime` are read by the visual
// playhead AND by the groove-bonus window, and those want the step SOUNDING NOW,
// not the one being queued 100ms into the future. So the scheduler runs on its
// own pair of variables and the old two are back-derived from the audio clock
// each frame — every existing consumer keeps working untouched.
const SCHED_AHEAD = 0.1;     // seconds of lookahead
let nextStepTime = 0;        // audioCtx time of the next step to queue
let scheduleStep = 0;        // which step that is
let schedQueue = [];         // {step, t} pending, so "what is sounding" is knowable

function resetSequencerClock() {
    currentStep = 0;
    scheduleStep = 0;
    schedQueue = [];
    nextStepTime = 0;
    lastStepTime = performance.now();
}

function tickSequencer() {
    if (!playing) return;
    // The beat must not run before the audio clock does. A suspended
    // AudioContext freezes its clock, so scheduling hits while suspended piles
    // them up into a burst at unlock.
    if (!audioCtx || audioCtx.state !== "running") {
        sequencerStarted = false;
        return;
    }
    const stepSec = stepMs / 1000;
    const now = audioCtx.currentTime;

    if (!sequencerStarted) {
        // First audible frame: pattern starts clean from the top, both clocks
        // born together
        sequencerStarted = true;
        currentStep = 0;
        scheduleStep = 0;
        schedQueue = [];
        nextStepTime = now;
        lastStepTime = performance.now();
    }
    // Tab-stall guard: resync rather than firing a burst of catch-up hits
    if (nextStepTime < now - stepSec * 2) nextStepTime = now;

    // ---- schedule everything inside the lookahead window ----
    while (nextStepTime < now + SCHED_AHEAD) {
        const ar = getActiveRows();
        for (let r = 0; r < ar; r++) {
            if (grid[r][scheduleStep]) drumFns[r](nextStepTime);
        }
        schedQueue.push({ step: scheduleStep, t: nextStepTime });
        scheduleStep = (scheduleStep + 1) % GRID_COLS;
        nextStepTime += stepSec;          // accumulate — error cannot build up
    }

    // ---- back-derive what is SOUNDING, for the visuals and the groove window --
    let sounded = null;
    while (schedQueue.length && schedQueue[0].t <= now) sounded = schedQueue.shift();
    if (sounded) {
        // `currentStep` keeps its old meaning — the step AFTER the one sounding —
        // so playheadCol/soundingCol/the beat window all read unchanged.
        currentStep = (sounded.step + 1) % GRID_COLS;
        lastStepTime = performance.now();
        const ar = getActiveRows();
        for (let r = 0; r < ar; r++) {
            if (grid[r][sounded.step]) rowTrigger[r] = 8;   // pulse for 8 frames
        }
    }
}

// ---- Update ----
function update(dt) {
    // THE SEQUENCER STEPS FIRST, before anything else reads the clock.
    //
    // This was the last statement in update(), so everything that asked what
    // the beat was doing — the punch, the groove bonus, the row pulses — was
    // answered with the step state left over from the PREVIOUS frame. A
    // systematic 16.7ms lag. It was invisible while the only consumer was a
    // bonus with a whole-step window, and it stopped being invisible the moment
    // anything wanted finer timing than that.
    //
    // Nothing wanted it at the bottom. Hits are scheduled 100ms ahead against
    // the audio clock, so stepping earlier in the frame changes no timing; the
    // row pulses and the drawn playhead now belong to the same frame that
    // renders them, which is if anything more correct. It also means a hit
    // freeze no longer eats the sequencer tick for those frames, so punching a
    // Donk cannot stutter the beat.
    tickSequencer();

    // Decay visual effect timers
    for (let r = 0; r < GRID_ROWS; r++) {
        if (rowTrigger[r] > 0) rowTrigger[r]--;
        for (let c = 0; c < GRID_COLS; c++) {
            if (blockToggleAnim[r][c] > 0) blockToggleAnim[r][c]--;
        }
    }

    // Level countdown timer
    if (levelTimer > 0 && !levelComplete) { // clock stops once the beat is restored
        levelTimer--;
        if (levelTimer <= 0) {
            // Level 30: timer expiry triggers ending, not game over
            if (currentLevel < LEVELS.length && LEVELS[currentLevel].noPattern) {
                finalScore = score;
                gameState = "ending";
                if (typeof startEnding === "function") startEnding();
                return;
            }
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
            shakeAt = playerCentre();
            pendingShake = false;
        }
        return;
    }

    // Decrement screen shake
    if (screenShake > 0) { screenShake--; if (screenShake === 0) shakeDur = 0; }

    const p = player;

    // Boulder launch animation — skip all player input during flight
    // Boulder freeze countdown (direct hit — 10 second freeze)
    if (p.freezeTimer > 0) {
        p.freezeTimer--;
        spaceJustPressed = false;
        // Game continues normally around frozen Carl — goblins, sequencer all keep running
    }

    // Punch input buffering: a press during the punch animation queues a
    // follow-up punch that fires as soon as the current one finishes
    if (spaceJustPressed && p.attacking) {
        p.punchBuffered = true;
        spaceJustPressed = false;
    }
    if (p.stunTimer > 0 || p.freezeTimer > 0) {
        p.punchBuffered = false; // don't fire stale punches after a stun/freeze
    }
    if (p.punchBuffered && !p.attacking) {
        p.punchBuffered = false;
        spaceJustPressed = true; // replay the buffered press
    }

    // Attack (single press only) — skip during boulder launch or stun
    if (spaceJustPressed && !p.attacking && p.stunTimer <= 0 && p.freezeTimer <= 0) {
        p.attacking = true;
        p.attackTimer = p.attackDuration;
        p.punchFx = 0;          // the burst is seeded by CONTACT, not by the swing
        p.punchFxAt = null;
        p.punchHit = false;
        p.punchHitCol = null;
        ensureAudio();
        // No sound on the SWING. There used to be a sine thump plus a noise
        // burst here, fired on every punch before anything was known about what
        // it would hit — so punching a pad played that AND the pad's drum, two
        // impacts a few milliseconds apart for one action. What a punch sounds
        // like is now decided by what it lands on: a pad plays its own drum, a
        // Donk keeps its clang, and hitting nothing makes no noise, which is
        // what hitting nothing sounds like.

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
                p.punchFx = PUNCH_FX_LEN + 1; p.punchFxAt = null;
                p.punchHitCol = INK.mustard;   // a solid hit on a Donk
                hitGob.hp--;

                if (hitGob.hp > 0) {
                    hitGob.hurtTimer = 12;
                    const baseSpd = currentLevel < LEVELS.length ? LEVELS[currentLevel].goblinSpeed : 0.5;
                    // No speed boost on hurt — elites keep their stalking (or
                    // gloating) speed, and fleeing goblins keep their sprint
                    if (!hitGob.fleeing) {
                        hitGob.speed = hitGob.elite
                            ? baseSpd * 0.85 * (hitGob.gloatTimer > 0 ? 0.5 : 1)
                            : baseSpd;
                    }

                    hitFreeze = 2;
                    pendingShake = true;
                    pendingShakeElite = false;

                    const gobTileX = Math.round(hitGob.x / TILE);
                    const gobTileY = Math.round(hitGob.y / TILE);
                    const knockDx = gobTileX - Math.round(p.x / TILE);
                    const knockDy = gobTileY - Math.round(p.y / TILE);
                    const knockX = hitGob.x + Math.sign(knockDx) * TILE;
                    const knockY = hitGob.y + Math.sign(knockDy) * TILE;
                    hitGob.destX = Math.max(TILE, Math.min((COLS - 2) * TILE, knockX));
                    hitGob.destY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, knockY));

                    for (let i = 0; i < 8; i++) {
                        deathParticles.push({
                            x: hitGob.x + hitGob.w / 2,
                            y: hitGob.y + hitGob.h / 2,
                            vx: (Math.random() - 0.5) * 2,
                            vy: (Math.random() - 0.5) * 2 - 0.5,
                            life: 15 + Math.random() * 15,
                            color: hitGob.hp === 2 ? "#c05838" : "#50ad33",
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
                        ? { x: hitGob.x - 40, y: hitGob.y - 12, timer: 120, text: "bro why you gotta stab me?", color: INK.mint, scale: 4 }
                        : { x: hitGob.x - 20, y: hitGob.y - 8, timer: 60, text: deathOw, color: INK.red, scale: 5 };

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
                p.punchFx = PUNCH_FX_LEN + 1; p.punchFxAt = null;
                p.punchHitCol = INK.silverL;   // clang — it's armour plate
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
                        color: Math.random() > 0.5 ? INK.mint : "#ffffff",
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
                    tryY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, tryY));
                    const ttx = Math.round(tryX / TILE);
                    const tty = Math.round(tryY / TILE);
                    let gobBlocked = false;
                    for (const gg of goblins) {
                        if (!gg.dead && tryX === Math.round(gg.x / TILE) * TILE && tryY === Math.round(gg.y / TILE) * TILE) {
                            gobBlocked = true; break;
                        }
                    }
                    const blocked = gobBlocked;
                    if (!blocked) { kbDist = d; break; }
                }
                if (kbDist > 0) {
                    let kbX = p.x + kbDirX * kbDist * TILE;
                    let kbY = p.y + kbDirY * kbDist * TILE;
                    kbX = Math.max(TILE, Math.min((COLS - 2) * TILE, kbX));
                    kbY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, kbY));
                    p.destX = kbX;
                    p.destY = kbY;
                }
                // Screen shake for impact feel
                screenShake = 8;
                shakeIntensity = 3;
                shakeAt = playerCentre();
                // "WHAT THE...?" floating text above player
                deathText = { x: p.x - 16, y: p.y - 14, timer: 50, text: "WHAT THE...?", color: "#FFFFFF", scale: 3 };
            }
        }


        // Toggle block only if no goblin was hit
        if (!hitAnyGoblin && row >= 0 && row < getActiveRows() && col >= 0 && col < GRID_COLS) {
            grid[row][col] = !grid[row][col];
            blockToggleAnim[row][col] = 12; // trigger pop animation
            p.punchHit = true;
            p.punchFx = PUNCH_FX_LEN + 1; p.punchFxAt = null;
            // The pad flashes in its own instrument's colour, so the impact
            // reinforces the sequencer's colour language instead of fighting it
            p.punchHitCol = PAL.gridOn[row] || INK.mustard;
            screenShake = Math.max(screenShake, 3);
            shakeIntensity = Math.max(shakeIntensity, 1);
            shakeAt = playerCentre();
            // Punching a pad plays THAT PAD'S DRUM. It used to be a square-wave
            // blip, 880Hz on and 440Hz off, which was the last synth voice left
            // in a game that now has a sampled kit — and it told you nothing
            // about what you had just edited.
            //
            // This does two jobs at once. It is the right feedback for the
            // action, the way tapping a pad on a drum machine is; and it is the
            // only thing in the game that says which row is which instrument.
            // The six rows are told apart by colour alone otherwise, which is
            // no help at all if you cannot separate those colours.
            //
            // Turning a pad OFF plays the same drum well down, so the two
            // actions stay distinguishable — the blip did that with pitch.
            if (audioCtx) {
                const now = audioCtx.currentTime;
                const on = grid[row][col];
                if (!playSample(ROW_VOICE[row], now, on ? 1.0 : 0.3)) {
                    // No sample for that row: fall back to the synthesised
                    // voice, which carries its own level.
                    if (on && drumFns[row]) drumFns[row](now);
                }
            }

            // ---- Groove timing bonuses ----
            // Only toggles that move the pattern TOWARD the goal count
            const lvlDef = currentLevel < LEVELS.length ? LEVELS[currentLevel] : null;
            const madeCorrect = lvlDef && !lvlDef.noPattern &&
                grid[row][col] === lvlDef.pattern[row][col];
            if (madeCorrect && playing && sequencerStarted) {
                const sinceTick = performance.now() - lastStepTime;
                const playedCol = (currentStep + GRID_COLS - 1) % GRID_COLS;
                if (col === playedCol) {
                    // Punched the block at its own musical moment
                    triggerPocketHit(row, col);
                } else {
                    // Landed on the quarter-note beat? The crowd answers
                    const BEAT_WINDOW_MS = 67;
                    const onBeat =
                        (playedCol % 4 === 0 && sinceTick <= BEAT_WINDOW_MS) ||
                        (currentStep % 4 === 0 && (stepMs - sinceTick) <= BEAT_WINDOW_MS);
                    if (onBeat) triggerYeah();
                }
            }

            // Check if level pattern is now complete
            tryCompleteLevelOrWait();
        }
    }
    spaceJustPressed = false;

    if (p.punchFx > 0) p.punchFx--;   // impact burst runs on its own clock
    if (p.attacking) {
        // HOLD the punch out while the button is down instead of playing a
        // one-shot swing: the thrust peaks at the halfway frame, so pinning the
        // timer there pins the pose. Let go and the rest of the swing plays out
        // and retracts him. A stun or freeze always wins.
        const peak = Math.ceil(p.attackDuration / 2);
        const held = keys["Space"] && p.stunTimer <= 0 && p.freezeTimer <= 0;
        if (held && p.attackTimer <= peak) {
            p.attackTimer = peak;
        } else {
            p.attackTimer--;
            if (p.attackTimer <= 0) p.attacking = false;
        }
    }

    // Stun timer countdown
    if (p.stunTimer > 0) {
        p.stunTimer--;
    }

    // Movement (smooth pixel-by-pixel, destination-based) — skip during boulder launch or stun
    const atDest = Math.abs(p.x - p.destX) < 0.5 && Math.abs(p.y - p.destY) < 0.5;

    if (atDest && !p.attacking && p.stunTimer <= 0 && p.freezeTimer <= 0) {
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
                p.turnDelay = 5;
            } else if (p.turnDelay > 0) {
                // Wait after turning before allowing movement
                p.turnDelay--;
            } else {
            // Already facing this way — move one tile
            let nx = p.x, ny = p.y;
            switch (wantDir) {
                case 0: ny = Math.min(WALK_BOTTOM, p.y + TILE); break;
                case 1: ny = Math.max(WALK_TOP, p.y - TILE); break;
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
                ;
            if (!blocked) {
                p.destX = nx;
                p.destY = ny;
            }
            }
        } else {
            p.frame = 0;
        }
    }

    // Move toward the destination EVERY frame — including the one where a new
    // destination was just chosen. Gating this on `atDest` (computed BEFORE the
    // input ran) skipped the step on arrival frames, stalling him for one frame
    // at every tile boundary: about five hitches a second while walking, and it
    // also made the rig read as "standing" for that frame.
    {
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

    if (entourageCheer > 0) entourageCheer--;

    // (The walk-to-the-exit check lived here. The level now ends the instant
    // the pattern lands, so there is nothing left to walk to.)

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
        // No goblins on the practice levels (1-2)
        if (currentLevel < 2) {
            gob.respawnTimer = 300;
            continue;
        }
        // Don't respawn if pattern is already matched
        else if (patternMatched) {
            gob.respawnTimer = 300;
        }
        // No respawns once the door is open — but DON'T skip the rest of the
        // loop body: dead goblins still need their death-poof timer (at the
        // loop tail) to tick, or a goblin killed mid-flee freezes on poof
        // frame zero and looks stuck in place.
        if (!levelComplete) {
        gob.respawnTimer--;
        if (gob.respawnTimer <= 0) {
            // Every 6th goblin is a catapult goblin instead of normal/elite (from L15+)
            if (killCount % 6 === 5 && !catapultGoblin && !catapultSpawnedThisCycle && currentLevel >= 14) {
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
            gob.speed = gob.elite ? baseSpeed * 0.85 : baseSpeed;
            // Reset elite AI state from any previous life
            gob.gloatTimer = 0;
            gob.stalkTimer = 0;
            gob.windupTimer = 0;
            gob.punchNow = false;
            gob.danceTimer = 0;
            gob.fleeing = false;
            gob.huntX = undefined;
            gob.huntY = undefined;
            // Spawn from any cave — pick one not occupied by another alive goblin
            const availableCaves = CAVES.map((_, ci) => ci).filter(ci => {
                for (const og of goblins) {
                    if (og !== gob && !og.dead && og.spawnCave === ci) return false;
                }
                return true;
            });
            gob.spawnCave = availableCaves.length > 0
                ? availableCaves[Math.floor(Math.random() * availableCaves.length)]
                : Math.floor(Math.random() * CAVES.length);
            const cave = CAVES[gob.spawnCave];
            const spawnX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
            const spawnY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, cave.tileY * TILE));
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
        } // end if (!levelComplete)
    } else if (gob.danceTimer > 0) {
        // GROOVED! Involuntary dance break — can't move, sabotage, or punch
        gob.danceTimer--;
        if (gob.danceTimer <= 0) {
            gob.windupTimer = 0;
            gob.stalkTimer = 999; // elites re-acquire Carl immediately
        }
    } else {
        // Smooth pixel movement toward destination
        const dx = gob.destX - gob.x;
        const dy = gob.destY - gob.y;
        const dist = Math.abs(dx) + Math.abs(dy);

        if (dist < gob.speed) {
            gob.x = gob.destX;
            gob.y = gob.destY;

            // Elite goblins don't sabotage — they hunt Carl instead
            // (and nobody sabotages while fleeing a restored beat)
            if (!gob.elite && !gob.fleeing) {
                // Check if on a grid cell to sabotage
                const gc = Math.round(gob.x / TILE) - GRID_X;
                const gr = tileYToRow(Math.round(gob.y / TILE));
                if (gr >= 0 && gr < getActiveRows() && gc >= 0 && gc < GRID_COLS) {
                    if (gc === gob.targetCol && gr === gob.targetRow) {
                        grid[gr][gc] = !grid[gr][gc];
                        cellFlash[gr][gc] = 30;
                        cellRecent[gr][gc] = 180;
                        if (audioCtx) playSabotageSound(audioCtx.currentTime);
                        gob.targetRow = -1;
                        if (patternMatched && !checkLevelComplete()) {
                            patternMatched = false;
                        }
                        tryCompleteLevelOrWait();
                    }
                }
            }

            // Elite goblin punch: telegraphed wind-up, then stun when adjacent
            // (goblins can't share Carl's tile — movement blocks it — so
            // adjacency is the trigger)
            if (gob.elite && gob.windupTimer > 0) {
                // Winding up — frozen in place (goal selection below holds position)
                gob.windupTimer--;
                if (gob.windupTimer === 0) {
                    const gobTX = Math.round(gob.x / TILE);
                    const gobTY = Math.round(gob.y / TILE);
                    const plrTX = Math.round(p.x / TILE);
                    const plrTY = Math.round(p.y / TILE);
                    const manhattan = Math.abs(gobTX - plrTX) + Math.abs(gobTY - plrTY);
                    if (manhattan > 1 || p.stunTimer > 0 || p.freezeTimer > 0) {
                        // Carl dodged (or is already incapacitated) — resume stalking
                        gob.stalkTimer = 999;
                    } else {
                        // Punch lands — handled by the block below via punchNow flag
                        gob.punchNow = true;
                    }
                }
            } else if (gob.elite && !gob.fleeing && gob.gloatTimer <= 0 && p.stunTimer <= 0 && p.freezeTimer <= 0) {
                // Adjacent? Start the wind-up telegraph instead of punching instantly
                const gobTX = Math.round(gob.x / TILE);
                const gobTY = Math.round(gob.y / TILE);
                const plrTX = Math.round(p.x / TILE);
                const plrTY = Math.round(p.y / TILE);
                const manhattan = Math.abs(gobTX - plrTX) + Math.abs(gobTY - plrTY);
                if (manhattan <= 1) {
                    gob.windupTimer = 30;
                    // Face Carl for the telegraph
                    gob.dir = Math.abs(plrTX - gobTX) >= Math.abs(plrTY - gobTY)
                        ? (plrTX > gobTX ? 3 : 2)
                        : (plrTY > gobTY ? 0 : 1);
                    // Rising warning tone
                    if (audioCtx) {
                        const now = audioCtx.currentTime;
                        const osc = audioCtx.createOscillator();
                        const g = audioCtx.createGain();
                        osc.type = "square";
                        osc.frequency.setValueAtTime(300, now);
                        osc.frequency.exponentialRampToValueAtTime(900, now + 0.45);
                        g.gain.setValueAtTime(0.08, now);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                        osc.connect(g); g.connect(audioCtx.destination);
                        osc.start(now); osc.stop(now + 0.5);
                    }
                }
            }

            if (gob.elite && gob.punchNow) {
                gob.punchNow = false;
                const gobTX = Math.round(gob.x / TILE);
                const gobTY = Math.round(gob.y / TILE);
                const plrTX = Math.round(p.x / TILE);
                const plrTY = Math.round(p.y / TILE);
                {
                    // Stun Carl
                    p.stunTimer = 60;
                    screenFlash = 15;
                    screenShake = 8;
                    shakeAt = null;
                    shakeIntensity = 3;
                    deathText = { x: p.x - 16, y: p.y - 14, timer: 50, text: "STUNNED!", color: "#FF4444", scale: 5 };
                    // Knock Carl back 2 tiles away from the elite
                    const kdx = plrTX - gobTX;
                    const kdy = plrTY - gobTY;
                    // Same tile shouldn't happen, but fall back to elite's facing direction
                    const knockDirX = kdx !== 0 ? Math.sign(kdx) : (gob.dir === 2 ? -1 : gob.dir === 3 ? 1 : 0);
                    const knockDirY = kdy !== 0 ? Math.sign(kdy) : (gob.dir === 0 ? 1 : gob.dir === 1 ? -1 : 0);
                    // Try 2 tiles, then 1, skipping tiles occupied by goblins
                    const landingClear = (lx, ly) => {
                        for (const og of goblins) {
                            if (og.dead) continue;
                            if (Math.round(og.x / TILE) * TILE === lx && Math.round(og.y / TILE) * TILE === ly) return false;
                        }
                        return true;
                    };
                    for (let dist = 2; dist >= 1; dist--) {
                        let newPX = Math.max(TILE, Math.min((COLS - 2) * TILE, p.x + knockDirX * TILE * dist));
                        let newPY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, p.y + knockDirY * TILE * dist));
                        if (landingClear(newPX, newPY)) {
                            p.x = newPX; p.destX = newPX;
                            p.y = newPY; p.destY = newPY;
                            break;
                        }
                    }
                    // Elite enters gloating phase: pick a flee spot away from Carl
                    gob.gloatTimer = 180;
                    const fleeDirX = Math.sign(gob.x - p.x) || (gob.dir === 3 ? -1 : 1);
                    const fleeDirY = Math.sign(gob.y - p.y) || (gob.dir === 0 ? -1 : 1);
                    gob.gloatX = Math.max(TILE, Math.min((COLS - 2) * TILE,
                        Math.round(gob.x / TILE) * TILE + fleeDirX * TILE * 4));
                    gob.gloatY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM,
                        Math.round(gob.y / TILE) * TILE + fleeDirY * TILE * 4));
                    // Gloat at half speed
                    const gloatBase = currentLevel < LEVELS.length ? LEVELS[currentLevel].goblinSpeed : 0.5;
                    gob.speed = gloatBase * 0.85 * 0.5;
                }
            }

            // Elite gloating countdown — restore stalking speed when done
            if (gob.elite && gob.gloatTimer > 0) {
                gob.gloatTimer--;
                if (gob.gloatTimer <= 0) {
                    gob.stalkTimer = 999; // force immediate re-target
                    const stalkBase = currentLevel < LEVELS.length ? LEVELS[currentLevel].goblinSpeed : 0.5;
                    gob.speed = stalkBase * 0.85;
                }
            }

            // Pick next goal position
            gob.moveSteps++;
            let goalX, goalY;
            if (gob.fleeing) {
                // Sprint home to the spawn cave; vanish on arrival
                const fleeCave = CAVES[gob.spawnCave];
                const fleeX = fleeCave.tileX === 0 ? TILE : fleeCave.tileX === COLS - 1 ? (COLS - 2) * TILE : fleeCave.tileX * TILE;
                const fleeY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, fleeCave.tileY * TILE));
                if (gob.x === fleeX && gob.y === fleeY) {
                    gob.dead = true;
                    gob.respawnTimer = 999999; // gone for the rest of the level
                }
                goalX = fleeX;
                goalY = fleeY;
            } else if (gob.elite) {
                if (gob.windupTimer > 0) {
                    // Hold position during the punch wind-up
                    goalX = Math.round(gob.x / TILE) * TILE;
                    goalY = Math.round(gob.y / TILE) * TILE;
                } else if (gob.gloatTimer > 0) {
                    // Gloating: retreat toward the flee spot
                    goalX = gob.gloatX;
                    goalY = gob.gloatY;
                } else {
                    // Stalking: lock onto Carl's actual tile, re-evaluate every 30 frames
                    gob.stalkTimer++;
                    if (gob.huntX === undefined || gob.stalkTimer >= 30) {
                        gob.huntX = Math.round(p.x / TILE) * TILE;
                        gob.huntY = Math.round(p.y / TILE) * TILE;
                        gob.stalkTimer = 0;
                    }
                    goalX = gob.huntX;
                    goalY = gob.huntY;
                }
            } else {
                // Normal goblins: wander to random grid cells
                if (gob.targetRow < 0 || gob.moveSteps > 5) {
                    gob.targetRow = Math.floor(Math.random() * getActiveRows());
                    gob.targetCol = Math.floor(Math.random() * GRID_COLS);
                    gob.moveSteps = 0;
                }
                goalX = (GRID_X + gob.targetCol) * TILE;
                goalY = rowPixelY(gob.targetRow);
            }
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
            ny = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, ny));

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
            if (!isGobTileBlocked(nx, ny)) {
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
                ay = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, ay));
                if ((ax !== gob.x || ay !== gob.y) && !isGobTileBlocked(ax, ay)) {
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
                        ? (isSparkle ? INK.mint : Math.random() > 0.3 ? "#c05838" : INK.rust)
                        : (Math.random() > 0.3 ? "#50ad33" : darker(INK.green, 0.3)),
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
                        ? (isSparkle ? INK.mint : Math.random() > 0.3 ? "#c05838" : INK.rust)
                        : (Math.random() > 0.5 ? "#50ad33" : Math.random() > 0.3 ? darker(INK.green, 0.3) : lighter(INK.green, 0.35)),
                    size: wasElite ? 2 + Math.random() * 4 : 2 + Math.random() * 3,
                    sparkle: isSparkle,
                });
            }
        }
    }

    } // end for each goblin

    // Update catapult goblin
    if (catapultGoblin) updateCatapultGoblin();
    updateFriendNPC();

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



    // (The sequencer step used to be HERE, at the very bottom of update. It
    //  runs at the top now — see the note there.)
}

// (playerLaunch removed — replaced by near miss stun / direct hit freeze)

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
    shakeAt = null;
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
    player.punchBuffered = false;
    player.blinkTimer = 0;
    player.stunTimer = 0;
    player.freezeTimer = 0;

    // Reset enemies
    killCount = 0;
    score = 0;
    lastTimeBonus = 0;
    for (const g of goblins) {
        g.dead = true;
        g.deathAnimActive = false;
        g.deathAnimTimer = 0;
        g.respawnTimer = 300;
        g.fleeing = false;
        g.danceTimer = 0;
        g.windupTimer = 0;
        g.gloatTimer = 0;
    }
    catapultGoblin = null;
    catapultSpawnedThisCycle = false;

    // Reset room progression + entourage
    thiefCarriedPiece = null;
    biomeBannerTimer = 300; // announce the first biome when gameplay starts
    biomeBannerPending = false;
    if (texturesBuiltForLevel !== 0) rebuildCaveTextures(0);
    entourageCheer = 0;
    pocketRing = null;
    carlGlowBoost = 0;
    enemyWarningShown = { normal: false, elite: false, catapult: false };
    newInstrumentShown = { cowbell: false, tom: false };
    levelTimer = LEVELS[0].timerSeconds * 60;
    lastTickSecond = -1;

    // Clear dancers and effects
    deathParticles = [];
    deathText = null;
    screenFlash = 0;
    screenShake = 0;
    shakeDur = 0;
    hitFreeze = 0;
    fireworks = [];
    playerDeathAnim.active = false;
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            cellFlash[r][c] = 0, cellRecent[r][c] = 0;

    // Reset sequencer and frame timing
    resetSequencerClock();
    lastTime = 0;
    frameAccum = 0;

    // Reset level progression
    currentLevel = 0;
    levelComplete = false;
    patternMatched = false;
    levelCelebrateTimer = 0;
    levelCelebrateDisplayScore = 0;

    // Reset minigame state
    caveClockPickups = [];
    djSetupEarned = [];
    minigamesCompleted = [];
    pieceRecoveredThisLevel = null;

    // Set tempo for level 0
    setLevelTempo(0);
}

// ---- Level Progression ----
function checkLevelComplete() {
    if (currentLevel >= LEVELS.length) return false;
    if (LEVELS[currentLevel].noPattern) return false; // L30: no win condition
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
    // Pattern restored. The level ends HERE, on the beat it is finished —
    // there is no exit door to walk to any more. Getting it right was the
    // achievement; making the player then trudge across the room to a door put
    // a chore between the win and the reward, and left the best moment in the
    // game happening somewhere the player was not looking.
    celebrateBeatRestored();
    triggerLevelComplete();
}

// One bar of the level's own tempo, in frames at 60fps.
function holdFrames() {
    return Math.round(GRID_COLS * stepMs * 60 / 1000);
}

// The burst on the beat landing: the room cheers, the Donks bolt, the fanfare
// plays. It used to be the door opening; it is now the win itself.
function celebrateBeatRestored() {
    entourageCheer = 120;
    deathText = { x: player.x - 28, y: player.y - 18, timer: 90, text: "BEAT RESTORED!", color: "#50ad33", scale: 5 };
    // The fanfare is NOT played here. triggerLevelComplete runs on the very
    // next line and plays it, so this was firing two overlapping arpeggios for
    // one win — and the other paths into triggerLevelComplete never came
    // through here, so removing it there instead would have lost the fanfare
    // on those. One win, one fanfare, on every route.
    // The Donks used to be sent fleeing for their caves here, and the catapult
    // crew told to pack up. Both are gone: triggerLevelComplete runs on the
    // very next line and clears the room outright, so nothing ever got a frame
    // to flee in. That code only made sense while the level continued after the
    // pattern landed, and it does not any more.
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
    lastTimeBonus = Math.ceil(levelTimer / 60) * 10;
    score += lastTimeBonus;
    // DJ piece recovery at milestone levels — the kidnap mini-levels are
    // retired, so the stolen piece is reclaimed directly with the room
    pieceRecoveredThisLevel = null;
    if (MINIGAME_LEVELS.includes(currentLevel) && !minigamesCompleted.includes(currentLevel)) {
        minigamesCompleted.push(currentLevel);
        if (djSetupEarned.length < DJ_SETUP_PIECES.length) {
            pieceRecoveredThisLevel = DJ_SETUP_PIECES[djSetupEarned.length];
            djSetupEarned.push(pieceRecoveredThisLevel);
        }
    }
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



























function advanceLevel() {
    currentLevel++;
    if (currentLevel >= LEVELS.length) {
        // Player beat all levels — start ending cinematic!
        finalScore = score;
        gameState = "ending";
        startEnding();
        return;
    }
    // New room, new look — regenerate the cave for this level's biome & seed
    if (biomeForLevel(currentLevel) !== currentBiome) {
        biomeBannerPending = true; // crossing into a new zone — announce it once play starts
    }
    rebuildCaveTextures(currentLevel);

    levelTimer = LEVELS[currentLevel].timerSeconds * 60;
    // Spawn friend NPC for level 30 (noPattern mode)
    if (LEVELS[currentLevel].noPattern) {
        spawnFriendNPC();
    } else {
        friendNPC = null;
    }
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

    // Enter the new room through the left-hand doorway
    player.x = TILE * 2;
    player.y = DOOR_TILE_Y * TILE;
    player.destX = player.x;
    player.destY = player.y;
    player.dir = 3; // facing into the room
    player.attacking = false;
    player.attackTimer = 0;
    player.punchHit = false;


    // Reset all goblins with staggered respawn timers
    for (let i = 0; i < goblins.length; i++) {
        const g = goblins[i];
        g.dead = true;
        g.deathAnimActive = false;
        g.deathAnimTimer = 0;
        g.fleeing = false;
        g.danceTimer = 0;
        g.windupTimer = 0;
        g.gloatTimer = 0;
        const staggerGap = Math.round(600 - (currentLevel / 29) * 360); // 10s apart early → 4s apart late
        g.respawnTimer = 180 + i * staggerGap;
    }
    catapultGoblin = null;
    catapultSpawnedThisCycle = false;

    // DON'T reset: dancers, killCount (persist across levels)

    // Reset effects
    deathParticles = [];
    deathText = null;
    screenFlash = 0;
    screenShake = 0;
    shakeDur = 0;
    hitFreeze = 0;
    levelComplete = false;
    patternMatched = false;
    levelCelebrateTimer = 0;
    levelCelebrateDisplayScore = 0;
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            cellFlash[r][c] = 0, cellRecent[r][c] = 0;

    // Reset sequencer timing to prevent catch-up
    resetSequencerClock();

    // Set tempo for new level
    setLevelTempo(currentLevel);

    // Determine post-sabotage destination (new enemy/instrument intro or straight to playing)
    const prevRows = currentLevel > 0 ? LEVELS[currentLevel - 1].activeRows : LEVELS[0].activeRows;
    const newRows = LEVELS[currentLevel].activeRows;
    sabotageNextState = "playing";

    // All feature screens (instruments, enemy warnings) now shown before advanceLevel is called

    // Stop marching drums before sabotage begins
    stopStoryDrums();

    // Start sabotage animation (goblin zigzags across grid scrambling cells,
    // then bolts through the right door and slams it behind itself)
    sabotageAnimTimer = 0;
    sabotageFlipIndex = 0;
    thiefCarriedPiece = (MINIGAME_LEVELS.includes(currentLevel) && djSetupEarned.length < DJ_SETUP_PIECES.length)
        ? DJ_SETUP_PIECES[djSetupEarned.length] : null;
    gameState = "sabotage-anim";
}

// ---- Catapult Goblin Logic ----
function spawnCatapultGoblin() {
    const caveIdx = Math.floor(Math.random() * CAVES.length);
    const cave = CAVES[caveIdx];
    const spawnX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
    const spawnY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, cave.tileY * TILE));

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
    stopY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, stopY));

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

    // GROOVED! Dance break pauses the catapult — unless a boulder is already
    // mid-air (physics doesn't dance)
    if (cg.danceTimer > 0 && !(cg.phase === "firing" && cg.boulder)) {
        cg.danceTimer--;
        return;
    }

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
                        cellRecent[r][c] = 180;
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
            shakeAt = null;
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

            // Boulder impact on Carl — direct hit or near miss
            const pGridCol = Math.round(player.x / TILE) - GRID_X;
            const pGridRow = tileYToRow(Math.round(player.y / TILE));
            if (pGridCol === cc && pGridRow === cr) {
                // Direct hit — 10 second freeze with visible countdown
                player.freezeTimer = 600;
                player.stunTimer = 0; // freeze overrides stun
                screenShake = 12;
                shakeAt = null;
                shakeIntensity = 5;
                screenFlash = 20;
                deathText = { x: player.x - 20, y: player.y - 14, timer: 60, text: "FROZEN!", color: "#44CCFF", scale: 6 };
            } else {
                // Near miss — psychological stun scaled by distance to the impact
                if (player.freezeTimer <= 0) {
                    const distTiles = Math.abs(pGridCol - cc) + Math.abs(pGridRow - cr);
                    player.stunTimer = distTiles <= 2 ? 90 : 30;
                    screenShake = 6;
                    shakeAt = null;
                    shakeIntensity = 2;
                    deathText = { x: player.x - 8, y: player.y - 14, timer: 40, text: "...", color: "#AAAAAA", scale: 5 };
                }
            }

            cg.phase = "retreating";
            // Set retreat destination back to cave
            const cave = CAVES[cg.caveIndex];
            const retreatX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
            const retreatY = Math.max(WALK_TOP, Math.min(WALK_BOTTOM, cave.tileY * TILE));
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
            // Single catapult only — no chain spawning
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
    // The HUD is built entirely from rects — panels AND the pixel-block digits
    // — so jittering this one primitive boils the whole readout. Seeded from
    // the rect's own position so a panel wobbles as one piece rather than
    // shaking apart. Arithmetic, not pixels: no bake, no per-frame cost.
    if (BOIL.on && BOIL.hud) {
        x += jit(x * 3 + y * 7, 61, 0.35);
        y += jit(x * 5 + y * 11, 73, 0.25);
    }
    hudCtx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
}


// How wide one digit is in that face, so the panels size themselves off the
// type rather than off a bitmap grid that no longer exists.
function hudDigitWidth(pixelSize) {
    hudCtx.font = gfont(pixelSize * 5 * SCALE);
    return hudCtx.measureText("0").width / SCALE;
}


// Canvas gives no access to glyph outlines, so text boils the only way it can:
// rendered once into an offscreen, slice-warped three ways and cached. Static
// labels and titles hit the cache; anything that changes every frame would
// thrash it, so the cache is capped and falls back to plain drawing when full.
// This is the least rewarding of the boil sources per unit of work, which is
// exactly why it has its own switch.
const TEXT_WARPS = new Map();
const TEXT_WARP_CAP = 240;
function warpedText(text, color, size) {
    const key = text + "|" + size + "|" + color;
    let e = TEXT_WARPS.get(key);
    if (!e) {
        if (TEXT_WARPS.size >= TEXT_WARP_CAP) return null;   // cache full
        const px = size * SCALE;
        const pad = Math.ceil(px * 0.35) + 2;
        const meas = document.createElement("canvas").getContext("2d");
        meas.font = gfont(px);
        const w = Math.ceil(meas.measureText(text).width);
        const base = document.createElement("canvas");
        base.width = w + pad * 2;
        base.height = Math.ceil(px * 1.6) + pad * 2;
        const bg = base.getContext("2d");
        bg.font = gfont(px);
        bg.fillStyle = color;
        bg.textAlign = "start";
        bg.textBaseline = "alphabetic";
        bg.fillText(text, pad, pad + px);
        e = { w, pad, asc: pad + px, phases: [] };
        for (let ph = 0; ph < 3; ph++) e.phases[ph] = sliceWarp(base, ph);
        TEXT_WARPS.set(key, e);
    }
    return e;
}
function drawText(text, x, y, color, size) {
    if (BOIL.on && BOIL.text) {
        const e = warpedText(String(text), color, size);
        if (e) {
            // honour whatever textAlign the caller left set, since drawText
            // never set it itself and several callers rely on that
            const a = ctx.textAlign;
            const off = a === "center" ? -e.w / 2 : (a === "right" || a === "end") ? -e.w : 0;
            mipping = true;   // the cached copy is already warped; don't re-warp it
            try {
                ctx.drawImage(e.phases[boil()],
                    x * SCALE + off - e.pad, y * SCALE - e.asc);
            } finally { mipping = false; }
            return;
        }
    }
    ctx.fillStyle = color;
    ctx.font = gfont(size * SCALE);
    ctx.fillText(text, x * SCALE, y * SCALE);
}

// Rounded rectangle helper for block-print style grid blocks
function fillRoundRect(context, x, y, w, h, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    context.fill();
}

// ---- HUD Render (separate canvas below game) ----
function renderHUD() {
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    // The readouts print on the wall where there is a wall to print them on.
    // This function still runs either way: the last-ten-seconds tick lives at
    // the bottom of it, and that is audio, which does not care where the
    // numbers are drawn.
    const onWall = hudOnWall();

    // NO PANELS. Every readout used to sit in a charcoal plate with a border, a
    // top highlight and a bottom shadow — four rects of furniture around each
    // number. The coaster's HUD has none of that: section 2 gets its hierarchy
    // from SIZE AND FACE, and the primary number survives a moving backdrop on a
    // hard offset shadow rather than on a box.
    //
    // Losing the plates flips every colour. The numbers were paper-on-charcoal
    // because the plate was charcoal; the band behind them is the room's pale
    // bottom wall, so they are charcoal-on-pale now, with the mustard offset
    // doing the work the plate used to.
    const W = COLS * TILE;
    const margin = TILE;
    const numSize = 9;                  // display face — the numbers
    const labSize = 4;                  // body face — the words
    // The band the type sits on is no longer always the game's own. In a drawn
    // room the wall the HUD prints on is part of the picture, and in the first
    // one it starts 7.4 units down the 16-unit lane rather than at the top of
    // it — so type centred in the lane straddled the floor/wall join and half
    // of every numeral landed on dark boards. 14.5 puts the whole run, offset
    // shadow included, inside the drawn band: measured 8.38:1 across all three
    // readouts, against 4.9 / 1.4 / 5.0 before.
    const baseY = (currentBiome && currentBiome.art && !currentBiome.floorArt)
        ? 14.5
        : HUD_H / 2 + numSize * 0.42;

    const label = (text, x, align) => {
        hudCtx.font = fbody(labSize * SCALE);
        hudCtx.fillStyle = mixC(INK.charcoal, INK.paper, 0.32);
        hudCtx.textAlign = align || "start";
        hudCtx.fillText(text, x * SCALE, (baseY - 0.5) * SCALE);
        hudCtx.textAlign = "start";
        return hudCtx.measureText(text).width / SCALE;
    };
    const number = (text, x, col, align) => {
        hudCtx.font = fdisp(numSize * SCALE);
        hudCtx.textAlign = align || "start";
        hudCtx.fillStyle = INK.mustard;
        hudCtx.fillText(text, (x + 0.7) * SCALE, (baseY + 0.7) * SCALE);
        hudCtx.fillStyle = col;
        hudCtx.fillText(text, x * SCALE, baseY * SCALE);
        hudCtx.textAlign = "start";
        return hudCtx.measureText(text).width / SCALE;
    };

    // The clock's state is read by the tick below, which fires wherever the
    // numbers are printed — so it is worked out before anything is drawn rather
    // than inside the branch that draws the band.
    const timerSec = Math.max(0, Math.ceil(levelTimer / 60));
    const timerStr = timerSec < 10 ? "0" + timerSec : String(timerSec);
    const isUrgent = timerSec <= 30;
    const isCritical = timerSec <= 10;

    // --- LEVEL, left ---------------------------------------------------------
    if (!onWall) {
    const lw = label("LEVEL", margin);
    number(String(currentLevel + 1).padStart(2, "0"), margin + lw + 3, INK.charcoal);

    // The tier word that used to sit after the level number — ROCK / FUNK /
    // BREAKS, one per ten levels — is gone. Section 4 of the HUD doc: hierarchy
    // comes from size and face, and three sizes is the budget. The tier was a
    // fourth thing in the left block at the same size and colour as LEVEL,
    // saying something the level number already said, and floating loose in the
    // band with nothing tying it to the number it described.

    // --- SCORE, centred and biggest ------------------------------------------
    const scoreStr = String(score).padStart(5, "0");
    number(scoreStr, W / 2, INK.charcoal, "center");

    // --- TIME, right ---------------------------------------------------------
    const blinkRate = isCritical ? 15 : 30;
    const blinkOn = !isUrgent || Math.floor(levelTimer / blinkRate) % 2 === 0;
    // On a pale band mustard is 1.43:1 and vanishes, so the warning state is
    // rust and only the lethal <=10s state wears alert red — which is still the
    // reserved colour, and this is still a thing that can kill you.
    const timerColor = isCritical ? INK.alert : isUrgent ? INK.rust : INK.charcoal;
    if (blinkOn) number(timerStr, W - margin, timerColor, "right");
    hudCtx.font = fbody(labSize * SCALE);
    const tlw = hudCtx.measureText("TIME").width / SCALE;
    label("TIME", W - margin - hudDigitWidth(2) * 2 - 4 - tlw);
    }

    // Tick sound during the last 10 seconds, once per second.
    //
    // This used to fire on `levelTimer % 60 === 0`, tested here — in a RENDER
    // function, which runs every frame whether the clock is moving or not. That
    // is once a second only while the timer is counting. Park it on a multiple
    // of 60 and the condition stays true every frame: pausing with ten seconds
    // or less left, on an exact second, machine-gunned 60 beeps a second, and
    // so did the level-complete hold, which stops the clock by design.
    //
    // Firing on the CHANGE of second cannot do that, however long the clock sits
    // still.
    if (isCritical && timerSec > 0 && timerSec !== lastTickSecond && audioCtx) {
        lastTickSecond = timerSec;
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

    // Equipment recovery tracker — the stage gear recovered so far
    {
        const earned = djSetupEarned.length;
        const total = DJ_SETUP_PIECES.length;
        if (!onWall && (earned > 0 || currentLevel >= 4)) {
            const trackerY = HUD_H / 2 - 2;
            const trackerX = W / 2 + 34;
            for (let i = 0; i < total; i++) {
                const ix = trackerX + i * 5;
                // charcoal for missing rather than near-black on near-black:
                // these used to sit on a dark plate and now sit on the pale wall
                drawHudRect(ix, trackerY, 4, 4, i < earned ? INK.mustard : mixC(INK.charcoal, INK.paper, 0.55));
                drawHudRect(ix, trackerY, 4, 4.6, "rgba(0,0,0,0)");
            }
        }
    }
}


// ---- Render ----
let shakeBuf = null, shakeOut = null, shakeSoft = null;
// Displace part of the FINISHED frame instead of translating the whole canvas,
// so a hit rocks the room around the point of contact rather than throwing the
// entire screen about.
//
// The impact ripples OUT from the point of contact instead of the whole disc
// sliding sideways as one piece.
//
// The old version took a disc, shifted all of it by the same amount, and
// feathered only the outer quarter of its ALPHA. Everything inside 72% of the
// radius therefore moved in lockstep, which is what made a circular edge you
// could see: a rigid puck of the room skidding over a still room. Feathering
// the alpha does not help, because the thing that gives the edge away is the
// discontinuity in MOTION, not in opacity.
//
// So the falloff moved from the alpha to the displacement itself. The disc is
// redrawn as concentric rings, each shifted by a raised cosine of its own
// radius: the centre takes the full jolt, the rim takes none at all and so
// lands exactly on top of the frame already there — no seam to see, because
// nothing at the boundary has moved.
//
// The blur is scaled by each ring's OWN displacement for the same reason. A
// blur applied to the whole disc would soften the rim too, and a soft copy over
// a sharp original is a halo — the circle back again by another route.
// 12 rings, not 7. The ring count sets how big the displacement step is at the
// outermost ring that still draws, and THAT step is the visible arc — at 7 the
// last drawn ring still jumped 1.3px against the untouched frame beside it and
// printed a clean circle at 0.86R. At 12 the step is under a fifth of a pixel.
//
// The blur is per px of displacement, and 0.55 was too much: at a 12px jolt it
// put 6.6px of blur through BUZZ, which reads as a smear rather than a hit.
const SHAKE_RINGS = 12;
const SHAKE_BLUR = 0.62;   // blur px per px of that ring's displacement
// The inner 55% of the radius moves as a body at FULL strength, and only the
// outside rolls off. A cosine falling from the centre pin looks right on paper
// and was wrong in the hand: area-weighted, only 0.30 of the disc was really
// moving, and multiplied by the decay envelope's 0.56 the whole effect landed
// at 0.167 of what it replaced — six times weaker, which is why it went from
// painful to invisible in one step. Nothing about the plateau brings back the
// visible circle: the rim still reaches exactly zero, with zero slope.
const SHAKE_PLATEAU = 0.55;
// Decay exponent. 1.0 is a straight line, which spends most of the shake near
// nothing; below 1 it holds high early and falls away late, so the hit lands
// and then settles instead of fading from the first frame.
const SHAKE_DECAY_P = 0.5;
// One dial for how hard everything hits, on top of each trigger's own
// intensity. Raise it for more punch, lower it for less; nothing else in the
// shake needs touching to change how strong it feels.
//
// 1.6 read as wild. The trade is displacement for SMEAR: this comes down and
// SHAKE_BLUR goes up, so the same impact is carried by softening rather than by
// throwing the room around. Blur falls off with each ring's own displacement,
// so it is already a gradient — heaviest at the point of contact, nothing at
// the rim — and lifting it deepens that gradient rather than fogging the lot.
const SHAKE_GAIN = 0.95;
// ...and one for how LONG it lasts. A punch was 5 frames, which is 83ms — over
// before the eye has finished registering that it started, so it read as a
// flinch rather than a hit however hard it was. Stretching it does not make it
// stronger: the decay envelope is normalised to the shake's own length, so a
// longer shake has the same peak and the same average, just more time to
// travel through. Applied to LOCAL shakes only, the ones a punch makes; the
// whole-screen ones (dying, a boulder landing) are already long.
const SHAKE_STRETCH = 2.0;
function applyLocalShake(sx, sy) {
    const R = Math.round(SHAKE_RADIUS * SCALE), d = R * 2;
    const cx = Math.round(shakeAt.x * SCALE), cy = Math.round(shakeAt.y * SCALE);
    if (!shakeBuf) shakeBuf = document.createElement("canvas");
    if (shakeBuf.width !== d) { shakeBuf.width = d; shakeBuf.height = d; }
    if (!shakeOut) shakeOut = document.createElement("canvas");
    if (shakeOut.width !== d) { shakeOut.width = d; shakeOut.height = d; }
    if (!shakeSoft) shakeSoft = document.createElement("canvas");
    if (shakeSoft.width !== d) { shakeSoft.width = d; shakeSoft.height = d; }
    const g = shakeBuf.getContext("2d");
    const o = shakeOut.getContext("2d");
    const b = shakeSoft.getContext("2d");
    const mag = Math.hypot(sx, sy);
    mipping = true;   // these are raw blits; the mip/warp patch must not touch them
    try {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, d, d);
        g.drawImage(canvas, cx - R, cy - R, d, d, 0, 0, d, d);

        // ONE blur, at the centre's strength, then each ring mixes towards it by
        // its own displacement. Blurring per ring was the honest way to do it and
        // it cost 31 fps — measured 25.4 with a shake held on against 56.7 with
        // the filter taken out and everything else identical, so the twelve
        // clipped blits are free and canvas filters are not. Mixing a sharp and a
        // soft copy is not a true variable blur, but at these radii nothing in
        // the picture can tell, and it is one filter call a frame instead of one
        // per ring.
        // Full resolution, and that IS the cheaper option: blurring at half size
        // and scaling back up per ring measured 37.8 fps against 47.2 for this,
        // because twelve smoothed upscales cost more than the blur they save.
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.clearRect(0, 0, d, d);
        b.filter = `blur(${(mag * SHAKE_BLUR).toFixed(2)}px)`;
        b.drawImage(shakeBuf, 0, 0);
        b.filter = "none";

        o.setTransform(1, 0, 0, 1, 0, 0);
        o.clearRect(0, 0, d, d);
        for (let i = SHAKE_RINGS - 1; i >= 0; i--) {
            const r0 = R * i / SHAKE_RINGS, r1 = R * (i + 1) / SHAKE_RINGS;
            const t = (i + 0.5) / SHAKE_RINGS;
            // Flat at 1 across the plateau, then a raised cosine to 0 at the rim
            const u = t <= SHAKE_PLATEAU ? 0 : (t - SHAKE_PLATEAU) / (1 - SHAKE_PLATEAU);
            const f = 0.5 * (1 + Math.cos(Math.PI * u));
            // A ring that would move less than a third of a pixel is left
            // alone entirely. Drawing it anyway resamples the frame for no
            // visible motion, which only softens it — and doing that in the
            // OUTERMOST ring is how a rim that should be invisible starts to
            // show. Measured: disturbance outside the disc was ten times the
            // old version's until this and the clamp below went in.
            if (mag * f < 0.15) continue;
            o.save();
            o.beginPath();
            // Rings overlap by a hair so they do not tile-gap, except the last,
            // which stops dead on the radius. Nothing may be painted past it.
            o.arc(R, R, i === SHAKE_RINGS - 1 ? r1 : r1 + 0.75, 0, Math.PI * 2);
            if (r0 > 0) o.arc(R, R, r0, 0, Math.PI * 2, true);
            o.clip();
            // Sharp copy for the opaque base, then the soft one over it at the
            // ring's own weight: the centre ends up fully soft, the rim fully
            // sharp. An unsupported filter string is ignored rather than
            // throwing, so a browser without canvas filters simply gets two
            // copies of the sharp disc and the ripple runs unblurred.
            o.drawImage(shakeBuf, sx * f, sy * f);
            o.globalAlpha = f;
            o.drawImage(shakeSoft, sx * f, sy * f);
            o.globalAlpha = 1;
            o.restore();
        }
        ctx.drawImage(shakeOut, cx - R, cy - R);
    } finally { mipping = false; }
}

function render() {
    // A shake with no origin rocks the whole room, the way it always did. One
    // with an origin is applied at the END of the frame instead — see below.
    let shakeSX = 0, shakeSY = 0;
    if (screenShake > 0) {
        // The offset used to be re-rolled at FULL strength every frame and then
        // stop dead, which is white noise with a hard cut — the harshest shape
        // a shake can have, and most of why it was uncomfortable rather than
        // punchy. Decaying it across its own lifetime makes it land and settle.
        // A shake that has just been triggered is the one frame where
        // screenShake exceeds the length we were tracking, so this is where a
        // new one gets stretched — once, centrally, rather than at the eleven
        // places that set a duration.
        if (screenShake > shakeDur) {
            if (shakeAt) screenShake = Math.round(screenShake * SHAKE_STRETCH);
            shakeDur = screenShake;
        }
        const decay = shakeDur ? Math.pow(screenShake / shakeDur, SHAKE_DECAY_P) : 1;
        const amp = shakeIntensity * SCALE * decay * SHAKE_GAIN;
        shakeSX = (Math.random() - 0.5) * 2 * amp;
        shakeSY = (Math.random() - 0.5) * 2 * amp;
        if (!shakeAt) {
            ctx.save();
            ctx.translate(shakeSX, shakeSY);
        }
    }

    // Everything from here to the goblins is FLOOR — room, grid, lattice,
    // playhead — and under the projection it is drawn flat into the plane
    // canvas first, exactly as it always was, then laid down in one piece.
    if (PROJ.on) {
        ctx = planeCtx();
        ctx.clearRect(0, 0, COLS * TILE * SCALE, ROWS * TILE * SCALE);
        padRises.length = 0;
    }

    // Clear & draw cave background (sprite scaled to canvas, or pre-rendered fallback)
    ctx.drawImage(TEX_CAVE_BG[boilPhase("room")], 0, 0);

    // (Room variety now comes from the biome system — each level regenerates
    // its textures with a unique seed and the zone's palette.)

    // Spawn openings. A drawn room draws its own doorways, so the game draws
    // none of its own — the Donks walk in through the ones in the picture,
    // which is the whole point of having drawn them. The cave rooms still get
    // a mouth, because nothing else in a plain wall band says where anything
    // comes from.
    //
    // The EYE GLEAM below is outside this gate on purpose: it is not scenery,
    // it is the tell that a Donk is about to respawn, and the player needs it
    // in either kind of room.
    const roomArt = (currentBiome && currentBiome.art && !currentBiome.floorArt)
        ? ROOM_ART[currentBiome.art] : null;
    // The procedural cave mouth is a hole drawn ON THE FLOOR, which was the only
    // way to say "they come in here" while the room had no walls to cut. It has
    // walls now, and the opening is a gap in one — so the mouth would be a
    // second doorway lying flat next to the real one.
    const wallsCarryTheDoor = !!(currentBiome && currentBiome.wallTile && PROJ.on && PROJ.mode === "rake");
    for (let ci = 0; ci < CAVES.length; ci++) {
        const cave = CAVES[ci];
        const cx = cave.tileX * TILE;
        const cy = cave.tileY * TILE;

        if (!roomArt && !wallsCarryTheDoor) {
            {
                // Deep black cave hole
                ctx.fillStyle = "#2C2C2A";
                ctx.beginPath();
                ctx.roundRect(cx * SCALE, (cy - 2) * SCALE, TILE * SCALE, (TILE + 4) * SCALE, [6, 6, 2, 2]);
                ctx.fill();
            }
            {
                ctx.fillStyle = "#4a4a45";
                ctx.beginPath();
                ctx.roundRect((cx - 2) * SCALE, (cy - 5) * SCALE, (TILE + 4) * SCALE, 4 * SCALE, [4, 4, 0, 0]);
                ctx.fill();
                ctx.beginPath();
                ctx.roundRect((cx - 2) * SCALE, (cy + TILE + 1) * SCALE, (TILE + 4) * SCALE, 4 * SCALE, [0, 0, 4, 4]);
                ctx.fill();
                if (cave.tileX > 0) drawRect(cx - 3, cy - 2, 3, TILE + 4, "#3f3f3b");
                if (cave.tileX < COLS - 1) drawRect(cx + TILE, cy - 2, 3, TILE + 4, "#3f3f3b");
                ctx.fillStyle = "#4a4a45";
                ctx.beginPath();
                ctx.moveTo((cx + 3) * SCALE, (cy - 2) * SCALE);
                ctx.lineTo((cx + 5) * SCALE, (cy - 2) * SCALE);
                ctx.lineTo((cx + 4) * SCALE, (cy + 2) * SCALE);
                ctx.closePath(); ctx.fill();
                ctx.beginPath();
                ctx.moveTo((cx + 9) * SCALE, (cy - 2) * SCALE);
                ctx.lineTo((cx + 11) * SCALE, (cy - 2) * SCALE);
                ctx.lineTo((cx + 10) * SCALE, (cy + 1) * SCALE);
                ctx.closePath(); ctx.fill();
                ctx.beginPath();
                ctx.moveTo((cx + 5) * SCALE, (cy + TILE + 2) * SCALE);
                ctx.lineTo((cx + 7) * SCALE, (cy + TILE + 2) * SCALE);
                ctx.lineTo((cx + 6) * SCALE, (cy + TILE - 2) * SCALE);
                ctx.closePath(); ctx.fill();
                ctx.beginPath();
                ctx.moveTo((cx + 11) * SCALE, (cy + TILE + 2) * SCALE);
                ctx.lineTo((cx + 13) * SCALE, (cy + TILE + 2) * SCALE);
                ctx.lineTo((cx + 12) * SCALE, (cy + TILE - 1) * SCALE);
                ctx.closePath(); ctx.fill();
            }
            // Biome-colored glow from inside cave (gradient cached — building
            // one per cave per frame was measurable GC/setup churn)
            if (!gradCache.caveGlow) {
                const g = ctx.createRadialGradient(0, 0, 2 * SCALE, 0, 0, TILE * SCALE);
                g.addColorStop(0, `rgba(${currentBiome.caveGlow},0.12)`);
                g.addColorStop(1, "rgba(0,0,0,0)");
                gradCache.caveGlow = g;
            }
            ctx.save();
            ctx.translate((cx + TILE / 2) * SCALE, (cy + TILE / 2) * SCALE);
            ctx.fillStyle = gradCache.caveGlow;
            ctx.fillRect(-(TILE / 2 + 4) * SCALE, -(TILE / 2 + 4) * SCALE, (TILE + 8) * SCALE, (TILE + 8) * SCALE);
            ctx.restore();
        }
        // Eye gleam inside cave — always draw (gameplay indicator for goblin respawn)
        for (const g of goblins) {
            if (g.dead && g.respawnTimer < 60 && ci === g.spawnCave) {
                // The eyes belong IN the doorway. They used to sit in a cave
                // mouth painted on the floor; that mouth is gone, so without
                // this they were two green dots blinking on bare floorboards at
                // the edge of the room — which is what Carl saw as a blinking
                // overlay at the screen border.
                //
                // Only drawn where there is still a mouth to look out of. Once
                // the walls carry the opening, the tell goes on the wall with
                // it, and that is drawn with the walls rather than here.
                if (wallsCarryTheDoor) break;
                const caveEyeCol = g.elite ? INK.mint : "#50ad33";
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

    // The level-exit door is gone. It used to sit in the right wall, barred
    // until the pattern was restored, and the level ended when BUZZ walked
    // through it. The pattern landing IS the win now, so the door was a chore
    // between the achievement and the reward — and the thief's slam, the bars,
    // the padlock and the dust that went with it were all furniture for a
    // mechanic that no longer exists.

    // Bioluminescent mushroom & crystal lights along cave ceiling — drum-synced
    // Skip when cave bg sprite is loaded (lights are painted into the background)
    const MUSH_COLORS = currentBiome.lights;
    // Declared outside the if-block: the floor-crystals section below needs these too
    const ar_lights = getActiveRows();
    const now_lights = performance.now();
    {
    // The bioluminescent ceiling is a cave fixture. A drawn room has its own
    // ceiling and its own light, so these stay in the cave.
    const topCaveCol = Math.floor(COLS / 2);
    for (let c = 1; c < (currentBiome && currentBiome.art ? 1 : COLS - 1); c++) {
        if (c === topCaveCol) continue;
        const mushX = c * TILE + TILE / 2;
        const mushY = WALL_TOP - 3;   // recessed into the ceiling, not hung from it
        const rowIdx = c % ar_lights;
        const mushCol = MUSH_COLORS[c % MUSH_COLORS.length];
        const triggered = rowTrigger[rowIdx] > 0;
        const pulseIntensity = triggered ? rowTrigger[rowIdx] / 8 : 0;
        const chasePhase = (now_lights * 0.003 + c * 0.4) % (Math.PI * 2);
        const chaseBright = Math.sin(chasePhase) * 0.5 + 0.5;
        const twinkle = Math.sin(now_lights * 0.005 + c * 2.7) > 0.7 ? 0.3 : 0;
        const isCrystal = c % 4 === 0; // every 4th light is a crystal pendant

        // (No chain — the fixtures are inset in the ceiling now.)

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
            ctx.fillStyle = currentBiome.lightHi;
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
            ctx.fillStyle = currentBiome.stal.hi;
            ctx.fillRect((mushX - 0.5) * SCALE, (mushY - 1) * SCALE, 1 * SCALE, 4 * SCALE);
            // Cap (half-circle arc facing down)
            ctx.globalAlpha = 0.5 + chaseBright * 0.3 + pulseIntensity * 0.2 + twinkle;
            ctx.fillStyle = mushCol;
            ctx.beginPath();
            ctx.arc(mushX * SCALE, (mushY + 3) * SCALE, capR * SCALE, Math.PI, 0);
            ctx.fill();
            // Cap underside glow (lighter)
            ctx.fillStyle = currentBiome.lightHi;
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
    }

    // Floor crystals along the bottom wall — drum-synced glowing formations,
    // and cave, so they stay in the cave like the ceiling above them.
    for (let c = 1; c < (currentBiome && currentBiome.art ? 1 : COLS - 1); c++) {
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

    // The O/H/S/K/B/T row letters that used to run down the left are gone, along
    // with the step numbers and the pattern counter. The field is an instrument,
    // not a labelled diagram. NOTE this leaves the six channels identified by
    // COLOUR ALONE, and two of those pairs measure as the same grey (cowbell/tom
    // 1.05:1, snare/hi-hat 1.08:1) — if the rows ever need telling apart without
    // colour, a per-row mark inside the cell is now the only route left.
    // (The extruded front face is now a second channel — see PAD_LIFT.)
    const ar = getActiveRows();
    // The column currently SOUNDING — currentStep is the one after it.
    const soundingCol = (currentStep + GRID_COLS - 1) % GRID_COLS;

    // Stone wall background behind grid (sprite or pre-rendered fallback)
    {
        const gwX = GRID_X * TILE - 2;
        const gwY = (GRID_Y * TILE + GRID_Y_OFFSET) - 2;
        const gwH = ar * TILE + 4;
        const gwSrc = TEX_GRID_WALL;
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
                // Draw glow tile (sprite with rotation, or pre-rendered fallback).
                // NOTE: no draw-time shadowBlur here — the glow is baked into
                // the tile art itself; shadowBlur per cell was a huge perf cost.
                //
                // A lit pad SINKS on the step it sounds. Both heights are baked,
                // so this is still one blit — the pad is a drum head being hit,
                // and the sequencer plays the board in front of you rather than
                // just lighting a column.
                const struck = playing && c === soundingCol && rowTrigger[r] > 0;
                ctx.drawImage((struck ? TEX_GRID_HIT : TEX_GRID_ON)[gridVariant(r, c)][r], bxs, bys);
                // Remember it, so its height can be raised after the camera has
                // laid the floor down. Height is vertical in the world and the
                // floor plane is not.
                if (PROJ.on) padRises.push({ r, c, bxs, bys, struck });
            } else {
                // Draw dark stone tile (sprite with rotation, or pre-rendered fallback)
                ctx.drawImage(TEX_GRID_OFF[gridVariant(r, c)], bxs, bys);
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
                ctx.fillStyle = "#c05838";
                ctx.globalAlpha = cellFlash[r][c] / 30 * 0.75;
                ctx.fillRect((bx + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, (TILE - 2) * SCALE);
                ctx.globalAlpha = 1.0;
                // "!" indicator — visible longer, larger
                if (cellFlash[r][c] > 10) {
                    drawText("!", bx + 5, by - 5, "#50ad33", 5);
                }
                cellFlash[r][c]--;
            }

            // Recently-sabotaged marker: magenta border fading over ~3s so
            // the player can find what the goblins changed
            if (cellRecent[r][c] > 0) {
                ctx.globalAlpha = (cellRecent[r][c] / 180) * 0.55;
                ctx.strokeStyle = "#c05838";
                ctx.lineWidth = 1.5 * SCALE;
                ctx.strokeRect((bx + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, (TILE - 2) * SCALE);
                ctx.globalAlpha = 1.0;
                cellRecent[r][c]--;
            }

            // Target pattern indicator (skip for noPattern levels like L30)
            if (currentLevel < LEVELS.length && !LEVELS[currentLevel].noPattern) {
                const target = LEVELS[currentLevel].pattern[r][c];
                if (target && !on) {
                    // Needs to be ON — pulsing outline
                    const pulse = 0.5 + Math.sin(performance.now() * 0.003) * 0.25;
                    ctx.globalAlpha = pulse;
                    const rowCol = PAL.gridOn[r];
                    drawRect(bx + 1, by + 1, TILE - 2, 1, rowCol);
                    drawRect(bx + 1, by + TILE - 2, TILE - 2, 1, rowCol);
                    drawRect(bx + 1, by + 1, 1, TILE - 2, rowCol);
                    drawRect(bx + TILE - 2, by + 1, 1, TILE - 2, rowCol);
                    drawRect(bx + 6, by + 6, 4, 4, rowCol);
                    ctx.globalAlpha = 1.0;
                } else if (!target && on) {
                    // Needs to be OFF — pulsing X
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

    drawGridLattice();

    // Playhead with beat pulse on active blocks.
    // currentStep is the NEXT column to play (tickSequencer advances it right
    // after triggering), so the column currently SOUNDING is one behind —
    // draw the playhead there so audio and visuals line up.
    if (playing) {
        const playheadCol = soundingCol;   // same column, computed once above
        const px = (GRID_X + playheadCol) * TILE;
        ctx.fillStyle = PAL.playhead;
        ctx.globalAlpha = 0.2;
        const playheadH = (gridBottomTileY() - GRID_Y) * TILE;
        fillRoundRect(ctx, px * SCALE, (GRID_Y * TILE + GRID_Y_OFFSET) * SCALE, TILE * SCALE, playheadH * SCALE, 4, PAL.playhead);
        ctx.globalAlpha = 1.0;
        // Top marker — rounded
        fillRoundRect(ctx, (px + 2) * SCALE, ((GRID_Y - 1) * TILE + 10 + GRID_Y_OFFSET) * SCALE, (TILE - 4) * SCALE, 4 * SCALE, 2, PAL.playhead);
        // Beat pulse: brighten blocks under the playhead that are ON
        for (let r = 0; r < ar; r++) {
            if (grid[r][playheadCol] && rowTrigger[r] > 0) {
                const by = rowPixelY(r);
                const pulseAlpha = rowTrigger[r] / 8 * 0.45;
                ctx.fillStyle = "#ffffff";
                ctx.globalAlpha = pulseAlpha;
                ctx.fillRect((px + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, (TILE - 2) * SCALE);
                ctx.globalAlpha = 1.0;
            }
        }
    }


    // HUD is rendered on separate canvas
    renderHUD();


    // (The fan entourage that congaed along behind Carl lived here. Ten
    // pixel-art villagers, each a stack of individual fillRects, cost 3.7ms
    // of an 11.3ms render — a third of the frame for background garnish.
    // The crowd still exists where it means something: the intro, the title
    // screen and the cave-return cutscene.)

    // The floor is finished. Lay it down, come back to the real canvas, and
    // everything after this stands up on it.
    if (PROJ.on) {
        blitPlane();
        ctx = MAIN_CTX;
        drawSideWalls();
        drawPadRises();
    }

    // Goblins (all active ones)
    for (const g of goblins) {
        if (!g.dead) {
            billboard(g.x + g.w / 2, g.y + g.h, () => drawGoblinFor(g));
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
                    dir: g.dir, bodyCol: "#ffffff", darkCol: "#dddddd", headCol: "#ffffff", eyeCol: INK.mint
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

    // Friend NPC (Level 30)
    renderFriendNPC();

    // Death particles
    // Particles are in the room, so they take the camera like everything else.
    // Particles are in the room, so they take the camera like everything else.
    for (const pt of deathParticles) {
        if (pt.sparkle && Math.random() > 0.6) continue; // twinkle effect
        billboard(pt.x, pt.y, () => {
            ctx.fillStyle = pt.color;
            ctx.globalAlpha = pt.life / 60;
            ctx.fillRect(pt.x * SCALE, pt.y * SCALE, pt.size * SCALE, pt.size * SCALE);
        });
    }
    ctx.globalAlpha = 1.0;


    ctx.globalAlpha = 1.0;

    // Death text
    if (deathText) {
        // Anchored to the spot in the room it was thrown from. It was drawing
        // flat, which put "OW MY FACE!" up by the back wall while the Donk it
        // came out of was down on the grid.
        ctx.globalAlpha = Math.min(1, deathText.timer / 20);
        billboard(deathText.x, deathText.y, () =>
        drawText(deathText.text, deathText.x, deathText.y, deathText.color || INK.red, deathText.scale || 5));
        ctx.globalAlpha = 1.0;
    }

    // IN THE POCKET — expanding gold groove ring from the punched cell
    if (pocketRing) {
        pocketRing.timer--;
        const prT = 1 - pocketRing.timer / 30; // 0→1
        // Paint on the floor, so it lies down with the floor rather than
        // hanging in the air at its flat position.
        const prP = PROJ.on ? projPoint(pocketRing.x * SCALE, pocketRing.y * SCALE) : null;
        const prX = prP ? prP.x : pocketRing.x * SCALE;
        const prY = prP ? prP.y : pocketRing.y * SCALE;
        const prS = prP ? prP.s : 1;
        ctx.save();
        if (prP) { ctx.translate(prX, prY); ctx.scale(1, projScale(1) > 0 ? 0.42 : 1); ctx.translate(-prX, -prY); }
        ctx.strokeStyle = INK.mustard;
        ctx.lineWidth = 3 * SCALE;
        ctx.globalAlpha = (1 - prT) * 0.8;
        ctx.beginPath();
        ctx.arc(prX, prY, (4 + prT * 180) * SCALE * prS, 0, Math.PI * 2);
        ctx.stroke();
        // Trailing inner ring
        ctx.globalAlpha = (1 - prT) * 0.4;
        ctx.beginPath();
        ctx.arc(prX, prY, (4 + prT * 130) * SCALE * prS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1.0;
        if (pocketRing.timer <= 0) pocketRing = null;
    }

    // Screen flash (elite kill)
    if (screenFlash > 0) {
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = Math.min(1, screenFlash / 15) * 0.6;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    // ---- The punch reticle -------------------------------------------------
    // Drawn LAST, and flattened onto the floor.
    //
    // In the plane with the grid it was correct and invisible: BUZZ is a
    // billboard at full height standing on a floor compressed to a fraction of
    // its flat depth, so his body covers the tile immediately in front of him —
    // exactly the tile the reticle marks. Under the old top-down camera he sat
    // inside one tile and the next one was clear; he does not any more.
    //
    // So it goes on top of everything, squashed onto the floor plane so it
    // still reads as paint rather than as a decal on the glass.
    const ptx = Math.round(player.x / TILE);
    const pty = Math.round((player.y - GRID_Y_OFFSET) / TILE);
    let ttx = ptx, tty = pty;
    switch (player.dir) {
        case 0: tty += 1; break;
        case 1: tty -= 1; break;
        case 2: ttx -= 1; break;
        case 3: ttx += 1; break;
    }
    // Only a tile he could stand on gets marked. Now that row 0 is walkable,
    // facing the back wall from it aimed the reticle at row -1 — inside the
    // wall, where it projected as a green smear across the skirting.
    const targetInRoom = tty * TILE >= WALK_TOP && tty * TILE <= WALK_BOTTOM
                      && ttx >= 1 && ttx <= COLS - 2;
    if (!player.attacking && gameState === "playing" && targetInRoom) {
        const cx = (ttx + 0.5) * TILE * SCALE, cy = (tty + 0.5) * TILE * SCALE + GRID_Y_OFFSET * SCALE;
        const q = PROJ.on ? projPoint(cx, cy) : { x: cx, y: cy, s: 1 };
        const near = PROJ.on ? projPoint(cx, cy + TILE * SCALE / 2) : { y: cy + TILE * SCALE / 2 };
        const far  = PROJ.on ? projPoint(cx, cy - TILE * SCALE / 2) : { y: cy - TILE * SCALE / 2 };
        // Bigger when he is facing AWAY from the camera. The tile he aims at is
        // then directly behind him, and a billboard at full height on a raked
        // floor covers most of it — so the reticle has to reach out past his
        // shoulders. Facing any other way it is in clear floor and does not.
        const grow = player.dir === 1 ? 1.45 : 1;
        const halfW = TILE * SCALE * q.s / 2 * grow;
        const halfH = Math.max(3, (near.y - far.y) / 2) * grow;   // the tile's depth on screen
        const pulse = 0.35 + Math.sin(performance.now() * 0.004) * 0.2;
        const c = PAL.punch;   // INK.green — mustard is the sequencer's colour
        const armX = halfW * 0.42, armY = halfH * 0.42, t = Math.max(2, 2 * SCALE * q.s * 0.4);
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = c;
        ctx.fillRect(q.x - halfW, q.y - halfH, halfW * 2, halfH * 2);
        ctx.globalAlpha = pulse;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const x = q.x + sx * halfW, y = q.y + sy * halfH;
            ctx.fillRect(Math.min(x, x - sx * armX), y - (sy > 0 ? t : 0), armX, t);
            ctx.fillRect(x - (sx > 0 ? t : 0), Math.min(y, y - sy * armY), t, armY);
        }
        ctx.restore();
        ctx.globalAlpha = 1.0;
    }

    // ---- THE IMPACT LANDS HERE, and BUZZ is drawn after it ------------------
    // A local shake is the room reacting to a hit, so it is applied to
    // everything drawn so far — the floor, the sequencer, the Donks, the
    // effects — and BUZZ goes down on top of it untouched. He stays planted and
    // the room jolts around him, which reads as him hitting it rather than the
    // camera being knocked about.
    //
    // The punch reticle is deliberately on the shaking side of this line: it
    // marks a TILE, so it belongs to the room, not to him.
    //
    // Whole-screen shakes (dying, a boulder landing) still move everything
    // including BUZZ — those are not his doing, and there the point is that he
    // is not in control.
    if (screenShake > 0 && shakeAt) applyLocalShake(shakeSX, shakeSY);

    // Persistent amber/gold glow under Carl's feet — flares up on groove hits.
    // Gradient is cached at unit radius and scaled via transform.
    {
        const boost = carlGlowBoost > 0 ? (carlGlowBoost / 45) * 0.3 : 0;
        if (carlGlowBoost > 0) carlGlowBoost--;
        const R0 = TILE * SCALE;
        if (!gradCache.carlGlow) {
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R0);
            g.addColorStop(0, "rgba(239,172,40,0.5)");
            g.addColorStop(0.6, "rgba(239,172,40,0.15)");
            g.addColorStop(1, "rgba(239,172,40,0)");
            gradCache.carlGlow = g;
        }
        // At his feet, on the floor — so it follows him through the camera
        // instead of sitting at his flat position.
        const gp = PROJ.on ? projPoint((player.x + player.w / 2) * SCALE, (player.y + player.h) * SCALE) : null;
        const glowCX = gp ? gp.x : (player.x + player.w / 2) * SCALE;
        const glowCY = gp ? gp.y : (player.y + player.h) * SCALE;
        const glowPulse = 0.25 + Math.sin(performance.now() * 0.002) * 0.08 + boost;
        ctx.save();
        ctx.translate(glowCX, glowCY);
        ctx.scale(0.9 + boost, 0.35 + boost * 0.4); // ellipse via squash
        ctx.globalAlpha = glowPulse;
        ctx.fillStyle = gradCache.carlGlow;
        ctx.beginPath();
        ctx.arc(0, 0, R0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1.0;
    }

    // BUZZ and his punch stand up together on his own ground point — one
    // billboard, or the fist would take a different scale from the arm.
    billboard(player.x + player.w / 2, player.y + player.h, () => {
        // Player shadow
        contactShadow(player.x + player.w / 2, player.y + player.h - 1, 5.4, 1.9);

        // Punch (draw behind player for up-facing, in front otherwise)
        if (player.attacking && player.dir === 1) drawPunch();

        // Player sprite
        drawPlayer();
    });

    // Boulder freeze countdown display (large seconds above Carl)
    if (player.freezeTimer > 0) {
        const freezeSecs = Math.ceil(player.freezeTimer / 60);
        const countX = player.x + player.w / 2;
        const countY = player.y - 12;
        ctx.font = gfont(8 * SCALE);
        ctx.textAlign = "center";
        ctx.fillStyle = "#000000";
        ctx.fillText(freezeSecs + "s", countX * SCALE + 2, countY * SCALE + 2);
        ctx.fillStyle = "#44CCFF";
        ctx.fillText(freezeSecs + "s", countX * SCALE, countY * SCALE);
        ctx.textAlign = "left";
    }

    // Punch (in front for down/left/right)
    if (player.attacking && player.dir !== 1) {
        billboard(player.x + player.w / 2, player.y + player.h, drawPunch);
    }

    // ...and the impact after him, whichever way he is facing. See
    // drawPunchImpact: facing away, the tile he hit is behind him, and so was
    // the star that said he hit it.
    if (player.punchFx > 0 && player.punchHit) {
        billboard(player.x + player.w / 2, player.y + player.h, drawPunchImpact);
    }

    // "Press any key" prompt while the beat waits for the audio unlock
    if (!sequencerStarted && gameState === "playing" && !CAMRIG.on) {
        const blinkStart = Math.floor(performance.now() / 500) % 2 === 0;
        if (blinkStart) {
            ctx.font = gfont(6 * SCALE);
            ctx.textAlign = "center";
            ctx.fillStyle = "#000000";
            ctx.fillText("PRESS ANY KEY TO DROP THE BEAT", (COLS * TILE * SCALE) / 2 + SCALE, 14 * SCALE + SCALE);
            ctx.fillStyle = "#F6CC60";
            ctx.fillText("PRESS ANY KEY TO DROP THE BEAT", (COLS * TILE * SCALE) / 2, 14 * SCALE);
            ctx.textAlign = "start";
        }
    }

    // (The blinking "THE DOOR IS OPEN" prompt lived here. The beat landing ends
    // the level, so there is nothing to prompt for.)

    // Ambient cave vignette — dark green-tinted edges (gradient cached)
    {
        const W_a = COLS * TILE * SCALE;
        const H_a = ROWS * TILE * SCALE;
        if (!gradCache.vignette) {
            const g = ctx.createRadialGradient(W_a / 2, H_a / 2, W_a * 0.35, W_a / 2, H_a / 2, W_a * 0.72);
            g.addColorStop(0, "rgba(0,0,0,0)");
            g.addColorStop(1, "rgba(44,44,42,0.2)");
            gradCache.vignette = g;
        }
        ctx.fillStyle = gradCache.vignette;
        ctx.fillRect(0, 0, W_a, H_a);
    }

    // Timer urgency vignette (pulsing red edges when ≤10 seconds)
    {
        const timerSec_v = Math.max(0, Math.ceil(levelTimer / 60));
        if (timerSec_v <= 10 && timerSec_v > 0 && !levelComplete) {
            const urgency = 1 - timerSec_v / 10; // 0→1 as timer approaches 0
            const pulse = 0.3 + Math.sin(performance.now() * 0.008) * 0.2;
            const vigAlpha = (urgency * 0.4 + 0.1) * pulse;
            const W_v = COLS * TILE * SCALE;
            const H_v = ROWS * TILE * SCALE;
            const grad = ctx.createRadialGradient(W_v / 2, H_v / 2, W_v * 0.3, W_v / 2, H_v / 2, W_v * 0.7);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(1, "#FE3636");
            ctx.fillStyle = grad;
            ctx.globalAlpha = vigAlpha;
            ctx.fillRect(0, 0, W_v, H_v);
            ctx.globalAlpha = 1.0;
        }
    }

    // The "~ THE WARM-UP ROOM ~" biome banner is gone with the rest of the grid
    // chrome. It was drawn at y=36 — INSIDE the field, since the grid starts at
    // 32 — so it sat right on top of the play area, in the old neon green with a
    // hard black drop shadow that is not in the palette any more. Its timer
    // still runs; only the text is gone.
    if (biomeBannerTimer > 0) biomeBannerTimer--;


    // The local shake already ran, further up, before BUZZ was drawn. All that
    // is left here is closing the whole-screen one's translate.
    if (screenShake > 0 && !shakeAt) ctx.restore();
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

    // ---- BUZZ, the player (Donk rig, hero head/body) ----
    if (donkReady && DONK_PLAYER) {
        // Stride is locked to DISTANCE TRAVELLED — the legs cover ground at
        // the speed the character actually moves, like the procedural walk.
        // A big jump between frames is a teleport (level entry), not a step.
        let dist = 0;
        if (donkCarlLastX !== null) {
            dist = Math.abs(gx - donkCarlLastX) + Math.abs(gy - donkCarlLastY);
            if (dist > 8) dist = 0;
        }
        donkCarlLastX = gx; donkCarlLastY = gy;
        const moving = dist > 0.05;
        // Ease the walk state. Flipping it per frame made a single stalled
        // frame snap the feet to their stance and pop the body up by the full
        // dip — that was the jank.
        donkCarlWalk += ((moving ? 1 : 0) - donkCarlWalk) * 0.22;
        donkCarlPhase = moving ? donkCarlPhase + dist * DONK_STRIDE
            : (donkCarlWalk < 0.25 ? donkSettlePhase(donkCarlPhase) : donkCarlPhase);
        // Facing is sticky: vertical moves keep whichever way he last faced
        if (dir === 2) donkCarlFacing = -1;
        else if (dir === 3) donkCarlFacing = 1;
        if (ghost) { ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = "lighter"; }
        // Aim the punch at the tile it actually HITS, so what you see is what
        // you hit. (Same tile getPunchBox/the grid-toggle use.)
        const K = BUZZ_SCALE;
        // The drawn punch poses already carry their own lean and plant, so the
        // procedural body shift would double it up and slide him off his tile.
        if (punch > 0 && (dir === 1 ? heroSet().upPose
            : dir === 0 ? (heroSet().downPose || heroSet().punchPose) : heroSet().punchPose)) {
            leanX = 0; leanY = 0;
        }
        const ox = gx + TILE / 2 + leanX, oy = gy + TILE - 1 + leanY * 0.5;
        let ptx, pty;
        if (punch > 0) {
            const ttx = Math.round(gx / TILE) + (dir === 2 ? -1 : dir === 3 ? 1 : 0);
            const tty = Math.round(gy / TILE) + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
            ptx = (ttx * TILE + TILE / 2 - ox) * SCALE / K;
            pty = (tty * TILE + TILE / 2 - oy) * SCALE / K;
            if (donkCarlFacing === -1) ptx = -ptx; // into the rig's local space
        }
        drawBuzzRig(ox * SCALE, oy * SCALE, K, {
            punchTX: ptx, punchTY: pty,
            phase: donkCarlPhase,
            walk: donkCarlWalk,
            mirror: donkCarlFacing === -1, // BUZZ's art faces right natively
            punchThrust: punch,
            punchVel: opts.punchVel || 0,
            punchDir: dir,
        });
        if (ghost) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
        return;
    }

    // (Everything below here used to be the pre-BUZZ player: a 20-frame
    // sprite sheet, a per-direction PNG path, and ~190 lines of procedural
    // pixel-art Carl authored for 48px tiles. The BUZZ rig above returns
    // unconditionally, so none of it could run.)
}

// How far the arm is out, 0..1. A sine over the whole swing spread the
// extension across six frames and eased into the top, which reads as a slow
// reach rather than a jab. The arm now SNAPS out over PUNCH_EXT frames and
// only eases on the way back, so the strike lands almost immediately and the
// hold (see the attack tick) takes over from there.
// The impact burst's own length, in frames. Six is a tenth of a second: long
// enough to register, short enough that it is gone before the fist is. Contact
// seeds it at LEN+1 because the tick that decrements it runs later in the same
// update, so the frame the player actually sees the hit on is the full one.
const PUNCH_FX_LEN = 6;
const PUNCH_EXT = 3;   // frames to full extension
const PUNCH_RET = 4;   // frames to pull back once the button is released
function punchExtensionAt(p, timer) {
    if (!p.attacking) return 0;
    const elapsed = p.attackDuration - timer;
    // the +0.5 means frame one is already ~40% out — no dead frame at the start
    const out = Math.max(0, Math.min(1, (elapsed + 0.5) / PUNCH_EXT));
    const back = Math.min(1, timer / PUNCH_RET);
    return Math.min(1 - Math.pow(1 - out, 3), back);
}
const punchExtension = p => punchExtensionAt(p, p.attackTimer);

function drawPlayer() {
    const p = player;
    const punchThrust = punchExtension(p);
    // How much the fist moved this frame, 0..1 of full reach. The smear and the
    // trail both scale off it, so they appear exactly on the fast frames and
    // vanish the moment he's holding still at full extension.
    p.punchVel = Math.abs(punchThrust - punchExtensionAt(p, p.attackTimer + 1));
    // Flash sprite on/off every 6 frames when stunned
    if (p.stunTimer > 0 && Math.floor(p.stunTimer / 6) % 2 === 0) {
        // Skip drawing — sprite is "off" this cycle
    } else {
        drawPlayerSprite(p.x, p.y, p.frame, p.dir,
            { isBlinking: p.blinkTimer >= 180, punchThrust: punchThrust, punchVel: p.punchVel });
    }
}

function drawPunch() {
    const p = player;
    const px = p.x;
    const py = p.y;
    // Anchor matches the procedural sprite: game-unit offsets from the tile,
    // multiplied by SCALE (equivalent to the procedural block's 48px-tile art
    // scaled by (TILE*SCALE)/48 around the tile origin)
    const cx = px + p.w / 2;
    const cy = py + p.h * 0.35; // shoulder height

    ctx.save();

    // Same snap-out/ease-back curve the sprite uses, so the procedural arm and
    // the drawn pose stay in lockstep
    const thrust = punchExtension(p);

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
        case 0: shoulderOffX = -5; shoulderOffY = 2; break;   // down
        case 1: shoulderOffX = 5; shoulderOffY = -8; break;    // up
        case 2: shoulderOffX = -8; shoulderOffY = -2; break;   // left
        case 3: shoulderOffX = 8; shoulderOffY = -2; break;    // right
    }
    const armLen = 3 + thrust * 6; // short arm from body edge to fist
    const shoulderX = (cx + leanX + shoulderOffX) * SCALE;
    const shoulderY = (cy + leanY + shoulderOffY) * SCALE;
    const fistX = (cx + leanX + shoulderOffX + dx * armLen) * SCALE;
    const fistY = (cy + leanY + shoulderOffY + dy * armLen) * SCALE;

    // Donk-Carl punches with a rubber-hose glove; procedural Carl keeps skin
    const glove = donkReady && DONK_PLAYER;
    const armCol = glove ? "#2C2C2A" : INK.mustard;
    const armOutCol = glove ? "#2C2C2A" : "#927e6a";
    const fistShadowCol = glove ? "#b3aa96" : "#a58c27";
    const fistCol = glove ? "#fcf7e8" : INK.mustard;

    // BUZZ's punching arm is drawn by the rig itself (correct shoulder, and it
    // replaces the resting arm). Only the impact effects live here.
    const heroArm = !!(donkReady && DONK_PLAYER && DONK_IMG.hero && heroSet().fistMeta);
    if (!heroArm) {
    // === ARM ===
    ctx.strokeStyle = armCol;
    ctx.lineWidth = 4 * SCALE;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(fistX, fistY);
    ctx.stroke();

    // Arm outline
    ctx.strokeStyle = armOutCol;
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
    ctx.fillStyle = fistShadowCol;
    ctx.beginPath();
    ctx.arc(fistX + SCALE, fistY + SCALE, fistSize * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Main fist
    ctx.fillStyle = fistCol;
    ctx.beginPath();
    ctx.arc(fistX, fistY, fistSize * SCALE, 0, Math.PI * 2);
    ctx.fill();
    if (glove) {
        // Inked glove outline
        ctx.strokeStyle = "#2C2C2A";
        ctx.lineWidth = 1.5 * SCALE;
        ctx.stroke();
    }
    // Knuckle highlights
    ctx.fillStyle = "#F0D8B8";
    const knucklePerp = dx === 0 ? 1 : 0;
    for (let i = -1; i <= 1; i++) {
        const kx = fistX + (knucklePerp === 1 ? i * 1.8 * SCALE : dx * 2.5 * SCALE);
        const ky = fistY + (knucklePerp === 0 ? i * 1.8 * SCALE : dy * 2.5 * SCALE);
        ctx.beginPath();
        ctx.arc(kx, ky, 1.0 * SCALE, 0, Math.PI * 2);
        ctx.fill();
    }
    }

    // === IMPACT ===
    // Two different things, deliberately gated differently:
    //   the TRAIL is motion, so it draws on every swing including a whiff;
    //   the STAR and the BLOOM are contact, so they only fire when the punch
    //   actually connected with something (Carl). punchHit is already set only
    //   by a real hit — a goblin, the catapult, a villager, or a drum pad.
    // Both run off punchFx rather than the swing, because the swing can be HELD
    // and an effect frozen mid-flash reads as a bug rather than a hit.
    // BRING THE FIST TIP BACK INTO THIS SPACE BEFORE USING IT.
    //
    // donkFistTip is ABSOLUTE canvas coordinates — it is baked out through the
    // live transform at the moment the hand-drawn arm is posed, so the impact FX
    // can find the glove. Everything else in here is in the billboard's local
    // space. Handing an absolute point to a drawing call that is already inside
    // the billboard transform applies that transform twice, and the further the
    // camera has to move a point the worse it gets: at the back of the room the
    // burst landed three rows down the board from the fist that made it.
    //
    // This is not new — it was there before the burst was reshaped, and the old
    // slow bloom simply hid it. The trail was reading the same wrong point.
    const toLocal = (pt) => {
        const m = ctx.getTransform().invertSelf();
        return { x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f };
    };
    const tip = (heroArm && donkFistTip) ? toLocal(donkFistTip) : { x: fistX, y: fistY };
    const punchAngle = Math.atan2(dy, dx);

    // --- dry-brush trail, chasing the glove ---
    const vel = p.punchVel || 0;
    if (vel > 0.05) {
        const len = Math.min(1, vel * 2.2) * 15 * SCALE;
        const nx = -Math.sin(punchAngle), ny = Math.cos(punchAngle);
        ctx.strokeStyle = HOSE_INK; ctx.lineCap = "round";
        for (let i = -1; i <= 1; i++) {
            const off = i * 5 * SCALE, l = len * (1 - Math.abs(i) * 0.3);
            ctx.globalAlpha = 0.45 - Math.abs(i) * 0.14;
            ctx.lineWidth = (2.4 - Math.abs(i) * 0.8) * SCALE * 0.6;
            ctx.beginPath();
            ctx.moveTo(tip.x + nx * off, tip.y + ny * off);
            ctx.lineTo(tip.x + nx * off - Math.cos(punchAngle) * l,
                       tip.y + ny * off - Math.sin(punchAngle) * l);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // --- the star and the bloom ---------------------------------------------
    //
    // This is what was making the punch feel wrong, and it was three things.
    //
    // It BLOOMED instead of bursting. punchFx was seeded when the swing started
    // and shaped by sin(progress * PI), so it grew for five frames after the
    // fist had already landed and peaked in the middle of the hold — measured:
    // contact on frame 1, maximum on frame 6. A balloon inflating, not a hit.
    // It is seeded at CONTACT now, and it is loudest on the frame it starts.
    //
    // It DECAYED AS SLOWLY AS IT GREW, because a sine is symmetric. Impacts are
    // not: instant on, quick off. It fades on a curve now and expands slightly
    // while it does, which reads as the energy going somewhere.
    //
    // And it FOLLOWED THE FIST HOME. The star was drawn at the live glove
    // position, so on the retract it slid backwards with the hand — measured 51
    // pixels over the last three frames. An impact happened at a place; the mark
    // it leaves stays there, so the tip is latched on the frame of contact.
    if (p.punchFx > 0 && p.punchHit) {
        if (!p.punchFxAt) p.punchFxAt = { x: tip.x, y: tip.y };
    } else {
        p.punchFxAt = null;
    }
    ctx.restore();
}

// The star and the bloom, drawn AFTER him in every direction.
//
// They used to go out with the rest of the punch, which for an up-facing swing
// is drawn behind him — and the pad he is hitting when he faces up is behind him
// too, so the whole impact vanished into his own silhouette. One direction in
// four with no visible hit at all.
//
// Carl already ruled on exactly this conflict once, for the punch reticle: it is
// grown when he faces away because "the reticle gets obscured by his body". Same
// billboard, same occlusion, same answer. The impact marks a tile in the room,
// so it belongs to the room and goes down last.
function drawPunchImpact() {
    const p = player;
    if (!(p.punchFx > 0 && p.punchHit && p.punchFxAt)) return;
    const tipFx = p.punchFxAt;
    const e = 1 - p.punchFx / PUNCH_FX_LEN;   // 0 on the frame of contact
    const fx = Math.pow(1 - e, 1.6);          // brightness: instant on, quick off
    const spread = 0.92 + e * 0.45;           // and it opens out as it goes
    ctx.save();
    {
        // What he hit decides the colour: a drum pad flashes its own row, so the
        // impact teaches the sequencer's colour language instead of fighting it.
        const col = p.punchHitCol || INK.mustard;
        // Bloom — the paper soaking through behind the glove, not a light source
        const br = 0.56 * spread * TILE * SCALE;
        const grad = ctx.createRadialGradient(tipFx.x, tipFx.y, 0, tipFx.x, tipFx.y, br);
        grad.addColorStop(0, col); grad.addColorStop(0.45, col);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = fx * 0.45; ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(tipFx.x, tipFx.y, br, 0, Math.PI * 2); ctx.fill();
        // Inked starburst — drawn and boiling, like everything else in this
        // world. Sized against the TILE so it reads as "one cell got hit"
        // rather than swallowing him whole.
        const R = 0.56 * spread * TILE * SCALE;
        const fade = Math.min(1, fx * 1.35);
        ctx.save();
        ctx.translate(tipFx.x, tipFx.y);
        ctx.beginPath();
        const SPIKES = 11;
        for (let i = 0; i <= SPIKES * 2; i++) {
            const a = i / (SPIKES * 2) * Math.PI * 2 - Math.PI / 2;
            const r = R * (i % 2 === 0 ? 1 : 0.42) * (1 + jit(i * 17, 11, 0.16));
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.globalAlpha = fade * 0.55; ctx.fillStyle = col; ctx.fill();
        ctx.globalAlpha = fade; ctx.strokeStyle = HOSE_INK;
        ctx.lineWidth = 1.4 * SCALE * 0.6; ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}


// Map DJ_SETUP_PIECES names to draw functions with booth-relative offsets
// Offsets are relative to boothX, boothY as defined in intro Scene 0
function drawDJSetupPiece(pieceIndex, boothX, boothY, options) {
    const alpha = (options && options.alpha !== undefined) ? options.alpha : 1;
    const silhouette = (options && options.silhouette) || false;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * alpha;
    if (silhouette) ctx.globalAlpha = prevAlpha * 0.15;

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
    fillRoundRect(ctx, bx * SCALE, by * SCALE, bw * SCALE, bh * SCALE, 3, "#55554f");
    fillRoundRect(ctx, (bx + 1) * SCALE, (by + 1) * SCALE, (bw - 2) * SCALE, (bh - 2) * SCALE, 2, "#3f3f3b");
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
        ctx.strokeStyle = INK.paper;
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
    fillRoundRect(ctx, tx * SCALE, (ty + 6) * SCALE, 14 * SCALE, 6 * SCALE, 3, "#55554f");
    fillRoundRect(ctx, (tx + 1) * SCALE, (ty + 7) * SCALE, 12 * SCALE, 4 * SCALE, 2, "#3f3f3b");
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
    ctx.fillStyle = "#F6CC60";
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
    ctx.fillStyle = "#F6CC60";
    ctx.beginPath();
    ctx.arc((mx + 6) * SCALE, (my + 6) * SCALE, 1.5 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    // Level meters (small circles)
    ctx.fillStyle = INK.green;
    ctx.beginPath();
    ctx.arc((mx + 2) * SCALE, (my + 8.5) * SCALE, 1 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc((mx + 6) * SCALE, (my + 8.5) * SCALE, 1 * SCALE, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK.rust;
    ctx.beginPath();
    ctx.arc((mx + 10) * SCALE, (my + 8.5) * SCALE, 1 * SCALE, 0, Math.PI * 2);
    ctx.fill();
}

const LIGHT_RIG_COLORS = [INK.rust, "#F6CC60", INK.green, INK.teal, INK.red, "#F6CC60"];
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


// type: "normal", "elite", "catapult"
// gx, gy: top-left position (game coords)
// frame: animation frame (0-3)
// options: { dir, showShadow, bodyCol, darkCol, headCol, eyeCol }
// ============================================================
// DONK — the drum enemy, ported from BUZZ's Wild Ride
// Four-piece rubber-hose puppet: body shell, drumhead, arm, leg
// (arm and leg mirrored for the far side). Loads independently of
// USE_IMAGE_ASSETS; until the PNGs land in assets/donk/ the
// procedural goblin below draws as the fallback.
// ============================================================

// The rig table, verbatim from the coaster (base unit: Donk is 58 tall).
// Pivots are FRACTIONS of the art box, not pixel offsets — the pieces can
// be re-exported at any resolution and the rig still works.
const DK = {
    bx: -26.41, by: -51.84, bw: 53.14, bh: 36.33, // body+button crop rect
    btnBot: -41.6,                                 // drumhead bottom = pulse pivot
    legW: 16.97, legH: 32, legPX: 0.70, legPY: 0.02,
    armW: 19.66, armH: 24, armPX: 0.90, armPY: 0.07,
};

const DONK_FILES = {
    body:   "assets/donk/donk-body.png",
    button: "assets/donk/donk-button.png",
    arm:    "assets/donk/donk-arm.png",
    leg:    "assets/donk/donk-leg.png",
    hero:   "assets/donk/hero-drum.png", // BUZZ — the player's head/body
};
const DONK_IMG = { body: null, button: null, arm: null, leg: null };
const DONK_TINT = { elite: {} }; // tinted variants, baked once on load
let donkReady = false;
// The player is BUZZ (the smiling drum, via the hero slot below).
// Flip to false to get procedural Carl back.
const DONK_PLAYER = true;
const BUZZ_SCALE = 75 / 58 * RIG;   // drawn height vs the 58-unit rig base (was 90 —
                              // at 90 his drum sat a whole tile above his hitbox)
let donkCarlPhase = 0;        // player stride phase (advances with distance moved)
let donkCarlWalk = 0;         // eased 0..1 walk amount — a one-frame gap must not pop the pose
let donkCarlLastX = null, donkCarlLastY = null;
let donkCarlFacing = 1;       // sticky horizontal facing (+1 right, -1 left)
const DONK_STRIDE = 0.25;     // stride phase per game px — the legs swing a hair slower than his travel
// Standing still = legs actually still: glide the phase to the nearest
// rest pose (a multiple of pi, where the swing is zero) over a few frames
function donkSettlePhase(ph) {
    const rest = Math.round(ph / Math.PI) * Math.PI;
    return ph + (rest - ph) * 0.3;
}

// Pre-shrink art toward the size it's actually drawn at.
//
// BUZZ's drum is a 512px drawing rendered into an 86px box. drawImage does
// that 6:1 reduction with a 2x2 bilinear tap every frame, which throws away
// most of the source and leaves the fine ink lines broken and crawling. Halving
// repeatedly is a clean box filter — every source pixel contributes — so the
// final draw is a gentle <2x step instead of a brutal 6x one. Done once at
// load, it costs nothing per frame.
function mip(img, targetW) {
    let src = img;
    // Halve while there's more than 2x to give away — each halving is a clean
    // box filter where every source pixel contributes
    while (src.width / 2 >= targetW && src.width > 8) {
        src = mipStep(src, Math.round(src.width / 2), Math.round(src.height / 2));
    }
    // then one exact step onto the target, so the per-frame draw is never
    // reducing by more than a hair
    if (src.width > targetW) {
        src = mipStep(src, Math.max(1, Math.round(targetW)),
                      Math.max(1, Math.round(src.height * targetW / src.width)));
    }
    return src;
}
function mipStep(src, w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    mipping = true;
    try { g.drawImage(src, 0, 0, w, h); } finally { mipping = false; }
    return c;
}

// Every image in the game has this problem, not just BUZZ: the sequencer's
// stone tiles are 512px drawings painted into 80px cells, which is the same
// 6:1 reduction. Rather than hand-tune each call site, drawImage itself picks
// the right pre-shrunk copy. It's a no-op unless the source is meaningfully
// larger than the destination, so pre-baked textures and already-small art
// pass straight through.
let mipping = false;
const MIPS = new WeakMap();
function mipFor(img, destW) {
    if (mipping || !img || !destW || !(destW > 0)) return img;
    const sw = img.width || 0;
    if (!sw || sw <= destW * 1.3) return img;
    // quantise the target so a rotating or pulsing sprite doesn't rebuild a
    // mip every frame
    const key = Math.max(8, Math.pow(2, Math.ceil(Math.log2(destW))));
    if (sw <= key * 1.3) return img;
    let byW = MIPS.get(img);
    if (!byW) { byW = new Map(); MIPS.set(img, byW); }
    let m = byW.get(key);
    if (!m) { m = mip(img, key); byW.set(key, m); }
    return m;
}
// ---- Boiling the drawn art -----------------------------------------------
// PNGs can't boil, so each one gets three warped copies baked at load and the
// draw is a swap — the canvas answer to the coaster's feDisplacementMap, minus
// the filter. SLICE warp, not per-pixel displacement: cut the image into
// horizontal bands and offset each one. It reads as a redrawn line, costs a
// handful of drawImage calls once, and needs no getImageData at all.
//
// The copies keep the source's exact dimensions, which matters — the 8-argument
// draw path scales its source rect by width, and every caller sizes art from
// img.width/height. Bands pushed past the edge lose a pixel into the art's own
// transparent margin, which is invisible at this amplitude.
let WARPS = new WeakMap();
// Two things this got wrong the first time, and they compounded into the
// "flashing lines" across BUZZ:
//
//   * 14 bands over a 512px source is a 37px step, so the warp was a staircase
//     rather than a wobble — every band boundary put a visible horizontal jog
//     through his linework. Bands are ~4px of source now, well under a
//     displayed pixel, so the warp reads as continuous.
//   * each band was also offset VERTICALLY, and neighbouring offsets can differ
//     by more than nothing — so a transparent line opened up between two bands
//     and the background showed straight through him. Every band is now drawn
//     with a few rows of overlap, which is invisible (it is the same opaque art
//     drawn over itself) and makes a gap impossible.
//
// The warp is spatially the same shape as before: the noise argument is
// normalised down the image so raising the band count does not also multiply
// the frequency.
const WARP_BAND_PX = 4;      // source px per band
const WARP_SPAN = 169;       // noise argument across the whole image
const WARP_OVERLAP = 3;      // source px of overlap — must exceed the dy swing
function sliceWarp(src, phase) {
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    const bands = Math.max(1, Math.round(src.height / WARP_BAND_PX));
    const bh = src.height / bands;
    mipping = true;   // don't let the drawImage patch recurse into itself
    try {
        for (let i = 0; i < bands; i++) {
            const sy = i * bh;
            const h = Math.min(src.height - sy, bh + WARP_OVERLAP);
            if (h <= 0) continue;
            const t = (i / bands) * WARP_SPAN;
            const dx = pjit(t, 31, phase, 0.9);
            const dy = pjit(t + 400, 47, phase, 0.45);
            g.drawImage(src, 0, sy, src.width, h, dx, sy + dy, src.width, h);
        }
    } finally { mipping = false; }
    return c;
}
// WHICH art boils, and it is not "all of it".
//
// This is the bug behind four rounds of "there are weird blinking overlays and
// screen borders". The warp is applied by a patch on drawImage, so it caught
// every bitmap the game draws — the back wall, its props, the pad tiles, the
// side walls, and the whole floor, which goes down as 160 slices of one canvas
// and therefore boiled as 160 independently wobbling horizontal bands. That is
// exactly the shimmer along the room's edges, and it directly contradicts
// BOIL.room, which is false and always was: the room is meant to be still.
//
// The warp exists for the character art in DONK_IMG and nothing else, so
// membership is now explicit rather than inherited from "was drawn as an image".
const BOILING_ART = new WeakSet();
function charArt(im) { BOILING_ART.add(im); return im; }

function warpFor(src, boils) {
    if (!boils || !BOIL.on || !BOIL.chars || !src || !src.width) return src;
    let w = WARPS.get(src);
    if (!w) { w = []; WARPS.set(src, w); }
    const ph = boil();
    if (!w[ph]) w[ph] = sliceWarp(src, ph);
    return w[ph];
}

(function patchDrawImage() {
    const P = (typeof CanvasRenderingContext2D !== "undefined") && CanvasRenderingContext2D.prototype;
    if (!P || P.__mipPatched) return;
    const orig = P.drawImage;
    P.drawImage = function (img, ...a) {
        if (mipping) return orig.call(this, img, ...a);
        // Asked of the ORIGINAL, because the mip is a fresh canvas and would
        // never be in the set.
        const boils = BOILING_ART.has(img);
        if (a.length === 4) {                       // dx, dy, dw, dh
            const m = warpFor(mipFor(img, a[2]), boils);
            if (m !== img) return orig.call(this, m, a[0], a[1], a[2], a[3]);
        } else if (a.length === 8) {                // sx..sh, dx..dh
            // Judge the reduction by the SOURCE RECT, not by the whole image.
            // A slice that takes 7 source pixels into 7 destination pixels is a
            // 1:1 draw; measuring the destination width against img.width read
            // it as 700:1, picked an 8x1 mip of the wall strip, and then asked
            // that one-pixel-tall image for 1.26 pixels of height. Canvas
            // satisfies an over-long source rect by shrinking the DESTINATION
            // to match — so the side walls arrived 20% short of the floor with
            // no texture on them, and no error anywhere.
            const eff = a[2] > 0 ? img.width * (a[6] / a[2]) : a[6];
            const m = warpFor(mipFor(img, eff), boils);
            if (m !== img) {
                // the warp preserves the mip's size, so this factor is the
                // mip's alone
                const f = m.width / img.width;
                // and clamp to the mip's real bounds, because its height is
                // rounded: over-reaching is the silent-shrink bug above.
                const sy = a[1] * f, sx = a[0] * f;
                const sh = Math.min(a[3] * f, m.height - sy);
                const sw = Math.min(a[2] * f, m.width - sx);
                return orig.call(this, m, sx, sy, sw, sh, a[4], a[5], a[6], a[7]);
            }
        }
        return orig.call(this, img, ...a);
    };
    P.__mipPatched = true;
})();

function bakeTint(img, color, amt) {
    const c = document.createElement("canvas");
    c.width = img.width || 1;
    c.height = img.height || 1;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = amt;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    // A tinted Donk is still a Donk, so it keeps its place in the boiling set.
    return BOILING_ART.has(img) ? charArt(c) : c;
}

function donkFinishLoad() {
    if (DONK_IMG.body && DONK_IMG.button && DONK_IMG.arm && DONK_IMG.leg) {
        // Elite variant: Harbor Teal wash on shell + limbs; drumhead stays cream
        DONK_TINT.elite.body = bakeTint(DONK_IMG.body, INK.teal, 0.45);
        DONK_TINT.elite.arm = bakeTint(DONK_IMG.arm, INK.teal, 0.45);
        DONK_TINT.elite.leg = bakeTint(DONK_IMG.leg, INK.teal, 0.45);
        DONK_TINT.elite.button = DONK_IMG.button;
        donkReady = true;
    }
}

function loadDonkImages() {
    // An artifact/bundled build can define DONK_SRC with data URIs (same
    // contract as the coaster's build.py); otherwise load from assets/
    const srcs = (typeof DONK_SRC !== "undefined") ? DONK_SRC : DONK_FILES;
    let pending = 4;
    for (const key of ["body", "button", "arm", "leg"]) {
        const img = new Image();
        img.onload = () => { DONK_IMG[key] = charArt(img); if (--pending === 0) donkFinishLoad(); };
        img.onerror = () => { if (--pending === 0) donkFinishLoad(); };
        img.src = srcs[key];
    }
    // Hero head/body (optional, loads independently of the core four)
    const heroImg = new Image();
    heroImg.onload = () => { DONK_IMG.hero = charArt(heroImg); };
    heroImg.onerror = () => {};
    heroImg.src = srcs.hero || DONK_FILES.hero;
    // BUZZ's straight-hose limb pieces (optional; rig falls back to Donk limbs)
    for (const [key, file] of [["buzzArm", "buzz-arm.png"], ["buzzFist", "buzz-fist.png"], ["buzzWave", "buzz-wave.png"], ["buzzLeg", "buzz-leg.png"], ["buzzArmClean", "buzz-arm-clean.png"],
        // Carl's hand-drawn punch poses: body+legs in one piece, arm separate
        ["buzzPunchBody", "buzz-punch-body.png"], ["buzzPunchArm", "buzz-punch-arm.png"],
        ["buzzUpBody", "buzz-up-body.png"], ["buzzUpArm", "buzz-up-arm.png"],
        ["buzzDownBody", "buzz-down-body.png"], ["buzzDownArm", "buzz-down-arm.png"]]) {
        const im = new Image();
        im.onload = () => { DONK_IMG[key] = charArt(im); };
        im.onerror = () => {};
        im.src = srcs[key] || ("assets/donk/" + file);
    }
}
loadDonkImages();

let DONK_HERO = null, DONK_HERO_KEY = -1;
let donkFistTip = null; // screen-space fist tip during a punch (for impact FX)
function heroSet() {
    const key = (DONK_IMG.hero ? 1 : 0) + (DONK_IMG.buzzArm ? 2 : 0) +
        (DONK_IMG.buzzFist ? 4 : 0) + (DONK_IMG.buzzLeg ? 8 : 0) +
        (DONK_IMG.buzzArmClean ? 16 : 0) +
        (DONK_IMG.buzzPunchBody && DONK_IMG.buzzPunchArm ? 32 : 0) +
        (DONK_IMG.buzzUpBody ? 64 : 0) + // its glove comes from the side punch
        (DONK_IMG.buzzDownBody && DONK_IMG.buzzDownArm ? 128 : 0);
    // The body image is the one piece every measurement below is derived from,
    // and it loads asynchronously. Return an empty set until it arrives rather
    // than measuring `undefined` — the key is deliberately NOT stored, so the
    // real rig gets built on the first call after the art lands. Only visible
    // now that the story scenes are gone and the room is up almost instantly.
    if (!DONK_IMG.hero || !DONK_IMG.hero.width) return DONK_HERO || {};
    if (!DONK_HERO || DONK_HERO_KEY !== key) {
        DONK_HERO_KEY = key;
        const img = DONK_IMG.hero;
        // EVERY BUZZ piece faces RIGHT natively — the drum shows its shell on
        // the left (turned away to the right) and the shoes point right. Do
        // NOT pre-flip the body: that made his feet point one way and his
        // body the other. The whole rig mirrors together to walk left.
        const bodyH = DK.bw * (img.height / img.width);
        // Straight-hose limb metas. The four art pieces are drawn at DIFFERENT
        // scales in their canvases (hose widths 38/56/56/61 px), so sizing them
        // by height alone rendered the arms at less than half the legs'
        // thickness — the "thread arms" bug. Each piece is instead sized so its
        // hose renders at a shared gauge, and the hand slice keeps its natural
        // aspect so stretching for reach never distorts the glove.
        // (Downscaling is handled globally — see mipFor — so these just wrap.)
        const mk = (im, aw, ah, hose, split, px) => im ? ({ img: im, aw, ah, hose, split, px }) : null;
        const mkBody = im => im || null;
        DONK_HERO = {
            body: mkBody(img),
            leadSign: 1,                 // art faces +x, so the leading side is +x
            armXTrail: 22,               // resting arm, drawn in front of the shell
            button: null, // face is part of the body art — no separate pulse piece
            arm: DONK_IMG.arm,   // fallback if the straight-hose piece is absent
            leg: DONK_IMG.leg,
            armMeta:  mk(DONK_IMG.buzzArm, 127, 512, 38, 0.760, 0.453), // relaxed hand
            // the same glove with the interior palm crease painted out — the
            // front hand shows the BACK of the glove, which has no crease
            armCleanMeta: mk(DONK_IMG.buzzArmClean, 127, 512, 38, 0.760, 0.453),
            legMeta:  mk(DONK_IMG.buzzLeg, 170, 512, 61, 0.725, 0.324), // hose + shoe
            fistMeta: mk(DONK_IMG.buzzFist, 117, 512, 56, 0.758, 0.491), // punch
            waveMeta: mk(DONK_IMG.buzzWave, 143, 512, 56, 0.686, 0.462), // spread hand
            armGauge: 4.2, armLen: 32,   // hose thickness / shoulder-to-hand
            legGauge: 4.8, legLen: 39,   // legs run a slightly heavier gauge
            fistGauge: 6.0,              // the punch arm tenses thicker
    fistGrow: 0.85,             // how much the glove swells at full extension
            fistBase: 14, fistReach: 30, // wind-up length -> full extension
            armSwing: 0.30,              // walk swing (0.6 read as flapping)
            bodyH: bodyH,
            armY: DK.by + DK.bh - bodyH / 2, // shoulders at the drum's center height
            armX: 20,                        // leading shoulder (throws the punch)
            idleArm: Math.PI * 12 / 180,     // slight outward splay at rest
            // ---- Hand-drawn punch poses ------------------------------------
            // Body+legs are ONE drawing (the lean, the plant, the angry face
            // are all baked in); only the punching arm is still solved by IK
            // so the glove lands on the tile he actually hits.
            //
            // shX/shY is the SHOULDER as a fraction of the pose's own box, and
            // it has to sit on the drum — Carl picked each one off a labelled
            // grid over the art (side D6, down E5, up C6), all of which land
            // mid-drum. `h` height-matches the standing rig. He stays one-armed
            // through a punch: the other arm is simply on his far side.
            //
            // EVERY punch is thrown by the FRONT arm, so the limb always draws
            // OVER the body and swings across his front. `minExt` then holds
            // the fist a little way out of the shoulder even at the very start
            // of the throw, otherwise the first frame stamps the glove over
            // his own face.
            punchPose: (DONK_IMG.buzzPunchBody && DONK_IMG.buzzPunchArm) ? {
                body: mkBody(DONK_IMG.buzzPunchBody),
                arm: mk(DONK_IMG.buzzPunchArm, 262, 512, 81, 0.405, 0.556),
                h: 72.4, solesAt: 0.9994, drumCx: 0.508,
                shX: 118 / 359, shY: 197 / 512, gauge: 5.03, armLen: 31.8,
                front: true, minExt: 0.22,
            } : null,
            downPose: (DONK_IMG.buzzDownBody && DONK_IMG.buzzDownArm) ? {
                body: mkBody(DONK_IMG.buzzDownBody),
                arm: mk(DONK_IMG.buzzDownArm, 221, 512, 68, 0.6445, 0.493),
                h: 75, solesAt: 0.998, drumCx: 0.630,
                shX: 157 / 427, shY: 157 / 512, gauge: 5.2, armLen: 39,
                front: true, minExt: 0.22,
            } : null,
            upPose: (DONK_IMG.buzzUpBody && DONK_IMG.buzzPunchArm) ? {
                body: mkBody(DONK_IMG.buzzUpBody),
                // The glove comes from the SIDE punch, not from the up-punch
                // drawing: that one is a knuckles-on view with four fingers
                // showing, so BUZZ appeared to swap hands mid-fight. The hose
                // is stroked procedurally, so borrowing the hand slice costs
                // nothing. (buzz-up-arm.png is still in assets if we want it.)
                arm: mk(DONK_IMG.buzzPunchArm, 262, 512, 81, 0.405, 0.556),
                h: 72.4, solesAt: 1, drumCx: 0.414,
                shX: 79 / 408, shY: 197 / 512, gauge: 5.4, armLen: 38.8,
                front: true,
                // Carl: the up punch is an UPPERCUT — fist cocked low in front
                // of the drum, then swinging up past his face on a curve, with
                // the walking arm's roundness rather than a straight rod.
                arc: { from: [16, 16], ctrl: [34, -26] }, bow: 0.35,
                // Aim dead at the cell centre like the others — with the fist
                // now centred on its target rather than tip-first, it clears
                // his head on its own.
            } : null,
        };
    }
    return DONK_HERO;
}

// ============================================================
// RUBBER-HOSE IK — BUZZ's rig
// The HAND is the end effector: it goes where we point it, and the hose is a
// constant-arc-length curve between shoulder and wrist, so slack makes it BOW
// and reaching straightens it. That's what makes the limbs read as fluid hose
// instead of rigid sticks on pivots. Feet are planted on the ground line, so
// the body dips through the stride on its own.
// ============================================================
const HOSE_INK = "#312D2F"; // sampled from the art's own hose
// Classic rubber-hose glove darts, drawn in the GLOVE's own normalised space
// (x across the glove, y from wrist 0 to fingertips 1) so they scale, rotate
// and stretch with the hand instead of being baked into the art. Two darts —
// Carl dropped the third.
const GLOVE_DARTS = {
    ts: [-1, 0],     // which dart slots to draw
    x0: 0.5, spread: 0.13, fan: 1.2,
    yTop: 0.24,      // floats clear of the cuff
    yBot: 0.41,
    curve: 0.05, lw: 0.035,
};
function drawGloveDarts(hw, hh, px, k) {
    const d = GLOVE_DARTS;
    ctx.strokeStyle = HOSE_INK;
    ctx.lineCap = "round";
    ctx.lineWidth = d.lw * hw * k;
    for (const t of d.ts) {
        const sx = (d.x0 + t * d.spread) * hw, sy = d.yTop * hh;
        const ex = (d.x0 + t * d.spread * d.fan) * hw, ey = d.yBot * hh;
        const cx = (sx + ex) / 2 + d.curve * hw * t, cy = (sy + ey) / 2;
        ctx.beginPath();
        ctx.moveTo((sx - hw * px) * k, sy * k);
        ctx.quadraticCurveTo((cx - hw * px) * k, cy * k, (ex - hw * px) * k, ey * k);
        ctx.stroke();
    }
}
const BZ = {
    // Leg pivots sit exactly where the legs EMERGE from the drum silhouette
    // (measured off the art: y -24.17, x -5.0 / +6.2), rather than buried deep
    // inside the body. anchorX/legSplit place them; each leg then swings about
    // ITS OWN pivot, which is what keeps both extremes mirror images.
    anchorX: 0.6,
    legSplit: 5.6,
    footOut: 1.0,   // how far outside its pivot each foot parks when standing
    stride: 12, legLift: 0, legGauge: 5.76, legLen: 24.2,
    dip: 6,         // how far the body ducks at full spread; the legs stretch for the rest
    frontExtend: 0.25,  // how much further the forward foot reaches
    frontStraight: 0.3, // how much slack the forward leg gives up (straightens it)
    extremes: 0.55, // <1 holds the spread pose, snaps through the pass
    armX: 16, armXTrail: 18, armGauge: 4.2,
    armLen: 40,          // longer than the old 31 — an elbow needs hose to bend
    armReach: 0.88,      // hand distance as a fraction of armLen (leaves a crook)
    armRest: 0.209,      // rad both arms lean FORWARD at rest (12 deg)
    armSwingAng: 0.38,   // rad of fore/aft swing while walking
    boneBow: 0.35,       // how rounded each bone is (0 = straight sticks)
    elbowAt: 0.5,        // where the joint sits along the hose
    frontGloveFlip: false, // front glove: horizontal mirror off (rear arm's orientation)
    fistGauge: 6.0, fistBase: 12, fistReach: 32,
    hip2bot: 0.62,                 // drum bottom, relative to the pivot line
    shoulder: -23.39,              // shoulder height relative to the pivot line
};

// Solve one limb: draw the hose from (sx,sy) to a wrist placed so the HAND
// lands on the target, then stamp the hand aligned to the hose's end tangent.
function hoseIK(m, gauge, sx, sy, tx, ty, L, bow, k, flip, handScale) {
    // Limb art loads asynchronously, so a meta can still be null on the first
    // frames. Before the story scenes were removed there were ~30 seconds of
    // cutscene to hide that; now the room is on screen almost immediately and
    // it threw on every load. Nothing to draw yet is not an error.
    if (!m) return;
    // handScale grows the HAND without thickening the hose — the classic
    // cartoon punch reads as a big glove on a thin arm.
    const hs = handScale || 1;
    const s = gauge / m.hose, handH = m.ah * (1 - m.split) * s * hs, handW = m.aw * s * hs;
    let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 0.001;
    const maxD = L * 1.12;                    // cannot reach past full extension
    if (d > maxD) { const f = maxD / d; dx *= f; dy *= f; d = maxD; tx = sx + dx; ty = sy + dy; }
    const ang = Math.atan2(dy, dx);
    const wristD = Math.max(d * 0.2, d - handH);
    const wx = sx + Math.cos(ang) * wristD, wy = sy + Math.sin(ang) * wristD;
    const rest = Math.max(1, L - handH);
    const amp = Math.min(rest * 0.6, Math.max(0, rest - wristD) * 1.7) * bow;
    const cx2 = (sx + wx) / 2 - Math.sin(ang) * amp, cy2 = (sy + wy) / 2 + Math.cos(ang) * amp;
    ctx.strokeStyle = HOSE_INK;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = gauge * k;
    ctx.beginPath();
    ctx.moveTo(sx * k, sy * k);
    ctx.quadraticCurveTo(cx2 * k, cy2 * k, wx * k, wy * k);
    ctx.stroke();
    const ta = Math.atan2(wy - cy2, wx - cx2); // end tangent orients the hand
    ctx.save();
    ctx.translate(wx * k, wy * k);
    ctx.rotate(ta - Math.PI / 2);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(m.img, 0, m.ah * m.split, m.aw, m.ah * (1 - m.split),
        -handW * m.px * k, 0, handW * k, handH * k);
    ctx.restore();
    return { x: tx, y: ty };
}

// Two-bone arm. The ELBOW is solved as a mathematical point (law of cosines),
// but each bone is drawn as a CURVE and both are stroked as one continuous
// path — so it reads as a bent hose, not two sticks. bendSign +1 points the
// elbow backward (away from his facing).
function armIK(m, gauge, sx, sy, tx, ty, L, bendSign, k, flip, uf, boneBow, handScale, darts, smear) {
    // Limb art loads asynchronously, so a meta can still be null on the first
    // frames. Before the story scenes were removed there were ~30 seconds of
    // cutscene to hide that; now the room is on screen almost immediately and
    // it threw on every load. Nothing to draw yet is not an error.
    if (!m) return;
    const hs = handScale || 1;
    const s = gauge / m.hose, handH = m.ah * (1 - m.split) * s * hs, handW = m.aw * s * hs;
    const hoseLen = Math.max(2, L - handH);
    const u = uf === undefined ? 0.5 : uf;
    const L1 = hoseLen * u, L2 = hoseLen * (1 - u);
    const d0 = Math.hypot(tx - sx, ty - sy) || 0.001;
    const a0 = Math.atan2(ty - sy, tx - sx);
    const wristD = Math.max(d0 * 0.2, d0 - handH);
    let wx = sx + Math.cos(a0) * wristD, wy = sy + Math.sin(a0) * wristD;
    let d = Math.hypot(wx - sx, wy - sy);
    d = Math.max(Math.abs(L1 - L2) + 0.001, Math.min(L1 + L2 - 0.001, d));
    const ang = Math.atan2(wy - sy, wx - sx);
    wx = sx + Math.cos(ang) * d; wy = sy + Math.sin(ang) * d;
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const ex = sx + Math.cos(ang) * a - Math.sin(ang) * h * bendSign;
    const ey = sy + Math.sin(ang) * a + Math.cos(ang) * h * bendSign;
    const seg = (ax, ay, bx, by, amt) => {
        const t2 = Math.atan2(by - ay, bx - ax);
        return [(ax + bx) / 2 - Math.sin(t2) * amt, (ay + by) / 2 + Math.cos(t2) * amt];
    };
    const bb = boneBow === undefined ? 0.35 : boneBow;
    const c1 = seg(sx, sy, ex, ey, L1 * bb * bendSign);
    const c2 = seg(ex, ey, wx, wy, L2 * bb * bendSign);
    ctx.strokeStyle = HOSE_INK;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = gauge * k;
    ctx.beginPath();
    ctx.moveTo(sx * k, sy * k);
    ctx.quadraticCurveTo(c1[0] * k, c1[1] * k, ex * k, ey * k);
    ctx.quadraticCurveTo(c2[0] * k, c2[1] * k, wx * k, wy * k);
    ctx.stroke();
    const ta = Math.atan2(wy - c2[1], wx - c2[0]);
    ctx.save();
    ctx.translate(wx * k, wy * k);
    ctx.rotate(ta - Math.PI / 2);
    if (flip) ctx.scale(-1, 1);
    // SMEAR: on the fast frames the glove stretches along its travel and
    // pinches across it — deformation, not blur, which is how a cel animator
    // draws speed. It costs nothing and it's the difference between a jab and
    // a hand teleporting.
    if (smear) ctx.scale(1 / (1 + smear * 0.5), 1 + smear);
    ctx.drawImage(m.img, 0, m.ah * m.split, m.aw, m.ah * (1 - m.split),
        -handW * m.px * k, 0, handW * k, handH * k);
    if (darts) drawGloveDarts(handW, handH, m.px, k);
    ctx.restore();
}

// BUZZ, drawn with his soles on (cx, cy). k = height/58.
function drawBuzzRig(cx, cy, k, o) {
    const set = heroSet();
    // Every piece below is drawn from this set, so there is nothing to do until
    // the art has loaded. He is absent for a frame or two on a cold load rather
    // than throwing his way through the render — which is what happened once the
    // story scenes stopped covering those first seconds.
    if (!set || !set.body) return;
    const bodyH = set.bodyH, t = o.punchThrust || 0, ph = o.phase || 0;
    const w = o.walk !== undefined ? o.walk : (o.moving ? 1 : 0); // 0..1, eased
    // Each leg runs a half-cycle out of phase; the swinging leg LIFTS, which is
    // what keeps the passing position readable instead of a jumble.
    const legPh = s => ph + (s > 0 ? 0 : Math.PI);
    // Favour the EXTREMES (Carl: the quarter-spread is the pose worth holding).
    // A linear phase gives every pose equal screen time, so the weak
    // in-betweens read as loudly as the strong one. Shaping the swing holds
    // the spread and snaps through the pass, the way cartoon walks do.
    const shape = v => Math.sign(v) * Math.pow(Math.abs(v), BZ.extremes);
    // The legs STRETCH to reach the ground rather than the body ducking to
    // meet them — it's rubber hose, and it buys back the full stride from a
    // pivot that now sits at the body's edge. The body still dips a little.
    const hipH = BZ.legLen - BZ.dip * Math.abs(shape(Math.sin(ph))) * w;
    ctx.save();
    ctx.translate(cx, cy);
    if (o.mirror) ctx.scale(-1, 1);
    if (o.flash) ctx.filter = "brightness(1.9) saturate(0.4)";

    // ---- Hand-drawn punch pose -------------------------------------------
    // While punching, the whole standing rig is replaced by Carl's pose
    // drawing — sideways, upward and downward each have their own. The pose
    // cuts in on frame one rather than easing; the wind-up is the ARM, which
    // starts short at the shoulder and extends to the target as the punch
    // travels. A hard pose change with a stretching limb is what a rubber-hose
    // punch does.
    const pose = t > 0 ? (o.punchDir === 1 ? set.upPose
        : o.punchDir === 0 ? (set.downPose || set.punchPose) : set.punchPose) : null;
    if (pose && pose.arm) {
        const im = pose.body, bh = pose.h, bw = bh * (im.width / im.height);
        const x0 = -pose.drumCx * bw, y0 = -bh * pose.solesAt;
        const shx = x0 + pose.shX * bw, shy = y0 + pose.shY * bh;
        const tx = o.punchTX !== undefined ? o.punchTX : shx + 40;
        const ty = (o.punchTY !== undefined ? o.punchTY : shy) - (pose.aimLift || 0);
        // `arc` makes it an UPPERCUT: the fist starts cocked low in front of
        // him and swings up to the target along a curve (quadratic through a
        // control point out front), instead of travelling straight out from
        // the shoulder. Paired with a fatter `bow` the limb keeps the curve of
        // the walking arm rather than snapping into a rod.
        let hx, hy;
        if (pose.arc) {
            const sx1 = shx + pose.arc.from[0], sy1 = shy + pose.arc.from[1];
            const cx1 = shx + pose.arc.ctrl[0], cy1 = shy + pose.arc.ctrl[1];
            const m = 1 - t;
            hx = m * m * sx1 + 2 * m * t * cx1 + t * t * tx;
            hy = m * m * sy1 + 2 * m * t * cy1 + t * t * ty;
        } else {
            const e = pose.minExt ? pose.minExt + (1 - pose.minExt) * t : t;
            hx = shx + (tx - shx) * e; hy = shy + (ty - shy) * e;
        }
        // Cartoon punch: the glove is the whole gag, so it renders at roughly
        // twice the arm's natural hand size and swells further on impact.
        const hs = 1.8 + t * 0.25;
        // armIK lands the FAR TIP of the hand on its target, but the fist has
        // to land in the MIDDLE of the block he's hitting — measured off all
        // three gloves, their ink centres sit at 0.50 of the hand slice — so
        // the aim point is pushed half a glove past the cell centre. At this
        // glove size the difference is most of a tile.
        const half = pose.arm.ah * (1 - pose.arm.split) *
            (pose.gauge / pose.arm.hose) * hs * 0.5;
        const dx2 = hx - shx, dy2 = hy - shy, dd = Math.hypot(dx2, dy2) || 1;
        const ax = hx + dx2 / dd * half, ay = hy + dy2 / dd * half;
        const need = Math.hypot(ax - shx, ay - shy);
        const throwArm = () => armIK(pose.arm, pose.gauge, shx, shy, ax, ay,
            Math.max(pose.armLen * 0.5, need * 1.02), 1, k, false, 0.5,
            pose.bow === undefined ? 0.12 : pose.bow, hs, false,
            Math.min(0.6, (o.punchVel || 0) * 1.1));
        if (!pose.front) throwArm();
        ctx.drawImage(im, x0 * k, y0 * k, bw * k, bh * k);
        if (pose.front) throwArm();
        const tmp = ctx.getTransform(); // real fist position, for the impact FX
        donkFistTip = { x: tmp.a * hx * k + tmp.c * hy * k + tmp.e,
                        y: tmp.b * hx * k + tmp.d * hy * k + tmp.f };
        ctx.restore();
        return;
    }

    const hipY = -hipH, armY = hipY + BZ.shoulder;

    // Audience-left leg draws LAST so it sits in FRONT of the right one.
    // (Sides are audience-relative in the right-facing orientation; the rig
    // mirror carries the same near/far leg over when he turns.)
    for (const side of [1, -1]) {
        // Walking, the feet swing on the CENTRELINE: any constant lateral
        // offset compounds with the stride, so one half-cycle opens while the
        // other crosses into an X — a limp, not a walk. Standing, they part
        // into a stance. Shoes are never mirrored per side: both point the way
        // he faces.
        const px = BZ.anchorX + side * BZ.legSplit;
        // The leg stepping FORWARD reaches further and straightens out. Left
        // bowed it reads as a kick rather than a step, because a forward leg
        // with slack in it looks like a flicking knee.
        const fwd = Math.max(0, Math.sin(legPh(side))) * w;
        const swingX = shape(Math.sin(legPh(side))) * BZ.stride * (1 + BZ.frontExtend * fwd);
        const fx = px + side * BZ.footOut * (1 - w) + swingX * w;
        const fy = -Math.max(0, -Math.cos(legPh(side))) * BZ.legLift * w;
        const need = Math.hypot(fx - px, fy - hipY); // stretch only as far as reaching demands
        const restLen = BZ.legLen * (1 - BZ.frontStraight * fwd); // less slack out front
        hoseIK(set.legMeta, BZ.legGauge, px, hipY, fx, fy, Math.max(restLen, need),
            -side * 0.3 * (1 - fwd * 0.75), k, false);
    }
    // Arms swing as an ARC about the shoulder — the hand is the end effector,
    // the elbow falls out of the two-bone solve, and the pair oppose.
    const handAt = (shX, ang) => [shX + Math.sin(ang) * BZ.armLen * BZ.armReach,
                                  armY + Math.cos(ang) * BZ.armLen * BZ.armReach];
    const swingA = Math.sin(ph) * BZ.armSwingAng * w;
    if (!(t > 0)) {
        const p1 = handAt(BZ.armX, BZ.armRest - swingA);
        armIK(set.armMeta, BZ.armGauge, BZ.armX, armY, p1[0], p1[1], BZ.armLen,
            1, k, false, BZ.elbowAt, BZ.boneBow);
    }
    ctx.drawImage(set.body, DK.bx * k, (hipY + BZ.hip2bot - bodyH) * k, DK.bw * k, bodyH * k);
    {
        const p2 = handAt(-BZ.armXTrail, BZ.armRest + swingA);
        // Front glove flipped horizontally (Carl) — the hose is drawn separately,
        // so this only mirrors the hand slice.
        armIK(set.armCleanMeta || set.armMeta, BZ.armGauge, -BZ.armXTrail, armY,
            p2[0], p2[1], BZ.armLen, 1, k, BZ.frontGloveFlip, BZ.elbowAt, BZ.boneBow,
            1, true); // darts: the front hand shows the back of the glove
    }
    if (t > 0) {
        // The hand flies to the TARGET CELL (passed in rig-local units) and the
        // hose whips out behind it — bowed on the way, straight on impact.
        const sx = BZ.armX, sy = armY;
        const tx = o.punchTX !== undefined ? o.punchTX : sx + 30;
        const ty = o.punchTY !== undefined ? o.punchTY : sy;
        const hx = sx + (tx - sx) * t, hy = sy + (ty - sy) * t;
        const need = Math.hypot(hx - sx, hy - sy);
        hoseIK(set.fistMeta, BZ.fistGauge, sx, sy, hx, hy,
            Math.max(BZ.fistBase, need), -0.55 * (1 - t), k, false,
            1 + t * BZ.fistGrow); // fist swells toward the camera as it lands
        const tm = ctx.getTransform(); // real fist tip, for the impact FX
        donkFistTip = { x: tm.a * hx * k + tm.c * hy * k + tm.e,
                        y: tm.b * hx * k + tm.d * hy * k + tm.f };
    }
    ctx.restore();
}

// Draw Donk with his feet at device-px (cx, cy), scaled by k = height/58.
// Two sine waves at deliberately incommensurate rates (walk 0.005, pulse
// 0.006 — matched rates read as mechanical), one table of numbers.
function drawDonk(cx, cy, k, o) {
    const set = (o.hero && DONK_IMG.hero) ? heroSet()
        : (o.tint && DONK_TINT[o.tint] && DONK_TINT[o.tint].body) ? DONK_TINT[o.tint] : DONK_IMG;
    const ph = (o.phase !== undefined ? o.phase : perfNow * 0.005) + (o.wob || 0);
    const sw = Math.sin(ph) * (o.stand ? 0.22 : 1); // blocked Donk marks time at 22%
    ctx.save();
    ctx.translate(cx, cy);
    if (o.mirror) ctx.scale(-1, 1);
    if (o.flash) ctx.filter = "brightness(1.9) saturate(0.4)";

    // ---- Limbs -----------------------------------------------------------
    // Straight-hose art draws in two slices: the HOSE stretches to reach and
    // the HAND keeps its natural aspect, so a limb can be any length without
    // squashing the glove. `gauge` is the rendered hose thickness — shared
    // across pieces so arms and legs read as the same character.
    const limbSlice = (m, gauge, len) => {
        if (!m) return;
        const s = gauge / m.hose, w = m.aw * s;
        const handH = m.ah * (1 - m.split) * s;
        const hoseH = Math.max(0, len - handH);
        const x = -m.px * w, sp = m.ah * m.split;
        ctx.drawImage(m.img, 0, 0, m.aw, sp,          x * k, 0,         w * k, hoseH * k);
        ctx.drawImage(m.img, 0, sp, m.aw, m.ah - sp,  x * k, hoseH * k, w * k, handH * k);
    };

    const ls = o.legScale || 1;
    const LM = set.legMeta;
    const legLen = LM ? (set.legLen || 39) * ls : DK.legH * ls * (1 - DK.legPY);
    ctx.translate(0, -(legLen - 31.4) * k);

    const legAt = (hx, hy, rot) => {
        ctx.save();
        ctx.translate(hx * k, hy * k);
        ctx.rotate(rot);
        if (LM) limbSlice(LM, (set.legGauge || 4.8) * ls, legLen);
        else ctx.drawImage(set.leg, -DK.legW * ls * DK.legPX * k, -DK.legH * ls * DK.legPY * k,
            DK.legW * ls * k, DK.legH * ls * k);
        ctx.restore();
    };

    const armMX = set.armX !== undefined ? set.armX : 22;
    const armMY = set.armY !== undefined ? set.armY : -31;
    const armIdle = set.idleArm || 0;
    const armSwing = set.armSwing !== undefined ? set.armSwing : 0.6;
    const AM = set.armMeta;
    // Which way the art faces decides which shoulder LEADS. BUZZ's pieces face
    // +x; Donk's face -x. The leading arm tucks behind the body and throws the
    // punch; the trailing arm rests in front of the shell.
    const lead = set.leadSign || -1;
    const armXTrail = set.armXTrail !== undefined ? set.armXTrail : armMX;
    const armAt = (front, swing) => {
        const mx = front ? -lead * armXTrail : lead * armMX;
        ctx.save();
        ctx.translate(mx * k, armMY * k);           // shoulder mount
        if (front) ctx.scale(-1, 1);                // art mirrors for this side
        ctx.rotate(swing + (front ? armIdle : -armIdle));
        if (AM) limbSlice(AM, set.armGauge || 4.2, set.armLen || 32);
        else {
            const as_ = set.armScale || 1, ast = set.armStretch || 1, ath = set.armThick || 1;
            const aw = DK.armW * as_ * ath, ah = DK.armH * as_ * ast;
            ctx.drawImage(set.arm, -aw * DK.armPX * k, -ah * DK.armPY * k, aw * k, ah * k);
        }
        ctx.restore();
    };

    // Legs — hips o.hipX apart (default 9), 31.4 up inside the shell.
    // The swing is atan2(displacement, leg length), NOT a raw angle:
    // converting a horizontal displacement through the leg keeps the sole
    // grounded. Stride amplitude (o.stride) is INDEPENDENT of hip width —
    // a fast walker's feet swing past the midline, and tying the two
    // together made narrow hips waddle.
    const hipX = o.hipX !== undefined ? o.hipX : 9;
    const strideAmp = o.stride !== undefined ? o.stride : 8;
    legAt(-hipX, -31.4, Math.atan2(sw * -strideAmp, legLen));
    legAt(hipX, -31.4, Math.atan2(sw * strideAmp, legLen));

    // Step bob: carries everything above the hips
    ctx.translate(0, -Math.abs(sw) * 1.8 * k);

    // LEADING arm — counter-swings BEHIND the body (the punch replaces it)
    if (!(set.fistMeta && (o.punchThrust || 0) > 0)) armAt(false, -sw * armSwing);

    // Drumhead pulse, scaled about its own BOTTOM edge (scale about the
    // centre and the head visibly detaches from the shell). Only for sets
    // with a separate drumhead piece — the hero's face is baked into the body.
    if (set.button) {
        const p01 = 0.5 + 0.5 * Math.sin(perfNow * 0.006 + (o.wob || 0));
        ctx.save();
        ctx.translate(0, DK.btnBot * k);
        ctx.scale(1, 0.86 + 0.28 * p01);
        ctx.translate(0, -DK.btnBot * k);
        ctx.drawImage(set.button, DK.bx * k, DK.by * k, DK.bw * k, DK.bh * k);
        ctx.restore();
    }

    // Body: bottom edge stays put so hips and shoulders line up for any
    // body height (the hero drum is taller than Donk's shell)
    const bodyH = set.bodyH || DK.bh;
    ctx.drawImage(set.body, DK.bx * k, (DK.by + DK.bh - bodyH) * k, DK.bw * k, bodyH * k);
    // TRAILING arm rests IN FRONT of the shell (Carl: facing right, the
    // audience-left arm reads in front).
    armAt(true, -sw * armSwing);

    // PUNCH — always thrown from the LEADING shoulder in the direction he
    // faces, so he never punches behind himself. Down tilts forward to clear
    // his own legs.
    const FM = set.fistMeta, thrust = o.punchThrust || 0;
    if (FM && thrust > 0) {
        const up = o.punchDir === 1, down = o.punchDir === 0;
        const ang = up ? Math.PI : down ? (lead * -22 * Math.PI / 180) : (lead * -Math.PI / 2);
        const reach = (set.fistBase || 14) + thrust * (set.fistReach || 30);
        ctx.save();
        ctx.translate(lead * armMX * k, armMY * k);
        ctx.rotate(ang);
        limbSlice(FM, set.fistGauge || 6.0, reach);
        const tm = ctx.getTransform(); // hand the real fist tip to the impact FX
        donkFistTip = { x: tm.c * reach * k + tm.e, y: tm.d * reach * k + tm.f };
        ctx.restore();
    }

    ctx.restore();
}

function drawGoblinSprite(type, gx, gy, frame, options) {
    const opts = options || {};
    const dir = opts.dir !== undefined ? opts.dir : 0;
    const showShadow = opts.showShadow !== false;
    const bob = (frame % 2 === 1 ? 1 : 0) * SCALE;

    // ---- Donk path (drum enemy) ----
    // The catapult keeps its procedural crew until the machine gets its
    // own treatment; everything else walks as Donk once the art loads.
    if (donkReady && type !== "catapult") {
        if (showShadow) {
            ctx.fillStyle = PAL.shadow;
            ctx.beginPath();
            ctx.ellipse((gx + TILE / 2) * SCALE, (gy + TILE - 1.5) * SCALE,
                7 * SCALE, 2.2 * SCALE, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        drawDonk((gx + TILE / 2) * SCALE, (gy + TILE - 2) * SCALE,
            // 50% taller than they were (66 -> 99, elite 78 -> 117). They used
            // to stand SHORTER than BUZZ, which undercut them — a Donk now
            // looms over him, and an elite properly towers.
            (type === "elite" ? 117 : 99) / 58 * RIG, {
                wob: opts.phase !== undefined ? 0 : (opts.wob || 0),
                phase: opts.phase,
                stride: 12,
                mirror: opts.face !== undefined ? opts.face === 1 : dir === 3, // sticky horizontal facing
                stand: opts.stand,
                flash: opts.bodyCol === "#ffffff", // hurt + windup telegraph flashes
                tint: type === "elite" ? "elite" : null,
            });
        return;
    }

    // ---- Procedural fallback ----
    // Colors — allow overrides (for hurt flash, HP changes)
    let bodyCol, darkCol, headCol, eyeCol;
    if (opts.bodyCol) {
        bodyCol = opts.bodyCol; darkCol = opts.darkCol; headCol = opts.headCol; eyeCol = opts.eyeCol;
    } else if (type === "elite") {
        bodyCol = "#c05838"; darkCol = darker(INK.rust, 0.35); headCol = INK.rust; eyeCol = INK.mint;
    } else if (type === "catapult") {
        // Catapult crew: the one character still drawn procedurally, so it
        // gets the ink palette by hand until it earns real art
        bodyCol = INK.rust; darkCol = "#8c5326"; headCol = "#d59258"; eyeCol = INK.mustard;
    } else {
        bodyCol = "#50ad33"; darkCol = darker(INK.green, 0.3); headCol = lighter(INK.green, 0.35); eyeCol = "#c05838";
    }

    // Screen-pixel base position
    const sx = gx * SCALE;
    const sy = gy * SCALE;
    let bodyOffX = 0, bodyOffY = 0;

    function px(x, y, w, h, color) {
        drawPx(sx + bodyOffX + x, sy + bodyOffY + y - bob, w, h, color);
    }

    // Shadow — an ellipse at the feet rather than a bar under them, same
    // treatment BUZZ gets, so the Donks stand in the room instead of sitting
    // on it like decals.
    if (showShadow) {
        contactShadow(gx + TILE / 2, gy + TILE - 1.5, 4.6, 1.6);
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
        ctx.fillStyle = "#3a3a37";
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
        ctx.fillStyle = INK.paper;
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
        ctx.fillStyle = INK.mint;
        ctx.globalAlpha = shimmerAlpha;
        ctx.fillRect(sx, (sy - 18 * 1) - bob, 48, 60);
        ctx.globalAlpha = 1.0;
    }
}

function drawCatapultGoblin() {
    const cg = catapultGoblin;
    if (!cg) return;

    drawGoblinSprite("catapult", cg.x, cg.y,
        cg.danceTimer > 0 ? Math.floor(cg.danceTimer / 4) % 4 : cg.frame,
        { dir: cg.danceTimer > 0 ? 0 : cg.dir });

    // GROOVED! Music notes while the catapult crew dances
    if (cg.danceTimer > 0) {
        for (let ni = 0; ni < 2; ni++) {
            const nPhase = (180 - cg.danceTimer + ni * 30) % 60;
            ctx.globalAlpha = (1 - nPhase / 60) * 0.9;
            ctx.font = gfont(5 * SCALE);
            ctx.fillStyle = ni === 0 ? "#50ad33" : INK.mustard;
            ctx.fillText(ni === 0 ? "♪" : "♫",
                (cg.x + (ni === 0 ? 1 : 11)) * SCALE,
                (cg.y - 6 - nPhase * 0.3) * SCALE);
        }
        ctx.globalAlpha = 1.0;
    }

    // Landing warning: mark the 3x3 blast zone from aiming through impact
    // so the direct-hit freeze is dodgeable
    if ((cg.phase === "aiming" || cg.phase === "firing") && cg.targetRow >= 0) {
        const warnT = cg.boulder ? cg.boulder.progress : 0; // intensity ramps in flight
        const tgtX = (GRID_X + cg.targetCol) * TILE;
        const tgtY = rowPixelY(cg.targetRow);
        // Growing shadow at the impact cell
        const cxp = (tgtX + TILE / 2) * SCALE;
        const cyp = (tgtY + TILE / 2) * SCALE;
        const growR = (3 + warnT * 6) * SCALE;
        ctx.globalAlpha = 0.2 + warnT * 0.35;
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.ellipse(cxp, cyp, growR, growR * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pulsing red ring around the full 3x3 blast area
        const warnPulse = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;
        ctx.globalAlpha = warnPulse * (0.35 + warnT * 0.45);
        ctx.strokeStyle = "#FF4444";
        ctx.lineWidth = 2 * SCALE;
        ctx.strokeRect((tgtX - TILE) * SCALE, (tgtY - TILE) * SCALE, TILE * 3 * SCALE, TILE * 3 * SCALE);
        ctx.globalAlpha = 1.0;
    }

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
                        ctx.fillStyle = "#BF7538";
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

// A flat ellipse of ink on the floor, at the feet. The only depth cue in the
// room used to be a 4px rectangle under BUZZ and nothing at all under anybody
// else, so the Donks read as decals rather than as things standing in the room
// with him.
//
// Flat fill, no blur — the same reason the surfaces have no gradients. A soft
// shadow is a render; this world is a print, and a printed shadow is a shape.
// Two stacked ellipses give it a core and a penumbra without touching a blur.
function contactShadow(cx, cy, rx, ry) {
    ctx.save();
    ctx.fillStyle = INK.charcoal;
    ctx.globalAlpha = 0.13;
    ctx.beginPath();
    ctx.ellipse(cx * SCALE, cy * SCALE, rx * SCALE, ry * SCALE, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.ellipse(cx * SCALE, cy * SCALE, rx * 0.62 * SCALE, ry * 0.62 * SCALE, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawGoblinFor(g) {
    // Sticky horizontal facing for the Donk rig: vertical movement keeps
    // whichever way this goblin last faced
    if (g.dir === 2) g.donkFace = -1;
    else if (g.dir === 3) g.donkFace = 1;
    // Distance-locked stride, same treatment as the player: legs cover
    // ground at the speed this goblin actually moves. (The coaster's
    // time-based amble was tuned for an enemy on screen for seconds.)
    let gDist = 0;
    if (g.donkLastX !== undefined) {
        gDist = Math.abs(g.x - g.donkLastX) + Math.abs(g.y - g.donkLastY);
        if (gDist > 8) gDist = 0; // teleport (respawn), not a step
    }
    g.donkLastX = g.x; g.donkLastY = g.y;
    g.donkMoving = gDist > 0.05;
    if (g.donkPhase === undefined) g.donkPhase = g.wob || 0; // desync folded in
    g.donkPhase = g.donkMoving ? g.donkPhase + gDist * 0.44 : donkSettlePhase(g.donkPhase);
    // Color palette: elite changes color based on HP
    let bodyCol, darkCol, headCol, eyeCol;
    if (g.hurtTimer > 0 && g.hurtTimer % 4 < 2) {
        bodyCol = "#ffffff"; darkCol = "#dddddd"; headCol = "#ffffff"; eyeCol = INK.mint;
    } else if (g.elite && g.windupTimer > 0 && g.windupTimer % 8 < 4) {
        // Punch telegraph: rapid white flash during wind-up
        bodyCol = "#ffffff"; darkCol = "#ffdddd"; headCol = "#ffffff"; eyeCol = INK.red;
    } else if (!g.elite) {
        bodyCol = "#50ad33"; darkCol = darker(INK.green, 0.3); headCol = lighter(INK.green, 0.35); eyeCol = "#c05838";
    } else if (g.hp === 3) {
        bodyCol = "#c05838"; darkCol = darker(INK.rust, 0.35); headCol = INK.rust; eyeCol = INK.mint;
    } else if (g.hp === 2) {
        bodyCol = darker(INK.rust, 0.35); darkCol = "#990099"; headCol = "#DD33DD"; eyeCol = "#FF3333";
    } else {
        bodyCol = INK.red; darkCol = darker(INK.red, 0.3); headCol = lighter(INK.red, 0.25); eyeCol = INK.mint;
    }

    // GROOVED! Silly involuntary dance — hip-wobble, fast footwork, music notes
    const dancing = g.danceTimer > 0;
    if (dancing) {
        ctx.save();
        const dcx = (g.x + g.w / 2) * SCALE;
        const dcy = (g.y + g.h) * SCALE; // pivot at the feet for a hip wiggle
        ctx.translate(dcx, dcy);
        ctx.rotate(Math.sin(g.danceTimer * 0.35) * 0.28);
        // Little bounce on the off-wobble
        ctx.scale(1, 1 + Math.abs(Math.sin(g.danceTimer * 0.35)) * 0.08);
        ctx.translate(-dcx, -dcy);
    }

    drawGoblinSprite(g.elite ? "elite" : "normal", g.x, g.y,
        dancing ? Math.floor(g.danceTimer / 4) % 4 : g.frame, {
        dir: dancing ? 0 : g.dir, bodyCol, darkCol, headCol, eyeCol,
        face: g.donkFace, phase: g.donkPhase
    });

    if (dancing) {
        ctx.restore();
        // Rising music notes
        for (let ni = 0; ni < 2; ni++) {
            const nPhase = (180 - g.danceTimer + ni * 30) % 60;
            ctx.globalAlpha = (1 - nPhase / 60) * 0.9;
            ctx.font = gfont(5 * SCALE);
            ctx.fillStyle = ni === 0 ? "#50ad33" : INK.mustard;
            ctx.fillText(ni === 0 ? "♪" : "♫",
                (g.x + (ni === 0 ? 1 : 11)) * SCALE,
                (g.y - 6 - nPhase * 0.3) * SCALE);
        }
        ctx.globalAlpha = 1.0;
    }

    // Damage flash: bright white burst when hurt
    if (g.hurtTimer > 8) {
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = (g.hurtTimer - 8) / 4 * 0.6;
        ctx.fillRect((g.x - 2) * SCALE, (g.y - 6) * SCALE, (g.w + 4) * SCALE, (g.h + 8) * SCALE);
        ctx.globalAlpha = 1.0;
    }

    // Punch telegraph: pulsing red "!" above the elite during wind-up
    if (g.elite && g.windupTimer > 0) {
        const wuPulse = 1 + Math.sin(g.windupTimer * 0.5) * 0.2;
        ctx.font = gfont(Math.round(9 * SCALE * wuPulse));
        ctx.textAlign = "center";
        const exX = (g.x + g.w / 2) * SCALE;
        const exY = (g.y - 14) * SCALE;
        ctx.fillStyle = "#000000";
        ctx.fillText("!", exX + 2, exY + 2);
        ctx.fillStyle = "#FF3333";
        ctx.fillText("!", exX, exY);
        ctx.textAlign = "left";
    }

    // HP pips for elite goblins (above head)
    if (g.elite && g.hp > 0 && g.hp <= 3) {
        const pipY = g.y - 10;
        const pipStartX = g.x + g.w / 2 - (3 * 4) / 2;
        for (let i = 0; i < 3; i++) {
            const filled = i < g.hp;
            drawRect(pipStartX + i * 4, pipY, 3, 3, filled ? "#c05838" : "#333333");
            if (filled) {
                drawRect(pipStartX + i * 4, pipY, 3, 1, "#FF88FF"); // highlight
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
    ctx.fillStyle = INK.paper;
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
    ctx.fillStyle = INK.paper;
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
            // Straight to the score. Phase 3 faded to black for a revelation and
            // phase 4 was the rave that delivered it; both are retired, and
            // phase 5 is still what the Enter-to-high-score path keys off.
            endingPhase = 5;
            endingTimer = 0;
        }
    }
    // Phase 5: hold on the venue and wait for Enter.
}

function renderEnding() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    function drawCentered(text, y, color, size) {
        ctx.font = gfont(size * SCALE);
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    {
        // === THE VENUE — the curtain call ===
        // Was gated on endingPhase <= 3, with an underground rave on the other
        // side of the else. There is no other side any more.
        // Dark floor
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const shade = (r + c) % 2 === 0 ? "#2C2C2A" : "#232321";
                drawRect(c * TILE, r * TILE, TILE, TILE, shade);
            }
        }

        // Walls
        for (let c = 0; c < COLS; c++) {
            drawRect(c * TILE, 0, TILE, TILE, (c * 7 + 3) % 3 === 0 ? "#3f3f3b" : "#3a3a37");
            drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, (c * 11 + 5) % 3 === 0 ? "#343430" : "#3a3a37");
        }
        for (let r = 0; r < ROWS; r++) {
            drawRect(0, r * TILE, WALL_SIDE, TILE, (r * 7) % 3 === 0 ? "#343430" : "#3a3a37");
            drawRect(COLS * TILE - WALL_SIDE, r * TILE, WALL_SIDE, TILE, (r * 11) % 3 === 0 ? "#343430" : "#3a3a37");
        }

        // String lights (fade in during phase 0)
        const lightsAlpha = endingPhase === 0 ? Math.min(1, endingPiecesPlaced / 4) : 1;
        if (lightsAlpha > 0) {
            ctx.globalAlpha = lightsAlpha;
            const bulbColors = [INK.rust, "#F6CC60", INK.green, INK.teal, INK.red, "#F6CC60"];
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
        drawRect(boothX - 8, boothY + 12, 64, 8, "#55554f");
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
            const miniGridX = GRID_X * TILE;   // centred like the real sequencer
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
            ctx.fillStyle = "#F6CC60";
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

        // Phase 3 used to run a three-beat revelation here, and phases 4-5 cut
        // to an underground rave where the goblin glyphs finally resolved. Both
        // are gone with the rest of the story. What is left is a curtain call,
        // so the score lands on the venue rather than on a cave.
        if (endingPhase === 5) {
            ctx.globalAlpha = Math.min(0.55, endingTimer / 60);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, W * SCALE, H * SCALE);
            ctx.globalAlpha = Math.min(1, endingTimer / 60);
            ctx.textAlign = "center";
            ctx.font = gfont(12 * SCALE);
            ctx.fillStyle = INK.charcoal;
            ctx.fillText("THAT'S THE SHOW", (W / 2) * SCALE + SCALE, (H / 3 + 1) * SCALE);
            ctx.fillStyle = INK.mustard;
            ctx.fillText("THAT'S THE SHOW", (W / 2) * SCALE, (H / 3) * SCALE);
            ctx.font = gfont(8 * SCALE);
            ctx.fillStyle = INK.paper;
            ctx.fillText("FINAL SCORE: " + finalScore, (W / 2) * SCALE, (H / 3 + 20) * SCALE);
            if (endingTimer > 90 && Math.sin(endingTimer * 0.08) > 0) {
                ctx.font = gfont(5 * SCALE);
                ctx.fillStyle = INK.paper;
                ctx.fillText(scoreQualifies(finalScore) ? "PRESS ENTER FOR HIGH SCORE"
                                                        : "PRESS ENTER TO CONTINUE",
                             (W / 2) * SCALE, (H - 20) * SCALE);
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
const TITLE_STEP_FRAMES = 8.2; // frames per sixteenth note at 110bpm @ 60fps

// Title screen drum pattern (matches audio)

// ============================================================
// THE VENUE MARQUEE — the title screen
//
// Ported from BUZZ's Wild Ride's start billboard. The idea survives the port
// even though none of the DOM does: the title is not a dialog floating over a
// game, it is a REAL OBJECT standing in the game's own world. Here that object
// is the venue's marquee, hung from the ceiling of the room you are about to
// play in, with the beat already running behind it.
//
// The one rule that makes it read as an object rather than a sticker is the
// LAYER ORDER, and it is the same rule as the coaster's:
//
//     z0  structure   hanger rods, mounting plate      BEHIND the face
//     z1  the face    opaque board — occludes z0       the sign itself
//     z2  the light   bulb chase, soffit, light spill  IN FRONT of the face
//
// The rods are drawn full length and simply hidden by an opaque face — no
// clipping, no masking, no matching cut-outs. Get this order wrong and the
// whole thing collapses into flat stickers.
//
// Two things the coaster fought that canvas gives us free: the boil (we redraw
// every frame, so `jit` just works — no feTurbulence, no seed table to keep in
// sync) and the z-order (draw order IS z-order).
// ============================================================

// Art slots, same contract as the coaster: present overrides, absent falls back
// silently to the procedural ink. Drop a PNG in and it replaces that layer with
// no code change.
const TITLE_ART = { face: null, logo: null };
for (const [key, file] of [["face", "marquee-face.png"], ["logo", "marquee-logo.png"]]) {
    const im = new Image();
    im.onload = () => { TITLE_ART[key] = im; };
    im.onerror = () => {};
    im.src = "assets/title/" + file;
}

const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

// Title card geometry, in logical units. Everything else derives from these.
const MQ = {
    // It is a CARD now, not a billboard: no legs, no teal frame, no gooseneck
    // lamps, no maintenance catwalk. All of that was structure whose job was to
    // make a sign read as a physical object standing in the room, and the art
    // does not need the help — it is a printed card laid over the room, and the
    // only thing left holding it there is its own offset shadow.
    //
    // 192x108 is exactly the art's 16:9 to four decimals, and exactly the size
    // the card was drawn at inside the old frame — so losing the frame changed
    // what is around the picture, not the picture. `top` moved 17 -> 25 for the
    // same reason: 25 is where the card's own top edge already sat.
    //
    // It covers BUZZ, and that is correct — the card is over the room, so he is
    // standing behind it.
    w: 192, h: 108,
    top: 25,
    radius: 4,             // the card's rounded corners
};

// Path a rounded rect in LOGICAL units (roundRect itself takes device px, and
// every caller here thinks in game units).
function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE, r * SCALE);
}


function drawTitleMarquee(sinkY) {
    const W = COLS * TILE;
    const cx = W / 2;
    const x0 = cx - MQ.w / 2, y0 = MQ.top + sinkY;
    const x1 = x0 + MQ.w, y1 = y0 + MQ.h;
    const S = SCALE;
    ctx.save();
    // No sway, and now nothing to sway from. A card lying over the room has no
    // pivot and no structure; the only thing that tells you it is a separate
    // sheet is its offset shadow.

    // ---- THE CARD ----------------------------------------------------------
    if (TITLE_ART.face) {
        // Hard offset shadow — the house style is a second printing pass
        // slightly out of register, never a blur. This is what is left of the
        // billboard: it is the whole reason the card reads as sitting ON the
        // room rather than being part of it.
        ctx.fillStyle = "rgba(20,20,19,0.55)";
        roundRectPath(x0 + 3, y0 + 4, MQ.w, MQ.h, MQ.radius);
        ctx.fill();
        // the card itself, filling the whole footprint now that there is no
        // frame to inset it from
        ctx.save();
        roundRectPath(x0, y0, MQ.w, MQ.h, MQ.radius);
        ctx.clip();
        ctx.drawImage(TITLE_ART.face, x0 * S, y0 * S, MQ.w * S, MQ.h * S);
        ctx.restore();
        ctx.strokeStyle = INK.charcoal;
        ctx.lineWidth = 0.8 * S;
        roundRectPath(x0, y0, MQ.w, MQ.h, MQ.radius);
        ctx.stroke();
    } else {
        // No art: a plain cream card with a boiled charcoal keyline. The teal
        // casing this used to sit in went with the frame.
        ctx.fillStyle = "rgba(20,20,19,0.55)";
        roundRectPath(x0 + 3, y0 + 4, MQ.w, MQ.h, MQ.radius);
        ctx.fill();
        ctx.fillStyle = INK.paper;
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
            const t = i / 48, per = t * 4;
            let px, py;
            if (per < 1)      { px = x0 + MQ.w * per;        py = y0; }
            else if (per < 2) { px = x1;                     py = y0 + MQ.h * (per - 1); }
            else if (per < 3) { px = x1 - MQ.w * (per - 2);  py = y1; }
            else              { px = x0;                     py = y1 - MQ.h * (per - 3); }
            const j = jit(i * 11 + y0, 21, 0.7);
            i ? ctx.lineTo((px + j) * S, (py + j) * S) : ctx.moveTo((px + j) * S, (py + j) * S);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK.charcoal;
        ctx.lineWidth = 2 * S;
        ctx.stroke();
    }

    // ---- the lettering, on the face ----------------------------------------
    const centred = (text, y, col, size, dx) => {
        ctx.font = gfont(size * S);
        ctx.fillStyle = col;
        ctx.textAlign = "center";
        ctx.fillText(text, (cx + (dx || 0)) * S, y * S);
        ctx.textAlign = "start";
    };
    if (TITLE_ART.logo) {
        const lw = MQ.w - 24, lh = lw * (TITLE_ART.logo.height / TITLE_ART.logo.width);
        ctx.drawImage(TITLE_ART.logo, (cx - lw / 2) * S, (y0 + 9) * S, lw * S, lh * S);
    } else if (!TITLE_ART.face) {
        // Only when nothing has been supplied. A face image is a FINISHED sign
        // and carries its own lettering; this gate used to be on `logo` alone,
        // so dropping in the billboard drew the old type straight over the type
        // already in the artwork.
        centred("BUZZ'S", y0 + 15, INK.rust, 5);
        // Charcoal letterforms with a mustard offset — a painted sign, not a
        // glowing one. The old title used 8-bit orange and neon green.
        for (const [text, ty] of [["RHYTHM", y0 + 30], ["RAMPAGE", y0 + 45]]) {
            centred(text, ty + 1.1, INK.mustard, 14);
            centred(text, ty, INK.charcoal, 14);
        }
    }

    // ---- the reader board: where a marquee puts its showtimes ---------------
    // The filled charcoal plate this used to sit on is drawn ONLY for the
    // procedural sign. On the billboard there is nowhere on the art to put it:
    // the bottom fifth is BUZZ's shoes and the dust clouds, and the first
    // attempt at plate-less type landed straight on his legs. So the live UI
    // goes BELOW the sign, on the room's own charcoal floor, where paper type
    // reads cleanly and nothing competes with the illustration. The board is
    // sized to leave that strip clear of the HUD band.
    // Two lines, 8 units apart, whether they sit on the plate or on the floor.
    const onArt = !!TITLE_ART.face;
    // ONE BUTTON, sized to its own type. There is no mode selector any more, and
    // the plate is no longer a reader board that has to hold two lines — so it
    // shrinks to the measured width of the word plus a little padding, which is
    // what lets it sit in the clear strip UNDER BUZZ's feet at the bottom of the
    // card instead of covering his shoes.
    // No blink. It was inherited from a prompt that was bare text; now that it
    // is a solid plate, blinking flashes the whole button off and on, which
    // reads as a glitch. The reference's button just sits there.
    if (onArt && !titleFadingOut) {
        const label = "PRESS ENTER";
        const fs = 5;
        ctx.font = gfont(fs * S);
        const tw = ctx.measureText(label).width / S;
        const pw = tw + 11, ph = fs + 5.5;
        // 1.5 units up from the card's bottom edge. That used to be measured
        // from the frame's inner opening; with the frame gone the card IS the
        // footprint, so the button lands in exactly the same place on the art.
        const px = cx - pw / 2, py = y0 + MQ.h - ph - 1.5;
        ctx.fillStyle = "rgba(20,20,19,0.5)";
        roundRectPath(px + 1.6, py + 2, pw, ph, 2.5);
        ctx.fill();
        // Mustard, not cream. A cream plate on a cream illustration half
        // vanishes; the reference's primary button is yellow for the same
        // reason, and mustard is the palette's action colour.
        ctx.fillStyle = INK.mustard;
        roundRectPath(px, py, pw, ph, 2.5);
        ctx.fill();
        ctx.strokeStyle = INK.charcoal;
        ctx.lineWidth = 0.9 * S;
        ctx.stroke();
        ctx.fillStyle = INK.charcoal;
        ctx.textAlign = "center";
        ctx.fillText(label, cx * S, (py + ph - 2.2) * S);
        ctx.textAlign = "start";
    } else if (!onArt && !titleFadingOut) {
        // the procedural sign keeps its reader board
        drawRect(x0 + 9, y0 + MQ.h - 20, MQ.w - 18, 16, INK.charcoal);
        centred("PRESS ENTER", y0 + MQ.h - 8,
                (titleStep % 4 === 0) ? INK.mustard : INK.silverL, 5);
    }

    // The gooseneck floodlights and the maintenance catwalk that used to cross
    // in front of the bottom edge are gone with the rest of the structure. Both
    // existed to sell the sign as a lit, serviceable object in the room; a card
    // is neither.

    ctx.restore();
    // The second leg pass onto the HUD canvas goes too. Its whole purpose was
    // to let the legs cross IN FRONT of the readout on their way to the floor,
    // and there are no legs.
}

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

    // THE TITLE SCREEN IS THE GAME, with a sign hung in front of it.
    //
    // It used to be an imitation: a hand-drawn copy of the room's ceiling
    // lights, and a two-row 32-cell mock grid of flat rectangles sitting low
    // under the sign — different art, different size, different place from the
    // real sequencer. So the handover was a cut between two pictures, and it
    // needed a fade to black to hide the join.
    //
    // Now it draws the actual field, at its actual position, with the real
    // tiles and the ruled lattice, and the beat runs underneath. Nothing has to
    // change when play starts, so nothing has to be hidden.
    tickSequencer();
    render();

    // === THE MARQUEE ===

    if (titleFadingOut) {
        titleFadeTimer++;
        if (titleFadeTimer >= TITLE_FADE_DURATION) {
            titleFadingOut = false;
            titleFadeTimer = 0;
            stopTitleDrums();
            // Straight into the room. The four story scenes that used to sit
            // between here and the first level are gone — and with them went the
            // resetGame() that finished the last one, so it has to happen here.
            // This is now exactly what chill mode does a few lines up; the two
            // modes only differed because one of them detoured through a
            // cutscene.
            gameState = "playing";
            resetSequencerClock();
            // No sceneTransition. There is nothing to cover: the same room, the
            // same grid and the same BUZZ are already on screen, so a fade to
            // black would be hiding a join that no longer exists.
            return;
        }
    }

    // IT SINKS, IT DOES NOT FADE, and it only moves on the way OUT. It used to
    // slide down into place over the first 34 frames, which is precisely what
    // the coaster's billboard doc warns against: it puts the transition on the
    // panel rather than on the exit, so the screen visibly assembles itself on
    // first paint. Whatever is in the room was already there when you walked in.
    //
    // The travel is measured from the card's top edge, which is now the topmost
    // thing there is — it used to allow 7 extra units for the lamp bar standing
    // proud of the board, and there is no lamp bar.
    const flyEase = t => t * t * (3 - 2 * t);
    const highest = MQ.top;
    const sinkY = titleFadingOut
        ? flyEase(Math.min(1, titleFadeTimer / TITLE_FADE_DURATION)) * (ROWS * TILE - highest + 10)
        : 0;

    drawTitleMarquee(sinkY);

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




function renderHighScoreEntry() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background with starfield
    drawRect(0, 0, W, H, "#2C2C2A");
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(initialsBlink * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#50ad33" : "#7A8F85");
    }
    ctx.globalAlpha = 1;

    initialsBlink++;

    // "NEW HIGH SCORE!" header — prominent, celebratory
    const header = "NEW HIGH SCORE!";
    ctx.textAlign = "center";
    ctx.font = gfont(8 * SCALE);
    ctx.fillStyle = "#000";
    ctx.fillText(header, (W / 2) * SCALE + SCALE, 20 * SCALE + SCALE);
    ctx.fillStyle = "#F6CC60";
    ctx.fillText(header, (W / 2) * SCALE, 20 * SCALE);

    // Score display — big and proud
    const scoreStr = String(finalScore);
    ctx.font = gfont(8 * SCALE);
    ctx.fillStyle = "#000";
    ctx.fillText(scoreStr, (W / 2) * SCALE + SCALE, 42 * SCALE + SCALE);
    ctx.fillStyle = INK.paper;
    ctx.fillText(scoreStr, (W / 2) * SCALE, 42 * SCALE);

    // "ENTER YOUR INITIALS" label — readable instruction
    const label = "ENTER YOUR INITIALS";
    ctx.font = gfont(5 * SCALE);
    ctx.fillStyle = INK.mustard;
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
            drawText("^", lx + letterScale * 0.1, ly - 20, "#F6CC60", 8);
            // Down arrow indicator below
            drawText("v", lx + letterScale * 0.1, ly + letterScale + 10, "#F6CC60", 8);
        }

        // Draw the letter
        const color = i < initialsPos ? "#44aa44" : (i === initialsPos ? "#50ad33" : "#3a3a37");
        drawText(initialsEntry[i], lx, ly, color, letterScale);
        ctx.globalAlpha = 1;

        // Underline
        drawRect(lx, ly + letterScale + 4, letterScale, 2, i === initialsPos ? "#50ad33" : "#3a3a37");
    }

    // Existing high scores list
    if (highScores.length > 0) {
        const scoreX = 16;
        const scoreStartY = H / 2 - 20;
        drawText("HIGH SCORES", scoreX, scoreStartY - 12, "#F6CC60", 3);
        for (let i = 0; i < highScores.length; i++) {
            const entry = highScores[i];
            const rank = (i + 1) + "." + entry.name + " " + String(entry.score).padStart(5, "0");
            const color = i === 0 ? "#F6CC60" : INK.mustard;
            drawText(rank, scoreX, scoreStartY + i * 9, color, 3);
        }
    }

    // "PRESS ENTER TO CONFIRM" blinking — standard CTA size
    const confirmText = "PRESS ENTER TO CONFIRM";
    if (initialsBlink % 60 < 40) {
        ctx.textAlign = "center";
        ctx.font = gfont(5 * SCALE);
        ctx.fillStyle = INK.mustard;
        ctx.fillText(confirmText, (W / 2) * SCALE, (H - 24) * SCALE);
        ctx.textAlign = "start";
    }

    // Controls hint — minimum readable size
    const hint = "UP/DOWN: LETTER   ENTER: CONFIRM";
    ctx.textAlign = "center";
    ctx.font = gfont(3 * SCALE);
    ctx.fillStyle = "#4a4a45";
    ctx.fillText(hint, (W / 2) * SCALE, (H - 12) * SCALE);
    ctx.textAlign = "start";
}

function renderLevelComplete() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    levelCelebrateTimer++;
    if (screenFlash > 0) screenFlash--;
    // THE BEAT KEEPS PLAYING. This used to shuffle `currentStep` on an
    // arbitrary every-eighth-frame counter with the sequencer stopped — so the
    // dancers moved but no drums came out, and the reward for restoring a
    // groove was that the groove went silent. The real clock runs instead.
    tickSequencer();

    // Render the game map underneath, then fade to black over time.
    //
    // HOLD FIRST, FOR A WHOLE BAR. The level ends on the beat the pattern
    // lands, so this is the moment the player just earned, and 45 frames of it
    // was under a second — less than a third of a bar at this tempo. You never
    // once heard the thing you spent the level building. A full sixteen steps
    // of the restored pattern, in the finished room, before anything moves.
    render();
    // Everything after the hold runs on `ct`, not on the raw timer. Get that
    // wrong and the panel's type starts fading up at frame 30 while the room is
    // still fully lit behind it, which reads as a caption on the game rather
    // than as the next screen arriving.
    // One bar, derived from the level's own tempo rather than a magic 45 — it
    // is 160 frames at 90 BPM and 80 at 180, and it stays one bar either way.
    const HOLD = holdFrames();
    const ct = Math.max(0, levelCelebrateTimer - HOLD);
    const fadeAlpha = Math.min(1, ct / 90);
    ctx.globalAlpha = fadeAlpha;
    drawRect(0, 0, COLS * TILE, ROWS * TILE, "#2C2C2A");
    ctx.globalAlpha = 1.0;


    // "LEVEL X COMPLETE!" text
    if (ct > 30) {
        const textAlpha = Math.min(1, (ct - 30) / 30);
        ctx.globalAlpha = textAlpha;

        const levelText = "LEVEL " + (currentLevel + 1);
        const completeText = "COMPLETE!";
        const textScale = 14;
        const ty = H / 2 - 30;
        const bounce = Math.sin(ct * 0.05) * 2;

        // Draw centered using textAlign
        ctx.textAlign = "center";
        ctx.font = gfont(textScale * SCALE);
        // Shadow
        ctx.fillStyle = "#000000";
        ctx.fillText(levelText, (W * SCALE) / 2 + SCALE, (ty + bounce + 1) * SCALE);
        // Main
        ctx.fillStyle = "#F6CC60";
        ctx.fillText(levelText, (W * SCALE) / 2, (ty + bounce) * SCALE);

        // "COMPLETE!" below
        const cy = ty + 20;
        ctx.fillStyle = "#000000";
        ctx.fillText(completeText, (W * SCALE) / 2 + SCALE, (cy + bounce + 1) * SCALE);
        ctx.fillStyle = "#F6CC60";
        ctx.fillText(completeText, (W * SCALE) / 2, (cy + bounce) * SCALE);

        // Time bonus and score below
        const bonusScale = 8;
        ctx.font = gfont(bonusScale * SCALE);
        if (lastTimeBonus > 0) {
            const by = cy + 28;
            const bonusText = "TIME BONUS: +" + lastTimeBonus;
            ctx.fillStyle = "#000000";
            ctx.fillText(bonusText, (W * SCALE) / 2 + SCALE, (by + 1) * SCALE);
            ctx.fillStyle = INK.teal;
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
        ctx.fillStyle = INK.paper;
        ctx.fillText(scoreText, (W * SCALE) / 2, sy * SCALE);

        // Piece recovery announcement at milestone levels
        if (pieceRecoveredThisLevel && ct > 60) {
            const pcAlpha = Math.min(1, (ct - 60) / 30);
            const pcPulse = 1 + Math.sin(ct * 0.1) * 0.06;
            ctx.globalAlpha = pcAlpha;
            ctx.font = gfont(Math.round(6 * SCALE * pcPulse));
            const pcText = "RECOVERED: THE " + pieceRecoveredThisLevel.toUpperCase() + "!";
            ctx.fillStyle = "#000000";
            ctx.fillText(pcText, (W * SCALE) / 2 + SCALE, (sy + 12) * SCALE);
            ctx.fillStyle = INK.mustard;
            ctx.fillText(pcText, (W * SCALE) / 2, (sy + 11) * SCALE);
            ctx.globalAlpha = 1;
            ctx.font = gfont(8 * SCALE);
        }

        // Narrative breadcrumb — brief one-liner about progress
        if (ct > 90) {
            const narrativeAlpha = Math.min(1, (ct - 90) / 40);
            ctx.globalAlpha = narrativeAlpha;
            ctx.font = gfont(4 * SCALE);
            let narrative = "";
            const earned = djSetupEarned.length;
            const lvl = currentLevel + 1;
            if (lvl === 1) narrative = "The rhythm returns...";
            else if (lvl === 2) narrative = "The beat grows stronger.";
            else if (lvl === 5 || lvl === 10 || lvl === 15 || lvl === 20 || lvl === 25 || lvl === 30)
                narrative = earned > 0 ? earned + " / 6 pieces recovered." : "The room is filling up...";
            else if (lvl === 10) narrative = "Rock fundamentals mastered.";
            else if (lvl === 20) narrative = "Funk and soul reclaimed.";
            else if (lvl === 30) narrative = "The whole park heard that.";
            else if (earned > 0 && earned < 6) narrative = earned + " / 6 pieces recovered.";
            if (narrative) {
                // Sits lower when the piece-recovery banner is showing above it
                const nyOfs = pieceRecoveredThisLevel ? 24 : 18;
                ctx.fillStyle = "#000000";
                ctx.fillText(narrative, (W * SCALE) / 2 + SCALE, (sy + nyOfs + 1) * SCALE);
                ctx.fillStyle = "#8a9a6a";
                ctx.fillText(narrative, (W * SCALE) / 2, (sy + nyOfs) * SCALE);
            }
            ctx.globalAlpha = 1.0;
        }

        ctx.textAlign = "start";

        ctx.globalAlpha = 1.0;
    }

    // Firework bursts + confetti
    const fwColors = [INK.mustard, INK.teal, INK.rust, INK.green, INK.red, INK.mint, INK.silverL];
    // Launch new fireworks periodically — more frequent
    if (ct % 18 === 0 && ct < 240) {
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
                    const twinkle = Math.sin(ct * 0.3 + ep.x) > 0.3;
                    const sz = twinkle ? ep.size * 1.5 : ep.size;
                    drawRect(ep.x, ep.y, sz, sz, ep.color);
                }
            }
            ctx.globalAlpha = 1.0;
            if (allDead) fireworks.splice(i, 1);
        }
    }

    // Confetti — varied shapes (rectangles, triangles, pennants)
    if (ct % 5 === 0 && ct < 240) {
        const confColors = [INK.mustard, INK.teal, INK.rust, INK.green, INK.red, INK.mint, INK.silverL];
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
        const sz = p.sparkle && Math.sin(ct * 0.2 + ci) > 0 ? p.size * 1.5 : p.size;
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
    if (ct === 180) {
        startStoryDrums();
    }

    // "PRESS ENTER" to continue
    if (ct > 120) {
        const blink = ct % 60 < 40;
        if (blink) {
            const pressText = "PRESS ENTER TO CONTINUE";
            ctx.textAlign = "center";
            ctx.font = gfont(5 * SCALE);
            ctx.fillStyle = INK.paper;
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

        if (screenShake > 0) { screenShake--; if (screenShake === 0) shakeDur = 0; }
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
                ctx.fillStyle = "#c05838";
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
        // Position below the player (offset by collapse)
        const textY = player.y + player.h + 20;
        ctx.textAlign = "center";
        drawText(shitText, W / 2 + 1, textY + 1, "#000000", 7);
        drawText(shitText, W / 2, textY, INK.mustard, 7);
        ctx.textAlign = "start";
        ctx.globalAlpha = 1.0;
    }

    // Narrative context — goblins win (appears after "RUDE!" has sunk in)
    if (gameOverTimer >= 200 && gameOverTimer < 600) {
        const narAlpha = gameOverTimer < 230 ? (gameOverTimer - 200) / 30
            : gameOverTimer >= 540 ? Math.max(0, 1 - (gameOverTimer - 540) / 60) : 1;
        ctx.globalAlpha = narAlpha;
        const narText = "THE DONKS TOOK THE ROOM.";
        const narY = player.y + player.h + 34;
        ctx.textAlign = "center";
        drawText(narText, W / 2 + 1, narY + 1, "#000000", 5);
        drawText(narText, W / 2, narY, "#50ad33", 5);
        ctx.textAlign = "start";
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

// ---- Biome Transition Cutscene ----
// Plays after each milestone level (5/10/15/20/25): celebrate the recovered
// DJ piece, watch the goblins drag the next one deeper, read the newest
// glyph fragment, then descend into the new zone with its title card.
// Enter skips.
function startBiomeTransition() {
    biomeTransFrom = currentBiome;
    biomeTransTo = biomeForLevel(currentLevel + 1);
    biomeTransPiece = pieceRecoveredThisLevel;
    biomeTransNextPiece = djSetupEarned.length < DJ_SETUP_PIECES.length
        ? DJ_SETUP_PIECES[djSetupEarned.length] : null;
    biomeTransTimer = 0;
    gameState = "biome-transition";
    if (audioCtx && audioCtx.state === "running") {
        if (!playSample("crowd", audioCtx.currentTime) && !playSample("yeah", audioCtx.currentTime)) {
            playYeahStab(audioCtx.currentTime);
        }
    }
}

// Glowing golden DJ piece with rotating sparkle rays (game-unit coords)
function drawDJPieceGlow(cx, cy, t) {
    const s = SCALE;
    ctx.strokeStyle = "#ffe082";
    for (let i = 0; i < 8; i++) {
        const ang = t * 0.02 + i * Math.PI / 4;
        ctx.globalAlpha = 0.25 + Math.sin(t * 0.1 + i) * 0.15;
        ctx.lineWidth = s;
        ctx.beginPath();
        ctx.moveTo((cx + Math.cos(ang) * 8) * s, (cy + Math.sin(ang) * 8) * s);
        ctx.lineTo((cx + Math.cos(ang) * 13) * s, (cy + Math.sin(ang) * 13) * s);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#F6CC60";
    ctx.beginPath();
    ctx.roundRect((cx - 5) * s, (cy - 4) * s, 10 * s, 8 * s, 2 * s);
    ctx.fill();
    ctx.fillStyle = "#ffe082";
    ctx.fillRect((cx - 5) * s, (cy - 4) * s, 10 * s, 2 * s);
    if (Math.floor(t / 8) % 2 === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect((cx + 2) * s, (cy - 3) * s, s, s);
    }
}

function renderBiomeTransition() {
    tickSequencer(); // the beat you rebuilt keeps grooving under the cutscene
    biomeTransTimer++;
    const t = biomeTransTimer;
    const W = COLS * TILE;
    const H = ROWS * TILE;

    const PH_A = 220;   // celebration: piece held high
    const PH_B = 360;   // goblins drag the next piece deeper
    // The glyph phase that used to sit between PH_B and the descent is gone,
    // and PH_END comes in by its length so the transition is not left holding
    // 200 frames of nothing.
    const PH_END = 600; // auto-advance (~10s total; Enter skips)

    drawRect(0, 0, W, H, "#2C2C2A");

    if (t < PH_A) {
        // === Phase 1: celebrate the recovered piece ===
        const fadeIn = Math.min(1, t / 20);
        const grad = ctx.createRadialGradient(
            W / 2 * SCALE, H / 2 * SCALE, 10 * SCALE,
            W / 2 * SCALE, H / 2 * SCALE, W * 0.4 * SCALE);
        grad.addColorStop(0, `rgba(${biomeTransFrom.caveGlow},${0.18 * fadeIn})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W * SCALE, H * SCALE);

        // Carl center stage, piece held overhead
        const cx = W / 2 - 8, cy = H / 2 - 4;
        ctx.globalAlpha = fadeIn;
        drawPlayerSprite(cx, cy, 0, 0, {});
        drawDJPieceGlow(W / 2, cy - 10, t);

        // Fans flanking him, arms up, bouncing
        for (let i = 0; i < 6; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const off = 22 + Math.floor(i / 2) * 16;
            drawDancerSprite(W / 2 - 6 + side * off, cy + 10 + (i % 3) * 4,
                DANCER_PALETTES[i % DANCER_PALETTES.length], {
                    bob: Math.abs(Math.sin(t * 0.15 + i)) * 3,
                    armBlend: 1,
                    footOffset: Math.sin(t * 0.15 + i) * 1.5,
                });
        }

        if (t > 25 && biomeTransPiece) {
            const line = "THE " + biomeTransPiece.toUpperCase() + " IS BACK!";
            ctx.textAlign = "center";
            drawText(line, W / 2 + 1, 26, "#000000", 7);
            drawText(line, W / 2, 25, "#F6CC60", 7);
            ctx.textAlign = "start";
        }

        // DJ setup progress: six slots, earned ones lit gold
        if (t > 55) {
            const slotW = 12, gap = 4;
            const totalW = DJ_SETUP_PIECES.length * slotW + (DJ_SETUP_PIECES.length - 1) * gap;
            const sx0 = W / 2 - totalW / 2;
            const sy0 = H - 42;
            const label = "DJ SETUP: " + djSetupEarned.length + "/" + DJ_SETUP_PIECES.length;
            ctx.textAlign = "center";
            drawText(label, W / 2, sy0 - 10, "#7A8F85", 5);
            ctx.textAlign = "start";
            for (let i = 0; i < DJ_SETUP_PIECES.length; i++) {
                const sx = sx0 + i * (slotW + gap);
                const earned = i < djSetupEarned.length;
                const newest = i === djSetupEarned.length - 1;
                const pulse = newest ? 0.75 + Math.sin(t * 0.15) * 0.25 : 1;
                ctx.globalAlpha = fadeIn * (earned ? pulse : 0.5);
                drawRect(sx, sy0, slotW, 10, earned ? "#F6CC60" : "#3a3a37");
                if (earned) drawRect(sx + 1, sy0 + 1, slotW - 2, 2, "#ffe082");
            }
        }
        ctx.globalAlpha = 1;
    } else if (t < PH_B) {
        // === Phase 2: the goblins drag the NEXT piece deeper ===
        const pt = t - PH_A;
        // The new zone's glow leaks in from the right — that's where they're headed
        const grad = ctx.createRadialGradient(
            W * SCALE, H / 2 * SCALE, 10 * SCALE,
            W * SCALE, H / 2 * SCALE, W * 0.5 * SCALE);
        grad.addColorStop(0, `rgba(${biomeTransTo.caveGlow},0.16)`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W * SCALE, H * SCALE);

        // Goblin sprints across the screen with the stolen piece overhead
        const prog = Math.min(1, pt / 120);
        const gx = -TILE + prog * (W + TILE * 2);
        const gy = H / 2 + 8 + Math.sin(pt * 0.1) * 2;
        drawGoblinSprite("normal", gx, gy, Math.floor(pt / 5) % 4, { dir: 3, showShadow: false, phase: gx * 0.55 });
        if (biomeTransNextPiece) drawDJPieceGlow(gx + 8, gy - 8, t);

        if (biomeTransNextPiece && pt > 15) {
            const line1 = "THE DONKS HAUL THE " + biomeTransNextPiece.toUpperCase();
            const line2 = "OFF TO THE NEXT ROOM...";
            ctx.textAlign = "center";
            drawText(line1, W / 2 + 1, 26, "#000000", 6);
            drawText(line1, W / 2, 25, "#50ad33", 6);
            drawText(line2, W / 2 + 1, 36, "#000000", 6);
            drawText(line2, W / 2, 35, "#50ad33", 6);
            ctx.textAlign = "start";
        }
    } else {
        // === Phase 3: descend into the new zone ===
        const pt = t - PH_B;
        const dur = PH_END - PH_B - 30;
        const p = Math.min(1, pt / dur);

        // Crossfade: old zone's glow behind, new zone's glow ahead
        const gradOld = ctx.createRadialGradient(
            0, H / 2 * SCALE, 10 * SCALE, 0, H / 2 * SCALE, W * 0.45 * SCALE);
        gradOld.addColorStop(0, `rgba(${biomeTransFrom.caveGlow},${0.14 * (1 - p)})`);
        gradOld.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradOld;
        ctx.fillRect(0, 0, W * SCALE, H * SCALE);
        const gradNew = ctx.createRadialGradient(
            W * SCALE, H / 2 * SCALE, 10 * SCALE, W * SCALE, H / 2 * SCALE, W * 0.55 * SCALE);
        gradNew.addColorStop(0, `rgba(${biomeTransTo.caveGlow},${0.05 + 0.15 * p})`);
        gradNew.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradNew;
        ctx.fillRect(0, 0, W * SCALE, H * SCALE);

        // Tunnel floor line
        drawRect(0, H / 2 + 26, W, 2, "#1a1a1a");

        // Carl leads his entourage deeper (rightward)
        const walkX = W * 0.1 + p * W * 0.55;
        const walkY = H / 2 + 8;
        drawPlayerSprite(walkX, walkY, 1 + (Math.floor(t / 8) % 2), 3, {});
        // A cutscene crowd, not the old live entourage — sized off progress
        const crew = Math.max(2, Math.min(4, 2 + Math.floor(currentLevel / 10)));
        for (let i = 0; i < crew; i++) {
            drawDancerSprite(walkX - 18 - i * 14, walkY + 2,
                DANCER_PALETTES[i % DANCER_PALETTES.length], {
                    bob: Math.abs(Math.sin(t * 0.12 + i)) * 2,
                    armBlend: 0,
                    footOffset: Math.sin(t * 0.12 + i) * 1.5,
                });
        }

        // New zone title card + tagline + mission
        if (pt > 40) {
            const a = Math.min(1, (pt - 40) / 30);
            ctx.globalAlpha = a;
            const title = "~ " + biomeTransTo.name + " ~";
            ctx.textAlign = "center";
            drawText(title, W / 2 + 1, 26, "#000000", 8);
            drawText(title, W / 2, 25, biomeTransTo.lights[0], 8);
            ctx.textAlign = "start";
            const tag = biomeTransTo.tagline || "";
            ctx.textAlign = "center";
            drawText(tag, W / 2, 37, "#7A8F85", 5);
            ctx.textAlign = "start";
            if (biomeTransNextPiece) {
                const goal = "RECOVER THE " + biomeTransNextPiece.toUpperCase() + "!";
                ctx.textAlign = "center";
                drawText(goal, W / 2, H - 30, "#F6CC60", 6);
                ctx.textAlign = "start";
            }
            ctx.globalAlpha = 1;
        }
    }

    // Skip prompt
    if (t > 90) {
        ctx.globalAlpha = 0.5 + Math.sin(t * 0.1) * 0.3;
        drawText("ENTER >", W - 34, H - 10, "#7A8F85", 4);
        ctx.globalAlpha = 1;
    }

    if (t >= PH_END) {
        advanceLevel();
    }
}

function renderSabotageAnim() {
    // Keep the drum sequencer playing during the scramble
    tickSequencer();

    sabotageAnimTimer++;
    const t = sabotageAnimTimer;
    if (screenShake > 0) { screenShake--; if (screenShake === 0) shakeDur = 0; } // update() isn't running in this state

    // Determine which cell the goblin is "at"
    const cellIndex = Math.floor(t / SABOTAGE_FRAMES_PER_CELL);

    // Flip cells as the goblin passes them
    while (sabotageFlipIndex < sabotageCells.length && sabotageFlipIndex <= cellIndex) {
        const cell = sabotageCells[sabotageFlipIndex];
        if (cell.flip) {
            grid[cell.r][cell.c] = !grid[cell.r][cell.c];
            cellFlash[cell.r][cell.c] = 30;
            cellRecent[cell.r][cell.c] = 180;
            if (sabotageFlipIndex % 4 === 0) { screenShake = 2; shakeAt = null; }
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
        grad_s.addColorStop(1, "#c05838");
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
        ctx.font = gfont(12 * SCALE);
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.fillText("SABOTAGE!", (W_s2 * SCALE) / 2 + SCALE, (ROWS * TILE / 2) * SCALE + SCALE);
        ctx.fillStyle = "#c05838";
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
                ctx.fillStyle = "#50ad33";
                ctx.globalAlpha = (4 - trail) / 4 * 0.45;
                ctx.fillRect((tx + 2) * SCALE, (ty + 2) * SCALE, (TILE - 4) * SCALE, (TILE - 4) * SCALE);
            }
        }
        ctx.globalAlpha = 1.0;

        drawGoblinSprite("normal", gx, gy, frame, { dir: dir, showShadow: false });
    }

    // Scramble complete — the thief bolts for the right door and slams it
    // shut behind itself (that's why the exit is barred all level)
    if (sabotageFlipIndex >= sabotageCells.length) {
        if (sabotageCells.length === 0) {
            // Nothing to scramble (shouldn't happen) — just close the door and go
            if (t > 20) {
                if (biomeBannerPending) {
                    biomeBannerTimer = 300;
                    biomeBannerPending = false;
                }
                gameState = sabotageNextState;
            }
            return;
        }
        const endFrame = sabotageCells.length * SABOTAGE_FRAMES_PER_CELL;
        const tt = t - endFrame;      // frames since the scramble finished
        const THIEF_RUN = 50;         // sprint duration
        const THIEF_PAUSE = 30;       // beat after the slam before play starts

        const last = sabotageCells[sabotageCells.length - 1];
        const startX = (GRID_X + last.c) * TILE;
        const startY = rowPixelY(last.r);
        // The thief bolts out through the right-hand doorway — the same one
        // the Donks come in by, because it is the one the room actually has.
        const exitDoor = CAVES[CAVES.length - 1];
        const exitX = (COLS - 2) * TILE;
        const exitY = exitDoor.tileY * TILE;

        if (tt >= 0 && tt <= THIEF_RUN) {
            // Sprint from the last scrambled cell to the door (smoothstep ease)
            const prog = tt / THIEF_RUN;
            const ease = prog * prog * (3 - 2 * prog);
            const gx = startX + (exitX - startX) * ease;
            const gy = startY + (exitY - startY) * ease;
            const runFrame = Math.floor(t / 4) % 4;
            drawGoblinSprite("normal", gx, gy, runFrame, { dir: 3, showShadow: false, phase: (gx + gy) * 0.55 });

            // On milestone levels the thief is visibly carrying the next DJ piece
            if (thiefCarriedPiece) {
                const bobY = Math.sin(t * 0.3) * 1.5;
                const px2 = (gx + TILE / 2) * SCALE;
                const py2 = (gy - 5 + bobY) * SCALE;
                ctx.fillStyle = "#F6CC60";
                ctx.fillRect(px2 - 3 * SCALE, py2 - 3 * SCALE, 6 * SCALE, 6 * SCALE);
                ctx.fillStyle = "#ffe082";
                ctx.fillRect(px2 - 3 * SCALE, py2 - 3 * SCALE, 6 * SCALE, 2 * SCALE);
                if (Math.floor(t / 6) % 2 === 0) {
                    ctx.fillStyle = "rgba(255,255,255,0.9)";
                    ctx.fillRect(px2 + 2 * SCALE, py2 - 5 * SCALE, SCALE, SCALE);
                }
                // Callout so the player knows what this zone's prize is
                const stealText = "THE THIEF HAS THE " + thiefCarriedPiece.toUpperCase() + "!";
                const W_t = COLS * TILE;
                ctx.textAlign = "center";
                drawText(stealText, W_t / 2 + 1, TILE * 3 + 1, "#000000", 6);
                drawText(stealText, W_t / 2, TILE * 3, "#F6CC60", 6);
                ctx.textAlign = "start";
            }

            if (tt === THIEF_RUN) {
                // The thief hits the doorway and is gone. No door to slam any
                // more, but the impact is the punctuation on the scramble and
                // the cue that the level has started, so the shake and the
                // clang stay.
                screenShake = 8;
                shakeAt = null;
                shakeIntensity = 4;
                playDoorSlam();
            }
        } else if (tt > THIEF_RUN + THIEF_PAUSE) {
            if (biomeBannerPending) {
                biomeBannerTimer = 300;
                biomeBannerPending = false;
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
    drawRect(0, 0, W, H, "#2C2C2A");

    // Dramatic flash effect — bright flash that fades
    if (progress < 0.4) {
        ctx.fillStyle = "#FE3636";
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
    drawRect(0, 0, W, H, "#2C2C2A");
    // Threat color tint — subtle background hue based on enemy type
    const threatCol = enemyWarningType === "normal" ? "#50ad33" : (enemyWarningType === "elite" ? "#c05838" : INK.mint);
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
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#50ad33" : "#7A8F85");
    }
    ctx.globalAlpha = 1;

    // Centered text helper (same as story/tutorial screens)
    function drawCenteredText(text, y, color, scale) {
        ctx.font = gfont(scale * SCALE);
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
    const borderCol = enemyWarningType === "normal" ? "#50ad33" : (enemyWarningType === "elite" ? "#c05838" : INK.mint);
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
        drawCenteredText("WATCH OUT!", 30, "#50ad33", 8);
        drawCenteredText("DONKS!", 55, "#50ad33", 6);
        ctx.save();
        const cx_w = (W / 2) * SCALE;
        const cy_w = (80 + bobOffset + 8) * SCALE;
        ctx.translate(cx_w, cy_w);
        ctx.scale(spriteScale, spriteScale);
        ctx.translate(-cx_w, -cy_w);
        drawGoblinSprite("normal", W / 2 - 8, 80 + bobOffset, gobFrame, { showShadow: false });
        ctx.restore();
        drawCenteredText("THEY'LL SCRAMBLE YOUR BEATS THE MOMENT", 115, INK.mustard, 5);
        drawCenteredText("YOUR BACK IS TURNED. DON'T LET THEM.", 132, "#F6CC60", 5);

    } else if (enemyWarningType === "elite") {
        drawCenteredText("WARNING!", 30, "#c05838", 8);
        drawCenteredText("ELITE DONK", 55, INK.rust, 6);
        ctx.save();
        const cx_w = (W / 2) * SCALE;
        const cy_w = (80 + bobOffset + 8) * SCALE;
        ctx.translate(cx_w, cy_w);
        ctx.scale(spriteScale, spriteScale);
        ctx.translate(-cx_w, -cy_w);
        drawGoblinSprite("elite", W / 2 - 8, 80 + bobOffset, gobFrame, { showShadow: false });
        ctx.restore();
        drawCenteredText("BIGGER. MEANER. THIS ONE DOESN'T GO DOWN EASY.", 115, INK.mustard, 5);
        drawCenteredText("THREE SOLID HITS TO PUT IT ON THE FLOOR.", 132, INK.rust, 5);
        drawCenteredText("AND IT'S FAST.", 149, INK.mustard, 5);

    } else if (enemyWarningType === "catapult") {
        drawCenteredText("WARNING!", 30, "#c05838", 8);
        drawCenteredText("CATAPULT DONK", 55, INK.mint, 6);
        ctx.save();
        const cx_w = (W / 2) * SCALE;
        const cy_w = (80 + bobOffset + 8) * SCALE;
        ctx.translate(cx_w, cy_w);
        ctx.scale(spriteScale, spriteScale);
        ctx.translate(-cx_w, -cy_w);
        drawGoblinSprite("catapult", W / 2 - 8, 80 + bobOffset, gobFrame, { showShadow: false });
        ctx.restore();
        drawCenteredText("THIS ONE FIGHTS DIRTY, LOBBING GEAR", 115, INK.mustard, 5);
        drawCenteredText("AT YOUR PADS FROM ACROSS THE ROOM.", 132, INK.mustard, 5);
        drawCenteredText("YOU CAN'T KILL IT. BUT IT CAN SURE KILL YOU.", 149, "#c05838", 5);
    }

    // Blinking "PRESS ENTER TO CONTINUE"
    if (t > 60 && t % 60 < 40) {
        drawCenteredText("PRESS ENTER TO CONTINUE", H - 12, "#7A8F85", 5);
    }

}

// ---- New Instrument Screen (full instruction style) ----
function renderNewInstrument() {
    newInstrumentTimer++;
    const t = newInstrumentTimer;
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background (same as tutorial)
    drawRect(0, 0, W, H, "#2C2C2A");

    // Starfield
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(t * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#50ad33" : "#7A8F85");
    }
    ctx.globalAlpha = 1;

    function drawCenteredText(text, y, color, scale) {
        ctx.font = gfont(scale * SCALE);
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, (W * SCALE) / 2, y * SCALE);
        ctx.textAlign = "start";
    }

    if (newInstrumentType === "cowbell") {
        // Title with entrance animation
        const titleAlpha = Math.min(1, t / 30);
        ctx.globalAlpha = titleAlpha;
        drawCenteredText("NEW INSTRUMENT!", 28, "#50ad33", 8);
        ctx.globalAlpha = 1;

        // Instrument name
        const nameAlpha = Math.min(1, Math.max(0, (t - 15) / 30));
        ctx.globalAlpha = nameAlpha;
        drawCenteredText("COWBELL", 52, INK.rust, 7);
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
            ctx.fillStyle = INK.rust;
            ctx.beginPath();
            ctx.moveTo(-12 * SCALE, -9 * SCALE);
            ctx.lineTo(12 * SCALE, -9 * SCALE);
            ctx.lineTo(15 * SCALE, 9 * SCALE);
            ctx.lineTo(-15 * SCALE, 9 * SCALE);
            ctx.closePath();
            ctx.fill();
            // Highlight stripe
            ctx.fillStyle = INK.mustard;
            ctx.fillRect(-9 * SCALE, -6 * SCALE, 18 * SCALE, 3 * SCALE);
            // Handle on top
            ctx.fillStyle = INK.paper;
            ctx.fillRect(-4 * SCALE, -15 * SCALE, 8 * SCALE, 6 * SCALE);
            // Clapper at bottom
            ctx.fillStyle = INK.paper;
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
            drawCenteredText("A NEW VOICE JOINS THE MIX.", 135, INK.mustard, 5);
            ctx.globalAlpha = 1;
        }
        if (t > 55) {
            const desc2Alpha = Math.min(1, (t - 55) / 30);
            ctx.globalAlpha = desc2Alpha;
            drawCenteredText("THE GROOVE GROWS DEEPER.", 155, INK.rust, 5);
            drawCenteredText("FILL IN THE COWBELL PATTERN TO MAKE IT SING.", 170, INK.rust, 5);
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
                    cowbellPattern[c] ? INK.rust : PAL.gridOff);
                // Playhead
                if (c === demoStep) {
                    ctx.fillStyle = "#F6CC60";
                    ctx.globalAlpha = stripAlpha * 0.4;
                    ctx.fillRect(cx_s * SCALE, stripY * SCALE, cellW * SCALE, cellW * SCALE);
                    ctx.globalAlpha = stripAlpha;
                }
            }
            // Row label
            drawText("B", stripX - 8, stripY + 6, INK.rust, 4);
            ctx.globalAlpha = 1;
        }

    } else if (newInstrumentType === "tom") {
        // Title with entrance animation
        const titleAlpha = Math.min(1, t / 30);
        ctx.globalAlpha = titleAlpha;
        drawCenteredText("NEW INSTRUMENT!", 28, "#50ad33", 8);
        ctx.globalAlpha = 1;

        // Instrument name
        const nameAlpha = Math.min(1, Math.max(0, (t - 15) / 30));
        ctx.globalAlpha = nameAlpha;
        drawCenteredText("TOM DRUM", 52, INK.teal, 7);
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
            ctx.fillStyle = hitFlash ? "#F6CC60" : INK.teal;
            ctx.fillRect(-15 * SCALE, -6 * SCALE, 30 * SCALE, 18 * SCALE);
            // Drum head (top ellipse)
            ctx.fillStyle = hitFlash ? "#FFFFFF" : INK.paper;
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
            drawCenteredText("THE RHYTHM IS GETTING RICHER.", 135, INK.mustard, 5);
            ctx.globalAlpha = 1;
        }
        if (t > 55) {
            const desc2Alpha = Math.min(1, (t - 55) / 30);
            ctx.globalAlpha = desc2Alpha;
            drawCenteredText("THE PARK IS WAKING UP.", 155, INK.teal, 5);
            drawCenteredText("EVEN MORE BEATS TO MASTER.", 170, INK.teal, 5);
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
                    tomPattern[c] ? INK.teal : PAL.gridOff);
                if (c === demoStep) {
                    ctx.fillStyle = "#F6CC60";
                    ctx.globalAlpha = stripAlpha * 0.4;
                    ctx.fillRect(cx_s * SCALE, stripY * SCALE, cellW * SCALE, cellW * SCALE);
                    ctx.globalAlpha = stripAlpha;
                }
            }
            drawText("T", stripX - 8, stripY + 6, INK.teal, 4);
            ctx.globalAlpha = 1;
        }
    }

    // Blinking "PRESS ENTER TO CONTINUE"
    if (t > 80 && t % 60 < 40) {
        drawCenteredText("PRESS ENTER TO CONTINUE", H - 12, "#7A8F85", 5);
    }
}

// ============================================================
// PAPER GRAIN
// A 512x512 greyscale tile, recoloured so its DENSITY becomes the alpha of
// charcoal ink specks, then tiled as a pattern. It is what stops the cream
// reading as a flat fill.
//
// THE HARD RULE: never scale the pattern at fill time. A squeezed pattern
// samples badly, reads as pixelation, and measured 2.5x slower. So the grain
// does NOT live on the game canvas — that's a 1600x800 buffer the browser then
// shrinks to fit the window, which would drag the grain down with it and turn
// 1px marks into mush. It gets its own canvas sized to the CSS pixel box it
// actually occupies, filled 1:1, and repainted only when that box changes.
// ============================================================
const grainCanvas = document.getElementById("grain");
const grainCtx = grainCanvas ? grainCanvas.getContext("2d") : null;
let grainTile = null;
let grainW = 0, grainH = 0;

function paintGrain() {
    if (!grainCtx) return;
    const r = grainCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (w !== grainW || h !== grainH) {
        grainCanvas.width = grainW = w;
        grainCanvas.height = grainH = h;
    }
    grainCtx.clearRect(0, 0, w, h);
    if (!grainTile || !BOIL.grain || BOIL.grainAlpha <= 0) return;
    grainCtx.globalAlpha = BOIL.grainAlpha;
    grainCtx.fillStyle = grainCtx.createPattern(grainTile, "repeat");
    grainCtx.fillRect(0, 0, w, h);   // 1:1, no transform — see the rule above
    grainCtx.globalAlpha = 1;
}

(function loadGrain() {
    if (!grainCtx) return;
    const im = new Image();
    im.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = cv.height = im.width || 512;
        const g = cv.getContext("2d");
        g.drawImage(im, 0, 0);
        try {
            const id = g.getImageData(0, 0, cv.width, cv.height), d = id.data;
            for (let i = 0; i < d.length; i += 4) {
                const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                d[i] = 44; d[i + 1] = 44; d[i + 2] = 42;   // charcoal ink...
                d[i + 3] = (255 - lum) * 0.8;              // ...carrying the tile's density
            }
            g.putImageData(id, 0, 0);
        } catch (e) {
            // Opening index.html straight off disk taints the canvas, so the
            // recolour can't run and the grain simply sits this one out. Over
            // http, and from the inlined data URI the bundle ships, it's fine.
            console.warn("grain: tile unreadable (" + e.name + ") — skipping");
            return;
        }
        grainTile = cv;
        paintGrain();
    };
    im.onerror = () => {};
    im.src = "assets/shared/noise.webp";
    window.addEventListener("resize", paintGrain);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", paintGrain);
})();

// The boil switchboard is gone: the corner tab, the panel behind it, the
// keyboard shortcuts and the localStorage that remembered them. It existed to
// judge which sources were worth boiling rather than assume it, that judgement
// has been made, and the answers are the defaults at the top of this file.
//
// Its persistence goes with it deliberately. A saved config would have kept
// overriding those defaults with whatever was last toggled, on a machine with
// no way left to see or change it.

function gameLoop(timestamp) {
    perfNow = timestamp || 0; // drives the boil clock — one hand inks everything
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    frameAccum += dt;
    // Run at most ONE simulation+render step per rAF callback. The old
    // catch-up while-loop re-rendered up to 3x per displayed frame when a
    // frame ran long — tripling the draw cost exactly when the machine was
    // already struggling (lag death-spiral). Under load we now drop the
    // backlog instead: the game time-slows slightly but stays smooth, and
    // the sequencer keeps beat on its own wall-clock. The accumulator still
    // paces high-refresh displays (120Hz+) down to 60 steps/sec.
    if (frameAccum >= FRAME_MS) {
        frameAccum = Math.min(frameAccum - FRAME_MS, FRAME_MS);
        try {
            // Clear HUD canvas when not in gameplay
            if (gameState !== "playing") {
                hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
            }
            if (gameState === "title") {
                renderTitleScreen();
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
            } else if (gameState === "biome-transition") {
                renderBiomeTransition();
            } else if (gameState === "ending") {
                updateEnding();
                renderEnding();
            } else if (gameState === "gameover") {
                renderGameOverScreen();
            } else if (gameState === "highscore") {
                renderHighScoreEntry();
            } else if (gameState === "paused") {
                // Render the frozen game frame + pause overlay
                render();
                // Dark overlay
                const W_p = COLS * TILE * SCALE;
                const H_p = ROWS * TILE * SCALE;
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(0, 0, W_p, H_p);
                // "PAUSED" text
                ctx.font = gfont(10 * SCALE);
                ctx.textAlign = "center";
                ctx.fillStyle = "#000000";
                ctx.fillText("PAUSED", W_p / 2 + 2 * SCALE, H_p / 2 - 6 * SCALE);
                ctx.fillStyle = "#F6CC60";
                ctx.fillText("PAUSED", W_p / 2, H_p / 2 - 8 * SCALE);
                // Subtitle
                ctx.font = gfont(4 * SCALE);
                ctx.fillStyle = INK.paper;
                ctx.fillText("PRESS ESC TO RESUME", W_p / 2, H_p / 2 + 6 * SCALE);
                ctx.textAlign = "start";
            } else if (CAMRIG.on) {
                render();          // frozen: the camera moves, the game does not
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
                    if (sceneTransition.from === "title") {
                        // Quick fade out of the title — same visual scene either
                        // side of it, so an iris wipe reads wrong
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

// ============================================================
// TOUCH CONTROLS — mobile playtest layer
// Built by the game itself so every build (GitHub Pages, artifact
// bundle) gets them for free. Only appears on coarse-pointer devices;
// synthesizes the same keyboard events the game already listens for,
// so every input path (audio unlock, punch buffering, menu advance)
// is the real one.
// ============================================================
function initTouchControls() {
    try {
        if (typeof document === "undefined" || !document.body || !window.matchMedia) return;
        if (!window.matchMedia("(pointer: coarse)").matches) return;

        // Make sure pinch-zoom/scroll never fights the game
        if (document.head && !document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement("meta");
            meta.name = "viewport";
            meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
            document.head.appendChild(meta);
        }

        const style = document.createElement("style");
        style.textContent = `
            .tc-btn {
                position: fixed; z-index: 20;
                display: flex; align-items: center; justify-content: center;
                background: rgba(44,44,42,0.72); color: #fcf7e8;
                border: 2px solid rgba(252,247,232,0.85); border-radius: 12px;
                font-family: monospace; font-weight: bold;
                user-select: none; -webkit-user-select: none;
                -webkit-tap-highlight-color: transparent; touch-action: none;
            }
            .tc-btn.tc-on { background: rgba(246,204,96,0.9); color: #2C2C2A; }
            #tc-punch {
                right: 16px; bottom: 26px; width: 84px; height: 84px;
                border-radius: 50%; font-size: 15px;
                background: rgba(246,204,96,0.82); color: #2C2C2A;
                border: 3px solid #2C2C2A;
                box-shadow: 4px 4px 0 rgba(44,44,42,0.55);
            }
            #tc-punch.tc-on { background: #F6CC60; transform: scale(0.94); }
            .tc-dir { width: 56px; height: 56px; font-size: 22px; }
            #tc-rotate {
                display: none; position: fixed; z-index: 30; left: 0; right: 0; top: 12px;
                text-align: center; font-family: monospace; font-size: 14px;
                color: #fcf7e8; text-shadow: 1px 1px 0 #2C2C2A;
                pointer-events: none;
            }
            @media (orientation: portrait) { #tc-rotate { display: block; } }
        `;
        document.head.appendChild(style);

        const sendKey = (type, code) => {
            window.dispatchEvent(new KeyboardEvent(type, {
                code: code,
                key: code === "Space" ? " " : code === "Enter" ? "Enter" : code,
                bubbles: true,
            }));
        };

        const mkBtn = (id, label, cls, pos) => {
            const b = document.createElement("div");
            b.id = id;
            b.className = "tc-btn " + (cls || "");
            b.textContent = label;
            for (const k in pos) b.style[k] = pos[k];
            document.body.appendChild(b);
            return b;
        };

        // Hold-to-move d-pad (bottom-left)
        const dirs = [
            ["tc-up",    "▲", "ArrowUp",    { left: "76px",  bottom: "126px" }],
            ["tc-left",  "◀", "ArrowLeft",  { left: "16px",  bottom: "68px"  }],
            ["tc-right", "▶", "ArrowRight", { left: "136px", bottom: "68px"  }],
            ["tc-down",  "▼", "ArrowDown",  { left: "76px",  bottom: "10px"  }],
        ];
        for (const [id, label, code, pos] of dirs) {
            const b = mkBtn(id, label, "tc-dir", pos);
            const down = (e) => { e.preventDefault(); b.classList.add("tc-on"); sendKey("keydown", code); };
            const up = (e) => { e.preventDefault(); b.classList.remove("tc-on"); sendKey("keyup", code); };
            b.addEventListener("touchstart", down, { passive: false });
            b.addEventListener("touchend", up, { passive: false });
            b.addEventListener("touchcancel", up, { passive: false });
        }

        // Punch (bottom-right)
        const punch = mkBtn("tc-punch", "PUNCH", "", {});
        punch.addEventListener("touchstart", (e) => {
            e.preventDefault();
            punch.classList.add("tc-on");
            sendKey("keydown", "Space");
        }, { passive: false });
        const punchUp = (e) => { e.preventDefault(); punch.classList.remove("tc-on"); sendKey("keyup", "Space"); };
        punch.addEventListener("touchend", punchUp, { passive: false });
        punch.addEventListener("touchcancel", punchUp, { passive: false });

        // Tap anywhere else = Enter (start, advance cutscenes, continue).
        // During gameplay Enter is a no-op, so stray taps cost nothing.
        const tapEnter = (e) => {
            if (e.target.closest && e.target.closest(".tc-btn")) return;
            // (A guard here used to let the boil switchboard claim a tap before
            //  the game did. There is no switchboard, so every tap is the game's.)
            sendKey("keydown", "Enter");
            sendKey("keyup", "Enter");
        };
        document.body.addEventListener("touchstart", tapEnter, { passive: true });

        // Gentle nudge — the game is built 16:9
        const rot = document.createElement("div");
        rot.id = "tc-rotate";
        rot.textContent = "🥁 ROTATE FOR FULL GROOVE 🥁";
        document.body.appendChild(rot);
    } catch (e) {
        console.error("touch controls init error:", e);
    }
}
initTouchControls();

loadHighScores();
function startGame() {
    // The title screen draws the real room now, so the world has to exist
    // before the first frame rather than being built when the player presses
    // Enter. resetGame() runs again on start — it is idempotent for level 1 and
    // produces the same field, which is the point: nothing moves at the handover.
    try { resetGame(); } catch (e) { console.error("startGame init error:", e); }
    requestAnimationFrame(gameLoop);
}

// Canvas does NOT wait for a web font: it silently draws in the fallback and
// carries on. That would be cosmetic if we painted every frame, but warpedText
// bakes each string into three canvases and caches them, so a string drawn one
// frame too early keeps its fallback glyphs for the rest of the session.
// So: ask for both faces first, start regardless if they're slow, and throw the
// text cache away once they land.
function startWhenFontsReady() {
    const go = () => { try { startGame(); } catch (e) { console.error(e); } };
    if (!document.fonts || !document.fonts.load) { go(); return; }
    const wanted = [`${12 * SCALE}px ${FONT_DISP}`, `${5 * SCALE}px ${FONT_BODY}`];
    Promise.race([
        Promise.all(wanted.map(f => document.fonts.load(f, "BUZZ"))),
        new Promise(res => setTimeout(res, 2500)),   // never block the game on a font
    ]).catch(() => {}).then(go);
    // Belt and braces: anything baked before the faces arrived gets re-baked.
    document.fonts.ready.then(() => { try { TEXT_WARPS.clear(); } catch (e) {} });
}
if (assetsReady) startWhenFontsReady();
