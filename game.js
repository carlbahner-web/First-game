// ============================================================
// DRUM QUEST - A 16-bit Zelda-style drum sequencer game
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---- Constants ----
const TILE = 16;
const SCALE = 3;
const COLS = 22;           // room width in tiles
const ROWS = 18;           // room height in tiles
const GRID_COLS = 16;      // sequencer steps
const GRID_ROWS = 6;       // drum channels
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
    gridOn:    ["#BF7538", "#F6CC60", "#BFCDC0", "#EBEBE3", "#E86A6A", "#6AB8E8"], // per-row colors
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

const drumFns = [
    (t) => playHihat(t, true),
    (t) => playHihat(t, false),
    (t) => playSnare(t),
    (t) => playKick(t),
    (t) => playCowbell(t),
    (t) => playTom(t),
];

// ---- Sequencer State ----
const grid = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(false));
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
    x: (GRID_X + 7) * TILE,   // center of grid
    y: (GRID_Y + GRID_ROWS + 1) * TILE,
    w: TILE,
    h: TILE,
    dir: 0,        // 0=down, 1=up, 2=left, 3=right
    frame: 0,
    frameTimer: 0,
    attacking: false,
    attackTimer: 0,
    attackDuration: 6,
    swordHit: false, // did this swing already toggle a block?
    moveCooldown: 0,
    moveCooldownMax: 6, // frames between moves
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
    speed: 1.0, // pixels per frame (player is ~2.67 px/frame at 30fps)
    dead: true,
    respawnTimer: 150, // start dead, spawn after 5 seconds
    respawnDelay: 300, // ~10 seconds at 30fps
    spawnCave: 0,
    targetRow: -1,
    targetCol: -1,
    sabotageTimer: 0,
    moveSteps: 0, // count steps for re-picking target
};

// Death particles
let deathParticles = [];
let deathText = null; // {x, y, timer, text}

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
    if (e.code === "Enter") {
        e.preventDefault();
        ensureAudio();
    }
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

