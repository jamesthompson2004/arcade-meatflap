const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const baconEl = document.getElementById("bacon");
const pantsScaredEl = document.getElementById("pants-scared");
const bestBaconEl = document.getElementById("best-bacon");
const bestPantsEl = document.getElementById("best-pants");
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
const BACON_TOUCH_RADIUS = 1.0;

const BUILDING_CELL = 46;
const BUILDING_RANGE = Math.ceil((MAX_DIST + 25) / BUILDING_CELL) + 1;
const BUILDING_DENSITY = 0.28;
const DOOR_WIDTH = 1.8;
const MIN_ROOM_SIZE = 3.2;
const WALL_HEIGHT = 3;

const PANTS_CELL = 13;
const PANTS_RANGE = Math.ceil(MAX_DIST / PANTS_CELL) + 1;
const PANTS_DENSITY = 0.09;
const PANTS_NOTICE_RADIUS = 7;
const PANTS_CALM_RADIUS = PANTS_NOTICE_RADIUS * 2.2;
const PANTS_FLEE_SPEED = 6.5;
const PANTS_WAIST_HALF = 0.42;
const PANTS_DEPTH_HALF = 0.22;
const PANTS_LEG_TOP_HALF = PANTS_WAIST_HALF * 0.5;
const PANTS_LEG_LEN = 0.78;
const PANTS_ANKLE_HALF = PANTS_LEG_TOP_HALF * 0.8;
const PANTS_ANKLE_DEPTH_HALF = 0.15;

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
const SQUISH_AMOUNT = 0.16;

const BEST_BACON_KEY = "meatflap-wander-best-bacon";
const BEST_PANTS_KEY = "meatflap-wander-best-pants";
const BG_COLOR = [13, 15, 20];
const GRID_NEAR = [90, 170, 210];
const TREE_NEAR = [77, 255, 159];
const BUILDING_NEAR = [255, 195, 110];
const BACON_NEAR = [255, 140, 105];
const PANTS_NEAR = [60, 140, 255];
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
let baconBandColor = [];
let pantsBandColor = [];
for (let i = 0; i < BANDS; i++) {
  const t = i / (BANDS - 1);
  const alpha = 1 - t;
  gridBandColor.push(bandRgba(GRID_NEAR, t, alpha));
  treeBandColor.push(bandRgba(TREE_NEAR, t, alpha));
  baconBandColor.push(bandRgba(BACON_NEAR, t, alpha));
  pantsBandColor.push(bandRgba(PANTS_NEAR, t, alpha));
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

function pointToSegmentDist(px, pz, seg) {
  const dx = seg.bx - seg.ax, dz = seg.bz - seg.az;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 0 ? ((px - seg.ax) * dx + (pz - seg.az) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx2 = seg.ax + dx * t, cz2 = seg.az + dz * t;
  return Math.hypot(px - cx2, pz - cz2);
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

function buildBuilding(ix, iz) {
  if (hash2(ix, iz, SEED + 55555) >= BUILDING_DENSITY) return null;

  const rng = makeRng(ix, iz, SEED);
  const jx = rng(), jz = rng();
  const cx = (ix + 0.5 + (jx - 0.5) * 0.4) * BUILDING_CELL;
  const cz = (iz + 0.5 + (jz - 0.5) * 0.4) * BUILDING_CELL;

  const width = 8 + rng() * 10;
  const depth = 8 + rng() * 10;
  const roomsWanted = 1 + Math.floor(rng() * 2);

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
  const doorSide = Math.floor(rng() * 4);
  sides.forEach((s, i) => {
    const [a, b, len] = s;
    const gap = i === doorSide ? { center: 0.5, half: (DOOR_WIDTH / 2) / len } : null;
    addWallSeg(walls, a.x, a.z, b.x, b.z, gap);
  });

  const partitions = buildFloorplan(width, depth, roomsWanted, rng);
  for (const p of partitions) {
    addWallSeg(walls, cx + p.ax, cz + p.az, cx + p.bx, cz + p.bz, p.gap);
  }

  const bacon = [];
  const baconCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < baconCount; i++) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const lx = (rng() - 0.5) * (width - 2.4);
      const lz = (rng() - 0.5) * (depth - 2.4);
      const wx = cx + lx, wz = cz + lz;
      if (walls.every((w) => pointToSegmentDist(wx, wz, w) > 0.9)) {
        bacon.push({ x: wx, z: wz, y: padHeight, rot: rng() * Math.PI * 2, key: ix + "_" + iz + "_b" + i });
        break;
      }
    }
  }

  return { cx, cz, width, depth, padHeight, footRadius, padRadius, walls, bacon, key: ix + "_" + iz };
}

