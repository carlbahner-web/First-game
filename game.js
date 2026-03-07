// ============================================================
// REVENGE OF THE GROOVE GOBLINS - A 16-bit Zelda-style drum sequencer game
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---- Constants ----
const TILE = 16;
const SCALE = 3;
const COLS = 22;           // room width in tiles
const ROWS = 18;           // room height in tiles
const GRID_COLS = 16;      // sequencer steps
const GRID_ROWS = 4;       // drum channels
const GRID_X = 3;          // grid start tile-x
const GRID_Y = 4;          // grid start tile-y
let bpm = 120;
let stepMs = (60 / bpm / 4) * 1000; // 16th-note interval

canvas.width = COLS * TILE * SCALE;
canvas.height = ROWS * TILE * SCALE;
ctx.imageSmoothingEnabled = false;

// ---- Colors (carnival palette) ----
// #EBEBE3 Ticket Paper, #F6CC60 Midway Mustard, #BFCDC0 Foggy Mint
// #3A6168 Harbor Teal, #BF7538 Rusty Turnstile
const PAL = {
    bg:        "#2c4a4f",
    wall:      "#3A6168",
    wallTop:   "#4a7a82",
    floor:     "#345558",
    floorAlt:  "#2f4f53",
    gridOff:   "#2a4448",
    gridOn:    ["#BF7538", "#F6CC60", "#BFCDC0", "#EBEBE3"], // per-row colors
    gridBorder:"#3A6168",
    playhead:  "#F6CC60",
    player:    "#EBEBE3",
    playerDark:"#BFCDC0",
    sword:     "#F6CC60",
    swordGlow: "#BF7538",
    shadow:    "rgba(0,0,0,0.3)",
    startBtn:  "#BFCDC0",
    stopBtn:   "#BF7538",
    labelText: "#EBEBE3",
    titleText: "#EBEBE3",
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
    (t) => playHihat(t, true),
    (t) => playHihat(t, false),
    (t) => playSnare(t),
    (t) => playKick(t),
];

// ---- Sequencer State ----
const grid = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(false));
// Starter beat: kick on 1,9 and snare on 5,13 (0-indexed: row 3=kick, row 2=snare)
grid[3][0] = true; grid[3][8] = true;   // Kick on steps 1 and 9
grid[2][4] = true; grid[2][12] = true;  // Snare on steps 5 and 13
const playing = true; // always playing — use RESET block to clear
let currentStep = 0;
let lastStepTime = 0;

// ---- Kill Counter & Dancers ----
let killCount = 0;
const dancers = [];
const DANCER_PALETTES = [
    { body: "#E86A6A", dark: "#C05050", head: "#F09090", hair: "#8B4513" },
    { body: "#6AB8E8", dark: "#4A98C8", head: "#F0D0B0", hair: "#2a2a2a" },
    { body: "#F6CC60", dark: "#D6AC40", head: "#F0D0B0", hair: "#BF7538" },
    { body: "#9B59B6", dark: "#7B3996", head: "#F09090", hair: "#F6CC60" },
    { body: "#2ECC71", dark: "#1EAC51", head: "#F0D0B0", hair: "#881111" },
    { body: "#E67E22", dark: "#C65E02", head: "#F0D0B0", hair: "#2a2a2a" },
];

// ---- Player State ----
const player = {
    x: (GRID_X + 7) * TILE,   // current position (smooth, pixel-level)
    y: (GRID_Y + GRID_ROWS + 1) * TILE,
    destX: (GRID_X + 7) * TILE, // movement destination
    destY: (GRID_Y + GRID_ROWS + 1) * TILE,
    w: TILE,
    h: TILE,
    dir: 0,        // 0=down, 1=up, 2=left, 3=right
    frame: 0,
    frameTimer: 0,
    attacking: false,
    attackTimer: 0,
    attackDuration: 12,
    swordHit: false, // did this swing already toggle a block?
    speed: 2.0, // pixels per frame at 60fps — snappy tile-to-tile glide
};

// ---- Caves (goblin spawn points) ----
const CAVES = [
    { tileX: COLS - 1, tileY: GRID_Y + 3 },   // right wall
    { tileX: Math.floor(COLS / 2), tileY: ROWS - 1 }, // bottom wall
    { tileX: 0, tileY: GRID_Y + 1 },           // left wall
];

// ---- Goblin Enemy State ----
const goblin = {
    x: CAVES[0].tileX * TILE,
    y: CAVES[0].tileY * TILE,
    destX: CAVES[0].tileX * TILE,
    destY: CAVES[0].tileY * TILE,
    w: TILE,
    h: TILE,
    dir: 0,
    frame: 0,
    frameTimer: 0,
    speed: 0.5, // pixels per frame at 60fps
    dead: true,
    respawnTimer: 300, // start dead, spawn after 5 seconds
    respawnDelay: 600, // ~10 seconds at 60fps
    spawnCave: 0,
    targetRow: -1,
    targetCol: -1,
    sabotageTimer: 0,
    moveSteps: 0, // count steps for re-picking target
    elite: false, // true for every 3rd goblin (pink & fast)
    hp: 1,        // normal goblins have 1 hp, elites have 3
    hurtTimer: 0, // flash white when hit
};

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
// When active: { x, y, destX, destY, dir, frame, frameTimer, speed,
//   phase, phaseTimer, caveIndex, targetRow, targetCol,
//   boulder: null | { startX, startY, targetX, targetY, progress } }

let gamePaused = false;
let gameState = "title"; // "title", "story", "playing", "gameover", "highscore"
let titleBlink = 0; // blink timer for "PRESS ENTER"

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
}

function confirmHighScore() {
    const name = initialsEntry.join("");
    highScores.push({ name: name, score: finalScore });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > 5) highScores.length = 5;
    saveHighScores();
    resetGame();
    gameState = "title";
}