// ---- Helper: get sword hitbox ----
function getSwordBox() {
    const p = player;
    const sw = 6, sh = 14;
    const progress = 1 - (p.attackTimer / p.attackDuration);
    switch (p.dir) {
        case 0: return { x: p.x - 1, y: p.y + p.h - 2, w: sh, h: sw + 4 };
        case 1: return { x: p.x - 1, y: p.y - sw - 4, w: sh, h: sw + 4 };
        case 2: return { x: p.x - sw - 6, y: p.y, w: sw + 6, h: sh };
        case 3: return { x: p.x + p.w, y: p.y, w: sw + 6, h: sh };
    }
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
            goblin.dead = true;
            goblin.respawnTimer = goblin.respawnDelay;
            p.swordHit = true;
            // Spawn death particles (bloody pixel explosion)
            for (let i = 0; i < 20; i++) {
                deathParticles.push({
                    x: goblin.x + goblin.w / 2,
                    y: goblin.y + goblin.h / 2,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4 - 2,
                    life: 15 + Math.random() * 15,
                    color: Math.random() > 0.3 ? "#cc2222" : "#881111",
                    size: 2 + Math.random() * 3,
                });
            }
            // "OW!" text
            deathText = { x: goblin.x, y: goblin.y - 8, timer: 30, text: "OW!" };
            // Play a silly death sound
            if (audioCtx) {
                const now = audioCtx.currentTime;
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
            // Kill counter & dancer spawn
            killCount++;
            if (killCount % 3 === 0) {
                // Pick a position in the lower area (rows 14-16), spread horizontally
                const minX = 2 * TILE;
                const maxX = (COLS - 3) * TILE;
                const palette = DANCER_PALETTES[dancers.length % DANCER_PALETTES.length];
                dancers.push({
                    x: minX + Math.random() * (maxX - minX),
                    y: (14 + Math.floor(Math.random() * 3)) * TILE,
                    palette: palette,
                    phase: Math.floor(Math.random() * 16),
                });
            }
        }
    }
    spaceJustPressed = false;

    if (p.attacking) {
        p.attackTimer--;
        if (p.attackTimer <= 0) p.attacking = false;
    }

    // Movement (grid-snapped, one tile at a time, not while attacking)
    if (p.moveCooldown > 0) p.moveCooldown--;

    if (!p.attacking && p.moveCooldown <= 0) {
        let wantDir = -1;
        if (keys["ArrowLeft"]  || keys["KeyA"])  wantDir = 2;
        else if (keys["ArrowRight"] || keys["KeyD"]) wantDir = 3;
        else if (keys["ArrowUp"]    || keys["KeyW"]) wantDir = 1;
        else if (keys["ArrowDown"]  || keys["KeyS"]) wantDir = 0;

        if (wantDir >= 0) {
            if (p.dir !== wantDir) {
                // Turn only, don't move
                p.dir = wantDir;
                p.moveCooldown = p.moveCooldownMax;
            } else {
                // Already facing this way — move
                let nx = p.x, ny = p.y;
                switch (wantDir) {
                    case 0: ny = Math.min((ROWS - 2) * TILE, p.y + TILE); break;
                    case 1: ny = Math.max(TILE * 2, p.y - TILE); break;
                    case 2: nx = Math.max(TILE, p.x - TILE); break;
                    case 3: nx = Math.min((COLS - 2) * TILE, p.x + TILE); break;
                }
                // Check goblin collision
                const gRoundX = Math.round(goblin.x / TILE) * TILE;
                const gRoundY = Math.round(goblin.y / TILE) * TILE;
                if (!goblin.dead && nx === gRoundX && ny === gRoundY) {
                    // blocked by goblin
                } else {
                    p.x = nx;
                    p.y = ny;
                }
                p.moveCooldown = p.moveCooldownMax;
                p.frame = (p.frame + 1) % 4;
            }
        } else {
            p.frame = 0;
        }
    }

    // Update goblin
    if (goblin.dead) {
        goblin.respawnTimer--;
        if (goblin.respawnTimer <= 0) {
            goblin.dead = false;
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
        }
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

            // Don't walk into player
            if (nx !== p.x || ny !== p.y) {
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
            if (goblin.frameTimer >= 4) {
                goblin.frameTimer = 0;
                goblin.frame = (goblin.frame + 1) % 4;
            }
        }
    }

    // Update death particles
    deathParticles = deathParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3; // gravity
        p.life--;
        return p.life > 0;
    });
    if (deathText) {
        deathText.y -= 0.6;
        deathText.timer--;
        if (deathText.timer <= 0) deathText = null;
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
        const willSpawnHere = goblin.dead && goblin.respawnTimer < 45;
        if (willSpawnHere) {
            // Show eyes in the cave it'll spawn from
            const showEyes = goblin.respawnTimer < 30 && ci === goblin.spawnCave;
            if (showEyes) {
                drawRect(cx + 5, cy + 5, 2, 2, "#cc2222");
                drawRect(cx + 9, cy + 5, 2, 2, "#cc2222");
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

    // Title with carnival flair
    drawText("DRUM QUEST", GRID_X * TILE + 32, TILE * 2.8, "#F6CC60", 6);
    // Tempo badge
    drawText(bpm + " BPM", (GRID_X + 12) * TILE, TILE * 2.8, "#BFCDC0", 4);

    // Row icons (pixel-art drum icons in the left wall area)
    for (let r = 0; r < GRID_ROWS; r++) {
        const ix = 2;  // icon x start (inside left wall)
        const iy = (GRID_Y + r) * TILE;
        const col = PAL.gridOn[r];
        const dark = "#2a2a2a";

        if (r === 3) {
            // KICK: bass drum — large circle with beater
            drawRect(ix + 2, iy + 2, 10, 2, col);      // top rim
            drawRect(ix + 2, iy + 12, 10, 2, col);     // bottom rim
            drawRect(ix, iy + 4, 2, 8, col);            // left side
            drawRect(ix + 12, iy + 4, 2, 8, col);       // right side
            drawRect(ix + 6, iy + 5, 2, 5, dark);       // center dot
        } else if (r === 2) {
            // SNARE: drum from side — short cylinder with snare wires
            drawRect(ix + 1, iy + 4, 12, 2, col);       // top rim
            drawRect(ix + 1, iy + 11, 12, 2, col);      // bottom rim
            drawRect(ix + 1, iy + 6, 2, 5, col);        // left side
            drawRect(ix + 11, iy + 6, 2, 5, col);       // right side
            // snare wires (horizontal lines across bottom)
            drawRect(ix + 3, iy + 10, 8, 1, dark);
            drawRect(ix + 3, iy + 12, 8, 1, dark);
        } else if (r === 1) {
            // CLOSED HI-HAT: two cymbals pressed together
            drawRect(ix + 6, iy + 2, 2, 12, col);       // stand
            drawRect(ix + 2, iy + 6, 10, 2, col);       // top cymbal
            drawRect(ix + 2, iy + 8, 10, 2, col);       // bottom cymbal (touching)
            drawRect(ix + 1, iy + 7, 1, 2, col);        // left edge
            drawRect(ix + 12, iy + 7, 1, 2, col);       // right edge
        } else if (r === 4) {
            // COWBELL: trapezoidal bell shape
            drawRect(ix + 4, iy + 2, 6, 2, col);        // top (narrow)
            drawRect(ix + 3, iy + 4, 8, 2, col);        // upper body
            drawRect(ix + 2, iy + 6, 10, 4, col);       // lower body (wide)
            drawRect(ix + 1, iy + 10, 12, 2, col);      // bottom rim
            drawRect(ix + 6, iy + 7, 2, 3, dark);       // strike mark
        } else if (r === 5) {
            // TOM: round drum from above
            drawRect(ix + 3, iy + 2, 8, 2, col);        // top rim
            drawRect(ix + 3, iy + 12, 8, 2, col);       // bottom rim
            drawRect(ix + 1, iy + 4, 2, 8, col);        // left side
            drawRect(ix + 11, iy + 4, 2, 8, col);       // right side
            // drum head lines
            drawRect(ix + 4, iy + 5, 6, 1, dark);
            drawRect(ix + 4, iy + 8, 6, 1, dark);
            drawRect(ix + 4, iy + 11, 6, 1, dark);
        } else {
            // OPEN HI-HAT: two cymbals apart
            drawRect(ix + 6, iy + 2, 2, 12, col);       // stand
            drawRect(ix + 2, iy + 5, 10, 2, col);       // top cymbal
            drawRect(ix + 2, iy + 10, 10, 2, col);      // bottom cymbal (gap)
            drawRect(ix + 1, iy + 6, 1, 1, col);        // top left edge
            drawRect(ix + 12, iy + 6, 1, 1, col);       // top right edge
            drawRect(ix + 1, iy + 11, 1, 1, col);       // bottom left edge
            drawRect(ix + 12, iy + 11, 1, 1, col);      // bottom right edge
        }
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

    // Status indicator
    const indicatorY = (GRID_Y + GRID_ROWS) * TILE + 18;
    const indicatorX = GRID_X * TILE;
    drawRect(indicatorX, indicatorY, 6, 8, PAL.stopBtn);
    drawRect(indicatorX + 8, indicatorY, 6, 8, PAL.stopBtn);
    drawText("PLAYING", indicatorX + 18, indicatorY + 7, PAL.startBtn, 3);

    // Kill counter (skull icon + count)
    const kcX = indicatorX + 80;
    const kcY = indicatorY;
    // Skull icon
    drawRect(kcX, kcY, 7, 5, "#EBEBE3");         // cranium
    drawRect(kcX + 1, kcY + 5, 5, 2, "#EBEBE3");  // jaw
    drawRect(kcX + 1, kcY + 2, 2, 2, "#2c4a4f");  // left eye
    drawRect(kcX + 4, kcY + 2, 2, 2, "#2c4a4f");  // right eye
    drawRect(kcX + 3, kcY + 4, 1, 1, "#2c4a4f");  // nose
    drawText(String(killCount), kcX + 10, kcY + 7, "#EBEBE3", 3);
    // Next dancer progress dots
    const dotsX = kcX + 10 + String(killCount).length * 5 + 6;
    for (let i = 0; i < 3; i++) {
        const filled = (killCount % 3) > i;
        drawRect(dotsX + i * 5, kcY + 2, 3, 3, filled ? "#F6CC60" : "#5a8a8f");
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
            // Reset icon: undo/circular arrow
            const iconColor = "#2a4448";
            // Arc body (drawn as pixel segments)
            drawRect(bx + 5, by + 3, 6, 2, iconColor);  // top
            drawRect(bx + 3, by + 5, 2, 4, iconColor);   // left
            drawRect(bx + 5, by + 11, 6, 2, iconColor);  // bottom
            drawRect(bx + 11, by + 7, 2, 4, iconColor);  // right
            // Arrow head pointing left at the top-left
            drawRect(bx + 3, by + 3, 2, 2, iconColor);
            drawRect(bx + 2, by + 5, 2, 2, iconColor);
            drawRect(bx + 5, by + 1, 2, 2, iconColor);
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

    // Death particles
    for (const p of deathParticles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 60;
        ctx.fillRect(p.x * SCALE, p.y * SCALE, p.size * SCALE, p.size * SCALE);
    }
    ctx.globalAlpha = 1.0;

    // Death text
    if (deathText) {
        ctx.globalAlpha = Math.min(1, deathText.timer / 20);
        drawText(deathText.text, deathText.x, deathText.y, "#cc2222", 5);
        ctx.globalAlpha = 1.0;
    }

    // Player shadow
    drawRect(player.x + 2, player.y + player.h - 2, player.w - 4, 4, PAL.shadow);

    // Sword (draw behind or in front depending on direction)
    if (player.attacking && player.dir === 1) drawSword();

    // Player sprite
    drawPlayer();

    // Sword (in front for other directions)
    if (player.attacking && player.dir !== 1) drawSword();
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
    const progress = 1 - (p.attackTimer / p.attackDuration);
    const swing = Math.sin(progress * Math.PI);

    ctx.save();
    const sbox = getSwordBox();

    // Sword glow
    ctx.fillStyle = PAL.swordGlow;
    ctx.globalAlpha = 0.4 * swing;
    ctx.fillRect((sbox.x - 2) * SCALE, (sbox.y - 2) * SCALE, (sbox.w + 4) * SCALE, (sbox.h + 4) * SCALE);
    ctx.globalAlpha = 1.0;

    // Sword blade
    switch (p.dir) {
        case 0: // down
            drawRect(p.x + 6, p.y + p.h, 4, 10 * swing, PAL.sword);
            drawRect(p.x + 4, p.y + p.h - 1, 8, 2, "#8a7040"); // hilt
            break;
        case 1: // up
            drawRect(p.x + 6, p.y - 10 * swing, 4, 10 * swing, PAL.sword);
            drawRect(p.x + 4, p.y - 1, 8, 2, "#8a7040");
            break;
        case 2: // left
            drawRect(p.x - 10 * swing, p.y + 5, 10 * swing, 4, PAL.sword);
            drawRect(p.x - 1, p.y + 3, 2, 8, "#8a7040");
            break;
        case 3: // right
            drawRect(p.x + p.w, p.y + 5, 10 * swing, 4, PAL.sword);
            drawRect(p.x + p.w - 1, p.y + 3, 2, 8, "#8a7040");
            break;
    }

    // Sparkle at tip
    if (swing > 0.5 && p.swordHit) {
        const sparkle = Math.random() > 0.3;
        if (sparkle) {
            ctx.fillStyle = "#fff";
            ctx.globalAlpha = swing;
            let sx, sy;
            switch (p.dir) {
                case 0: sx = p.x + 7; sy = p.y + p.h + 10 * swing; break;
                case 1: sx = p.x + 7; sy = p.y - 10 * swing; break;
                case 2: sx = p.x - 10 * swing; sy = p.y + 6; break;
                case 3: sx = p.x + p.w + 10 * swing; sy = p.y + 6; break;
            }
            ctx.fillRect((sx - 1) * SCALE, sy * SCALE, 3 * SCALE, 1 * SCALE);
            ctx.fillRect(sx * SCALE, (sy - 1) * SCALE, 1 * SCALE, 3 * SCALE);
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

    // Shadow
    drawRect(gx + 3, gy + g.h - 2, g.w - 6, 3, PAL.shadow);
    // Body (green)
    drawRect(gx + 4, gy + 3 - bob, 8, 9, "#4a8a3a");
    // Darker sides
    drawRect(gx + 4, gy + 3 - bob, 2, 9, "#3a6a2a");
    drawRect(gx + 10, gy + 3 - bob, 2, 9, "#3a6a2a");
    // Head
    drawRect(gx + 3, gy - 1 - bob, 10, 6, "#5a9a4a");
    // Pointy ears
    drawRect(gx + 1, gy - bob, 3, 3, "#5a9a4a");
    drawRect(gx + 12, gy - bob, 3, 3, "#5a9a4a");
    // Eyes (beady red)
    if (g.dir !== 1) {
        const ed = [[0, 2], [0, -2], [-1, 0], [1, 0]][g.dir];
        drawRect(gx + 5 + ed[0], gy + 1 - bob + ed[1], 2, 2, "#cc2222");
        drawRect(gx + 9 + ed[0], gy + 1 - bob + ed[1], 2, 2, "#cc2222");
    }
    // Mouth (little fangs)
    if (g.dir === 0) {
        drawRect(gx + 6, gy + 4 - bob, 1, 2, "#EBEBE3");
        drawRect(gx + 9, gy + 4 - bob, 1, 2, "#EBEBE3");
    }
    // Feet
    const wo = g.frame === 1 ? 2 : g.frame === 3 ? -2 : 0;
    drawRect(gx + 5 + wo, gy + 12, 3, 2, "#3a6a2a");
    drawRect(gx + 8 - wo, gy + 12, 3, 2, "#3a6a2a");
}

function drawDancer(d) {
    const p = d.palette;
    const step = (currentStep + d.phase) % 16;
    // Beat-synced animation
    const onBeat = (step % 4 === 0);       // strong beats (quarter notes)
    const bob = onBeat ? 3 : (step % 2 === 0 ? 1 : 0);  // jump on beats, small bob otherwise
    const armsUp = step % 4 < 2;           // arms alternate every 2 steps
    const footOffset = step % 2 === 0 ? 1 : -1;

    const dx = d.x;
    const dy = d.y;

    // Shadow
    drawRect(dx + 2, dy + 13, 8, 2, PAL.shadow);
    // Body
    drawRect(dx + 3, dy + 4 - bob, 6, 7, p.body);
    drawRect(dx + 3, dy + 4 - bob, 1, 7, p.dark);
    drawRect(dx + 8, dy + 4 - bob, 1, 7, p.dark);
    // Head
    drawRect(dx + 3, dy - bob, 6, 5, p.head);
    // Hair
    drawRect(dx + 2, dy - 1 - bob, 8, 2, p.hair);
    // Eyes (always facing front/down)
    drawRect(dx + 4, dy + 2 - bob, 1, 1, "#1f3a3f");
    drawRect(dx + 7, dy + 2 - bob, 1, 1, "#1f3a3f");
    // Arms
    if (armsUp) {
        // Arms raised
        drawRect(dx + 1, dy + 2 - bob, 2, 3, p.body);
        drawRect(dx + 9, dy + 2 - bob, 2, 3, p.body);
    } else {
        // Arms down
        drawRect(dx + 1, dy + 5 - bob, 2, 4, p.body);
        drawRect(dx + 9, dy + 5 - bob, 2, 4, p.body);
    }
    // Feet
    drawRect(dx + 3 + footOffset, dy + 11, 2, 2, p.dark);
    drawRect(dx + 7 - footOffset, dy + 11, 2, 2, p.dark);
}

// ---- Game Loop (30 fps) ----
let lastTime = 0;
const FRAME_MS = 1000 / 30;
let frameAccum = 0;
function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    frameAccum += dt;
    if (frameAccum >= FRAME_MS) {
        frameAccum -= FRAME_MS;
        if (frameAccum > FRAME_MS) frameAccum = 0; // prevent spiral
        update(dt);
        render();
    }
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
