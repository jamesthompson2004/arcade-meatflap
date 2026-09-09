const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const turnLabel = document.getElementById("turn-label");
const heatFill = document.getElementById("heat-fill");
const restartBtn = document.getElementById("restart-btn");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const overlayRestartBtn = document.getElementById("overlay-restart-btn");

const W = 620, H = 460;
const COLS = 6, ROWS = 4;
const TOTAL = COLS * ROWS;
const CELL = 88, GAP = 6;
const GRID_W = COLS * CELL + (COLS - 1) * GAP;
const GRID_H = ROWS * CELL + (ROWS - 1) * GAP;
const GRID_X = (W - GRID_W) / 2;
const GRID_Y = 80;

// Tuned via Monte Carlo simulation (see commit message) to avoid both instant losses and
// games that always run to the last tile: a short grace period where nothing can happen,
// then risk ramps up faster than linearly, capped below certain-death until the very last
// tile forces it (so a game can't end in a anticlimactic "clear the whole board" no-op).
const RISK_GRACE = 4;
const RISK_EXPONENT = 1.7;
const RISK_SCALE = 0.9;
const RISK_CAP = 0.85;

function riskAt(brokenCount) {
  if (brokenCount >= TOTAL - 1) return 1;
  if (brokenCount <= RISK_GRACE) return 0;
  const t = (brokenCount - RISK_GRACE) / (TOTAL - RISK_GRACE);
  return Math.min(RISK_CAP, Math.pow(t, RISK_EXPONENT) * RISK_SCALE);
}

let dpr = 1;
function applySize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function tileRect(index) {
  const col = index % COLS, row = Math.floor(index / COLS);
  const x = GRID_X + col * (CELL + GAP);
  const y = GRID_Y + row * (CELL + GAP);
  return { x, y, cx: x + CELL / 2, cy: y + CELL / 2 };
}

let tiles, brokenCount, turn, phase, particles, sausage, time;

function reset() {
  tiles = Array.from({ length: TOTAL }, () => ({ broken: false, breakT: 0 }));
  brokenCount = 0;
  turn = "player";
  phase = "idle";
  particles = [];
  const restX = W / 2, restY = GRID_Y - 34;
  sausage = { x: restX, y: restY, restX, restY, bobPhase: Math.random() * Math.PI * 2, fallT: 0, fallDuration: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, stage: "resting" };
  time = 0;
  overlay.classList.add("hidden");
  updateHud();
  render();
}

function updateHud() {
  turnLabel.textContent = phase === "over" ? "Game over" : turn === "player" ? "Your turn" : "Computer's turn…";
  heatFill.style.width = `${Math.round(riskAt(brokenCount) * 100)}%`;
}

function spawnBreakParticles(cx, cy, ember) {
  const count = ember ? 10 : 6;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 50;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - (ember ? 40 : 10),
      life: 0, maxLife: 0.4 + Math.random() * 0.4,
      size: ember ? 2 + Math.random() * 3 : 3 + Math.random() * 4,
      ember,
    });
  }
}

function handleTap(who, index) {
  if (phase !== "idle" || tiles[index].broken) return;
  tiles[index].broken = true;
  tiles[index].breakT = 0;
  brokenCount++;
  const rect = tileRect(index);
  spawnBreakParticles(rect.cx, rect.cy, false);
  phase = "breaking";
  updateHud();

  const fatal = Math.random() < riskAt(brokenCount);

  setTimeout(() => {
    if (fatal) {
      startFall(who, rect);
    } else {
      phase = "idle";
      turn = who === "player" ? "computer" : "player";
      updateHud();
      if (turn === "computer") scheduleComputerTurn();
    }
  }, 260);
}

function scheduleComputerTurn() {
  setTimeout(() => {
    if (phase !== "idle" || turn !== "computer") return;
    const remaining = tiles.map((t, i) => (t.broken ? -1 : i)).filter((i) => i >= 0);
    if (!remaining.length) return;
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    handleTap("computer", pick);
  }, 650 + Math.random() * 500);
}

function startFall(who, rect) {
  phase = "falling";
  sausage.stage = "toHole";
  sausage.fallT = 0;
  sausage.fallDuration = 0.35;
  sausage.fromX = sausage.x;
  sausage.fromY = sausage.y;
  sausage.toX = rect.cx;
  sausage.toY = rect.cy - 10;
  sausage.faultWho = who;
}