// ---- Control Blocks (physical buttons in the room) ----
const CTRL_BLOCKS = {
    tempoUp:   { tileX: GRID_X + GRID_COLS + 1, tileY: GRID_Y + GRID_ROWS + 1, label: "BPM+", color: "#E86A6A" },
    tempoDown: { tileX: GRID_X + GRID_COLS + 1, tileY: GRID_Y + GRID_ROWS + 4, label: "BPM-", color: "#6AB8E8" },
    reset:     { tileX: GRID_X + GRID_COLS + 1, tileY: GRID_Y + GRID_ROWS + 5, label: "RESET", color: "#BF7538" },
};

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
const keys = {};
let spaceJustPressed = false;
window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        e.preventDefault();
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
        } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
            initialsPos = Math.max(0, initialsPos - 1);
        } else if (e.code === "ArrowRight" || e.code === "KeyD") {
            initialsPos = Math.min(2, initialsPos + 1);
        } else if (e.code === "Enter") {
            confirmHighScore();
        }
        return;
    }

    if (e.code === "Enter") {
        e.preventDefault();
        if (gameState === "title") {
            ensureAudio();
            gameState = "story";
            storyBlink = 0;
            startStoryDrums();
            return;
        }
        if (gameState === "story") {
            stopStoryDrums();
            gameState = "playing";
            return;
        }
        if (gameState === "gameover" && gameOverTimer > 180) {
            // Let player skip the rest of the sad song
            if (scoreQualifies(finalScore)) {
                enterHighScoreState();
            } else {
                resetGame();
                gameState = "title";
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

// ---- Helper: get sword hitbox ----
function getSwordBox() {
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

// ---- Helper: check if a tile is blocked by solid objects ----
function isTileBlockedByObjects(tileX, tileY) {
    // Control blocks (tempoUp, tempoDown, reset)
    for (const key of ["tempoUp", "tempoDown", "reset"]) {
        const blk = CTRL_BLOCKS[key];
        if (tileX === blk.tileX && tileY === blk.tileY) return true;
    }
    // BPM display between tempo arrows (same x column, rows between tempoUp and tempoDown)
    const ctrlX = CTRL_BLOCKS.tempoUp.tileX;
    const bpmTop = CTRL_BLOCKS.tempoUp.tileY + 1;
    const bpmBot = CTRL_BLOCKS.tempoDown.tileY - 1;
    if (tileX === ctrlX && tileY >= bpmTop && tileY <= bpmBot) return true;
    // Kill counter area (roughly tiles 3-4, row 9)
    const kcTileY = GRID_Y + GRID_ROWS + 1; // row below grid + 1 (where counter renders)
    if (tileX >= GRID_X && tileX <= GRID_X + 2 && tileY === kcTileY) return true;
    return false;
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

// ---- Helper: get block rect for grid cell ----
function getBlockRect(row, col) {
    return {
        x: (GRID_X + col) * TILE,
        y: (GRID_Y + row) * TILE,
        w: TILE,
        h: TILE,
    };
}

// ---- Update ----
function update(dt) {
    if (gamePaused) return;

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
        p.swordHit = false;
        ensureAudio();
        // play a subtle sword "whoosh"
        if (audioCtx) {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
            g.gain.setValueAtTime(0.08, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.connect(g); g.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.08);
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
        const row = targetTileY - GRID_Y;
        if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
            grid[row][col] = !grid[row][col];
            p.swordHit = true;
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
        }

        // Check control blocks
        const td = CTRL_BLOCKS.tempoDown;
        const tu = CTRL_BLOCKS.tempoUp;
        const rs = CTRL_BLOCKS.reset;
        if (targetTileX === td.tileX && targetTileY === td.tileY) {
            ensureAudio();
            bpm = Math.max(40, bpm - 1);
            stepMs = (60 / bpm / 4) * 1000;
            p.swordHit = true;
        }
        if (targetTileX === tu.tileX && targetTileY === tu.tileY) {
            ensureAudio();
            bpm = Math.min(300, bpm + 1);
            stepMs = (60 / bpm / 4) * 1000;
            p.swordHit = true;
        }
        if (targetTileX === rs.tileX && targetTileY === rs.tileY) {
            for (let r = 0; r < GRID_ROWS; r++)
                for (let c = 0; c < GRID_COLS; c++)
                    grid[r][c] = false;
            p.swordHit = true;
            // play a clear sound
            if (audioCtx) {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
                g.gain.setValueAtTime(0.1, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.connect(g); g.connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.2);
            }
        }

        // Check goblin hit (always check, even if we hit a grid block)
        const gobTileX = Math.round(goblin.x / TILE);
        const gobTileY = Math.round(goblin.y / TILE);
        if (!goblin.dead && targetTileX === gobTileX && targetTileY === gobTileY) {
            p.swordHit = true;
            goblin.hp--;

            if (goblin.hp > 0) {
                // Non-lethal hit on elite goblin — hurt feedback
                goblin.hurtTimer = 12; // flash white for 12 frames
                goblin.speed = goblin.hp === 2 ? 0.9 : 1.1; // get faster each hit

                // Small hit freeze + shake
                hitFreeze = 2;
                pendingShake = true;
                pendingShakeElite = false;

                // Knockback: push goblin 1 tile away from player
                const knockDx = gobTileX - Math.round(p.x / TILE);
                const knockDy = gobTileY - Math.round(p.y / TILE);
                const knockX = goblin.x + Math.sign(knockDx) * TILE;
                const knockY = goblin.y + Math.sign(knockDy) * TILE;
                goblin.destX = Math.max(TILE, Math.min((COLS - 2) * TILE, knockX));
                goblin.destY = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, knockY));

                // Small burst of particles
                for (let i = 0; i < 8; i++) {
                    deathParticles.push({
                        x: goblin.x + goblin.w / 2,
                        y: goblin.y + goblin.h / 2,
                        vx: (Math.random() - 0.5) * 2,
                        vy: (Math.random() - 0.5) * 2 - 0.5,
                        life: 15 + Math.random() * 15,
                        color: goblin.hp === 2 ? "#d46a9a" : "#ff4444",
                        size: 2 + Math.random() * 2,
                        sparkle: false,
                    });
                }

                // Hurt text
                const hurtTexts = goblin.hp === 2
                    ? ["OW!", "HEY!", "RUDE!", "OUCH!"]
                    : ["STOP IT!", "AAAGH!", "IM MAD!", "GRRRR!"];
                const ht = hurtTexts[Math.floor(Math.random() * hurtTexts.length)];
                const htCol = goblin.hp === 2 ? "#ffaacc" : "#ff6666";
                deathText = { x: goblin.x - 8, y: goblin.y - 8, timer: 40, text: ht, color: htCol, scale: 4 };

                // Hurt sound — descending pitch, angrier each hit
                if (audioCtx) {
                    const now = audioCtx.currentTime;
                    const osc = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    osc.type = "square";
                    const startFreq = goblin.hp === 2 ? 500 : 700;
                    osc.frequency.setValueAtTime(startFreq, now);
                    osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
                    g.gain.setValueAtTime(0.12, now);
                    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    osc.connect(g); g.connect(audioCtx.destination);
                    osc.start(now); osc.stop(now + 0.15);
                }
            } else {
            // Lethal hit — full death sequence
            goblin.dead = true;
            const wasElite = goblin.elite;
            // Longer pause after elite (3rd) kill: 15s vs 10s
            goblin.respawnTimer = wasElite ? 900 : goblin.respawnDelay;

            // Death particles — elite gets a big sparkly explosion
            const particleCount = wasElite ? 50 : 20;
            const spreadMul = wasElite ? 3 : 2;
            for (let i = 0; i < particleCount; i++) {
                const isSparkle = wasElite && Math.random() > 0.5;
                deathParticles.push({
                    x: goblin.x + goblin.w / 2,
                    y: goblin.y + goblin.h / 2,
                    vx: (Math.random() - 0.5) * spreadMul,
                    vy: (Math.random() - 0.5) * spreadMul - 1,
                    life: wasElite ? 50 + Math.random() * 50 : 30 + Math.random() * 30,
                    color: wasElite
                        ? (isSparkle ? "#ffee44" : Math.random() > 0.3 ? "#d46a9a" : "#ff88bb")
                        : (Math.random() > 0.3 ? "#cc2222" : "#881111"),
                    size: wasElite ? 2 + Math.random() * 4 : 2 + Math.random() * 3,
                    sparkle: isSparkle, // sparkle particles twinkle
                });
            }

            // Death text
            deathText = wasElite
                ? { x: goblin.x - 40, y: goblin.y - 12, timer: 120, text: "bro why you gotta stab me?", color: "#ffee44", scale: 4 }
                : { x: goblin.x - 8, y: goblin.y - 8, timer: 60, text: "OW FUCK!", color: "#cc2222", scale: 5 };

            // Screen flash for elite kill
            if (wasElite) screenFlash = 15;

            // Hit freeze + screen shake (juice)
            hitFreeze = wasElite ? 5 : 3;
            pendingShake = true;
            pendingShakeElite = wasElite;

            // Sound: fanfare for elite, simple boop for normal
            if (audioCtx) {
                const now = audioCtx.currentTime;
                if (wasElite) {
                    // Bright happy major arpeggio — Cmaj7 up two octaves
                    const notes = [523, 659, 784, 988, 1047, 1319, 1568, 1976, 2093]; // C5 E5 G5 B5 C6 E6 G6 B6 C7
                    notes.forEach((freq, i) => {
                        const osc = audioCtx.createOscillator();
                        const g = audioCtx.createGain();
                        osc.type = "triangle";
                        osc.frequency.setValueAtTime(freq, now + i * 0.07);
                        g.gain.setValueAtTime(0.15 - i * 0.015, now + i * 0.07);
                        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.35);
                        osc.connect(g); g.connect(audioCtx.destination);
                        osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.35);
                    });
                    // Sparkly high shimmer on top
                    const shimmer = audioCtx.createOscillator();
                    const sg = audioCtx.createGain();
                    shimmer.type = "sine";
                    shimmer.frequency.setValueAtTime(2093, now + 0.49);
                    shimmer.frequency.linearRampToValueAtTime(2637, now + 0.8);
                    sg.gain.setValueAtTime(0.08, now + 0.49);
                    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
                    shimmer.connect(sg); sg.connect(audioCtx.destination);
                    shimmer.start(now + 0.49); shimmer.stop(now + 1.0);
                    // Warm held chord underneath (C major triad)
                    [523, 659, 784].forEach((freq) => {
                        const osc = audioCtx.createOscillator();
                        const g = audioCtx.createGain();
                        osc.type = "triangle";
                        osc.frequency.setValueAtTime(freq, now + 0.49);
                        g.gain.setValueAtTime(0.06, now + 0.49);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
                        osc.connect(g); g.connect(audioCtx.destination);
                        osc.start(now + 0.49); osc.stop(now + 1.2);
                    });
                } else {
                    const osc = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    osc.type = "square";
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
                    g.gain.setValueAtTime(0.15, now);
                    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    osc.connect(g); g.connect(audioCtx.destination);
                    osc.start(now); osc.stop(now + 0.3);
                }
            }

            // Kill counter & dancer spawn
            killCount++;
            catapultSpawnedThisCycle = false; // allow catapult to spawn on next qualifying kill
            if (killCount % 3 === 0) {
                // Spawn 3 dancers from different edges, no overlapping destinations
                const edges = [0, 1, 2]; // left, right, bottom
                // Shuffle edges so each dancer gets a unique one
                for (let i = edges.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [edges[i], edges[j]] = [edges[j], edges[i]];
                }
                // Collect occupied target tiles (existing dancers)
                const occupied = new Set();
                for (const dd of dancers) {
                    const tx = Math.round((dd.targetX ?? dd.x) / TILE);
                    const ty = Math.round((dd.targetY ?? dd.y) / TILE);
                    occupied.add(tx + "," + ty);
                }
                for (let di = 0; di < 3; di++) {
                    const palette = DANCER_PALETTES[dancers.length % DANCER_PALETTES.length];
                    // Find a target tile not already taken and not blocking a cave
                    let targetTX, targetTY, attempts = 0;
                    do {
                        targetTX = 2 + Math.floor(Math.random() * (COLS - 5));
                        targetTY = 14 + Math.floor(Math.random() * 3);
                        attempts++;
                    } while ((occupied.has(targetTX + "," + targetTY) ||
                        CAVES.some(c => Math.abs(c.tileX - targetTX) <= 1 && Math.abs(c.tileY - targetTY) <= 1)) &&
                        attempts < 50);
                    occupied.add(targetTX + "," + targetTY);
                    const targetX = targetTX * TILE;
                    const targetY = targetTY * TILE;
                    const edge = edges[di];
                    let startX, startY;
                    if (edge === 0) { startX = -TILE; startY = targetY; }
                    else if (edge === 1) { startX = COLS * TILE; startY = targetY; }
                    else { startX = targetX; startY = ROWS * TILE; }
                    dancers.push({
                        x: startX,
                        y: startY,
                        targetX: targetX,
                        targetY: targetY,
                        walkingIn: true,
                        palette: palette,
                        phase: Math.floor(Math.random() * 16),
                    });
                }
            }
            } // end else (lethal hit)
        }

        // Check catapult goblin hit — invincible! Clang sound
        if (catapultGoblin) {
            const cgTileX = Math.round(catapultGoblin.x / TILE);
            const cgTileY = Math.round(catapultGoblin.y / TILE);
            if (targetTileX === cgTileX && targetTileY === cgTileY) {
                p.swordHit = true;
                ensureAudio();
                if (audioCtx) playClang(audioCtx.currentTime);
                // Spark particles
                for (let i = 0; i < 5; i++) {
                    deathParticles.push({
                        x: catapultGoblin.x + catapultGoblin.w / 2,
                        y: catapultGoblin.y + catapultGoblin.h / 2,
                        vx: (Math.random() - 0.5) * 3,
                        vy: (Math.random() - 0.5) * 3 - 1,
                        life: 10 + Math.random() * 10,
                        color: Math.random() > 0.5 ? "#ffee44" : "#ffffff",
                        size: 1 + Math.random() * 2,
                        sparkle: true,
                    });
                }
            }
        }

        // Check dancer hit — donk + knockback one tile
        for (const d of dancers) {
            const dTileX = Math.round(d.x / TILE);
            const dTileY = Math.round(d.y / TILE);
            if (targetTileX === dTileX && targetTileY === dTileY) {
                p.swordHit = true;
                if (audioCtx) {
                    playDonk(audioCtx.currentTime);
                }
                // Knock dancer back one tile away from player
                const knockDx = dTileX - Math.round(p.x / TILE);
                const knockDy = dTileY - Math.round(p.y / TILE);
                const newX = d.x + Math.sign(knockDx) * TILE;
                const newY = d.y + Math.sign(knockDy) * TILE;
                d.targetX = Math.max(TILE, Math.min((COLS - 2) * TILE, newX));
                d.targetY = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, newY));
                d.walkingIn = true; // reuse walk-in movement to slide to new position
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
            const gRoundX = Math.round(goblin.x / TILE) * TILE;
            const gRoundY = Math.round(goblin.y / TILE) * TILE;
            const cgRoundX = catapultGoblin ? Math.round(catapultGoblin.x / TILE) * TILE : -999;
            const cgRoundY = catapultGoblin ? Math.round(catapultGoblin.y / TILE) * TILE : -999;
            const blocked = (!goblin.dead && nx === gRoundX && ny === gRoundY)
                || (catapultGoblin && nx === cgRoundX && ny === cgRoundY)
                || isTileBlockedByObjects(ntx, nty)
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

    // Update goblin
    if (goblin.dead) {
        goblin.respawnTimer--;
        if (goblin.respawnTimer <= 0) {
            // Every 6th goblin is a catapult goblin instead of normal/elite
            if (killCount % 6 === 5 && !catapultGoblin && !catapultSpawnedThisCycle) {
                spawnCatapultGoblin();
                catapultSpawnedThisCycle = true;
                goblin.respawnTimer = 300; // wait until catapult goblin finishes
            } else if (catapultGoblin) {
                // Wait for catapult goblin to finish before spawning next
                goblin.respawnTimer = 60;
            } else {
            goblin.dead = false;
            // Every 3rd goblin is elite (pink & fast), but not on catapult turns
            goblin.elite = (killCount % 3 === 2 && killCount % 6 !== 5);
            goblin.hp = goblin.elite ? 3 : 1;
            goblin.speed = goblin.elite ? 0.75 : 0.5;
            // Pick a random cave to spawn from
            goblin.spawnCave = Math.floor(Math.random() * CAVES.length);
            const cave = CAVES[goblin.spawnCave];
            // Start one tile inside the room from the cave
            const spawnX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
            const spawnY = cave.tileY === ROWS - 1 ? (ROWS - 2) * TILE : cave.tileY * TILE;
            goblin.x = spawnX;
            goblin.y = spawnY;
            goblin.destX = spawnX;
            goblin.destY = spawnY;
            goblin.targetRow = -1;
            goblin.moveSteps = 0;

            // Danger chord! Dissonant stinger on spawn
            ensureAudio();
            if (audioCtx) {
                const now = audioCtx.currentTime;
                if (goblin.elite) {
                    // Elite gets a nastier, lower, more menacing chord
                    const freqs = [110, 131, 165, 208]; // A2, C3, E3, Ab3 — diminished
                    freqs.forEach((f, i) => {
                        const osc = audioCtx.createOscillator();
                        const g = audioCtx.createGain();
                        osc.type = "sawtooth";
                        osc.frequency.setValueAtTime(f, now);
                        osc.frequency.linearRampToValueAtTime(f * 0.95, now + 0.4);
                        g.gain.setValueAtTime(0.12, now);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                        osc.connect(g); g.connect(audioCtx.destination);
                        osc.start(now + i * 0.03); osc.stop(now + 0.5);
                    });
                    // Low rumble underneath
                    const sub = audioCtx.createOscillator();
                    const sg = audioCtx.createGain();
                    sub.type = "sine";
                    sub.frequency.setValueAtTime(55, now);
                    sg.gain.setValueAtTime(0.2, now);
                    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    sub.connect(sg); sg.connect(audioCtx.destination);
                    sub.start(now); sub.stop(now + 0.6);
                } else {
                    // Normal goblin — quick minor stab
                    const freqs = [220, 262, 330]; // A3, C4, E4 — A minor
                    freqs.forEach((f, i) => {
                        const osc = audioCtx.createOscillator();
                        const g = audioCtx.createGain();
                        osc.type = "square";
                        osc.frequency.setValueAtTime(f, now);
                        g.gain.setValueAtTime(0.08, now);
                        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                        osc.connect(g); g.connect(audioCtx.destination);
                        osc.start(now + i * 0.02); osc.stop(now + 0.3);
                    });
                }
            }
        }
        } // end else (non-catapult spawn)
    } else {
        // Smooth pixel movement toward destination
        const dx = goblin.destX - goblin.x;
        const dy = goblin.destY - goblin.y;
        const dist = Math.abs(dx) + Math.abs(dy);

        if (dist < goblin.speed) {
            // Arrived at destination
            goblin.x = goblin.destX;
            goblin.y = goblin.destY;

            // Check if on a grid cell to sabotage
            const gc = Math.round(goblin.x / TILE) - GRID_X;
            const gr = Math.round(goblin.y / TILE) - GRID_Y;
            if (gr >= 0 && gr < GRID_ROWS && gc >= 0 && gc < GRID_COLS) {
                if (gc === goblin.targetCol && gr === goblin.targetRow) {
                    grid[gr][gc] = !grid[gr][gc];
                    cellFlash[gr][gc] = 30; // trigger red flash
                    if (audioCtx) playSabotageSound(audioCtx.currentTime);
                    goblin.targetRow = -1;
                }
            }

            // Pick next destination tile
            goblin.moveSteps++;
            if (goblin.targetRow < 0 || goblin.moveSteps > 5) {
                goblin.targetRow = Math.floor(Math.random() * GRID_ROWS);
                goblin.targetCol = Math.floor(Math.random() * GRID_COLS);
                goblin.moveSteps = 0;
            }

            const goalX = (GRID_X + goblin.targetCol) * TILE;
            const goalY = (GRID_Y + goblin.targetRow) * TILE;
            const gdx = goalX - goblin.x;
            const gdy = goalY - goblin.y;

            // Move one tile toward goal
            let nx = goblin.x, ny = goblin.y;
            if (Math.abs(gdx) > Math.abs(gdy)) {
                nx += Math.sign(gdx) * TILE;
                goblin.dir = gdx > 0 ? 3 : 2;
            } else if (gdy !== 0) {
                ny += Math.sign(gdy) * TILE;
                goblin.dir = gdy > 0 ? 0 : 1;
            }

            // Clamp to room bounds
            nx = Math.max(TILE, Math.min((COLS - 2) * TILE, nx));
            ny = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, ny));

            // Don't walk into player, dancers, or solid objects
            const gntx = Math.round(nx / TILE);
            const gnty = Math.round(ny / TILE);
            const cgBlockX = catapultGoblin ? Math.round(catapultGoblin.x / TILE) * TILE : -999;
            const cgBlockY = catapultGoblin ? Math.round(catapultGoblin.y / TILE) * TILE : -999;
            const gobBlocked = (nx === p.x && ny === p.y)
                || isTileBlockedByObjects(gntx, gnty)
                || isTileOccupiedByDancer(gntx, gnty)
                || (catapultGoblin && nx === cgBlockX && ny === cgBlockY);
            if (!gobBlocked) {
                goblin.destX = nx;
                goblin.destY = ny;
            }
        } else {
            // Move toward destination smoothly
            if (Math.abs(dx) > 0) {
                goblin.x += Math.sign(dx) * Math.min(goblin.speed, Math.abs(dx));
            }
            if (Math.abs(dy) > 0) {
                goblin.y += Math.sign(dy) * Math.min(goblin.speed, Math.abs(dy));
            }
            // Animate walk frame
            goblin.frameTimer++;
            if (goblin.frameTimer >= 8) {
                goblin.frameTimer = 0;
                goblin.frame = (goblin.frame + 1) % 4;
            }
        }
    }

    // Decrement goblin hurt flash timer
    if (goblin.hurtTimer > 0) goblin.hurtTimer--;

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

    // Sequencer step
    if (playing) {
        if (!lastStepTime) lastStepTime = performance.now();
        const now = performance.now();
        if (now - lastStepTime >= stepMs) {
            lastStepTime += stepMs;
            // Play active drums for current step
            ensureAudio();
            const t = audioCtx ? audioCtx.currentTime : 0;
            if (audioCtx) {
                for (let r = 0; r < GRID_ROWS; r++) {
                    if (grid[r][currentStep]) drumFns[r](t);
                }
            }
            currentStep = (currentStep + 1) % GRID_COLS;
        }
    }
}

