const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const soundBtn = document.getElementById("sound-btn");

const W = 900, H = 560;
const FLOOR_Y = 470;
const INNER_FLOOR_Y = FLOOR_Y - 16;
const FLAME_X_MIN = 350, FLAME_X_MAX = 550, FLAME_CX = (FLAME_X_MIN + FLAME_X_MAX) / 2;

let dpr = 1;
function applySize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildBackground();
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Seeded PRNG so the stone/bark texture speckle is the same every load instead of
// re-rolling (and looking different) on every resize-triggered background rebuild.
function makeRng(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// --- Static scene (hearth, stone surround, logs) — rebuilt into an offscreen canvas only on
// load/resize, then just blitted every frame. Only the fire itself needs to redraw per frame.
const bgCanvas = document.createElement("canvas");
const bgCtx = bgCanvas.getContext("2d");
let emberCracks = [];
let coalBed = [];

function buildBackground() {
  bgCanvas.width = W * dpr;
  bgCanvas.height = H * dpr;
  bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rng = makeRng(1337);
  const c = bgCtx;

  c.fillStyle = "#0d0806";
  c.fillRect(0, 0, W, H);

  // Stone surround
  const stoneGrad = c.createLinearGradient(0, 20, 0, FLOOR_Y + 70);
  stoneGrad.addColorStop(0, "#4a4038");
  stoneGrad.addColorStop(1, "#2c241f");
  c.fillStyle = stoneGrad;
  roundRect(c, 50, 30, W - 100, FLOOR_Y + 40 - 30, 18);
  c.fill();

  c.fillStyle = "rgba(0,0,0,0.25)";
  for (let i = 0; i < 90; i++) {
    const x = 60 + rng() * (W - 120);
    const y = 40 + rng() * (FLOOR_Y - 10);
    const r = 4 + rng() * 14;
    c.beginPath();
    c.ellipse(x, y, r, r * (0.5 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "rgba(255,255,255,0.05)";
  c.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const x = 60 + rng() * (W - 120);
    const y = 40 + rng() * (FLOOR_Y - 10);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + rng() * 10 - 5, y + rng() * 4);
    c.stroke();
  }

  // Firebox opening (dark interior the flame glows against)
  const openX0 = 150, openX1 = 750, openY0 = 90;
  const fireboxGrad = c.createLinearGradient(0, openY0, 0, FLOOR_Y);
  fireboxGrad.addColorStop(0, "#050201");
  fireboxGrad.addColorStop(0.7, "#0c0503");
  fireboxGrad.addColorStop(1, "#1a0d08");
  c.fillStyle = fireboxGrad;
  roundRect(c, openX0, openY0, openX1 - openX0, FLOOR_Y - openY0, 10);
  c.fill();

  // Soot staining near the top of the firebox
  const soot = c.createLinearGradient(0, openY0, 0, openY0 + 90);
  soot.addColorStop(0, "rgba(0,0,0,0.7)");
  soot.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = soot;
  c.fillRect(openX0, openY0, openX1 - openX0, 90);

  // Hearth floor slab
  const floorGrad = c.createLinearGradient(0, FLOOR_Y, 0, FLOOR_Y + 40);
  floorGrad.addColorStop(0, "#5c5048");
  floorGrad.addColorStop(1, "#332a24");
  c.fillStyle = floorGrad;
  roundRect(c, 60, FLOOR_Y, W - 120, 40, 6);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.08)";
  c.fillRect(64, FLOOR_Y + 2, W - 128, 3);

  drawLogs(c, rng);

  // Vignette
  const vignette = c.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, W * 0.65);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, W, H);
}

function logColor(charLevel, lightness) {
  const l = lightness * (1 - charLevel * 0.75);
  const r = Math.round(70 * l + 10);
  const g = Math.round(45 * l + 6);
  const b = Math.round(32 * l + 4);
  return `rgb(${r},${g},${b})`;
}

