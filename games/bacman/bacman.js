const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const overlaySub = document.getElementById("overlay-sub");
const startBtn = document.getElementById("start-btn");

const CELL_COLS = 9;
const CELL_ROWS = 9;
const COLS = CELL_COLS * 2 + 1;
const ROWS = CELL_ROWS * 2 + 1;
const TILE = canvas.width / COLS;
const LOOP_FACTOR = 0.15;

const PLAYER_SPEED = 5.4;
const IDLE_SPEED = 2.2;
const FLEE_SPEED_BASE = 4.8;
const FLEE_SPEED_PER_LEVEL = 0.12;
const STUNNED_SPEED = 1.6;

const NOTICE_RADIUS_BASE = 6;
const STUN_DURATION = 7;
const INITIAL_RELEASE_INTERVAL = 2.5;
const RESPAWN_DELAY = 2;

const DOT_SCORE = 10;
const PELLET_SCORE = 50;
const CAPTURE_SCORE = 150;
const CAPTURE_CHAIN_BASE = 200;

const BEST_KEY = "meatflap-bacman-best";

const WALL_COLOR = "#5aaee0";
const DOT_COLOR = "#e0a868";
const PELLET_COLOR = "#ff8c69";
const PLAYER_COLOR = "#ff4d8d";
const BACON_COLORS = ["#ff8c69", "#ff6f91", "#ffa47a", "#f2795c"];
const STUNNED_COLOR = "#ffe8d6";
const STUNNED_WARN_COLOR = "#e7e9ee";

const PEN = { x0: 8, x1: 10, y0: 8, y1: 10 };
const PEN_CENTER = { x: 9, y: 9 };
const PLAYER_START = { x: 9, y: 15 };
const CORNERS = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
  { x: COLS - 2, y: ROWS - 2 },
];
const PEN_SPOTS = [
  { x: 8, y: 9 },
  { x: 9, y: 9 },
  { x: 10, y: 9 },
  { x: 9, y: 10 },
];

function generateMaze() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill("#"));
  for (let cy = 0; cy < CELL_ROWS; cy++) {
    for (let cx = 0; cx < CELL_COLS; cx++) {
      grid[1 + 2 * cy][1 + 2 * cx] = ".";
    }
  }

  const visited = Array.from({ length: CELL_ROWS }, () => Array(CELL_COLS).fill(false));
  const stack = [[0, 0]];
  visited[0][0] = true;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = [];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && nx < CELL_COLS && ny >= 0 && ny < CELL_ROWS && !visited[ny][nx]) options.push([nx, ny, dx, dy]);
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = options[Math.floor(Math.random() * options.length)];
    grid[1 + 2 * cy + dy][1 + 2 * cx + dx] = ".";
    visited[ny][nx] = true;
    stack.push([nx, ny]);
  }

  for (let cy = 0; cy < CELL_ROWS; cy++) {
    for (let cx = 0; cx < CELL_COLS; cx++) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= CELL_COLS || ny >= CELL_ROWS) continue;
        const wx = 1 + 2 * cx + dx, wy = 1 + 2 * cy + dy;
        if (grid[wy][wx] === "#" && Math.random() < LOOP_FACTOR) grid[wy][wx] = ".";
      }
    }
  }

  for (let y = PEN.y0; y <= PEN.y1; y++) {
    for (let x = PEN.x0; x <= PEN.x1; x++) grid[y][x] = " ";
  }

  for (const c of CORNERS) grid[c.y][c.x] = "o";
  grid[PLAYER_START.y][PLAYER_START.x] = " ";

  return grid;
}

function isWall(tx, ty) {
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
  return maze[ty][tx] === "#";
}

function countDots() {
  let n = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (maze[y][x] === "." || maze[y][x] === "o") n++;
    }
  }
  return n;
}

function initEntity(entity, tx, ty) {
  entity.x = tx;
  entity.y = ty;
  entity.targetX = tx;
  entity.targetY = ty;
  entity.dir = { x: 0, y: 0 };
}

function arrivedAtTarget(entity) {
  return entity.x === entity.targetX && entity.y === entity.targetY;
}