// ---- Game Over ----
let gameOverTimer = 0; // counts up for animation timing
let sadSongStarted = false;

function triggerGameOver() {
    gameState = "gameover";
    gameOverTimer = 0;
    sadSongStarted = false;
    finalScore = killCount;

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
    // Reset grid to starter beat
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            grid[r][c] = false;
    grid[3][0] = true; grid[3][8] = true;
    grid[2][4] = true; grid[2][12] = true;

    // Reset player
    player.x = (GRID_X + 7) * TILE;
    player.y = (GRID_Y + GRID_ROWS + 1) * TILE;
    player.destX = player.x;
    player.destY = player.y;
    player.dir = 0;
    player.frame = 0;
    player.attacking = false;
    player.attackTimer = 0;
    player.swordHit = false;

    // Reset enemies
    killCount = 0;
    goblin.dead = true;
    goblin.respawnTimer = 300;
    catapultGoblin = null;
    catapultSpawnedThisCycle = false;

    // Clear dancers and effects
    dancers.length = 0;
    deathParticles = [];
    deathText = null;
    screenFlash = 0;
    screenShake = 0;
    hitFreeze = 0;
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            cellFlash[r][c] = 0;

    // Reset sequencer and frame timing
    currentStep = 0;
    lastStepTime = performance.now();
    lastTime = 0;
    frameAccum = 0;
}

// ---- Catapult Goblin Logic ----
function spawnCatapultGoblin() {
    const caveIdx = Math.floor(Math.random() * CAVES.length);
    const cave = CAVES[caveIdx];
    const spawnX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
    const spawnY = cave.tileY === ROWS - 1 ? (ROWS - 2) * TILE : cave.tileY * TILE;

    // Pick a random grid cell as boulder target
    const tRow = Math.floor(Math.random() * GRID_ROWS);
    const tCol = Math.floor(Math.random() * GRID_COLS);

    // Calculate a stop position: 2 tiles outside the grid area
    let stopX, stopY;
    if (cave.tileX === 0) {
        stopX = TILE * 2; stopY = (GRID_Y + tRow) * TILE;
    } else if (cave.tileX === COLS - 1) {
        stopX = (COLS - 3) * TILE; stopY = (GRID_Y + tRow) * TILE;
    } else {
        stopX = (GRID_X + tCol) * TILE; stopY = (ROWS - 3) * TILE;
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
            const targetPixelY = (GRID_Y + cg.targetRow) * TILE + TILE / 2;
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
                    if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
                        grid[r][c] = !grid[r][c];
                        cellFlash[r][c] = 30;
                    }
                }
            }
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
            const pGridRow = Math.round(player.y / TILE) - GRID_Y;
            if (pGridCol >= cc - 1 && pGridCol <= cc + 1 && pGridRow >= cr - 1 && pGridRow <= cr + 1) {
                // Player crushed by boulder!
                triggerGameOver();
                return;
            }

            cg.phase = "retreating";
            // Set retreat destination back to cave
            const cave = CAVES[cg.caveIndex];
            const retreatX = cave.tileX === 0 ? TILE : cave.tileX === COLS - 1 ? (COLS - 2) * TILE : cave.tileX * TILE;
            const retreatY = cave.tileY === ROWS - 1 ? (ROWS - 2) * TILE : cave.tileY * TILE;
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

