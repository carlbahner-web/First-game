// ============================================================
// DRUM QUEST - A 16-bit Zelda-style drum sequencer game
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---- Constants ----
const TILE = 16;
const SCALE = 3;
const COLS = 22;           // room width in tiles
const ROWS = 16;           // room height in tiles
const GRID_COLS = 16;      // sequencer steps
const GRID_ROWS = 4;       // drum channels (kick, snare, hihat-closed, hihat-open)
const GRID_X = 3;          // grid start tile-x
const GRID_Y = 4;          // grid start tile-y
const BPM = 120;
const STEP_MS = (60 / BPM / 4) * 1000; // 16th-note interval

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
    gridOn:    ["#BF7538", "#F6CC60", "#BFCDC0", "#EBEBE3"], // per-row colors (open-hh, hihat, snare, kick)
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

const drumFns = [
    (t) => playHihat(t, true),
    (t) => playHihat(t, false),
    (t) => playSnare(t),
    (t) => playKick(t),
];

// ---- Sequencer State ----
const grid = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(false));
let playing = false;
let currentStep = 0;
let lastStepTime = 0;

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
    attackDuration: 12,
    swordHit: false, // did this swing already toggle a block?
    moveCooldown: 0,
    moveCooldownMax: 12, // frames between moves (half speed)
};

// ---- Cave (goblin spawn point) ----
const CAVE = {
    tileX: COLS - 1,   // right wall
    tileY: GRID_Y + 3, // near bottom of grid
};

// ---- Goblin Enemy State ----
const goblin = {
    x: CAVE.tileX * TILE,
    y: CAVE.tileY * TILE,
    w: TILE,
    h: TILE,
    dir: 0,
    frame: 0,
    moveCooldown: 0,
    moveCooldownMax: 48, // 25% player speed (player is 12)
    dead: false,
    respawnTimer: 0,
    respawnDelay: 180, // ~3 seconds at 60fps
    targetRow: -1,
    targetCol: -1,
    sabotageTimer: 0,
    sabotageDelay: 60, // tries to sabotage every ~1 second
};

// Death particles
let deathParticles = [];
let deathText = null; // {x, y, timer, text}

