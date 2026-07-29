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
const GLOW_BLUR = 5.5;

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

const CELL = 2;
const GRID_RANGE = Math.ceil(MAX_DIST / CELL);
const GRID_N = GRID_RANGE * 2 + 1;
const HEIGHT_SCALE = 15;

const TREE_CELL = 9;
const TREE_RANGE = Math.ceil(MAX_DIST / TREE_CELL) + 1;
const TREE_DENSITY = 0.16;
const TREE_RADIUS = 0.55;
const DISCOVER_RADIUS = 5;

const BUILDING_CELL = 46;
const BUILDING_RANGE = Math.ceil((MAX_DIST + 25) / BUILDING_CELL) + 1;
const BUILDING_DENSITY = 0.28;
const DOOR_WIDTH = 1.8;
const MIN_ROOM_SIZE = 3.2;
const GIANT_MILESTONE = 1000;

const CHASE_DIST = 9;
const CHASE_HEIGHT = 2.8;
const PITCH_DEG = 9;
const PITCH_RAD = (PITCH_DEG * Math.PI) / 180;
const PITCH_COS = Math.cos(PITCH_RAD);
const PITCH_SIN = Math.sin(PITCH_RAD);
const PITCH_TAN = Math.tan(PITCH_RAD);
const MOVE_SPEED = 9;
const MOVE_SPEED_BACK = 5.5;
const TURN_SPEED = 2.3;
const CHAR_RADIUS = 0.55;

const BEST_KEY = "meatflap-wander-best";
const BG_COLOR = [13, 15, 20];
const GRID_NEAR = [90, 170, 210];
const TREE_NEAR = [77, 255, 159];
const BUILDING_NEAR = [255, 195, 110];
const CHAR_COLOR = "#ff4d8d";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function bandRgba(near, t, alpha) {
  const r = lerp(near[0], BG_COLOR[0], t);
  const g = lerp(near[1], BG_COLOR[1], t);
  const b = lerp(near[2], BG_COLOR[2], t);
  return `rgba(${r | 0},${g | 0},${b | 0},${alpha.toFixed(3)})`;
}