function drawLog(c, rng, cx, cy, length, radius, angleDeg, charLevel) {
  c.save();
  c.translate(cx, cy);
  c.rotate((angleDeg * Math.PI) / 180);

  const grad = c.createLinearGradient(0, -radius, 0, radius);
  grad.addColorStop(0, logColor(charLevel, 1.4));
  grad.addColorStop(0.45, logColor(charLevel, 0.9));
  grad.addColorStop(1, logColor(charLevel, 0.35));
  c.fillStyle = grad;
  roundRect(c, -length / 2, -radius, length, radius * 2, radius);
  c.fill();

  c.strokeStyle = `rgba(15,8,5,${0.35 + charLevel * 0.3})`;
  c.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const ly = -radius + ((i + 0.5) / 5) * radius * 2;
    c.beginPath();
    c.moveTo(-length / 2 + 4, ly);
    for (let x = -length / 2 + 4; x < length / 2 - 4; x += 14) {
      c.lineTo(x, ly + (rng() - 0.5) * 3);
    }
    c.stroke();
  }

  // End cap (growth rings) at the near end
  const capX = length / 2;
  const rings = 4;
  for (let i = rings; i >= 0; i--) {
    const rr = radius * (i / rings);
    c.beginPath();
    c.ellipse(capX, 0, radius * 0.28, rr, 0, 0, Math.PI * 2);
    c.fillStyle = i % 2 === 0 ? logColor(charLevel * 0.6, 1.1) : logColor(charLevel * 0.6, 0.75);
    c.fill();
  }

  c.restore();

  // Register a couple of ember-crack spots along this log's underside for the dynamic glow pass
  if (charLevel > 0.4) {
    const rad = (angleDeg * Math.PI) / 180;
    const count = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const t = 0.2 + rng() * 0.6;
      const along = (t - 0.5) * length;
      const ex = cx + Math.cos(rad) * along + Math.sin(rad) * radius * 0.7;
      const ey = cy + Math.sin(rad) * along - Math.cos(rad) * radius * 0.7;
      emberCracks.push({ x: ex, y: ey, len: 14 + rng() * 16, angle: angleDeg, seed: rng() * 1000 });
    }
  }
}

function drawLogs(c, rng) {
  emberCracks = [];
  const baseY = INNER_FLOOR_Y;
  drawLog(c, rng, FLAME_CX - 10, baseY - 8, 260, 22, -8, 0.85);
  drawLog(c, rng, FLAME_CX + 15, baseY - 4, 250, 22, 7, 0.95);
  drawLog(c, rng, FLAME_CX - 25, baseY - 46, 220, 18, -22, 0.45);
  drawLog(c, rng, FLAME_CX + 35, baseY - 50, 210, 18, 25, 0.35);

  coalBed = [];
  const coalRng = makeRng(4242);
  for (let i = 0; i < 22; i++) {
    coalBed.push({
      x: FLAME_X_MIN - 10 + coalRng() * (FLAME_X_MAX - FLAME_X_MIN + 20),
      y: baseY + 6 + coalRng() * 10,
      r: 6 + coalRng() * 10,
      seed: coalRng() * 1000,
    });
  }
}

// --- Fire flicker ---
let flicker = 1, flickerTarget = 1, flickerTimer = 0;
function updateFlicker(dt) {
  flickerTimer -= dt;
  if (flickerTimer <= 0) {
    flickerTarget = 0.7 + Math.random() * 0.6;
    flickerTimer = 0.05 + Math.random() * 0.14;
  }
  flicker += (flickerTarget - flicker) * Math.min(1, dt * 8);
}

// --- Particles ---
const flames = [];
const smoke = [];
const sparks = [];
let flameSpawnAcc = 0, smokeSpawnAcc = 0, sparkTimer = 0.4;
let time = 0;

function spawnFlame() {
  const t = (Math.random() + Math.random() + Math.random()) / 3;
  const x = lerp(FLAME_X_MIN, FLAME_X_MAX, t);
  flames.push({
    x, y: INNER_FLOOR_Y + (Math.random() * 8 - 4),
    vx: (Math.random() - 0.5) * 14,
    vy: -(95 + Math.random() * 70),
    size: 16 + Math.random() * 26,
    life: 0,
    maxLife: 0.6 + Math.random() * 0.65,
    seed: Math.random() * 1000,
    core: Math.random() < 0.4,
  });
}

