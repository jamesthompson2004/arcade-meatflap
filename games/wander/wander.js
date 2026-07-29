const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const distanceEl = document.getElementById("distance");
const treesEl = document.getElementById("trees");
const bestEl = document.getElementById("best");
const newWorldBtn = document.getElementById("new-world-btn");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("start-btn");

const MOBILE_W = 840;
const MOBILE_H = 480;
const FOV_DEG = 75;
const NEAR = 0.2;
const MAX_DIST = 110;
const BANDS = 6;

let W, H, CX, CY, FOCAL;

function isDesktopFill() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function applySize() {
  const desktop = isDesktopFill();
  const dpr = desktop ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const cssW = desktop ? window.innerWidth : MOBILE_W;
  const cssH = desktop ? window.innerHeight : MOBILE_H;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  W = cssW;
  H = cssH;
  CX = W / 2;
  CY = H * 0.42;
  FOCAL = (W / 2) / Math.tan((FOV_DEG / 2) * Math.PI / 180);
}

applySize();
window.addEventListener("resize", applySize);

const CELL = 4;
const GRID_RANGE = Math.ceil(MAX_DIST / CELL);
const HEIGHT_SCALE = 15;

const TREE_CELL = 9;
const TREE_RANGE = Math.ceil(MAX_DIST / TREE_CELL) + 1;
const TREE_DENSITY = 0.16;
const TREE_RADIUS = 0.55;
const DISCOVER_RADIUS = 5;

const CHASE_DIST = 9;
const CHASE_HEIGHT = 1.7;
const MOVE_SPEED = 9;
const MOVE_SPEED_BACK = 5.5;
const TURN_SPEED = 2.3;
const CHAR_RADIUS = 0.55;

const BEST_KEY = "meatflap-wander-best";
const BG_COLOR = [13, 15, 20];
const GRID_NEAR = [90, 170, 210];
const TREE_NEAR = [77, 255, 159];
const CHAR_COLOR = "#ff4d8d";

let gridBandColor = [];
let treeBandColor = [];
for (let i = 0; i < BANDS; i++) {
  const t = i / (BANDS - 1);
  const alpha = 1 - t;
  gridBandColor.push(bandRgba(GRID_NEAR, t, alpha));
  treeBandColor.push(bandRgba(TREE_NEAR, t, alpha));
}