let gridBandColor = [];
let treeBandColor = [];
for (let i = 0; i < BANDS; i++) {
  const t = i / (BANDS - 1);
  const alpha = 1 - t;
  gridBandColor.push(bandRgba(GRID_NEAR, t, alpha));
  treeBandColor.push(bandRgba(TREE_NEAR, t, alpha));
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

function terrainHeightRaw(x, z) {
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

let currentBuildings = [];

function terrainHeight(x, z) {
  let h = terrainHeightRaw(x, z);
  for (const b of currentBuildings) {
    const dist = Math.hypot(x - b.cx, z - b.cz);
    if (dist < b.footRadius) {
      h = b.padHeight;
    } else if (dist < b.padRadius) {
      const t = smooth(1 - (dist - b.footRadius) / (b.padRadius - b.footRadius));
      h = lerp(h, b.padHeight, t);
    }
  }
  return h;
}

const gridHeightCache = new Float64Array(GRID_N * GRID_N);
let gridCacheGX = null, gridCacheGZ = null, gridCacheSig = "";

function ensureGridHeights(baseGX, baseGZ) {
  const sig = currentBuildings.map((b) => b.key).join("|");
  if (gridCacheGX === baseGX && gridCacheGZ === baseGZ && gridCacheSig === sig) return;
  gridCacheGX = baseGX;
  gridCacheGZ = baseGZ;
  gridCacheSig = sig;
  for (let rz = 0; rz < GRID_N; rz++) {
    const wz = (baseGZ + rz - GRID_RANGE) * CELL;
    for (let rx = 0; rx < GRID_N; rx++) {
      const wx = (baseGX + rx - GRID_RANGE) * CELL;
      gridHeightCache[rz * GRID_N + rx] = terrainHeight(wx, wz);
    }
  }
}

function addWallSeg(list, ax, az, bx, bz, gap) {
  if (!gap) {
    list.push({ ax, az, bx, bz });
    return;
  }
  const g0 = Math.max(0, gap.center - gap.half);
  const g1 = Math.min(1, gap.center + gap.half);
  if (g0 > 0.02) list.push({ ax, az, bx: lerp(ax, bx, g0), bz: lerp(az, bz, g0) });
  if (g1 < 0.98) list.push({ ax: lerp(ax, bx, g1), az: lerp(az, bz, g1), bx, bz });
}

function makeRng(ix, iz, seedBase) {
  let n = 0;
  return () => hash2(ix, iz, seedBase + (n++) * 97 + 13);
}

function buildFloorplan(width, depth, roomsWanted, rng) {
  const hw = width / 2, hd = depth / 2;
  const rooms = [{ x0: -hw, z0: -hd, x1: hw, z1: hd }];
  const partitions = [];
  while (rooms.length < roomsWanted) {
    let idx = 0, bestArea = -1;
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const area = (r.x1 - r.x0) * (r.z1 - r.z0);
      if (area > bestArea) { bestArea = area; idx = i; }
    }
    const r = rooms[idx];
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const canSplitX = w >= MIN_ROOM_SIZE * 2 + 0.5;
    const canSplitZ = d >= MIN_ROOM_SIZE * 2 + 0.5;
    if (!canSplitX && !canSplitZ) break;
    const splitOnX = canSplitX && (!canSplitZ || w >= d);
    const frac = 0.4 + rng() * 0.2;
    const gapCenter = 0.3 + rng() * 0.4;
    if (splitOnX) {
      const px = r.x0 + w * frac;
      const gapHalf = Math.min(0.45, (DOOR_WIDTH / 2) / d);
      partitions.push({ ax: px, az: r.z0, bx: px, bz: r.z1, gap: { center: gapCenter, half: gapHalf } });
      rooms.splice(idx, 1, { x0: r.x0, z0: r.z0, x1: px, z1: r.z1 }, { x0: px, z0: r.z0, x1: r.x1, z1: r.z1 });
    } else {
      const pz = r.z0 + d * frac;
      const gapHalf = Math.min(0.45, (DOOR_WIDTH / 2) / w);
      partitions.push({ ax: r.x0, az: pz, bx: r.x1, bz: pz, gap: { center: gapCenter, half: gapHalf } });
      rooms.splice(idx, 1, { x0: r.x0, z0: r.z0, x1: r.x1, z1: pz }, { x0: r.x0, z0: pz, x1: r.x1, z1: r.z1 });
    }
  }
  return partitions;
}

function buildBuilding(ix, iz, opts) {
  opts = opts || {};
  const giant = !!opts.giant;
  if (!giant && hash2(ix, iz, SEED + 55555) >= BUILDING_DENSITY) return null;

  const rng = makeRng(ix, iz, SEED + (giant ? 999000 : 0));
  const jx = rng(), jz = rng();
  const cx = opts.cx !== undefined ? opts.cx : (ix + 0.5 + (jx - 0.5) * 0.4) * BUILDING_CELL;
  const cz = opts.cz !== undefined ? opts.cz : (iz + 0.5 + (jz - 0.5) * 0.4) * BUILDING_CELL;

  const width = giant ? 34 + rng() * 12 : 8 + rng() * 10;
  const depth = giant ? 30 + rng() * 12 : 8 + rng() * 10;
  const roomsWanted = giant ? 9 + Math.floor(rng() * 5) : 1 + Math.floor(rng() * 4);
  const wallHeight = giant ? 6.5 : 3;
  const doorCount = giant ? 2 : 1;

  const padHeight = terrainHeightRaw(cx, cz);
  const footRadius = Math.hypot(width, depth) / 2 + 1.6;
  const padRadius = footRadius + 10;

  const hw = width / 2, hd = depth / 2;
  const NW = { x: cx - hw, z: cz - hd };
  const NE = { x: cx + hw, z: cz - hd };
  const SE = { x: cx + hw, z: cz + hd };
  const SW = { x: cx - hw, z: cz + hd };

  const walls = [];
  const sides = [
    [NW, NE, width],
    [SE, SW, width],
    [NE, SE, depth],
    [SW, NW, depth],
  ];
  const doorSides = new Set();
  while (doorSides.size < doorCount) doorSides.add(Math.floor(rng() * 4));
  sides.forEach((s, i) => {
    const [a, b, len] = s;
    const gap = doorSides.has(i) ? { center: 0.5, half: (DOOR_WIDTH / 2) / len } : null;
    addWallSeg(walls, a.x, a.z, b.x, b.z, gap);
  });

  const partitions = buildFloorplan(width, depth, roomsWanted, rng);
  for (const p of partitions) {
    addWallSeg(walls, cx + p.ax, cz + p.az, cx + p.bx, cz + p.bz, p.gap);
  }

  return { cx, cz, width, depth, padHeight, footRadius, padRadius, walls, wallHeight, giant, key: giant ? "giant" : ix + "_" + iz };
}

function getNearbyBuildings(px, pz) {
  const list = [];
  const cix = Math.floor(px / BUILDING_CELL), ciz = Math.floor(pz / BUILDING_CELL);
  for (let dz = -BUILDING_RANGE; dz <= BUILDING_RANGE; dz++) {
    for (let dx = -BUILDING_RANGE; dx <= BUILDING_RANGE; dx++) {
      const b = buildBuilding(cix + dx, ciz + dz);
      if (!b) continue;
      if (giantBuilding && Math.hypot(b.cx - giantBuilding.cx, b.cz - giantBuilding.cz) < giantBuilding.padRadius + b.padRadius) continue;
      if (Math.hypot(b.cx - px, b.cz - pz) < MAX_DIST + b.padRadius) list.push(b);
    }
  }
  return list;
}

function refreshNearbyBuildings() {
  currentBuildings = getNearbyBuildings(player.x, player.z);
  if (giantBuilding && Math.hypot(giantBuilding.cx - player.x, giantBuilding.cz - player.z) < MAX_DIST + giantBuilding.padRadius) {
    currentBuildings.push(giantBuilding);
  }
}

function maybeSpawnGiant() {
  if (giantSpawned || distanceWalked < GIANT_MILESTONE) return;
  giantSpawned = true;
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  const aheadDist = 150 + hash2(1, 1, SEED + 424242) * 40;
  const gx = player.x + fx * aheadDist;
  const gz = player.z + fz * aheadDist;
  giantBuilding = buildBuilding(0, 0, { giant: true, cx: gx, cz: gz });
  showToast("Something massive looms on the horizon...");
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
      if (currentBuildings.some((b) => Math.hypot(tx - b.cx, tz - b.cz) < b.footRadius + 3)) continue;
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
  const rzYaw = dx * cam.sinH + dz * cam.cosH;
  const ryYaw = y - cam.y;
  const ry = ryYaw * cam.cosP + rzYaw * cam.sinP;
  const rz = rzYaw * cam.cosP - ryYaw * cam.sinP;
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
let giantBuilding = null;
let giantSpawned = false;
const keys = { forward: false, backward: false, left: false, right: false };

bestEl.textContent = Math.floor(best);

const toastEl = document.getElementById("toast");
let toastTimer = null;
function showToast(text, duration) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration || 4500);
}

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
  giantBuilding = null;
  giantSpawned = false;
  updateHud();
}