function drawText(text, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.font = `${size * SCALE}px monospace`;
    ctx.fillText(text, x * SCALE, y * SCALE);
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

    // Wooden plank floor
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const col = (r + c) % 2 === 0 ? "#8B6914" : "#7A5C12";
            drawRect(c * TILE, r * TILE, TILE, TILE, col);
            // Plank line
            drawRect(c * TILE, r * TILE + TILE - 1, TILE, 1, "rgba(0,0,0,0.15)");
        }
    }

    // Tent-style walls — striped top border (red/cream carnival stripes)
    for (let c = 0; c < COLS; c++) {
        const stripe = c % 2 === 0 ? "#BF7538" : "#EBEBE3";
        drawRect(c * TILE, 0, TILE, TILE, stripe);

        // Bottom wall — ticket booth style
        drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, c % 2 === 0 ? "#3A6168" : "#4a7a82");
    }
    // Side walls — booth posts
    for (let r = 0; r < ROWS; r++) {
        drawRect(0, r * TILE, TILE, TILE, r % 2 === 0 ? "#3A6168" : "#4a7a82");
        drawRect((COLS - 1) * TILE, r * TILE, TILE, TILE, r % 2 === 0 ? "#3A6168" : "#4a7a82");
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
        drawRect(cx, cy - 2, TILE, TILE + 4, "#1a1a1a");
        // Rocky arch around cave
        drawRect(cx - 2, cy - 4, TILE + 4, 3, "#5a5a4a");  // top rocks
        drawRect(cx - 2, cy + TILE + 1, TILE + 4, 3, "#5a5a4a");  // bottom rocks
        if (cave.tileX > 0) drawRect(cx - 3, cy - 2, 3, TILE + 4, "#4a4a3a"); // left edge
        if (cave.tileX < COLS - 1) drawRect(cx + TILE, cy - 2, 3, TILE + 4, "#4a4a3a"); // right edge
        // Stalactites
        drawRect(cx + 3, cy - 2, 2, 4, "#6a6a5a");
        drawRect(cx + 9, cy - 2, 2, 3, "#6a6a5a");
        // Stalagmites
        drawRect(cx + 5, cy + TILE - 2, 2, 4, "#6a6a5a");
        drawRect(cx + 11, cy + TILE - 1, 2, 3, "#6a6a5a");
        // Eye gleam inside cave (if goblin is dead / about to respawn from this cave)
        const willSpawnHere = goblin.dead && goblin.respawnTimer < 90;
        if (willSpawnHere) {
            // Show eyes in the cave it'll spawn from
            const showEyes = goblin.respawnTimer < 60 && ci === goblin.spawnCave;
            if (showEyes) {
                const caveEyeCol = goblin.elite ? "#ffee44" : "#cc2222";
                drawRect(cx + 5, cy + 5, 2, 2, caveEyeCol);
                drawRect(cx + 9, cy + 5, 2, 2, caveEyeCol);
            }
        }
    }

    // Carnival string lights along top
    for (let c = 1; c < COLS - 1; c++) {
        const bulbY = TILE + 6;
        const bulbX = c * TILE + TILE / 2;
        // Wire
        drawRect(c * TILE, TILE + 5, TILE, 1, "#2a2a2a");
        // Bulb
        const bulbColors = ["#F6CC60", "#BF7538", "#BFCDC0", "#EBEBE3"];
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
        const bulbColors = ["#F6CC60", "#BF7538", "#BFCDC0", "#EBEBE3"];
        drawRect(lx - 1, ly, 3, 3, bulbColors[(c + 2) % bulbColors.length]);
    }

    // Row labels (O, H, S, K) in the column just left of the first beat block
    const ROW_LETTERS = ["O", "H", "S", "K"];
    for (let r = 0; r < GRID_ROWS; r++) {
        const lx = (GRID_X - 1) * TILE + 3;
        const ly = (GRID_Y + r) * TILE + 12;
        drawText(ROW_LETTERS[r], lx, ly, PAL.gridOn[r], 5);
    }

    // Grid blocks
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const bx = (GRID_X + c) * TILE;
            const by = (GRID_Y + r) * TILE;
            const on = grid[r][c];

            // Block background
            drawRect(bx, by, TILE, TILE, PAL.gridBorder);
            drawRect(bx + 1, by + 1, TILE - 2, TILE - 2, on ? PAL.gridOn[r] : PAL.gridOff);

            // Beat markers (every 4th column)
            if (!on && c % 4 === 0) {
                drawRect(bx + 1, by + 1, TILE - 2, TILE - 2, "#2f4f53");
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
                ctx.fillStyle = "#ff2222";
                ctx.globalAlpha = cellFlash[r][c] / 30 * 0.6;
                ctx.fillRect((bx + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, (TILE - 2) * SCALE);
                ctx.globalAlpha = 1.0;
                // "!" indicator for first half of flash
                if (cellFlash[r][c] > 15) {
                    drawText("!", bx + 5, by - 4, "#ff4444", 4);
                }
                cellFlash[r][c]--;
            }
        }
    }

    // Playhead
    if (playing) {
        const px = (GRID_X + currentStep) * TILE;
        ctx.fillStyle = PAL.playhead;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(px * SCALE, GRID_Y * TILE * SCALE, TILE * SCALE, GRID_ROWS * TILE * SCALE);
        ctx.globalAlpha = 1.0;
        // Top marker
        drawRect(px + 2, (GRID_Y - 1) * TILE + 10, TILE - 4, 4, PAL.playhead);
    }

    // Step numbers (below grid)
    for (let c = 0; c < GRID_COLS; c++) {
        const num = String(c + 1);
        const tx = (GRID_X + c) * TILE + (c < 9 ? 4 : 1);
        drawText(num, tx, (GRID_Y + GRID_ROWS) * TILE + 8, c === currentStep && playing ? PAL.playhead : "#5a8a8f", 3);
    }

    // Kill counter — large pixel-art number with skull
    {
        const kcY = (GRID_Y + GRID_ROWS) * TILE + 16;
        const kcX = GRID_X * TILE;
        // Background panel
        const pxSz = 3;
        const digitW = (3 * pxSz + pxSz); // per digit width
        const numDigits = String(killCount).length;
        const panelW = 14 + numDigits * digitW + 10;
        const panelH = 5 * pxSz + 6;
        drawRect(kcX - 2, kcY - 2, panelW + 4, panelH + 4, "#1a3438");
        drawRect(kcX, kcY, panelW, panelH, "#243e42");
        drawRect(kcX, kcY, panelW, 1, "#3a6a70");
        // Skull icon (10x10 pixel art)
        const sx = kcX + 2, sy = kcY + 3;
        drawRect(sx + 1, sy, 8, 2, "#EBEBE3");     // top cranium
        drawRect(sx, sy + 2, 10, 4, "#EBEBE3");     // mid cranium
        drawRect(sx + 1, sy + 6, 8, 2, "#EBEBE3");  // lower face
        drawRect(sx + 2, sy + 8, 2, 2, "#EBEBE3");  // left tooth
        drawRect(sx + 6, sy + 8, 2, 2, "#EBEBE3");  // right tooth
        drawRect(sx + 2, sy + 3, 2, 2, "#2c4a4f");  // left eye
        drawRect(sx + 6, sy + 3, 2, 2, "#2c4a4f");  // right eye
        drawRect(sx + 4, sy + 5, 2, 2, "#2c4a4f");  // nose
        drawRect(sx + 4, sy + 8, 2, 2, "#2c4a4f");  // tooth gap
        // Large pixel-art kill number
        const numX = kcX + 14;
        const numY = kcY + 3;
        drawPixelDigits(killCount, numX + (numDigits * digitW) / 2, numY, "#EBEBE3", pxSz);
    }

    // Control blocks
    for (const key of ["tempoUp", "tempoDown", "reset"]) {
        const blk = CTRL_BLOCKS[key];
        const bx = blk.tileX * TILE;
        const by = blk.tileY * TILE;
        // Block body
        drawRect(bx, by, TILE, TILE, "#2a4448");
        drawRect(bx + 1, by + 1, TILE - 2, TILE - 2, blk.color);
        // 3D effect
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect((bx + 1) * SCALE, (by + 1) * SCALE, (TILE - 2) * SCALE, 2 * SCALE);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect((bx + 1) * SCALE, (by + TILE - 3) * SCALE, (TILE - 2) * SCALE, 2 * SCALE);

        if (key === "tempoDown") {
            // Down arrow icon
            const iconColor = "#2a4448";
            drawRect(bx + 6, by + 3, 4, 6, iconColor);          // shaft
            ctx.fillStyle = iconColor;
            ctx.beginPath();
            ctx.moveTo((bx + 3) * SCALE, (by + 9) * SCALE);
            ctx.lineTo((bx + 13) * SCALE, (by + 9) * SCALE);
            ctx.lineTo((bx + 8) * SCALE, (by + 14) * SCALE);
            ctx.fill();
        } else if (key === "tempoUp") {
            // Up arrow icon
            const iconColor = "#2a4448";
            drawRect(bx + 6, by + 7, 4, 6, iconColor);          // shaft
            ctx.fillStyle = iconColor;
            ctx.beginPath();
            ctx.moveTo((bx + 3) * SCALE, (by + 7) * SCALE);
            ctx.lineTo((bx + 13) * SCALE, (by + 7) * SCALE);
            ctx.lineTo((bx + 8) * SCALE, (by + 2) * SCALE);
            ctx.fill();
        } else {
            // Reset icon: X mark
            const iconColor = "#2a4448";
            // Diagonal line top-left to bottom-right
            drawRect(bx + 4, by + 4, 2, 2, iconColor);
            drawRect(bx + 6, by + 6, 2, 2, iconColor);
            drawRect(bx + 8, by + 8, 2, 2, iconColor);
            drawRect(bx + 10, by + 10, 2, 2, iconColor);
            // Diagonal line top-right to bottom-left
            drawRect(bx + 10, by + 4, 2, 2, iconColor);
            drawRect(bx + 8, by + 6, 2, 2, iconColor);
            drawRect(bx + 6, by + 8, 2, 2, iconColor);
            drawRect(bx + 4, by + 10, 2, 2, iconColor);
        }
    }

    // Large pixel-art BPM display between tempo arrows
    {
        const bpmBlockX = CTRL_BLOCKS.tempoUp.tileX * TILE;
        const bpmAreaTop = (CTRL_BLOCKS.tempoUp.tileY + 1) * TILE;
        const bpmAreaBottom = CTRL_BLOCKS.tempoDown.tileY * TILE;
        const bpmCenterX = bpmBlockX + TILE / 2;
        const bpmCenterY = (bpmAreaTop + bpmAreaBottom) / 2;
        // Background panel
        drawRect(bpmBlockX, bpmAreaTop, TILE, bpmAreaBottom - bpmAreaTop, "#1a3438");
        drawRect(bpmBlockX + 1, bpmAreaTop + 1, TILE - 2, bpmAreaBottom - bpmAreaTop - 2, "#243e42");
        // Digits
        const pxSize = 3;
        const digitH = 5 * pxSize;
        drawPixelDigits(bpm, bpmCenterX, bpmCenterY - digitH / 2 - 4, "#F6CC60", pxSize);
        // "BPM" label below digits
        drawText("BPM", bpmCenterX - 7, bpmCenterY + digitH / 2 + 2, "#8ab0b4", 3);
    }

    // Dancers (rendered behind player/goblin)
    for (const d of dancers) {
        drawDancer(d);
    }

    // Goblin
    if (!goblin.dead) {
        drawGoblin();
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

    // Death text
    if (deathText) {
        ctx.globalAlpha = Math.min(1, deathText.timer / 20);
        drawText(deathText.text, deathText.x, deathText.y, deathText.color || "#cc2222", deathText.scale || 5);
        ctx.globalAlpha = 1.0;
    }

    // Screen flash (elite kill)
    if (screenFlash > 0) {
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = screenFlash / 15 * 0.6;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    // Player shadow
    drawRect(player.x + 2, player.y + player.h - 2, player.w - 4, 4, PAL.shadow);

    // Sword (draw behind player for up-facing, in front otherwise)
    if (player.attacking && player.dir === 1) drawSword();

    // Player sprite
    drawPlayer();

    // Sword (in front for down/left/right)
    if (player.attacking && player.dir !== 1) drawSword();

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
        drawRect(bannerX - 2, bannerY - 2, bannerW + 4, bannerH + 4, "#1a3438");
        // Inner fill (matches carnival tent style)
        drawRect(bannerX, bannerY, bannerW, bannerH, "#2a4a50");
        // Highlight edge top
        drawRect(bannerX, bannerY, bannerW, 2, "#3a6a70");
        // Highlight edge bottom
        drawRect(bannerX, bannerY + bannerH - 2, bannerW, 2, "#1a2a2e");
        // Striped accents (carnival style)
        for (let i = 0; i < bannerW; i += 8) {
            if (Math.floor(i / 8) % 2 === 0) {
                drawRect(bannerX + i, bannerY, Math.min(8, bannerW - i), 2, "#BF3B53");
            }
        }

        // "PAUSED" text centered
        const pauseText = "PAUSED";
        const textScale = 7;
        const textW = pauseText.length * textScale * 1.1;
        const textX = bannerX + bannerW / 2 - textW / 2;
        const textY = bannerY + 12;
        // Shadow
        drawText(pauseText, textX + 1, textY + 1, "#0a1a1e", textScale);
        // Main text
        drawText(pauseText, textX, textY, "#F6CC60", textScale);

        // Controls section
        const ctrlX = bannerX + 16;
        const ctrlY = textY + 22;
        const ctrlCol = "#BFCDC0";
        const labelCol = "#F6CC60";
        drawText("CONTROLS:", ctrlX, ctrlY, labelCol, 4);
        drawText("ARROWS", ctrlX, ctrlY + 12, labelCol, 4);
        drawText("Move around", ctrlX + 32, ctrlY + 12, ctrlCol, 4);
        drawText("SPACE", ctrlX, ctrlY + 22, labelCol, 4);
        drawText("Sword attack", ctrlX + 28, ctrlY + 22, ctrlCol, 4);
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

function drawPlayer() {
    const p = player;
    const px = p.x;
    const py = p.y;
    const bob = p.frame % 2 === 1 ? 1 : 0;

    // Body
    drawRect(px + 3, py + 2 - bob, 10, 10, PAL.player);
    // Darker sides
    drawRect(px + 3, py + 2 - bob, 2, 10, PAL.playerDark);
    drawRect(px + 11, py + 2 - bob, 2, 10, PAL.playerDark);
    // Head
    drawRect(px + 4, py - 2 - bob, 8, 6, PAL.player);
    // Eyes
    const eyeDir = [
        [0, 2],  // down
        [0, -2], // up
        [-1, 0], // left
        [1, 0],  // right
    ][p.dir];
    if (p.dir !== 1) { // don't draw eyes facing up
        drawRect(px + 5 + eyeDir[0], py + bob + eyeDir[1], 2, 2, "#1f3a3f");
        drawRect(px + 9 + eyeDir[0], py + bob + eyeDir[1], 2, 2, "#1f3a3f");
    }
    // Hair/hat
    drawRect(px + 3, py - 3 - bob, 10, 3, "#BF7538");
    // Feet
    const walkOffset = p.frame === 1 ? 2 : p.frame === 3 ? -2 : 0;
    drawRect(px + 4 + walkOffset, py + 12, 3, 3, PAL.playerDark);
    drawRect(px + 9 - walkOffset, py + 12, 3, 3, PAL.playerDark);
}

function drawSword() {
    const p = player;
    const px = p.x;
    const py = p.y;
    const cx = px + p.w / 2; // player center x
    const cy = py + p.h / 2; // player center y
    const progress = 1 - (p.attackTimer / p.attackDuration);

    // Overhead arc: sword rotates from behind player to in front
    // progress 0→1 maps to angle arc depending on facing direction
    const bladeLen = 13;
    const hiltLen = 3;

    ctx.save();
    const sbox = getSwordBox();

    // Sword glow
    ctx.fillStyle = PAL.swordGlow;
    const swing = Math.sin(progress * Math.PI);
    ctx.globalAlpha = 0.4 * swing;
    ctx.fillRect((sbox.x - 2) * SCALE, (sbox.y - 2) * SCALE, (sbox.w + 4) * SCALE, (sbox.h + 4) * SCALE);
    ctx.globalAlpha = 1.0;

    // Calculate swing angle based on direction
    // Sword arcs overhead in the direction the player faces
    let angle;
    const shoulderX = cx, shoulderY = py + 2; // pivot near shoulders
    switch (p.dir) {
        case 0: // down — arc from upper-left to lower-right
            angle = -Math.PI * 0.8 + progress * Math.PI * 1.2;
            break;
        case 1: // up — arc from lower-right to upper-left
            angle = Math.PI * 0.8 - progress * Math.PI * 1.2;
            break;
        case 2: // left — arc from upper-right down to left
            angle = -Math.PI * 0.3 - progress * Math.PI * 0.9;
            break;
        case 3: // right — arc from upper-left down to right
            angle = -Math.PI * 0.7 + progress * Math.PI * 0.9;
            break;
    }

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Hilt (short stub behind pivot)
    const hx = shoulderX - cosA * hiltLen;
    const hy = shoulderY - sinA * hiltLen;

    // Tip (end of blade)
    const tx = shoulderX + cosA * bladeLen;
    const ty = shoulderY + sinA * bladeLen;

    // Draw blade as a thick line (3px wide)
    ctx.strokeStyle = PAL.sword;
    ctx.lineWidth = 3 * SCALE;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shoulderX * SCALE, shoulderY * SCALE);
    ctx.lineTo(tx * SCALE, ty * SCALE);
    ctx.stroke();

    // Draw hilt as crossguard
    ctx.strokeStyle = "#8a7040";
    ctx.lineWidth = 2 * SCALE;
    ctx.beginPath();
    ctx.moveTo(shoulderX * SCALE, shoulderY * SCALE);
    ctx.lineTo(hx * SCALE, hy * SCALE);
    ctx.stroke();

    // Crossguard perpendicular to blade
    const perpX = -sinA * 3;
    const perpY = cosA * 3;
    ctx.lineWidth = 2 * SCALE;
    ctx.beginPath();
    ctx.moveTo((shoulderX + perpX) * SCALE, (shoulderY + perpY) * SCALE);
    ctx.lineTo((shoulderX - perpX) * SCALE, (shoulderY - perpY) * SCALE);
    ctx.stroke();

    // Sparkle at tip
    if (swing > 0.5 && p.swordHit) {
        if (Math.random() > 0.3) {
            ctx.fillStyle = "#fff";
            ctx.globalAlpha = swing;
            ctx.fillRect((tx - 1) * SCALE, ty * SCALE, 3 * SCALE, 1 * SCALE);
            ctx.fillRect(tx * SCALE, (ty - 1) * SCALE, 1 * SCALE, 3 * SCALE);
            ctx.globalAlpha = 1.0;
        }
    }

    ctx.restore();
}

function drawGoblin() {
    const g = goblin;
    const gx = g.x;
    const gy = g.y;
    const bob = g.frame % 2 === 1 ? 1 : 0;

    // Color palette: elite changes color based on HP (3=pink, 2=dark magenta, 1=bright red)
    let bodyCol, darkCol, headCol, eyeCol;
    if (g.hurtTimer > 0 && g.hurtTimer % 4 < 2) {
        // White flash when hurt
        bodyCol = "#ffffff"; darkCol = "#dddddd"; headCol = "#ffffff"; eyeCol = "#ffee44";
    } else if (!g.elite) {
        bodyCol = "#4a8a3a"; darkCol = "#3a6a2a"; headCol = "#5a9a4a"; eyeCol = "#cc2222";
    } else if (g.hp === 3) {
        // Full HP elite: pink
        bodyCol = "#c45a8a"; darkCol = "#a43a6a"; headCol = "#d46a9a"; eyeCol = "#ffee44";
    } else if (g.hp === 2) {
        // Hurt elite: darker magenta, angrier
        bodyCol = "#8a2a5a"; darkCol = "#6a1a3a"; headCol = "#aa3a6a"; eyeCol = "#ff4444";
    } else {
        // Near death elite: bright red, furious
        bodyCol = "#cc2222"; darkCol = "#991111"; headCol = "#ee3333"; eyeCol = "#ffee44";
    }

    // Shadow
    drawRect(gx + 3, gy + g.h - 2, g.w - 6, 3, PAL.shadow);
    // Body
    drawRect(gx + 4, gy + 3 - bob, 8, 9, bodyCol);
    // Darker sides
    drawRect(gx + 4, gy + 3 - bob, 2, 9, darkCol);
    drawRect(gx + 10, gy + 3 - bob, 2, 9, darkCol);
    // Head
    drawRect(gx + 3, gy - 1 - bob, 10, 6, headCol);
    // Pointy ears
    drawRect(gx + 1, gy - bob, 3, 3, headCol);
    drawRect(gx + 12, gy - bob, 3, 3, headCol);
    // Eyes
    if (g.dir !== 1) {
        const ed = [[0, 2], [0, -2], [-1, 0], [1, 0]][g.dir];
        drawRect(gx + 5 + ed[0], gy + 1 - bob + ed[1], 2, 2, eyeCol);
        drawRect(gx + 9 + ed[0], gy + 1 - bob + ed[1], 2, 2, eyeCol);
    }
    // Mouth (little fangs)
    if (g.dir === 0) {
        drawRect(gx + 6, gy + 4 - bob, 1, 2, "#EBEBE3");
        drawRect(gx + 9, gy + 4 - bob, 1, 2, "#EBEBE3");
    }
    // Feet
    const wo = g.frame === 1 ? 2 : g.frame === 3 ? -2 : 0;
    drawRect(gx + 5 + wo, gy + 12, 3, 2, darkCol);
    drawRect(gx + 8 - wo, gy + 12, 3, 2, darkCol);
}

function drawCatapultGoblin() {
    const cg = catapultGoblin;
    if (!cg) return;

    const gx = cg.x;
    const gy = cg.y;
    const bob = cg.frame % 2 === 1 ? 1 : 0;

    // Colors: bronze/brown with golden shimmer
    const bodyCol = "#8B5E3C";
    const darkCol = "#6B3E1C";
    const headCol = "#9B6E4C";
    const eyeCol = "#ffee44";

    // Invincibility shimmer — oscillating brightness
    const shimmerPhase = (performance.now() / 100) % (Math.PI * 2);
    const shimmerAlpha = 0.15 + Math.sin(shimmerPhase) * 0.1;

    // Shadow
    drawRect(gx + 3, gy + cg.h - 2, cg.w - 6, 3, PAL.shadow);

    // Catapult behind goblin (wooden frame)
    const catX = gx - 4;
    const catY = gy + 2;
    drawRect(catX, catY + 6, 24, 3, "#5C3A1E"); // base beam
    drawRect(catX + 2, catY + 2, 3, 6, "#5C3A1E"); // left upright
    drawRect(catX + 19, catY + 2, 3, 6, "#5C3A1E"); // right upright
    drawRect(catX + 4, catY, 16, 2, "#7B5A3A"); // arm
    // Bowl/cup at end of arm
    drawRect(catX + 2, catY - 2, 5, 3, "#4A2A0E");

    // Body
    drawRect(gx + 4, gy + 3 - bob, 8, 9, bodyCol);
    drawRect(gx + 4, gy + 3 - bob, 2, 9, darkCol);
    drawRect(gx + 10, gy + 3 - bob, 2, 9, darkCol);
    // Head
    drawRect(gx + 3, gy - 1 - bob, 10, 6, headCol);
    // Pointy ears
    drawRect(gx + 1, gy - bob, 3, 3, headCol);
    drawRect(gx + 12, gy - bob, 3, 3, headCol);
    // Eyes
    const ed = [[0, 2], [0, -2], [-1, 0], [1, 0]][cg.dir] || [0, 2];
    drawRect(gx + 5 + ed[0], gy + 1 - bob + ed[1], 2, 2, eyeCol);
    drawRect(gx + 9 + ed[0], gy + 1 - bob + ed[1], 2, 2, eyeCol);
    // Fangs
    drawRect(gx + 6, gy + 4 - bob, 1, 2, "#EBEBE3");
    drawRect(gx + 9, gy + 4 - bob, 1, 2, "#EBEBE3");
    // Feet
    const cwo = cg.frame === 1 ? 2 : cg.frame === 3 ? -2 : 0;
    drawRect(gx + 5 + cwo, gy + 12, 3, 2, darkCol);
    drawRect(gx + 8 - cwo, gy + 12, 3, 2, darkCol);

    // Invincibility shimmer overlay
    ctx.fillStyle = "#ffee44";
    ctx.globalAlpha = shimmerAlpha;
    ctx.fillRect((gx + 2) * SCALE, (gy - 2 - bob) * SCALE, 12 * SCALE, 16 * SCALE);
    ctx.globalAlpha = 1.0;

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

        // Shadow on ground (grows as boulder descends)
        const shadowSize = 3 + (1 - Math.abs(arcY) / arcHeight) * 4;
        drawRect(bx - shadowSize / 2, b.targetY + 2, shadowSize, 2, PAL.shadow);

        // Boulder (dark gray rock)
        drawRect(bx - 4, by - 4, 8, 8, "#6a6a6a");
        drawRect(bx - 3, by - 3, 6, 6, "#888888");
        // Highlight
        drawRect(bx - 2, by - 3, 2, 2, "#aaaaaa");
    }

    // Target warning during aiming phase
    if (cg.phase === "aiming") {
        const flashOn = Math.floor(cg.phaseTimer / 4) % 2 === 0;
        if (flashOn) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = cg.targetRow + dr;
                    const c = cg.targetCol + dc;
                    if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
                        const tx = (GRID_X + c) * TILE;
                        const ty = (GRID_Y + r) * TILE;
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

function drawDancer(d) {
    const pal = d.palette;
    const step = (currentStep + d.phase) % 16;

    // Smooth interpolation: how far through the current step (0.0 - 1.0)
    const now = performance.now();
    const stepProgress = lastStepTime ? Math.min((now - lastStepTime) / stepMs, 1.0) : 0;
    // Fractional step position (e.g., step 4.6 means 60% through step 4)
    const smoothStep = step + stepProgress;

    // --- Smooth bob ---
    // Target bob heights: 3px on quarter beats, 1px on 8th beats, 0px otherwise
    const onBeat = (step % 4 === 0);
    const onEighth = (step % 2 === 0);
    const targetBob = onBeat ? 3 : onEighth ? 1 : 0;
    // Next step's target
    const nextStep = (step + 1) % 16;
    const nextOnBeat = (nextStep % 4 === 0);
    const nextOnEighth = (nextStep % 2 === 0);
    const nextBob = nextOnBeat ? 3 : nextOnEighth ? 1 : 0;
    // Ease out from current bob, ease in toward next
    // Use a sine curve for natural bounce
    const easedProgress = Math.sin(stepProgress * Math.PI / 2); // ease-out
    const bob = targetBob + (nextBob - targetBob) * easedProgress;

    // --- Smooth arms ---
    // Arms up on quarter beats, smoothly transition
    const armTarget = onBeat ? 1.0 : 0.0;
    const nextArmTarget = nextOnBeat ? 1.0 : 0.0;
    const armBlend = armTarget + (nextArmTarget - armTarget) * easedProgress;
    // Arm Y offset: 0 = down position (dy+5), 1 = up position (dy+2)
    const armDownY = 5;
    const armUpY = 2;
    const armY = armDownY + (armUpY - armDownY) * armBlend;
    const armH = 4 + (3 - 4) * armBlend; // height transitions from 4 (down) to 3 (up)

    // --- Smooth feet ---
    const footWave = Math.sin(smoothStep * Math.PI); // continuous sine wave
    const footOffset = footWave * 1.5;

    const dx = d.x;
    const dy = d.y;

    // Shadow (squishes when dancer is higher)
    const shadowW = 8 + bob * 0.5;
    drawRect(dx + 2 - bob * 0.25, dy + 13, shadowW, 2, PAL.shadow);
    // Body
    drawRect(dx + 3, dy + 4 - bob, 6, 7, pal.body);
    drawRect(dx + 3, dy + 4 - bob, 1, 7, pal.dark);
    drawRect(dx + 8, dy + 4 - bob, 1, 7, pal.dark);
    // Head
    drawRect(dx + 3, dy - bob, 6, 5, pal.head);
    // Hair
    drawRect(dx + 2, dy - 1 - bob, 8, 2, pal.hair);
    // Eyes
    drawRect(dx + 4, dy + 2 - bob, 1, 1, "#1f3a3f");
    drawRect(dx + 7, dy + 2 - bob, 1, 1, "#1f3a3f");
    // Arms (smoothly interpolated position)
    drawRect(dx + 1, dy + armY - bob, 2, armH, pal.body);
    drawRect(dx + 9, dy + armY - bob, 2, armH, pal.body);
    // Feet (smooth sine wave)
    drawRect(dx + 3 + footOffset, dy + 11, 2, 2, pal.dark);
    drawRect(dx + 7 - footOffset, dy + 11, 2, 2, pal.dark);
}

// ---- Game Loop (60 fps) ----
let lastTime = 0;
const FRAME_MS = 1000 / 60;
let frameAccum = 0;
// ---- Title Screen (page 1: logo only) ----
function renderTitleScreen() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background
    drawRect(0, 0, W, H, "#0a0a12");

    // Starfield
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(titleBlink * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#F6CC60" : "#EBEBE3");
    }
    ctx.globalAlpha = 1;

    // === Centered Logo ===
    const centerY = H / 2 - 50;

    // "REVENGE OF THE" smaller above
    const logoColor1 = "#BF7538";
    const logoColor2 = "#F6CC60";
    const subTitle = "REVENGE OF THE";
    const subW = subTitle.length * 4;
    const subX = W / 2 - subW / 2;
    for (let i = 0; i < subTitle.length; i++) {
        const charX = subX + i * 4;
        const wobble = Math.sin(titleBlink * 0.08 + i * 0.5) * 1;
        drawText(subTitle[i], charX, centerY + wobble, logoColor1, 4);
    }

    // Big "GROOVE"
    const grooveText = "GROOVE";
    const groovePx = 5;
    const grooveW = grooveText.length * (groovePx * 4 + groovePx);
    const grooveX = W / 2 - grooveW / 2;
    const grooveY = centerY + 16;
    for (let i = 0; i < grooveText.length; i++) {
        const charX = grooveX + i * (groovePx * 4 + groovePx);
        const bounce = Math.sin(titleBlink * 0.06 + i * 0.8) * 3;
        const col = i % 2 === 0 ? logoColor2 : logoColor1;
        drawText(grooveText[i], charX + 1, grooveY + bounce + 1, "#000000", groovePx * 4);
        drawText(grooveText[i], charX, grooveY + bounce, col, groovePx * 4);
    }

    // Big "GOBLINS"
    const goblinsText = "GOBLINS";
    const gobPx = 5;
    const gobW = goblinsText.length * (gobPx * 4 + gobPx);
    const gobX = W / 2 - gobW / 2;
    const gobY = grooveY + 30;
    for (let i = 0; i < goblinsText.length; i++) {
        const charX = gobX + i * (gobPx * 4 + gobPx);
        const bounce = Math.sin(titleBlink * 0.06 + i * 0.8 + 3) * 3;
        const col = i % 2 === 0 ? "#66cc66" : "#44aa44";
        drawText(goblinsText[i], charX + 1, gobY + bounce + 1, "#000000", gobPx * 4);
        drawText(goblinsText[i], charX, gobY + bounce, col, gobPx * 4);
    }

    // Pixel art goblin face below logo
    const faceX = W / 2 - 24;
    const faceY = gobY + 40;
    const fp = 3;
    drawRect(faceX + 2*fp, faceY, 4*fp, fp, "#44aa44");
    drawRect(faceX + fp, faceY + fp, 6*fp, fp, "#44aa44");
    drawRect(faceX, faceY + 2*fp, 8*fp, 3*fp, "#66cc66");
    drawRect(faceX + fp, faceY + 5*fp, 6*fp, fp, "#66cc66");
    drawRect(faceX + 2*fp, faceY + 6*fp, 4*fp, fp, "#44aa44");
    drawRect(faceX - fp, faceY + 2*fp, fp, 2*fp, "#44aa44");
    drawRect(faceX + 8*fp, faceY + 2*fp, fp, 2*fp, "#44aa44");
    drawRect(faceX + 2*fp, faceY + 3*fp, fp, fp, "#ff2222");
    drawRect(faceX + 5*fp, faceY + 3*fp, fp, fp, "#ff2222");
    drawRect(faceX + 2*fp, faceY + 5*fp, 4*fp, fp, "#1a1a1a");
    drawRect(faceX + 3*fp, faceY + 5*fp, fp, fp, "#EBEBE3");
    drawRect(faceX + 5*fp, faceY + 5*fp, fp, fp, "#EBEBE3");
    drawRect(faceX - fp, faceY + fp, fp, 3*fp, "#333");
    drawRect(faceX + 8*fp, faceY + fp, fp, 3*fp, "#333");
    drawRect(faceX + fp, faceY - fp, 6*fp, fp, "#333");
    drawRect(faceX - 2*fp, faceY + fp, 2*fp, 2*fp, "#BF7538");
    drawRect(faceX + 8*fp, faceY + fp, 2*fp, 2*fp, "#BF7538");

    // Musical notes floating around the face
    const notePositions = [
        { x: faceX - 20, y: faceY - 10 },
        { x: faceX + 40, y: faceY - 5 },
        { x: faceX - 15, y: faceY + 20 },
        { x: faceX + 45, y: faceY + 15 },
    ];
    for (let i = 0; i < notePositions.length; i++) {
        const np = notePositions[i];
        const ny = np.y + Math.sin(titleBlink * 0.1 + i * 2) * 4;
        const noteCol = ["#F6CC60", "#BF7538", "#E86A6A", "#9B59B6"][i];
        ctx.globalAlpha = 0.6 + Math.sin(titleBlink * 0.08 + i) * 0.4;
        drawRect(np.x, ny, 3, 2, noteCol);
        drawRect(np.x + 3, ny - 5, 1, 6, noteCol);
        drawRect(np.x + 3, ny - 5, 2, 1, noteCol);
    }
    ctx.globalAlpha = 1;

    // Blinking "PRESS ENTER"
    titleBlink++;
    const hasScores = highScores.length > 0;
    const pressY = hasScores ? H - 80 : H - 30;
    if (titleBlink % 60 < 40) {
        const pressText = "PRESS ENTER";
        const pressW = pressText.length * 5;
        drawText(pressText, W/2 - pressW/2, pressY, "#EBEBE3", 5);
    }

    // High score leaderboard
    if (hasScores) {
        const headerText = "HIGH SCORES";
        const headerW = headerText.length * 3;
        drawText(headerText, W / 2 - headerW / 2, H - 68, "#F6CC60", 3);

        for (let i = 0; i < highScores.length; i++) {
            const entry = highScores[i];
            const rank = (i + 1) + ". " + entry.name + "  " + String(entry.score).padStart(3, "0");
            const rankW = rank.length * 3;
            const color = i === 0 ? "#F6CC60" : "#BFCDC0";
            drawText(rank, W / 2 - rankW / 2, H - 58 + i * 10, color, 3);
        }
    }
}

// ---- Story Screen (page 2: backstory + instructions + characters) ----
let storyBlink = 0;
let storyDrumTimer = null;
let storyDrumStarted = false;

// Marching snare cadence — plays a looping military-style pattern during story
function startStoryDrums() {
    if (storyDrumStarted) return;
    storyDrumStarted = true;
    ensureAudio();
    if (!audioCtx) return;

    const bpm = 120;
    const beat = 60 / bpm; // 0.5s per beat
    const sixteenth = beat / 4;

    // Classic marching cadence pattern (16th note grid, 2 bars):
    // Beat:   1 e & a 2 e & a 3 e & a 4 e & a | 1 e & a 2 e & a 3 e & a 4 e & a
    // Hits:   X . X X X . X X X . X . X X X . | X . X X X . X X X X . . X . . .
    const pattern = [
        1,0,1,1, 1,0,1,1, 1,0,1,0, 1,1,1,0,
        1,0,1,1, 1,0,1,1, 1,1,0,0, 1,0,0,0,
    ];
    // Accent pattern (louder hits on main beats)
    const accents = [
        3,0,1,1, 2,0,1,1, 2,0,1,0, 1,1,2,0,
        3,0,1,1, 2,0,1,1, 2,1,0,0, 3,0,0,0,
    ];

    function scheduleLoop() {
        if (!storyDrumStarted || !audioCtx) return;
        const now = audioCtx.currentTime;
        const loopLen = pattern.length * sixteenth;

        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i]) {
                const t = now + i * sixteenth;
                const vol = accents[i] / 3; // 0.33 to 1.0

                // Snare hit with varying volume
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
                noiseGain.connect(audioCtx.destination);
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
                    oscGain.connect(audioCtx.destination);
                    osc.start(t);
                    osc.stop(t + 0.06);
                }
            }
        }

        // Schedule next loop iteration
        storyDrumTimer = setTimeout(scheduleLoop, loopLen * 900); // slightly early to avoid gaps
    }

    scheduleLoop();
}

