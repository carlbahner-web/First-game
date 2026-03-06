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

// ---- Colors (16-bit palette) ----
const PAL = {
    bg:        "#2b2b3d",
    wall:      "#4a4a6a",
    wallTop:   "#5c5c7e",
    floor:     "#3b3b55",
    floorAlt:  "#363650",
    gridOff:   "#2e3440",
    gridOn:    ["#bf616a", "#d08770", "#ebcb8b", "#a3be8c"], // per-row colors
    gridBorder:"#4c566a",
    playhead:  "#88c0d0",
    player:    "#81a1c1",
    playerDark:"#5e81ac",
    sword:     "#e5e9f0",
    swordGlow: "#8fbcbb",
    shadow:    "rgba(0,0,0,0.25)",
    startBtn:  "#a3be8c",
    stopBtn:   "#bf616a",
    labelText: "#d8dee9",
    titleText: "#eceff4",
};

const DRUM_LABELS = ["KICK", "SNARE", "HI-HAT", "OPEN-HH"];

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
    (t) => playKick(t),
    (t) => playSnare(t),
    (t) => playHihat(t, false),
    (t) => playHihat(t, true),
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
    speed: 2.2,
    dir: 0,        // 0=down, 1=up, 2=left, 3=right
    frame: 0,
    frameTimer: 0,
    attacking: false,
    attackTimer: 0,
    attackDuration: 12,
    swordHit: false, // did this swing already toggle a block?
};

// ---- Input ----
const keys = {};
window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (e.code === "Enter") {
        e.preventDefault();
        ensureAudio();
        playing = !playing;
        if (playing) {
            currentStep = 0;
            lastStepTime = performance.now();
        }
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

    // Attack
    if (keys["Space"] && !p.attacking) {
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
    }

    if (p.attacking) {
        p.attackTimer--;
        // Check sword <-> grid collision
        if (!p.swordHit) {
            const sbox = getSwordBox();
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    if (aabb(sbox, getBlockRect(r, c))) {
                        grid[r][c] = !grid[r][c];
                        p.swordHit = true;
                        // play a toggle blip
                        if (audioCtx) {
                            const now = audioCtx.currentTime;
                            const osc = audioCtx.createOscillator();
                            const g = audioCtx.createGain();
                            osc.type = "square";
                            osc.frequency.value = grid[r][c] ? 880 : 440;
                            g.gain.setValueAtTime(0.1, now);
                            g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                            osc.connect(g); g.connect(audioCtx.destination);
                            osc.start(now); osc.stop(now + 0.06);
                        }
                        break;
                    }
                }
                if (p.swordHit) break;
            }
        }
        if (p.attackTimer <= 0) p.attacking = false;
    }

    // Movement (not while attacking)
    if (!p.attacking) {
        let dx = 0, dy = 0;
        if (keys["ArrowLeft"]  || keys["KeyA"]) { dx = -p.speed; p.dir = 2; }
        if (keys["ArrowRight"] || keys["KeyD"]) { dx =  p.speed; p.dir = 3; }
        if (keys["ArrowUp"]    || keys["KeyW"]) { dy = -p.speed; p.dir = 1; }
        if (keys["ArrowDown"]  || keys["KeyS"]) { dy =  p.speed; p.dir = 0; }

        // Clamp to room walls (1 tile border)
        const nx = Math.max(TILE, Math.min(p.x + dx, (COLS - 2) * TILE));
        const ny = Math.max(TILE * 2, Math.min(p.y + dy, (ROWS - 2) * TILE));

        p.x = nx;
        p.y = ny;

        // Walk animation
        if (dx !== 0 || dy !== 0) {
            p.frameTimer++;
            if (p.frameTimer > 8) { p.frame = (p.frame + 1) % 4; p.frameTimer = 0; }
        } else {
            p.frame = 0;
            p.frameTimer = 0;
        }
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

    // Floor tiles
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const col = (r + c) % 2 === 0 ? PAL.floor : PAL.floorAlt;
            drawRect(c * TILE, r * TILE, TILE, TILE, col);
        }
    }

    // Walls (top 1.5 tiles, sides 1 tile, bottom 1 tile)
    for (let c = 0; c < COLS; c++) {
        drawRect(c * TILE, 0, TILE, TILE, PAL.wallTop);
        drawRect(c * TILE, TILE, TILE, TILE / 2, PAL.wall);
        drawRect(c * TILE, (ROWS - 1) * TILE, TILE, TILE, PAL.wall);
    }
    for (let r = 0; r < ROWS; r++) {
        drawRect(0, r * TILE, TILE, TILE, PAL.wall);
        drawRect((COLS - 1) * TILE, r * TILE, TILE, TILE, PAL.wall);
    }

    // Title
    drawText("DRUM QUEST", GRID_X * TILE + 32, TILE * 2.8, PAL.titleText, 6);
    // Tempo badge
    drawText("120 BPM", (GRID_X + 12) * TILE, TILE * 2.8, PAL.wall, 4);

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
                drawRect(bx + 1, by + 1, TILE - 2, TILE - 2, "#343848");
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
        drawText(num, tx, (GRID_Y + GRID_ROWS) * TILE + 8, c === currentStep && playing ? PAL.playhead : "#555568", 3);
    }

    // Start/Stop indicator
    const indicatorY = (GRID_Y + GRID_ROWS) * TILE + 18;
    const indicatorX = GRID_X * TILE;
    if (playing) {
        drawRect(indicatorX, indicatorY, 6, 8, PAL.stopBtn);
        drawRect(indicatorX + 8, indicatorY, 6, 8, PAL.stopBtn);
        drawText("PLAYING - ENTER TO STOP", indicatorX + 18, indicatorY + 7, PAL.startBtn, 3);
    } else {
        // play triangle
        ctx.fillStyle = PAL.startBtn;
        ctx.beginPath();
        ctx.moveTo(indicatorX * SCALE, indicatorY * SCALE);
        ctx.lineTo(indicatorX * SCALE, (indicatorY + 9) * SCALE);
        ctx.lineTo((indicatorX + 8) * SCALE, (indicatorY + 4.5) * SCALE);
        ctx.fill();
        drawText("STOPPED - ENTER TO PLAY", indicatorX + 18, indicatorY + 7, "#888", 3);
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
        drawRect(px + 5 + eyeDir[0], py + bob + eyeDir[1], 2, 2, "#2e3440");
        drawRect(px + 9 + eyeDir[0], py + bob + eyeDir[1], 2, 2, "#2e3440");
    }
    // Hair/hat
    drawRect(px + 3, py - 3 - bob, 10, 3, "#5e81ac");
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