function getNearbyBuildings(px, pz) {
  const list = [];
  const cix = Math.floor(px / BUILDING_CELL), ciz = Math.floor(pz / BUILDING_CELL);
  for (let dz = -BUILDING_RANGE; dz <= BUILDING_RANGE; dz++) {
    for (let dx = -BUILDING_RANGE; dx <= BUILDING_RANGE; dx++) {
      const b = buildBuilding(cix + dx, ciz + dz);
      if (b && Math.hypot(b.cx - px, b.cz - pz) < MAX_DIST + b.padRadius) list.push(b);
    }
  }
  return list;
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

function baconSegments(item) {
  const half = 0.4;
  const y = item.y + 0.05;
  const cosR = Math.cos(item.rot), sinR = Math.sin(item.rot);
  const rot = (lx, lz) => ({
    x: item.x + lx * cosR - lz * sinR,
    y,
    z: item.z + lx * sinR + lz * cosR,
  });
  const M = 5;
  const topPts = [], botPts = [];
  for (let i = 0; i <= M; i++) {
    const t = i / M;
    const lx = (t - 0.5) * 2 * half;
    const wave = Math.sin(t * Math.PI * 2.6) * 0.09;
    topPts.push(rot(lx, 0.16 + wave));
    botPts.push(rot(lx, -0.16 + wave));
  }
  const segs = [];
  for (let i = 0; i < M; i++) {
    segs.push([topPts[i], topPts[i + 1]]);
    segs.push([botPts[i], botPts[i + 1]]);
  }
  segs.push([topPts[0], botPts[0]]);
  segs.push([topPts[M], botPts[M]]);
  for (let i = 1; i < M; i++) {
    segs.push([topPts[i], botPts[i]]);
  }
  return segs;
}

function getNearbyPantsBase(px, pz) {
  const list = [];
  const cix = Math.floor(px / PANTS_CELL), ciz = Math.floor(pz / PANTS_CELL);
  for (let dz = -PANTS_RANGE; dz <= PANTS_RANGE; dz++) {
    for (let dx = -PANTS_RANGE; dx <= PANTS_RANGE; dx++) {
      const ix = cix + dx, iz = ciz + dz;
      const r = hash2(ix, iz, SEED + 662211);
      if (r >= PANTS_DENSITY) continue;
      const jx = hash2(ix, iz, SEED + 662222);
      const jz = hash2(ix, iz, SEED + 662233);
      const bx = (ix + 0.5 + (jx - 0.5) * 0.7) * PANTS_CELL;
      const bz = (iz + 0.5 + (jz - 0.5) * 0.7) * PANTS_CELL;
      if (Math.hypot(bx - px, bz - pz) > MAX_DIST + PANTS_CELL) continue;
      list.push({ key: ix + "_" + iz, baseX: bx, baseZ: bz });
    }
  }
  return list;
}

const pantsState = new Map();

function getNearbyPants(px, pz) {
  const bases = getNearbyPantsBase(px, pz);
  const activeKeys = new Set();
  const result = [];
  for (const base of bases) {
    activeKeys.add(base.key);
    let st = pantsState.get(base.key);
    if (!st) {
      st = { x: base.baseX, z: base.baseZ, fleeing: false, fleeHeading: 0, legPhase: 0 };
      pantsState.set(base.key, st);
    }
    result.push({
      key: base.key,
      x: st.x,
      z: st.z,
      y: terrainHeight(st.x, st.z),
      heading: st.fleeHeading,
      legPhase: st.legPhase,
      fleeing: st.fleeing,
    });
  }
  for (const k of Array.from(pantsState.keys())) {
    if (!activeKeys.has(k)) pantsState.delete(k);
  }
  return result;
}

function updatePants(dt) {
  let scares = 0;
  for (const st of pantsState.values()) {
    const dist = Math.hypot(st.x - player.x, st.z - player.z);
    if (dist < PANTS_NOTICE_RADIUS) {
      if (!st.fleeing) scares++;
      st.fleeing = true;
      st.fleeHeading = Math.atan2(st.x - player.x, st.z - player.z);
    } else if (dist > PANTS_CALM_RADIUS) {
      st.fleeing = false;
    }
    if (st.fleeing) {
      const fx = Math.sin(st.fleeHeading), fz = Math.cos(st.fleeHeading);
      st.x += fx * PANTS_FLEE_SPEED * dt;
      st.z += fz * PANTS_FLEE_SPEED * dt;
      st.legPhase += dt * 16;
    }
  }
  return scares;
}

function pantsSegments(p) {
  const bounce = p.fleeing ? Math.abs(Math.sin(p.legPhase)) * 0.09 : 0;
  const waistY = p.y + PANTS_LEG_LEN + bounce;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const rx = Math.cos(p.heading), rz = -Math.sin(p.heading);
  const swing = p.fleeing ? Math.sin(p.legPhase) * 0.32 : 0;
  const pt = (right, fwd, y) => ({
    x: p.x + rx * right + fx * fwd,
    y,
    z: p.z + rz * right + fz * fwd,
  });

  const waistTLf = pt(-PANTS_WAIST_HALF, PANTS_DEPTH_HALF, waistY);
  const waistTRf = pt(PANTS_WAIST_HALF, PANTS_DEPTH_HALF, waistY);
  const waistTRb = pt(PANTS_WAIST_HALF, -PANTS_DEPTH_HALF, waistY);
  const waistTLb = pt(-PANTS_WAIST_HALF, -PANTS_DEPTH_HALF, waistY);

  const legTopLf = pt(-PANTS_LEG_TOP_HALF, PANTS_DEPTH_HALF, waistY);
  const legTopLb = pt(-PANTS_LEG_TOP_HALF, -PANTS_DEPTH_HALF, waistY);
  const legTopRf = pt(PANTS_LEG_TOP_HALF, PANTS_DEPTH_HALF, waistY);
  const legTopRb = pt(PANTS_LEG_TOP_HALF, -PANTS_DEPTH_HALF, waistY);

  const ankleLf = pt(-PANTS_ANKLE_HALF, PANTS_ANKLE_DEPTH_HALF + swing, p.y + bounce);
  const ankleLb = pt(-PANTS_ANKLE_HALF, -PANTS_ANKLE_DEPTH_HALF + swing, p.y + bounce);
  const ankleRf = pt(PANTS_ANKLE_HALF, PANTS_ANKLE_DEPTH_HALF - swing, p.y + bounce);
  const ankleRb = pt(PANTS_ANKLE_HALF, -PANTS_ANKLE_DEPTH_HALF - swing, p.y + bounce);

  return [
    [waistTLf, waistTRf], [waistTRf, waistTRb], [waistTRb, waistTLb], [waistTLb, waistTLf],
    [legTopLf, legTopLb],
    [legTopLf, ankleLf], [legTopLb, ankleLb], [ankleLf, ankleLb],
    [legTopRf, legTopRb],
    [legTopRf, ankleRf], [legTopRb, ankleRb], [ankleRf, ankleRb],
  ];
}

function sphereSegments(cx, topY, cz, R, vScale, hScale) {
  const segs = [];
  const N = 8;
  const centerY = topY - R * vScale;
  const ringFracs = [-0.55, 0, 0.55];
  const rings = ringFracs.map((f) => {
    const dyLocal = f * R;
    const rrLocal = Math.sqrt(Math.max(R * R - dyLocal * dyLocal, 0.0001));
    const y = centerY + dyLocal * vScale;
    const rr = rrLocal * hScale;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * rr, y, z: cz + Math.sin(a) * rr });
    }
    return pts;
  });
  rings.forEach((pts) => {
    for (let i = 0; i < N; i++) segs.push([pts[i], pts[(i + 1) % N]]);
  });
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < N; i++) segs.push([rings[r][i], rings[r + 1][i]]);
  }
  const top = { x: cx, y: topY, z: cz };
  const bottom = { x: cx, y: centerY - R * vScale, z: cz };
  for (let i = 0; i < N; i++) {
    segs.push([rings[rings.length - 1][i], top]);
    segs.push([rings[0][i], bottom]);
  }
  const eye = { x: cx, y: topY + R * 0.4, z: cz };
  segs.push([top, eye]);
  return { segs, eye };
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
let bestBacon = Number(localStorage.getItem(BEST_BACON_KEY) || 0);
let bestPantsScared = Number(localStorage.getItem(BEST_PANTS_KEY) || 0);
let baconCollected = 0;
let pantsScared = 0;
const collectedBacon = new Set();
let currentTrees = [];
let currentBacon = [];
let currentPants = [];
let started = false;
let squishPhase = 0;
const keys = { forward: false, backward: false, left: false, right: false };