function stopStoryDrums() {
    storyDrumStarted = false;
    if (storyDrumTimer !== null) {
        clearTimeout(storyDrumTimer);
        storyDrumTimer = null;
    }
}
function renderStoryScreen() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background with slightly warmer tone
    drawRect(0, 0, W, H, "#0a0a12");

    // Starfield (same as title for consistency)
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(storyBlink * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#F6CC60" : "#EBEBE3");
    }
    ctx.globalAlpha = 1;

    // Story text — silly backstory
    const storyLines = [
        { text: "Long ago, sick beats echoed through", color: "#BFCDC0", scale: 3, gap: 8 },
        { text: "the hills and valleys of", color: "#BFCDC0", scale: 3, gap: 8 },
        { text: "STUDIOLAND", color: "#F6CC60", scale: 6, gap: 10 },
        { text: "and the people danced.", color: "#BFCDC0", scale: 3, gap: 10 },
        { text: "But on one dark day,", color: "#BFCDC0", scale: 3, gap: 8 },
        { text: "the GOBLINS got jealous.", color: "#66cc66", scale: 3, gap: 8 },
        { text: "Now they sneak in and", color: "#BFCDC0", scale: 3, gap: 8 },
        { text: "MESS UP YOUR BEATS.", color: "#ff6666", scale: 4, gap: 10 },
        { text: "It's time for a brave soul to", color: "#BFCDC0", scale: 3, gap: 8 },
        { text: "stop them once and for all!", color: "#BFCDC0", scale: 3, gap: 12 },
        { text: "You are the DJ, and you have a sword.", color: "#F6CC60", scale: 3, gap: 10 },
        { text: "Time to get stabbin'.", color: "#E86A6A", scale: 4, gap: 0 },
    ];

    let textY = 12;
    for (let i = 0; i < storyLines.length; i++) {
        const line = storyLines[i];
        const textW = line.text.length * line.scale;
        const tx = W / 2 - textW / 2;
        // Fade in lines sequentially based on storyBlink
        const fadeStart = i * 15; // each line fades in 15 frames after the last
        const alpha = Math.min(1, Math.max(0, (storyBlink - fadeStart) / 20));
        ctx.globalAlpha = alpha;
        drawText(line.text, tx, textY, line.color, line.scale);
        ctx.globalAlpha = 1;
        textY += line.scale + line.gap;
    }

    // Animated characters at the bottom — goblin on left, dancers on right, player in middle
    const charY = H - 48;

    // Goblin (left side, sneaking)
    const gobFrame = Math.floor(storyBlink / 10) % 4;
    const gobBob = gobFrame % 2 === 1 ? 1 : 0;
    const gobX = 30 + Math.sin(storyBlink * 0.03) * 15;
    // Body
    drawRect(gobX + 4, charY + 3 - gobBob, 8, 9, "#4a8a3a");
    drawRect(gobX + 4, charY + 3 - gobBob, 2, 9, "#3a6a2a");
    drawRect(gobX + 10, charY + 3 - gobBob, 2, 9, "#3a6a2a");
    // Head
    drawRect(gobX + 3, charY - 1 - gobBob, 10, 6, "#5a9a4a");
    // Ears
    drawRect(gobX + 1, charY - gobBob, 3, 3, "#5a9a4a");
    drawRect(gobX + 12, charY - gobBob, 3, 3, "#5a9a4a");
    // Eyes
    drawRect(gobX + 5, charY + 1 - gobBob, 2, 2, "#cc2222");
    drawRect(gobX + 9, charY + 1 - gobBob, 2, 2, "#cc2222");
    // Feet
    const gwo = gobFrame === 1 ? 2 : gobFrame === 3 ? -2 : 0;
    drawRect(gobX + 5 + gwo, charY + 12, 3, 2, "#3a6a2a");
    drawRect(gobX + 8 - gwo, charY + 12, 3, 2, "#3a6a2a");

    // Elite goblin (behind and to the left, pink)
    const eliteX = 12 + Math.sin(storyBlink * 0.025 + 1) * 10;
    const eliteBob = (gobFrame + 1) % 2 === 1 ? 1 : 0;
    drawRect(eliteX + 4, charY + 3 - eliteBob, 8, 9, "#c45a8a");
    drawRect(eliteX + 4, charY + 3 - eliteBob, 2, 9, "#a43a6a");
    drawRect(eliteX + 10, charY + 3 - eliteBob, 2, 9, "#a43a6a");
    drawRect(eliteX + 3, charY - 1 - eliteBob, 10, 6, "#d46a9a");
    drawRect(eliteX + 1, charY - eliteBob, 3, 3, "#d46a9a");
    drawRect(eliteX + 12, charY - eliteBob, 3, 3, "#d46a9a");
    drawRect(eliteX + 5, charY + 1 - eliteBob, 2, 2, "#ffee44");
    drawRect(eliteX + 9, charY + 1 - eliteBob, 2, 2, "#ffee44");

    // Player (center, with sword raised)
    const playerX = W / 2 - 8;
    const playerBob = Math.floor(storyBlink / 12) % 2 === 0 ? 0 : 1;
    // Body
    drawRect(playerX + 3, charY + 2 - playerBob, 10, 10, "#3a6a8a");
    drawRect(playerX + 3, charY + 2 - playerBob, 2, 10, "#2a4a6a");
    drawRect(playerX + 11, charY + 2 - playerBob, 2, 10, "#2a4a6a");
    // Head
    drawRect(playerX + 2, charY - 4 - playerBob, 12, 7, "#F0D0B0");
    // Eyes
    drawRect(playerX + 5, charY - 2 - playerBob, 2, 2, "#1a1a2e");
    drawRect(playerX + 9, charY - 2 - playerBob, 2, 2, "#1a1a2e");
    // Hair
    drawRect(playerX + 2, charY - 5 - playerBob, 12, 3, "#8a5a2a");
    // Feet
    const pwo = Math.floor(storyBlink / 12) % 2 === 0 ? 1 : -1;
    drawRect(playerX + 4 + pwo, charY + 12, 3, 2, "#2a4a6a");
    drawRect(playerX + 9 - pwo, charY + 12, 3, 2, "#2a4a6a");
    // Sword (held up)
    drawRect(playerX + 14, charY - 8 - playerBob, 2, 12, "#BFCDC0");
    drawRect(playerX + 12, charY - 2 - playerBob, 6, 2, "#BF7538");

    // Dancers (right side, dancing)
    const dancerPals = [
        { body: "#E86A6A", dark: "#C05050", head: "#F09090" },
        { body: "#6AB8E8", dark: "#4A98C8", head: "#F0D0B0" },
        { body: "#F6CC60", dark: "#D6AC40", head: "#F0D0B0" },
    ];
    for (let d = 0; d < 3; d++) {
        const dp = dancerPals[d];
        const dx = W - 70 + d * 22;
        const dBob = Math.floor((storyBlink + d * 5) / 8) % 2 === 0 ? 0 : 2;
        const armUp = Math.floor((storyBlink + d * 5) / 8) % 2 === 0;
        // Body
        drawRect(dx + 3, charY + 4 - dBob, 6, 7, dp.body);
        drawRect(dx + 3, charY + 4 - dBob, 2, 7, dp.dark);
        // Head
        drawRect(dx + 2, charY - dBob, 8, 5, dp.head);
        // Eyes
        drawRect(dx + 4, charY + 2 - dBob, 1, 1, "#1a1a2e");
        drawRect(dx + 7, charY + 2 - dBob, 1, 1, "#1a1a2e");
        // Arms
        if (armUp) {
            drawRect(dx + 1, charY + 2 - dBob, 2, 2, dp.body);
            drawRect(dx + 9, charY + 2 - dBob, 2, 2, dp.body);
        } else {
            drawRect(dx + 1, charY + 6 - dBob, 2, 2, dp.body);
            drawRect(dx + 9, charY + 6 - dBob, 2, 2, dp.body);
        }
        // Feet
        const dfo = (Math.floor((storyBlink + d * 5) / 8) % 2 === 0) ? 1 : -1;
        drawRect(dx + 3 + dfo, charY + 11, 2, 2, dp.dark);
        drawRect(dx + 7 - dfo, charY + 11, 2, 2, dp.dark);
    }

    // Controls section at bottom
    const ctrlY = H - 28;
    const ctrlCol = "#8ab0b4";
    drawText("ARROWS:Move  SPACE:Sword  ENTER:Pause", W/2 - 76, ctrlY, ctrlCol, 3);

    // Blinking "PRESS ENTER TO BEGIN"
    storyBlink++;
    if (storyBlink % 60 < 40) {
        const pressText = "PRESS ENTER TO BEGIN";
        const pressW = pressText.length * 5;
        drawText(pressText, W/2 - pressW/2, H - 14, "#EBEBE3", 5);
    }
}