function spawnSmoke() {
  smoke.push({
    x: lerp(FLAME_X_MIN + 20, FLAME_X_MAX - 20, Math.random()),
    y: INNER_FLOOR_Y - 90 - Math.random() * 30,
    vx: (Math.random() - 0.5) * 8,
    vy: -(14 + Math.random() * 12),
    size: 26 + Math.random() * 20,
    life: 0,
    maxLife: 2.6 + Math.random() * 2,
    seed: Math.random() * 1000,
  });
}

function spawnSpark() {
  sparks.push({
    x: lerp(FLAME_X_MIN, FLAME_X_MAX, Math.random()),
    y: INNER_FLOOR_Y,
    vx: (Math.random() - 0.5) * 30,
    vy: -(90 + Math.random() * 90),
    life: 0,
    maxLife: 0.7 + Math.random() * 1.2,
    seed: Math.random() * 1000,
  });
}

function updateParticles(dt) {
  flameSpawnAcc += (17 + flicker * 6) * dt;
  while (flameSpawnAcc >= 1) { spawnFlame(); flameSpawnAcc--; }

  smokeSpawnAcc += 0.8 * dt;
  while (smokeSpawnAcc >= 1) { spawnSmoke(); smokeSpawnAcc--; }

  sparkTimer -= dt;
  if (sparkTimer <= 0) {
    spawnSpark();
    sparkTimer = 0.25 + Math.random() * 0.9;
  }

  for (let i = flames.length - 1; i >= 0; i--) {
    const p = flames[i];
    p.life += dt;
    if (p.life >= p.maxLife) { flames.splice(i, 1); continue; }
    const wobble = Math.sin(time * 3 + p.seed) * 20;
    p.x += (p.vx + wobble) * dt;
    p.y += p.vy * dt;
    p.vy -= 18 * dt;
  }

  for (let i = smoke.length - 1; i >= 0; i--) {
    const p = smoke[i];
    p.life += dt;
    if (p.life >= p.maxLife) { smoke.splice(i, 1); continue; }
    p.x += (p.vx + Math.sin(time * 0.6 + p.seed) * 6) * dt;
    p.y += p.vy * dt;
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.life += dt;
    if (p.life >= p.maxLife) { sparks.splice(i, 1); continue; }
    p.vy += 55 * dt;
    p.x += (p.vx + Math.sin(time * 5 + p.seed) * 12) * dt;
    p.y += p.vy * dt;
  }
}