function bandRgba(near, t, alpha) {
  const r = lerp(near[0], BG_COLOR[0], t);
  const g = lerp(near[1], BG_COLOR[1], t);
  const b = lerp(near[2], BG_COLOR[2], t);
  return `rgba(${r | 0},${g | 0},${b | 0},${alpha.toFixed(3)})`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function hash2(ix, iz, seed) {
  let n = (ix * 374761393) ^ (iz * 668265263) ^ (seed * 1442695041);
  n = Math.imul(n ^ (n >>> 15), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const x1 = x0 + 1, z1 = z0 + 1;
  const sx = smooth(x - x0), sz = smooth(z - z0);
  const n00 = hash2(x0, z0, seed), n10 = hash2(x1, z0, seed);
  const n01 = hash2(x0, z1, seed), n11 = hash2(x1, z1, seed);
  const nx0 = lerp(n00, n10, sx), nx1 = lerp(n01, n11, sx);
  return lerp(nx0, nx1, sz);
}

let SEED = 1337;

function terrainHeight(x, z) {
  let h = 0, amp = 1, freq = 1, total = 0;
  for (let o = 0; o < 4; o++) {
    h += valueNoise(x * freq * 0.025, z * freq * 0.025, SEED + o * 101) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  h /= total;
  return (h - 0.5) * HEIGHT_SCALE;
}

function getNearbyTrees(px, pz) {
  const trees = [];
  const cix = Math.floor(px / TREE_CELL), ciz = Math.floor(pz / TREE_CELL);
  for (let dz = -TREE_RANGE; dz <= TREE_RANGE; dz++) {
    for (let dx = -TREE_RANGE; dx <= TREE_RANGE; dx++) {
      const ix = cix + dx, iz = ciz + dz;
      const r = hash2(ix, iz, SEED + 7777);
      if (r >= TREE_DENSITY) continue;
      const jx = hash2(ix, iz, SEED + 1111);
      const jz = hash2(ix, iz, SEED + 2222);
      const tx = (ix + 0.5 + (jx - 0.5) * 0.7) * TREE_CELL;
      const tz = (iz + 0.5 + (jz - 0.5) * 0.7) * TREE_CELL;
      if (Math.hypot(tx - px, tz - pz) > MAX_DIST + TREE_CELL) continue;
      const h0 = terrainHeight(tx, tz);
      const h1 = terrainHeight(tx + 1, tz);
      const h2 = terrainHeight(tx, tz + 1);
      const slope = Math.abs(h1 - h0) + Math.abs(h2 - h0);
      if (slope > 3.2) continue;
      const scale = 0.85 + hash2(ix, iz, SEED + 3333) * 0.5;
      trees.push({ x: tx, z: tz, y: h0, key: ix + "_" + iz, scale });
    }
  }
  return trees;
}

function treeSegments(t) {
  const trunkH = 1.6 * t.scale;
  const baseR = 0.9 * t.scale;
  const baseY = t.y + trunkH;
  const apex = { x: t.x, y: baseY + 2.6 * t.scale, z: t.z };
  const segs = [[{ x: t.x, y: t.y, z: t.z }, { x: t.x, y: baseY, z: t.z }]];
  const N = 6;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push({ x: t.x + Math.cos(a) * baseR, y: baseY, z: t.z + Math.sin(a) * baseR });
  }
  for (let i = 0; i < N; i++) {
    segs.push([pts[i], pts[(i + 1) % N]]);
    segs.push([pts[i], apex]);
  }
  return segs;
}

function sphereSegments(cx, cy, cz, R) {
  const segs = [];
  const N = 8;
  const ringDy = [-0.55, 0, 0.55].map((f) => f * R);
  const rings = ringDy.map((dy) => {
    const rr = Math.sqrt(Math.max(R * R - dy * dy, 0.0001));
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + dy, z: cz + Math.sin(a) * rr });
    }
    return pts;
  });
  rings.forEach((pts) => {
    for (let i = 0; i < N; i++) segs.push([pts[i], pts[(i + 1) % N]]);
  });
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < N; i++) segs.push([rings[r][i], rings[r + 1][i]]);
  }
  const top = { x: cx, y: cy + R, z: cz }, bottom = { x: cx, y: cy - R, z: cz };
  for (let i = 0; i < N; i++) {
    segs.push([rings[rings.length - 1][i], top]);
    segs.push([rings[0][i], bottom]);
  }
  segs.push([top, { x: cx, y: cy + R * 1.4, z: cz }]);
  return { segs, eye: { x: cx, y: cy + R * 1.4, z: cz } };
}

function project(x, y, z, cam) {
  const dx = x - cam.x, dz = z - cam.z;
  const rx = dx * cam.cosH - dz * cam.sinH;
  const rz = dx * cam.sinH + dz * cam.cosH;
  const ry = y - cam.y;
  return { x: rx, y: ry, z: rz };
}