function stepToward(entity, dt, speed) {
  const dx = entity.targetX - entity.x, dy = entity.targetY - entity.y;
  const dist = Math.hypot(dx, dy);
  const step = speed * dt;
  if (dist <= step || dist === 0) {
    entity.x = entity.targetX;
    entity.y = entity.targetY;
  } else {
    entity.x += (dx / dist) * step;
    entity.y += (dy / dist) * step;
  }
}

const DIRS = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

function openNeighbors(cx, cy, excludeReverse) {
  const opts = [];
  for (const d of DIRS) {
    if (excludeReverse && d.x === -excludeReverse.x && d.y === -excludeReverse.y) continue;
    if (!isWall(cx + d.x, cy + d.y)) opts.push(d);
  }
  if (opts.length === 0 && excludeReverse) {
    return openNeighbors(cx, cy, null);
  }
  return opts;
}

// Pathfinding uses a distance field (BFS flood-filled outward FROM a target tile) instead
// of recomputing a shortest path from the mover's position at every step. The latter can
// tie-break inconsistently between successive recomputations when a maze loop offers
// multiple equally-short routes, causing oscillation instead of convergence. Stepping
// "downhill" (toward) or "uphill" (away) on one static field can't oscillate — every step
// strictly moves the distance the right way.
function computeDistanceField(targetX, targetY) {
  const tx = Math.max(0, Math.min(COLS - 1, Math.round(targetX)));
  const ty = Math.max(0, Math.min(ROWS - 1, Math.round(targetY)));
  const dist = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  if (isWall(tx, ty)) return dist;
  dist[ty][tx] = 0;
  const queue = [[tx, ty]];
  let qi = 0;
  while (qi < queue.length) {
    const [x, y] = queue[qi++];
    for (const d of DIRS) {
      const nx = x + d.x, ny = y + d.y;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (isWall(nx, ny) || dist[ny][nx] !== -1) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

function stepDownhill(cx, cy, distField) {
  let best = null, bestDist = Infinity;
  for (const d of DIRS) {
    const nx = cx + d.x, ny = cy + d.y;
    if (isWall(nx, ny)) continue;
    const dv = distField[ny][nx];
    if (dv >= 0 && dv < bestDist) {
      bestDist = dv;
      best = d;
    }
  }
  return best;
}

function stepUphill(cx, cy, distField) {
  let best = null, bestDist = -1;
  for (const d of DIRS) {
    const nx = cx + d.x, ny = cy + d.y;
    if (isWall(nx, ny)) continue;
    const dv = distField[ny][nx];
    if (dv >= 0 && dv > bestDist) {
      bestDist = dv;
      best = d;
    }
  }
  return best;
}

function moveBaconToward(b, cx, cy, targetX, targetY, uphill) {
  const field = computeDistanceField(targetX, targetY);
  const d = (uphill ? stepUphill(cx, cy, field) : stepDownhill(cx, cy, field)) || openNeighbors(cx, cy, b.dir)[0];
  b.dir = d;
  b.targetX = cx + d.x;
  b.targetY = cy + d.y;
}

// Bacon are prey, not predators: when Nubby is far away they idle near their corner; once
// he gets close they flee (steepest ascent away from him). Getting stunned by a Boss Bacon
// pellet is the only time they move erratically and can be scooped up for a big bonus —
// otherwise capturing one just means out-maneuvering it while it runs.
function decideBaconDir(b, cx, cy) {
  if (b.mode === "stunned") {
    const opts = openNeighbors(cx, cy, b.dir);
    const d = opts[Math.floor(Math.random() * opts.length)];
    b.dir = d;
    b.targetX = cx + d.x;
    b.targetY = cy + d.y;
    return;
  }

  const distToPlayer = Math.hypot(cx - player.x, cy - player.y);
  if (distToPlayer < b.noticeRadius) {
    b.mode = "flee";
    moveBaconToward(b, cx, cy, player.x, player.y, true);
  } else {
    b.mode = "idle";
    moveBaconToward(b, cx, cy, b.scatterTarget.x, b.scatterTarget.y, false);
  }
}

function decidePlayerDir(cx, cy) {
  const nd = player.nextDir;
  if ((nd.x || nd.y) && !isWall(cx + nd.x, cy + nd.y)) {
    player.dir = { x: nd.x, y: nd.y };
  } else if (isWall(cx + player.dir.x, cy + player.dir.y)) {
    player.dir = { x: 0, y: 0 };
  }
  player.targetX = cx + player.dir.x;
  player.targetY = cy + player.dir.y;
}

let maze = generateMaze();
let dotsRemaining = countDots();
let player = {
  x: PLAYER_START.x, y: PLAYER_START.y, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 },
  targetX: PLAYER_START.x, targetY: PLAYER_START.y, facing: { x: 0, y: -1 }, animPhase: 0,
};
let bacons = [];
let score = 0;
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let level = 1;
let running = false;
let chainMultiplier = 0;

function makeBacons() {
  return PEN_SPOTS.map((s, i) => {
    const b = {
      color: BACON_COLORS[i], scale: 1 + Math.floor(Math.random() * 3), scatterTarget: CORNERS[i],
      mode: "house", stunTimer: 0, releaseDelay: i * INITIAL_RELEASE_INTERVAL,
      noticeRadius: NOTICE_RADIUS_BASE + (Math.random() * 2 - 1), wobblePhase: Math.random() * Math.PI * 2,
    };
    initEntity(b, s.x, s.y);
    return b;
  });
}

function respawnBacon(b) {
  const spot = PEN_SPOTS[bacons.indexOf(b)];
  initEntity(b, spot.x, spot.y);
  b.mode = "house";
  b.releaseDelay = RESPAWN_DELAY;
}

function resetPositions() {
  initEntity(player, PLAYER_START.x, PLAYER_START.y);
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };
  bacons = makeBacons();
  chainMultiplier = 0;
}

function newLevel() {
  maze = generateMaze();
  dotsRemaining = countDots();
  resetPositions();
}

function newGame() {
  score = 0;
  level = 1;
  running = true;
  newLevel();
  updateHud();
  overlay.classList.add("hidden");
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  levelEl.textContent = level;
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }
}