function drawFlame(p) {
  const t = p.life / p.maxLife;
  const hue = lerp(48, 12, Math.min(1, t * 1.3));
  const light = p.core ? lerp(88, 45, t) : lerp(62, 35, t);
  const alpha = (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88) * (p.core ? 0.85 : 0.55);
  const size = p.size * (1 - t * 0.55);
  // Flame tongues taper as they rise — stretch the glow vertically and taller near the base
  // (t small) so it reads as a lick of flame rather than a floating blob.
  const stretch = lerp(2.1, 1.1, t);
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
  g.addColorStop(0, `hsla(${hue},100%,${light}%,${alpha})`);
  g.addColorStop(0.6, `hsla(${hue - 8},100%,${light * 0.7}%,${alpha * 0.5})`);
  g.addColorStop(1, `hsla(${hue - 15},100%,${light * 0.4}%,0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - size * (stretch - 1) * 0.5, size * 0.65, size * stretch, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSmokeParticle(p) {
  const t = p.life / p.maxLife;
  const alpha = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * 0.16;
  const size = p.size * (1 + t * 1.6);
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
  g.addColorStop(0, `rgba(60,52,48,${alpha})`);
  g.addColorStop(1, "rgba(60,52,48,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpark(p) {
  const t = p.life / p.maxLife;
  const alpha = (1 - t) * (0.6 + 0.4 * Math.sin(time * 30 + p.seed));
  ctx.fillStyle = `hsla(${lerp(45, 20, t)},100%,${lerp(75, 45, t)}%,${clamp(alpha, 0, 1)})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoalBed() {
  for (const coal of coalBed) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 2.5 + coal.seed);
    const a = 0.5 * flicker * pulse;
    const g = ctx.createRadialGradient(coal.x, coal.y, 0, coal.x, coal.y, coal.r);
    g.addColorStop(0, `rgba(255,180,90,${a})`);
    g.addColorStop(0.5, `rgba(255,90,30,${a * 0.6})`);
    g.addColorStop(1, "rgba(255,60,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(coal.x, coal.y, coal.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEmberCracks() {
  for (const crack of emberCracks) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 3 + crack.seed);
    const a = 0.5 * flicker * pulse;
    const rad = (crack.angle * Math.PI) / 180;
    const g = ctx.createRadialGradient(crack.x, crack.y, 0, crack.x, crack.y, crack.len * 0.6);
    g.addColorStop(0, `rgba(255,150,60,${a})`);
    g.addColorStop(1, "rgba(255,90,30,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(crack.x, crack.y, crack.len * 0.5, 4, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAmbientGlow() {
  const g = ctx.createRadialGradient(FLAME_CX, INNER_FLOOR_Y - 40, 20, FLAME_CX, INNER_FLOOR_Y - 40, 420);
  g.addColorStop(0, `rgba(255,140,60,${0.16 * flicker})`);
  g.addColorStop(1, "rgba(255,140,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

let glowThrottle = 0;
function render() {
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(bgCanvas, 0, 0, W, H);

  for (const p of smoke) drawSmokeParticle(p);

  ctx.globalCompositeOperation = "lighter";
  drawCoalBed();
  drawEmberCracks();
  for (const p of flames) drawFlame(p);
  for (const p of sparks) drawSpark(p);
  drawAmbientGlow();
  ctx.globalCompositeOperation = "source-over";

  glowThrottle++;
  if (glowThrottle % 3 === 0) {
    canvas.style.boxShadow = `0 0 ${34 * flicker}px rgba(255,130,50,${0.22 * flicker})`;
  }
}

let lastTime = null;
function loop(now) {
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05);
  time += dt;
  updateFlicker(dt);
  updateParticles(dt);
  render();
  requestAnimationFrame(loop);
}

applySize();
window.addEventListener("resize", applySize);
requestAnimationFrame(loop);

// --- Ambient sound (procedural — no audio files, so it's synthesized the first time the
// listener asks for it, which also satisfies the browser's user-gesture requirement to
// start an AudioContext). A looping filtered-noise hum plus randomly timed noise-burst pops.
let audioCtx = null;
let humGain = null;
let crackleBuffer = null;
let soundOn = false;
let crackleHandle = null;

function createNoiseBuffer(seconds) {
  const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * seconds), audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playCrackle() {
  const src = audioCtx.createBufferSource();
  src.buffer = crackleBuffer;
  const dur = 0.02 + Math.random() * 0.06;
  const start = Math.random() * (crackleBuffer.duration - dur);
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700 + Math.random() * 3200;
  filter.Q.value = 1.1;
  const gain = audioCtx.createGain();
  const peak = 0.12 + Math.random() * 0.22;
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(peak, audioCtx.currentTime + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  src.connect(filter).connect(gain).connect(audioCtx.destination);
  src.start(audioCtx.currentTime, start, dur);
}

function scheduleCrackle() {
  const delay = 150 + Math.random() * 500;
  crackleHandle = setTimeout(() => {
    if (soundOn) playCrackle();
    scheduleCrackle();
  }, delay);
}

function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  crackleBuffer = createNoiseBuffer(0.3);
  const humBuffer = createNoiseBuffer(2);
  const humSrc = audioCtx.createBufferSource();
  humSrc.buffer = humBuffer;
  humSrc.loop = true;
  const humFilter = audioCtx.createBiquadFilter();
  humFilter.type = "lowpass";
  humFilter.frequency.value = 320;
  humGain = audioCtx.createGain();
  humGain.gain.value = 0;
  humSrc.connect(humFilter).connect(humGain).connect(audioCtx.destination);
  humSrc.start();
  scheduleCrackle();
}

soundBtn.addEventListener("click", () => {
  if (!audioCtx) initAudio();
  if (audioCtx.state === "suspended") audioCtx.resume();
  soundOn = !soundOn;
  humGain.gain.setTargetAtTime(soundOn ? 0.05 : 0, audioCtx.currentTime, 0.6);
  soundBtn.textContent = soundOn ? "🔇 Mute" : "🔊 Add Crackling Sound";
  soundBtn.classList.toggle("active", soundOn);
});