function lerp3(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

function clipNear(a, b) {
  const af = a.z > NEAR, bf = b.z > NEAR;
  if (af && bf) return [a, b];
  if (!af && !bf) return null;
  if (!af) a = lerp3(a, b, (NEAR - a.z) / (b.z - a.z));
  else b = lerp3(b, a, (NEAR - b.z) / (a.z - b.z));
  return [a, b];
}

function toScreen(p) {
  const scale = FOCAL / p.z;
  return { sx: CX + p.x * scale, sy: CY - p.y * scale };
}

let player = { x: 0, z: 0, heading: 0 };
let distanceWalked = 0;
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let treesFound = 0;
const visitedTrees = new Set();
let currentTrees = [];
let started = false;
let bobPhase = 0;
const keys = { forward: false, backward: false, left: false, right: false };

bestEl.textContent = Math.floor(best);

function updateHud() {
  distanceEl.textContent = Math.floor(distanceWalked);
  treesEl.textContent = treesFound;
  bestEl.textContent = Math.floor(best);
}

function resetWorld(newSeed) {
  SEED = newSeed;
  player = { x: 0, z: 0, heading: 0 };
  distanceWalked = 0;
  treesFound = 0;
  visitedTrees.clear();
  bobPhase = 0;
  updateHud();
}

function update(dt) {
  if (keys.left) player.heading -= TURN_SPEED * dt;
  if (keys.right) player.heading += TURN_SPEED * dt;

  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  let moveAmt = 0;
  if (keys.forward) moveAmt += MOVE_SPEED * dt;
  if (keys.backward) moveAmt -= MOVE_SPEED_BACK * dt;

  currentTrees = getNearbyTrees(player.x, player.z);

  if (moveAmt !== 0) {
    let nx = player.x + fx * moveAmt;
    let nz = player.z + fz * moveAmt;
    for (const t of currentTrees) {
      const dx = nx - t.x, dz = nz - t.z;
      const dist = Math.hypot(dx, dz);
      const minDist = CHAR_RADIUS + TREE_RADIUS * t.scale;
      if (dist > 0.0001 && dist < minDist) {
        const push = minDist - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      }
    }
    player.x = nx;
    player.z = nz;
    distanceWalked += Math.abs(moveAmt);
    bobPhase += Math.abs(moveAmt) * 1.6;
    if (distanceWalked > best) {
      best = distanceWalked;
      localStorage.setItem(BEST_KEY, String(Math.floor(best)));
    }
  }

  for (const t of currentTrees) {
    if (visitedTrees.has(t.key)) continue;
    if (Math.hypot(t.x - player.x, t.z - player.z) < DISCOVER_RADIUS) {
      visitedTrees.add(t.key);
      treesFound++;
    }
  }

  updateHud();
}

function getCamera() {
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  const camX = player.x - fx * CHASE_DIST;
  const camZ = player.z - fz * CHASE_DIST;
  const camY = terrainHeight(player.x, player.z) + CHASE_HEIGHT;
  return { x: camX, y: camY, z: camZ, cosH: Math.cos(player.heading), sinH: Math.sin(player.heading) };
}

function drawSeg(a, b, group) {
  const clipped = clipNear(a, b);
  if (!clipped) return;
  const [ca, cb] = clipped;
  const dist = (ca.z + cb.z) / 2;
  if (dist > MAX_DIST || dist <= 0) return;
  let band = Math.floor((dist / MAX_DIST) * BANDS);
  if (band >= BANDS) band = BANDS - 1;
  if (band < 0) band = 0;
  const pa = toScreen(ca), pb = toScreen(cb);
  bandPaths[group][band].moveTo(pa.sx, pa.sy);
  bandPaths[group][band].lineTo(pb.sx, pb.sy);
}

let bandPaths = { grid: [], tree: [] };

function render() {
  ctx.fillStyle = "#0d0f14";
  ctx.fillRect(0, 0, W, H);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, CY);
  skyGrad.addColorStop(0, "#171b2b");
  skyGrad.addColorStop(1, "#0d0f14");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, CY);

  const cam = getCamera();

  bandPaths = { grid: [], tree: [] };
  for (let i = 0; i < BANDS; i++) {
    bandPaths.grid.push(new Path2D());
    bandPaths.tree.push(new Path2D());
  }

  const N = GRID_RANGE * 2 + 1;
  const baseGX = Math.floor(player.x / CELL), baseGZ = Math.floor(player.z / CELL);
  const proj = new Array(N);
  for (let rz = 0; rz < N; rz++) {
    proj[rz] = new Array(N);
    const wz = (baseGZ + rz - GRID_RANGE) * CELL;
    for (let rx = 0; rx < N; rx++) {
      const wx = (baseGX + rx - GRID_RANGE) * CELL;
      const wy = terrainHeight(wx, wz);
      proj[rz][rx] = project(wx, wy, wz, cam);
    }
  }
  for (let rz = 0; rz < N; rz++) {
    for (let rx = 0; rx < N - 1; rx++) drawSeg(proj[rz][rx], proj[rz][rx + 1], "grid");
  }
  for (let rx = 0; rx < N; rx++) {
    for (let rz = 0; rz < N - 1; rz++) drawSeg(proj[rz][rx], proj[rz + 1][rx], "grid");
  }

  const treesSorted = currentTrees
    .map((t) => ({ t, cam: project(t.x, t.y, t.z, cam) }))
    .filter((e) => e.cam.z > NEAR - 3 && e.cam.z < MAX_DIST + 5)
    .sort((a, b) => b.cam.z - a.cam.z);

  for (const e of treesSorted) {
    const segs = treeSegments(e.t);
    for (const [a, b] of segs) {
      drawSeg(project(a.x, a.y, a.z, cam), project(b.x, b.y, b.z, cam), "tree");
    }
  }

  const bob = Math.sin(bobPhase) * 0.09 + 0.09;
  const py = terrainHeight(player.x, player.z);
  const R = 0.55;
  const nub = sphereSegments(player.x, py + R + bob, player.z, R);
  for (const [a, b] of nub.segs) {
    const pa = project(a.x, a.y, a.z, cam), pb = project(b.x, b.y, b.z, cam);
    const clipped = clipNear(pa, pb);
    if (!clipped) continue;
    const [ca, cb] = clipped;
    const sa = toScreen(ca), sb = toScreen(cb);
    ctx.strokeStyle = CHAR_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sa.sx, sa.sy);
    ctx.lineTo(sb.sx, sb.sy);
    ctx.stroke();
  }
  const eyeCam = project(nub.eye.x, nub.eye.y, nub.eye.z, cam);
  if (eyeCam.z > NEAR) {
    const es = toScreen(eyeCam);
    ctx.fillStyle = CHAR_COLOR;
    ctx.beginPath();
    ctx.arc(es.sx, es.sy, Math.max(2, (FOCAL / eyeCam.z) * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = 1;
  for (let i = 0; i < BANDS; i++) {
    ctx.strokeStyle = gridBandColor[i];
    ctx.stroke(bandPaths.grid[i]);
    ctx.strokeStyle = treeBandColor[i];
    ctx.stroke(bandPaths.tree[i]);
  }
}

let lastTime = null;
function loop(now) {
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05);
  if (started) update(dt);
  else currentTrees = getNearbyTrees(player.x, player.z);
  render();
  requestAnimationFrame(loop);
}

const KEY_MAP = {
  ArrowUp: "forward", KeyW: "forward",
  ArrowDown: "backward", KeyS: "backward",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

window.addEventListener("keydown", (e) => {
  const dir = KEY_MAP[e.code];
  if (dir) {
    keys[dir] = true;
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  const dir = KEY_MAP[e.code];
  if (dir) keys[dir] = false;
});

document.querySelectorAll(".dpad-btn").forEach((btn) => {
  const dir = btn.dataset.dir;
  const on = (e) => {
    e.preventDefault();
    keys[dir] = true;
  };
  const off = () => {
    keys[dir] = false;
  };
  btn.addEventListener("pointerdown", on);
  ["pointerup", "pointercancel", "pointerleave"].forEach((evt) => btn.addEventListener(evt, off));
});

startBtn.addEventListener("click", () => {
  started = true;
  overlay.classList.add("hidden");
});

newWorldBtn.addEventListener("click", () => {
  resetWorld(Math.floor(Math.random() * 1e9));
});

resetWorld(Math.floor(Math.random() * 1e9));
requestAnimationFrame(loop);