function updateHud() {
  baconEl.textContent = baconCollected;
  pantsScaredEl.textContent = pantsScared;
  bestBaconEl.textContent = bestBacon;
  bestPantsEl.textContent = bestPantsScared;
}
updateHud();

function refreshCurrentBacon() {
  currentBacon = [];
  for (const b of currentBuildings) {
    for (const item of b.bacon) {
      if (!collectedBacon.has(item.key)) currentBacon.push(item);
    }
  }
}

function resetWorld(newSeed) {
  SEED = newSeed;
  player = { x: 0, z: 0, heading: 0 };
  baconCollected = 0;
  pantsScared = 0;
  collectedBacon.clear();
  pantsState.clear();
  squishPhase = 0;
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

  currentBuildings = getNearbyBuildings(player.x, player.z);
  currentTrees = getNearbyTrees(player.x, player.z);
  refreshCurrentBacon();
  const scares = updatePants(dt);
  currentPants = getNearbyPants(player.x, player.z);
  if (scares > 0) {
    pantsScared += scares;
    if (pantsScared > bestPantsScared) {
      bestPantsScared = pantsScared;
      localStorage.setItem(BEST_PANTS_KEY, String(bestPantsScared));
    }
  }

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
    squishPhase += Math.abs(moveAmt) * 1.6;
  }

  for (const item of currentBacon) {
    if (Math.hypot(item.x - player.x, item.z - player.z) < BACON_TOUCH_RADIUS) {
      collectedBacon.add(item.key);
      baconCollected++;
      if (baconCollected > bestBacon) {
        bestBacon = baconCollected;
        localStorage.setItem(BEST_BACON_KEY, String(bestBacon));
      }
    }
  }
  currentBacon = currentBacon.filter((item) => !collectedBacon.has(item.key));

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