function collectAt(cx, cy) {
  const cell = maze[cy][cx];
  if (cell === ".") {
    maze[cy][cx] = " ";
    score += DOT_SCORE;
    dotsRemaining -= 1;
    updateHud();
  } else if (cell === "o") {
    maze[cy][cx] = " ";
    score += PELLET_SCORE;
    dotsRemaining -= 1;
    chainMultiplier = 0;
    for (const b of bacons) {
      if (b.mode !== "house") {
        b.mode = "stunned";
        b.stunTimer = STUN_DURATION;
      }
    }
    updateHud();
  }
  if (dotsRemaining <= 0) {
    level += 1;
    newLevel();
    updateHud();
  }
}

function update(dt) {
  if (!running) return;

  if (arrivedAtTarget(player)) {
    const cx = Math.round(player.x), cy = Math.round(player.y);
    decidePlayerDir(cx, cy);
    collectAt(cx, cy);
  }
  if (player.dir.x || player.dir.y) {
    player.facing = { x: player.dir.x, y: player.dir.y };
    player.animPhase += dt * 8;
  }
  stepToward(player, dt, PLAYER_SPEED);

  const fleeSpeed = FLEE_SPEED_BASE + (level - 1) * FLEE_SPEED_PER_LEVEL;
  for (const b of bacons) {
    b.wobblePhase += dt * 6;
    if (b.mode === "house") {
      b.releaseDelay -= dt;
      if (b.releaseDelay > 0) continue;
      b.mode = "idle";
    }
    if (arrivedAtTarget(b)) {
      const cx = Math.round(b.x), cy = Math.round(b.y);
      decideBaconDir(b, cx, cy);
    }
    if (b.mode === "stunned") {
      b.stunTimer -= dt;
      if (b.stunTimer <= 0) b.mode = "idle";
    }
    const speed = b.mode === "stunned" ? STUNNED_SPEED : b.mode === "flee" ? fleeSpeed : IDLE_SPEED;
    stepToward(b, dt, speed);
  }

  for (const b of bacons) {
    if (b.mode === "house") continue;
    const dist = Math.hypot(player.x - b.x, player.y - b.y);
    if (dist < 0.6) {
      if (b.mode === "stunned") {
        score += CAPTURE_CHAIN_BASE * b.scale * Math.pow(2, chainMultiplier);
        chainMultiplier += 1;
      } else {
        score += CAPTURE_SCORE * b.scale;
      }
      respawnBacon(b);
      updateHud();
    }
  }
}