function resolveWallCollision(nx, nz, seg, minDist) {
  const dx = seg.bx - seg.ax, dz = seg.bz - seg.az;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 0 ? ((nx - seg.ax) * dx + (nz - seg.az) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const px = seg.ax + dx * t, pz = seg.az + dz * t;
  const ddx = nx - px, ddz = nz - pz;
  const dist = Math.hypot(ddx, ddz);
  if (dist > 0.0001 && dist < minDist) {
    const push = minDist - dist;
    nx += (ddx / dist) * push;
    nz += (ddz / dist) * push;
  }
  return [nx, nz];
}

function update(dt) {
  if (keys.left) player.heading -= TURN_SPEED * dt;
  if (keys.right) player.heading += TURN_SPEED * dt;

  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  let moveAmt = 0;
  if (keys.forward) moveAmt += MOVE_SPEED * dt;
  if (keys.backward) moveAmt -= MOVE_SPEED_BACK * dt;

  refreshNearbyBuildings();
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
    for (const b of currentBuildings) {
      if (Math.hypot(nx - b.cx, nz - b.cz) > b.footRadius + 4) continue;
      for (const seg of b.walls) {
        [nx, nz] = resolveWallCollision(nx, nz, seg, CHAR_RADIUS + 0.12);
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

  maybeSpawnGiant();
  updateHud();
}

function getCamera() {
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  const camX = player.x - fx * CHASE_DIST;
  const camZ = player.z - fz * CHASE_DIST;
  const camY = terrainHeight(player.x, player.z) + CHASE_HEIGHT;
  return {
    x: camX, y: camY, z: camZ,
    cosH: Math.cos(player.heading), sinH: Math.sin(player.heading),
    cosP: PITCH_COS, sinP: PITCH_SIN,
  };
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

function drawBuildings(cam) {
  const items = [];
  for (const b of currentBuildings) {
    for (const seg of b.walls) {
      const midx = (seg.ax + seg.bx) / 2, midz = (seg.az + seg.bz) / 2;
      const c = project(midx, b.padHeight + b.wallHeight / 2, midz, cam);
      if (c.z < NEAR - 3 || c.z > MAX_DIST + 15) continue;
      items.push({ dist: c.z, seg, padHeight: b.padHeight, wallHeight: b.wallHeight });
    }
  }
  items.sort((a, b) => b.dist - a.dist);
  for (const it of items) {
    const a = project(it.seg.ax, it.padHeight, it.seg.az, cam);
    const b = project(it.seg.bx, it.padHeight, it.seg.bz, cam);
    const c = project(it.seg.bx, it.padHeight + it.wallHeight, it.seg.bz, cam);
    const d = project(it.seg.ax, it.padHeight + it.wallHeight, it.seg.az, cam);
    if (a.z <= NEAR || b.z <= NEAR || c.z <= NEAR || d.z <= NEAR) continue;
    const sa = toScreen(a), sb = toScreen(b), sc = toScreen(c), sd = toScreen(d);
    const t = Math.min(1, Math.max(0, it.dist / MAX_DIST));
    const fillA = lerp(0.92, 0, t);
    const edgeA = lerp(1, 0, t);
    ctx.beginPath();
    ctx.moveTo(sa.sx, sa.sy);
    ctx.lineTo(sb.sx, sb.sy);
    ctx.lineTo(sc.sx, sc.sy);
    ctx.lineTo(sd.sx, sd.sy);
    ctx.closePath();
    ctx.fillStyle = `rgba(16,20,28,${fillA.toFixed(3)})`;
    ctx.fill();
    const edgeColor = `rgba(${BUILDING_NEAR[0]},${BUILDING_NEAR[1]},${BUILDING_NEAR[2]},${edgeA.toFixed(3)})`;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.shadowColor = edgeColor;
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function render() {
  const cam = getCamera();
  const horizonY = Math.max(0, Math.min(H, CY - PITCH_TAN * FOCAL));

  ctx.fillStyle = "#0d0f14";
  ctx.fillRect(0, 0, W, H);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
  skyGrad.addColorStop(0, "#171b2b");
  skyGrad.addColorStop(1, "#0d0f14");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, horizonY);

  bandPaths = { grid: [], tree: [] };
  for (let i = 0; i < BANDS; i++) {
    bandPaths.grid.push(new Path2D());
    bandPaths.tree.push(new Path2D());
  }

  const N = GRID_N;
  const baseGX = Math.floor(player.x / CELL), baseGZ = Math.floor(player.z / CELL);
  ensureGridHeights(baseGX, baseGZ);
  const proj = new Array(N);
  for (let rz = 0; rz < N; rz++) {
    proj[rz] = new Array(N);
    const wz = (baseGZ + rz - GRID_RANGE) * CELL;
    for (let rx = 0; rx < N; rx++) {
      const wx = (baseGX + rx - GRID_RANGE) * CELL;
      const wy = gridHeightCache[rz * GRID_N + rx];
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

  ctx.lineWidth = 1;
  ctx.shadowBlur = GLOW_BLUR;
  for (let i = 0; i < BANDS; i++) {
    ctx.shadowColor = gridBandColor[i];
    ctx.strokeStyle = gridBandColor[i];
    ctx.stroke(bandPaths.grid[i]);
    ctx.shadowColor = treeBandColor[i];
    ctx.strokeStyle = treeBandColor[i];
    ctx.stroke(bandPaths.tree[i]);
  }
  ctx.shadowBlur = 0;

  drawBuildings(cam);

  const bob = Math.sin(bobPhase) * 0.09 + 0.09;
  const py = terrainHeight(player.x, player.z);
  const R = 0.55;
  const nub = sphereSegments(player.x, py + R + bob, player.z, R);
  ctx.strokeStyle = CHAR_COLOR;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = GLOW_BLUR + 1;
  ctx.shadowColor = CHAR_COLOR;
  for (const [a, b] of nub.segs) {
    const pa = project(a.x, a.y, a.z, cam), pb = project(b.x, b.y, b.z, cam);
    const clipped = clipNear(pa, pb);
    if (!clipped) continue;
    const [ca, cb] = clipped;
    const sa = toScreen(ca), sb = toScreen(cb);
    ctx.beginPath();
    ctx.moveTo(sa.sx, sa.sy);
    ctx.lineTo(sb.sx, sb.sy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  const eyeCam = project(nub.eye.x, nub.eye.y, nub.eye.z, cam);
  if (eyeCam.z > NEAR) {
    const es = toScreen(eyeCam);
    ctx.fillStyle = CHAR_COLOR;
    ctx.beginPath();
    ctx.arc(es.sx, es.sy, Math.max(2, (FOCAL / eyeCam.z) * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
}

let lastTime = null;
function loop(now) {
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05);
  if (started) {
    update(dt);
  } else {
    refreshNearbyBuildings();
    currentTrees = getNearbyTrees(player.x, player.z);
  }
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
