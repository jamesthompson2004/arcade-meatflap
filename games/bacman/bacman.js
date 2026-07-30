const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const livesEl = document.getElementById("lives");
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
const GHOST_BASE_SPEED = 4.5;
const GHOST_SPEED_PER_LEVEL = 0.15;
const FRIGHTENED_SPEED = 3;
const EATEN_SPEED = 8.5;

const FRIGHTENED_DURATION = 7;
const SCATTER_DURATION = 6;
const CHASE_DURATION = 18;

const DOT_SCORE = 10;
const PELLET_SCORE = 50;
const GHOST_SCORE_BASE = 200;

const LIVES_START = 3;
const BEST_KEY = "meatflap-bacman-best";

const WALL_COLOR = "#5aaee0";
const DOT_COLOR = "#e0a868";
const PELLET_COLOR = "#ff8c69";
const PLAYER_COLOR = "#ff4d8d";
const GHOST_COLORS = ["#e07850", "#c060d0", "#50c0d0", "#e0c050"];
const FRIGHTENED_COLOR = "#4d7bff";
const FRIGHTENED_WARN_COLOR = "#e7e9ee";

const HOUSE = { x0: 8, x1: 10, y0: 8, y1: 10 };
const HOUSE_DOOR = { x: 9, y: 8 };
const HOUSE_CENTER = { x: 9, y: 9 };
const PLAYER_START = { x: 9, y: 15 };
const CORNERS = [
  { x: 1, y: 1 },
  { x: COLS - 2, y: 1 },
  { x: 1, y: ROWS - 2 },
  { x: COLS - 2, y: ROWS - 2 },
];
const GHOST_STARTS = [
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

  for (let y = HOUSE.y0; y <= HOUSE.y1; y++) {
    for (let x = HOUSE.x0; x <= HOUSE.x1; x++) grid[y][x] = " ";
  }
  grid[HOUSE_DOOR.y][HOUSE_DOOR.x] = " ";

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

// Pathfinding toward a target tile uses a distance field (BFS flood-filled outward FROM
// the target) rather than recomputing a shortest path from the ghost's position at every
// tile. The latter can tie-break inconsistently between successive recomputations when a
// maze loop offers multiple equally-short routes, causing ghosts to oscillate forever
// instead of converging. Stepping "downhill" on a single static distance field can't
// oscillate: every step strictly decreases distance, so it always reaches the target.
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

function ghostChaseTarget(g) {
  const pcx = Math.round(player.x), pcy = Math.round(player.y);
  if (g.personality === "direct") return { x: pcx, y: pcy };
  if (g.personality === "ambush") {
    return { x: pcx + player.dir.x * 4, y: pcy + player.dir.y * 4 };
  }
  if (g.personality === "shy") {
    const d = Math.hypot(g.x - pcx, g.y - pcy);
    return d > 8 ? { x: pcx, y: pcy } : g.scatterTarget;
  }
  // "wild" — mostly chases, occasionally darts off randomly
  if (Math.random() < 0.15) return { x: Math.random() * COLS, y: Math.random() * ROWS };
  return { x: pcx, y: pcy };
}

function moveGhostToward(g, cx, cy, targetX, targetY) {
  const field = computeDistanceField(targetX, targetY);
  const d = stepDownhill(cx, cy, field) || openNeighbors(cx, cy, g.dir)[0];
  g.dir = d;
  g.targetX = cx + d.x;
  g.targetY = cy + d.y;
}

function decideGhostDir(g, cx, cy) {
  if (g.mode === "eaten") {
    if (cx === HOUSE_CENTER.x && cy === HOUSE_CENTER.y) {
      g.mode = globalMode;
      g.frightTimer = 0;
      decideGhostDir(g, cx, cy);
      return;
    }
    moveGhostToward(g, cx, cy, HOUSE_CENTER.x, HOUSE_CENTER.y);
    return;
  }

  if (g.mode === "frightened") {
    const opts = openNeighbors(cx, cy, g.dir);
    const d = opts[Math.floor(Math.random() * opts.length)];
    g.dir = d;
    g.targetX = cx + d.x;
    g.targetY = cy + d.y;
    return;
  }

  const target = g.mode === "scatter" ? g.scatterTarget : ghostChaseTarget(g);
  moveGhostToward(g, cx, cy, target.x, target.y);
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
let player = { x: PLAYER_START.x, y: PLAYER_START.y, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, targetX: PLAYER_START.x, targetY: PLAYER_START.y, chompPhase: 0 };
let ghosts = [];
let score = 0;
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let lives = LIVES_START;
let level = 1;
let running = false;
let over = false;
let globalMode = "scatter";
let modeTimer = SCATTER_DURATION;
let chainMultiplier = 0;

const GHOST_RELEASE_INTERVAL = 2.5;

function makeGhosts() {
  const personalities = ["direct", "ambush", "shy", "wild"];
  return GHOST_STARTS.map((s, i) => {
    const g = {
      color: GHOST_COLORS[i], personality: personalities[i], scatterTarget: CORNERS[i],
      mode: "house", frightTimer: 0, releaseDelay: i * GHOST_RELEASE_INTERVAL,
    };
    initEntity(g, s.x, s.y);
    return g;
  });
}

function resetPositions() {
  initEntity(player, PLAYER_START.x, PLAYER_START.y);
  player.dir = { x: 0, y: 0 };
  player.nextDir = { x: 0, y: 0 };
  ghosts = makeGhosts();
  globalMode = "scatter";
  modeTimer = SCATTER_DURATION;
  chainMultiplier = 0;
}

function newLevel() {
  maze = generateMaze();
  dotsRemaining = countDots();
  resetPositions();
}

function newGame() {
  score = 0;
  lives = LIVES_START;
  level = 1;
  over = false;
  running = true;
  newLevel();
  updateHud();
  overlay.classList.add("hidden");
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  livesEl.textContent = lives;
  levelEl.textContent = level;
}

function loseLife() {
  lives -= 1;
  updateHud();
  if (lives <= 0) {
    endGame();
  } else {
    resetPositions();
  }
}

function endGame() {
  running = false;
  over = true;
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }
  overlayText.textContent = `Game Over — Score ${score}`;
  overlaySub.textContent = `Best: ${best}. The lemurs got the last laugh this time.`;
  startBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
  updateHud();
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
    for (const g of ghosts) {
      if (g.mode !== "eaten" && g.mode !== "house") {
        g.mode = "frightened";
        g.frightTimer = FRIGHTENED_DURATION;
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

  modeTimer -= dt;
  if (modeTimer <= 0) {
    globalMode = globalMode === "scatter" ? "chase" : "scatter";
    modeTimer = globalMode === "scatter" ? SCATTER_DURATION : CHASE_DURATION;
    for (const g of ghosts) {
      if (g.mode === "scatter" || g.mode === "chase") g.mode = globalMode;
    }
  }

  if (arrivedAtTarget(player)) {
    const cx = Math.round(player.x), cy = Math.round(player.y);
    decidePlayerDir(cx, cy);
    collectAt(cx, cy);
  }
  if (player.dir.x || player.dir.y) player.chompPhase += dt * 10;
  stepToward(player, dt, PLAYER_SPEED);

  const ghostSpeedBase = GHOST_BASE_SPEED + (level - 1) * GHOST_SPEED_PER_LEVEL;
  for (const g of ghosts) {
    if (g.mode === "house") {
      g.releaseDelay -= dt;
      if (g.releaseDelay <= 0) g.mode = globalMode;
      continue;
    }
    if (arrivedAtTarget(g)) {
      const cx = Math.round(g.x), cy = Math.round(g.y);
      decideGhostDir(g, cx, cy);
    }
    if (g.mode === "frightened") {
      g.frightTimer -= dt;
      if (g.frightTimer <= 0) g.mode = globalMode;
    }
    const speed = g.mode === "frightened" ? FRIGHTENED_SPEED : g.mode === "eaten" ? EATEN_SPEED : ghostSpeedBase;
    stepToward(g, dt, speed);
  }

  for (const g of ghosts) {
    if (g.mode === "house") continue;
    const dist = Math.hypot(player.x - g.x, player.y - g.y);
    if (dist < 0.6) {
      if (g.mode === "frightened") {
        g.mode = "eaten";
        score += GHOST_SCORE_BASE * Math.pow(2, chainMultiplier);
        chainMultiplier += 1;
        updateHud();
      } else if (g.mode !== "eaten") {
        loseLife();
        return;
      }
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
  const r = TILE * 0.42;
  let angle = 0;
  if (player.dir.x === 1) angle = 0;
  else if (player.dir.x === -1) angle = Math.PI;
  else if (player.dir.y === 1) angle = Math.PI / 2;
  else if (player.dir.y === -1) angle = -Math.PI / 2;
  const mouth = (player.dir.x || player.dir.y) ? (Math.abs(Math.sin(player.chompPhase)) * 0.28 + 0.03) : 0.03;
  ctx.fillStyle = PLAYER_COLOR;
  ctx.shadowColor = PLAYER_COLOR;
  ctx.shadowBlur = 9;
  ctx.beginPath();
  ctx.arc(px, py, r, angle + mouth * Math.PI, angle + (2 - mouth) * Math.PI);
  ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawGhostBody(cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  const bottom = cy + r;
  const waves = 4;
  for (let i = 0; i <= waves; i++) {
    const x = cx + r - (i * (2 * r)) / waves;
    const y = i % 2 === 0 ? bottom : bottom - r * 0.35;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawGhosts() {
  for (const g of ghosts) {
    const cx = g.x * TILE + TILE / 2, cy = g.y * TILE + TILE / 2;
    const r = TILE * 0.42;
    if (g.mode === "eaten") {
      ctx.fillStyle = "#e7e9ee";
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy, r * 0.14, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.3, cy, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    let color = g.color;
    if (g.mode === "frightened") {
      color = g.frightTimer < 2 && Math.floor(g.frightTimer * 6) % 2 === 0 ? FRIGHTENED_WARN_COLOR : FRIGHTENED_COLOR;
    }
    drawGhostBody(cx, cy, r, color);
    ctx.fillStyle = "#0d0f14";
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, cy - r * 0.12, r * 0.15, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.32, cy - r * 0.12, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  ctx.fillStyle = "#10141c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawWalls();
  drawDots();
  drawGhosts();
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