function drawWalls() {
  ctx.fillStyle = WALL_COLOR;
  ctx.shadowColor = WALL_COLOR;
  ctx.shadowBlur = 6;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (maze[y][x] !== "#") continue;
      ctx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
    }
  }
  ctx.shadowBlur = 0;
}

function drawDots() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = maze[y][x];
      if (cell === ".") {
        ctx.fillStyle = DOT_COLOR;
        ctx.beginPath();
        ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE * 0.09, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === "o") {
        const pulse = 1 + Math.sin(performance.now() / 150) * 0.15;
        ctx.fillStyle = PELLET_COLOR;
        ctx.shadowColor = PELLET_COLOR;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE * 0.28 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
}

function drawPlayer() {
  const px = player.x * TILE + TILE / 2, py = player.y * TILE + TILE / 2;
  const r = TILE * 0.38;
  const fx = player.facing.x, fy = player.facing.y;
  const bob = (player.dir.x || player.dir.y) ? Math.sin(player.animPhase) * TILE * 0.04 : 0;

  ctx.fillStyle = PLAYER_COLOR;
  ctx.shadowColor = PLAYER_COLOR;
  ctx.shadowBlur = 9;

  ctx.beginPath();
  ctx.arc(px, py + bob, r, 0, Math.PI * 2);
  ctx.fill();

  const tipDist = r * 0.75;
  ctx.beginPath();
  ctx.arc(px + fx * tipDist, py + bob + fy * tipDist, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#0d0f14";
  const eyeDist = r * 0.95;
  ctx.beginPath();
  ctx.arc(px + fx * eyeDist, py + bob + fy * eyeDist, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function drawBaconCreature(b) {
  const cx = b.x * TILE + TILE / 2, cy = b.y * TILE + TILE / 2;
  const scaleR = 0.85 + b.scale * 0.12;
  const len = TILE * 0.85 * scaleR, halfW = TILE * 0.3 * scaleR;
  const dx = b.dir.x, dy = b.dir.y;
  const angle = (dx || dy) ? Math.atan2(dy, dx) : 0;

  let color = b.color;
  if (b.mode === "stunned") {
    color = b.stunTimer < 2 && Math.floor(b.stunTimer * 6) % 2 === 0 ? STUNNED_WARN_COLOR : STUNNED_COLOR;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 7;

  const seg = 8;
  const top = [], bot = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const x = -len / 2 + t * len;
    const wobble = Math.sin(t * Math.PI * 2.4 + b.wobblePhase) * halfW * 0.4;
    top.push([x, -halfW * 0.6 + wobble]);
    bot.push([x, halfW * 0.6 + wobble]);
  }
  ctx.beginPath();
  ctx.moveTo(top[0][0], top[0][1]);
  for (const p of top) ctx.lineTo(p[0], p[1]);
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBacons() {
  for (const b of bacons) drawBaconCreature(b);
}

function draw() {
  ctx.fillStyle = "#10141c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawWalls();
  drawDots();
  drawBacons();
  drawPlayer();
}

const KEY_MAP = {
  ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
};

window.addEventListener("keydown", (e) => {
  const d = KEY_MAP[e.code];
  if (d) {
    player.nextDir = { x: d.x, y: d.y };
    e.preventDefault();
  }
});

startBtn.addEventListener("click", newGame);

let lastTime = null;
function loop(now) {
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05);
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

updateHud();
draw();
requestAnimationFrame(loop);