function finishGame(who) {
  phase = "over";
  spawnBreakParticles(sausage.x, sausage.y, true);
  updateHud();
  const text = who === "player" ? "You lose! The sausage hit the coals on your watch." : "You win! The computer dropped it.";
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function update(dt) {
  time += dt;

  for (const t of tiles) {
    if (t.broken && t.breakT < 1) t.breakT = Math.min(1, t.breakT + dt / 0.25);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.ember ? -20 : 60) * dt;
  }

  if (phase === "falling") {
    sausage.fallT += dt;
    if (sausage.stage === "toHole") {
      const t = Math.min(1, sausage.fallT / sausage.fallDuration);
      sausage.x = sausage.fromX + (sausage.toX - sausage.fromX) * t;
      sausage.y = sausage.fromY + (sausage.toY - sausage.fromY) * t - Math.sin(t * Math.PI) * 24;
      if (t >= 1) {
        sausage.stage = "dropping";
        sausage.fallT = 0;
        sausage.fallDuration = 0.5;
        sausage.fromY = sausage.y;
      }
    } else if (sausage.stage === "dropping") {
      const t = Math.min(1, sausage.fallT / sausage.fallDuration);
      sausage.y = sausage.fromY + t * 90;
      sausage.alpha = 1 - t;
      if (t >= 1) {
        finishGame(sausage.faultWho);
      }
    }
  } else {
    sausage.bobPhase += dt * 2;
    sausage.x = sausage.restX;
    sausage.y = sausage.restY + Math.sin(sausage.bobPhase) * 3;
    sausage.alpha = 1;
  }
}

function drawTile(index) {
  const t = tiles[index];
  const { x, y } = tileRect(index);
  if (t.broken) {
    const ease = t.breakT;
    if (ease < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - ease;
      const scale = 1 - ease * 0.5;
      const cx = x + CELL / 2, cy = y + CELL / 2;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.rotate(ease * 0.6);
      drawGrate(-CELL / 2, -CELL / 2);
      ctx.restore();
    }
    const cx = x + CELL / 2, cy = y + CELL / 2;
    const flicker = 0.75 + 0.25 * Math.sin(time * 6 + index);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, CELL * 0.6);
    g.addColorStop(0, `rgba(255,150,60,${0.8 * flicker})`);
    g.addColorStop(0.5, `rgba(255,80,30,${0.5 * flicker})`);
    g.addColorStop(1, "rgba(20,10,5,0.9)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, CELL, CELL);
    return;
  }
  drawGrate(x, y);
}

function drawGrate(x, y) {
  const grad = ctx.createLinearGradient(x, y, x, y + CELL);
  grad.addColorStop(0, "#4a4d52");
  grad.addColorStop(1, "#2c2e32");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, CELL, CELL);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 3;
  for (let i = 1; i < 4; i++) {
    const gy = y + (CELL / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x + 4, gy);
    ctx.lineTo(x + CELL - 4, gy);
    ctx.stroke();
  }
}

function drawSausage() {
  const { x, y, alpha } = sausage;
  ctx.save();
  ctx.globalAlpha = alpha ?? 1;
  ctx.translate(x, y);
  const bodyGrad = ctx.createLinearGradient(-30, -16, 30, 16);
  bodyGrad.addColorStop(0, "#c9683f");
  bodyGrad.addColorStop(1, "#a94f2c");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  for (const dx of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(dx, -13);
    ctx.lineTo(dx + 5, 13);
    ctx.stroke();
  }
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(-8, -4, 2.5, 0, Math.PI * 2);
  ctx.arc(2, -4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-3, 2, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    const alpha = 1 - t;
    ctx.fillStyle = p.ember
      ? `rgba(255,${140 + Math.floor(60 * (1 - t))},60,${alpha})`
      : `rgba(180,180,180,${alpha * 0.6})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 - t * 0.3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, "#1a120c");
  bgGrad.addColorStop(1, "#0d0704");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < TOTAL; i++) drawTile(i);
  drawParticles();
  if (phase !== "over" || sausage.alpha > 0) drawSausage();
}

let lastTime = null;
function loop(now) {
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05);
  update(dt);
  render();
  requestAnimationFrame(loop);
}

canvas.addEventListener("click", (e) => {
  if (phase !== "idle" || turn !== "player") return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width, scaleY = H / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  for (let i = 0; i < TOTAL; i++) {
    if (tiles[i].broken) continue;
    const { x, y } = tileRect(i);
    if (px >= x && px <= x + CELL && py >= y && py <= y + CELL) {
      handleTap("player", i);
      break;
    }
  }
});

restartBtn.addEventListener("click", reset);
overlayRestartBtn.addEventListener("click", reset);

applySize();
window.addEventListener("resize", applySize);
reset();
requestAnimationFrame(loop);