function renderHighScoreEntry() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    // Dark background with starfield
    drawRect(0, 0, W, H, "#0a0a12");
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + 50) % W);
        const sy = ((i * 97 + 30) % H);
        const twinkle = Math.sin(initialsBlink * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        const starSize = (i % 3 === 0) ? 2 : 1;
        drawRect(sx, sy, starSize, starSize, i % 5 === 0 ? "#F6CC60" : "#EBEBE3");
    }
    ctx.globalAlpha = 1;

    initialsBlink++;

    // "NEW HIGH SCORE!" header
    const header = "NEW HIGH SCORE!";
    const headerW = header.length * 5;
    drawText(header, W / 2 - headerW / 2, 20, "#F6CC60", 5);

    // Kill count display
    const scoreStr = String(finalScore);
    const scoreW = scoreStr.length * 6;
    drawText(scoreStr, W / 2 - scoreW / 2, 40, "#EBEBE3", 6);

    // "ENTER YOUR INITIALS" label
    const label = "ENTER YOUR INITIALS";
    const labelW = label.length * 3;
    drawText(label, W / 2 - labelW / 2, 65, "#BFCDC0", 3);

    // Three letter slots
    const letterScale = 8;
    const letterSpacing = letterScale * 3; // space between letters
    const totalLettersW = 3 * letterScale + 2 * letterSpacing;
    const startX = W / 2 - totalLettersW / 2;

    for (let i = 0; i < 3; i++) {
        const lx = startX + i * (letterScale + letterSpacing);
        const ly = 85;

        // Active letter blinks
        if (i === initialsPos) {
            const blinkAlpha = Math.sin(initialsBlink * 0.12) * 0.3 + 0.7;
            ctx.globalAlpha = blinkAlpha;

            // Up arrow indicator above
            drawText("^", lx + letterScale * 0.1, ly - 12, "#F6CC60", 4);
            // Down arrow indicator below
            drawText("v", lx + letterScale * 0.1, ly + letterScale + 6, "#F6CC60", 4);
        }

        // Draw the letter
        drawText(initialsEntry[i], lx, ly, i === initialsPos ? "#F6CC60" : "#EBEBE3", letterScale);
        ctx.globalAlpha = 1;

        // Underline
        drawRect(lx, ly + letterScale + 2, letterScale, 1, i === initialsPos ? "#F6CC60" : "#555555");
    }

    // "PRESS ENTER TO CONFIRM" blinking
    const confirmText = "PRESS ENTER TO CONFIRM";
    const confirmW = confirmText.length * 3;
    if (initialsBlink % 60 < 40) {
        drawText(confirmText, W / 2 - confirmW / 2, H - 30, "#BFCDC0", 3);
    }

    // Controls hint
    const hint = "UP/DOWN:Letter  LEFT/RIGHT:Slot";
    const hintW = hint.length * 2;
    drawText(hint, W / 2 - hintW / 2, H - 18, "#666666", 2);
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

        // Redraw the player on top of the darkness (spotlight effect)
        if (gameOverTimer < 600) {
            // Player fades out during final phase
            const playerAlpha = gameOverTimer >= 540 ? Math.max(0, 1 - (gameOverTimer - 540) / 150) : 1.0;
            ctx.globalAlpha = playerAlpha;
            // Player shadow
            drawRect(player.x + 2, player.y + player.h - 2, player.w - 4, 4, PAL.shadow);
            drawPlayer();
            ctx.globalAlpha = 1.0;
        }
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
        const shitText = "well... shit.";
        const shitW = shitText.length * 5;
        // Position below the player
        const textY = player.y + player.h + 20;
        drawText(shitText, W / 2 - shitW / 2 + 1, textY + 1, "#000000", 5);
        drawText(shitText, W / 2 - shitW / 2, textY, "#BFCDC0", 5);
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
        }
    }
}

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    frameAccum += dt;
    if (frameAccum >= FRAME_MS) {
        frameAccum -= FRAME_MS;
        if (frameAccum > FRAME_MS) frameAccum = 0; // prevent spiral
        if (gameState === "title") {
            renderTitleScreen();
        } else if (gameState === "story") {
            renderStoryScreen();
        } else if (gameState === "gameover") {
            renderGameOverScreen();
        } else if (gameState === "highscore") {
            renderHighScoreEntry();
        } else {
            update(dt);
            render();
        }
    }
    requestAnimationFrame(gameLoop);
}

loadHighScores();
requestAnimationFrame(gameLoop);