let bandPaths = { grid: [], tree: [], bacon: [], pants: [] };

function drawBuildings(cam) {
  const items = [];
  for (const b of currentBuildings) {
    for (const seg of b.walls) {
      const midx = (seg.ax + seg.bx) / 2, midz = (seg.az + seg.bz) / 2;
      const c = project(midx, b.padHeight + WALL_HEIGHT / 2, midz, cam);
      if (c.z < NEAR - 3 || c.z > MAX_DIST + 15) continue;
      items.push({ dist: c.z, seg, padHeight: b.padHeight });
    }
  }
  items.sort((a, b) => b.dist - a.dist);
  for (const it of items) {
    const a = project(it.seg.ax, it.padHeight, it.seg.az, cam);
    const b = project(it.seg.bx, it.padHeight, it.seg.bz, cam);
    const c = project(it.seg.bx, it.padHeight + WALL_HEIGHT, it.seg.bz, cam);
    const d = project(it.seg.ax, it.padHeight + WALL_HEIGHT, it.seg.az, cam);
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

  bandPaths = { grid: [], tree: [], bacon: [], pants: [] };
  for (let i = 0; i < BANDS; i++) {
    bandPaths.grid.push(new Path2D());
    bandPaths.tree.push(new Path2D());
    bandPaths.bacon.push(new Path2D());
    bandPaths.pants.push(new Path2D());
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

  const baconSorted = currentBacon
    .map((it) => ({ it, cam: project(it.x, it.y, it.z, cam) }))
    .filter((e) => e.cam.z > NEAR - 3 && e.cam.z < MAX_DIST + 5)
    .sort((a, b) => b.cam.z - a.cam.z);
  for (const e of baconSorted) {
    const segs = baconSegments(e.it);
    for (const [a, b] of segs) {
      drawSeg(project(a.x, a.y, a.z, cam), project(b.x, b.y, b.z, cam), "bacon");
    }
  }

  const pantsSorted = currentPants
    .map((p) => ({ p, cam: project(p.x, p.y + 0.25, p.z, cam) }))
    .filter((e) => e.cam.z > NEAR - 3 && e.cam.z < MAX_DIST + 5)
    .sort((a, b) => b.cam.z - a.cam.z);
  for (const e of pantsSorted) {
    const segs = pantsSegments(e.p);
    for (const [a, b] of segs) {
      drawSeg(project(a.x, a.y, a.z, cam), project(b.x, b.y, b.z, cam), "pants");
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
    ctx.shadowColor = baconBandColor[i];
    ctx.strokeStyle = baconBandColor[i];
    ctx.stroke(bandPaths.bacon[i]);
    ctx.shadowColor = pantsBandColor[i];
    ctx.strokeStyle = pantsBandColor[i];
    ctx.stroke(bandPaths.pants[i]);
  }
  ctx.shadowBlur = 0;

  drawBuildings(cam);

  const R = 0.55;
  const py = terrainHeight(player.x, player.z);
  const topY = py + 2 * R;
  const squish = Math.sin(squishPhase) * SQUISH_AMOUNT;
  const vScale = 1 + squish;
  const hScale = 1 - squish;
  const nub = sphereSegments(player.x, topY, player.z, R, vScale, hScale);
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
    currentBuildings = getNearbyBuildings(player.x, player.z);
    currentTrees = getNearbyTrees(player.x, player.z);
    refreshCurrentBacon();
    currentPants = getNearbyPants(player.x, player.z);
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