// ---- Control Blocks (physical buttons in the room) ----
const CTRL_BLOCKS = {
    playStop: { tileX: GRID_X + GRID_COLS + 1, tileY: GRID_Y + 1, label: "PLAY", color: "#BFCDC0" },
    reset:    { tileX: GRID_X + GRID_COLS + 1, tileY: GRID_Y + 2, label: "RESET", color: "#BF7538" },
};

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
        playing = !playing;
        if (playing) {
            currentStep = 0;
            lastStepTime = performance.now();
        }
        CTRL_BLOCKS.playStop.label = playing ? "STOP" : "PLAY";
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
        const ps = CTRL_BLOCKS.playStop;
        const rs = CTRL_BLOCKS.reset;
        if (targetTileX === ps.tileX && targetTileY === ps.tileY) {
            ensureAudio();
            playing = !playing;
            if (playing) {
                currentStep = 0;
                lastStepTime = performance.now();
            }
            ps.label = playing ? "STOP" : "PLAY";
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
        if (!goblin.dead && targetTileX * TILE === goblin.x && targetTileY * TILE === goblin.y) {
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
                    life: 30 + Math.random() * 30,
                    color: Math.random() > 0.3 ? "#cc2222" : "#881111",
                    size: 2 + Math.random() * 3,
                });
            }
            // "OW!" text
            deathText = { x: goblin.x, y: goblin.y - 8, timer: 60, text: "OW!" };
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
                if (!goblin.dead && nx === goblin.x && ny === goblin.y) {
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
            // Respawn from the cave
            goblin.x = (CAVE.tileX - 1) * TILE;
            goblin.y = CAVE.tileY * TILE;
            goblin.targetRow = -1;
        }
    } else {
        goblin.moveCooldown--;
        if (goblin.moveCooldown <= 0) {
            goblin.moveCooldown = goblin.moveCooldownMax;

            // Pick a target grid cell to sabotage
            goblin.sabotageTimer--;
            if (goblin.sabotageTimer <= 0 || goblin.targetRow < 0) {
                goblin.targetRow = Math.floor(Math.random() * GRID_ROWS);
                goblin.targetCol = Math.floor(Math.random() * GRID_COLS);
                goblin.sabotageTimer = 3; // re-pick after 3 moves if not reached
            }

            const targetX = (GRID_X + goblin.targetCol) * TILE;
            const targetY = (GRID_Y + goblin.targetRow) * TILE;

            // Move one step toward target
            let nx = goblin.x, ny = goblin.y;
            const dx = targetX - goblin.x;
            const dy = targetY - goblin.y;

            if (Math.abs(dx) > Math.abs(dy)) {
                nx += Math.sign(dx) * TILE;
                goblin.dir = dx > 0 ? 3 : 2;
            } else if (dy !== 0) {
                ny += Math.sign(dy) * TILE;
                goblin.dir = dy > 0 ? 0 : 1;
            }

            // Clamp to room bounds
            nx = Math.max(TILE, Math.min((COLS - 2) * TILE, nx));
            ny = Math.max(TILE * 2, Math.min((ROWS - 2) * TILE, ny));

            // Don't walk into player
            if (nx !== p.x || ny !== p.y) {
                goblin.x = nx;
                goblin.y = ny;
            }
            goblin.frame = (goblin.frame + 1) % 4;

            // If on a grid cell, sabotage it!
            const gc = Math.round(goblin.x / TILE) - GRID_X;
            const gr = Math.round(goblin.y / TILE) - GRID_Y;
            if (gr >= 0 && gr < GRID_ROWS && gc >= 0 && gc < GRID_COLS) {
                if (gc === goblin.targetCol && gr === goblin.targetRow) {
                    grid[gr][gc] = !grid[gr][gc];
                    goblin.targetRow = -1; // pick new target
                }
            }
        }
    }

    // Update death particles
    deathParticles = deathParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life--;
        return p.life > 0;
    });
    if (deathText) {
        deathText.y -= 0.3;
        deathText.timer--;
        if (deathText.timer <= 0) deathText = null;
    }

    // Sequencer step
    if (playing) {
        const now = performance.now();
        if (now - lastStepTime >= STEP_MS) {
            lastStepTime += STEP_MS;
            // Play active drums for current step
            const t = audioCtx.currentTime;
            for (let r = 0; r < GRID_ROWS; r++) {
                if (grid[r][currentStep]) drumFns[r](t);
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
        // Scalloped bottom edge of tent
        drawRect(c * TILE, TILE, TILE, 4, c % 2 === 0 ? "#BF7538" : "#EBEBE3");
        // Dark trim under scallop
        drawRect(c * TILE, TILE + 4, TILE, 2, "#3A6168");

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

    // Cave opening on right wall (goblin spawn)
    const caveX = CAVE.tileX * TILE;
    const caveY = CAVE.tileY * TILE;
    // Dark cave hole
    drawRect(caveX, caveY - 2, TILE, TILE + 4, "#1a1a1a");
    // Rocky arch around cave
    drawRect(caveX - 2, caveY - 4, TILE + 2, 3, "#5a5a4a");  // top rocks
    drawRect(caveX - 2, caveY + TILE + 1, TILE + 2, 3, "#5a5a4a");  // bottom rocks
    drawRect(caveX - 3, caveY - 2, 3, TILE + 4, "#4a4a3a");  // left edge rocks
    // Stalactites
    drawRect(caveX + 3, caveY - 2, 2, 4, "#6a6a5a");
    drawRect(caveX + 9, caveY - 2, 2, 3, "#6a6a5a");
    // Stalagmites
    drawRect(caveX + 5, caveY + TILE - 2, 2, 4, "#6a6a5a");
    drawRect(caveX + 11, caveY + TILE - 1, 2, 3, "#6a6a5a");
    // Eye gleam inside cave (if goblin is dead / waiting to respawn)
    if (goblin.dead && goblin.respawnTimer < 60) {
        drawRect(caveX + 5, caveY + 5, 2, 2, "#cc2222");
        drawRect(caveX + 9, caveY + 5, 2, 2, "#cc2222");
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
    drawText("120 BPM", (GRID_X + 12) * TILE, TILE * 2.8, "#BFCDC0", 4);

    // Row labels
    for (let r = 0; r < GRID_ROWS; r++) {
        drawText(DRUM_LABELS[r], TILE * 0.3, (GRID_Y + r) * TILE + TILE * 0.75, PAL.gridOn[r], 3.5);
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
    if (playing) {
        drawRect(indicatorX, indicatorY, 6, 8, PAL.stopBtn);
        drawRect(indicatorX + 8, indicatorY, 6, 8, PAL.stopBtn);
        drawText("PLAYING", indicatorX + 18, indicatorY + 7, PAL.startBtn, 3);
    } else {
        ctx.fillStyle = PAL.startBtn;
        ctx.beginPath();
        ctx.moveTo(indicatorX * SCALE, indicatorY * SCALE);
        ctx.lineTo(indicatorX * SCALE, (indicatorY + 9) * SCALE);
        ctx.lineTo((indicatorX + 8) * SCALE, (indicatorY + 4.5) * SCALE);
        ctx.fill();
        drawText("STOPPED", indicatorX + 18, indicatorY + 7, "#5a8a8f", 3);
    }

    // Control blocks
    for (const key of ["playStop", "reset"]) {
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
        // Label
        drawText(blk.label, bx - blk.label.length * 2, by + TILE + 8, blk.color, 3);
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

// ---- Game Loop ----
let lastTime = 0;
function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
