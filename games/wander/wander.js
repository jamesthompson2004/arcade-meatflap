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
const BACON_GLOW_BLUR = 11;

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
const TREE_WOBBLE_K = 90;
const TREE_WOBBLE_C = 9;
const TREE_WOBBLE_KICK = 4;
const TREE_WOBBLE_MAX_VEL = 6;
const TREE_WOBBLE_MAX_OFFSET = 0.6;

const ROCK_CELL = 9;
const ROCK_RANGE = Math.ceil(MAX_DIST / ROCK_CELL) + 1;
const ROCK_DENSITY = 0.16;
const ROCK_RADIUS = 0.6;
const ROCK_NEAR = [150, 150, 165];

const LAKE_CELL = 80;
const LAKE_RANGE = Math.ceil((MAX_DIST + 20) / LAKE_CELL) + 1;
const LAKE_DENSITY = 0.14;
const LAKE_RADIUS_MIN = 6;
const LAKE_RADIUS_MAX = 13;
const LAKE_FLATNESS_MAX = 1.3;
const LAKE_BASIN_DEPTH = 0.6;
const LAKE_SHORE_BLEND = 5;
const RIVER_CHANCE = 0.6;
const RIVER_STEP = 4;
const RIVER_MAX_STEPS = 36;
const RIVER_SAMPLE_DIRS = 9;
const RIVER_FORWARD_ARC_DEG = 140;
const RIVER_FLAT_STOP_STREAK = 6;
const RIVER_HALF_WIDTH = 0.9;
const RIVER_FLOW_SPEED = 3.2;
const RIVER_FLOW_MARK_SPACING = 3.2;
const RIVER_FLOW_MARK_LEN = 0.9;
const WATER_NEAR = [70, 195, 235];
const WATER_FLOW_COLOR = "#eaffff";

const BIRD_FLOCK_CELL = 15;
const BIRD_FLOCK_RANGE = Math.ceil(MAX_DIST / BIRD_FLOCK_CELL) + 1;
const BIRD_FLOCK_DENSITY = 0.06;
const BIRD_FLOCK_MIN_COUNT = 1;
const BIRD_FLOCK_MAX_COUNT = 12;
const BIRD_NOTICE_RADIUS = 6;
const BIRD_NOTICE_PANTS_FLEEING_MULT = 1.5;
const BIRD_FLEE_SPEED = 11;
const BIRD_FLEE_DURATION = 2.5;
const BIRD_RAMP_DURATION = 0.25;
const BIRD_TURN_SPEED = 12;
const BIRD_TURN_RAMP_DURATION = 0.2;
const BIRD_FLEE_ARC_DEG = 120;
const BIRD_RISE_HEIGHT = 6;
const BIRD_RISE_DURATION = 1.2;
const BIRD_TAKEOFF_DURATION = 0.35;
const BIRD_BUBBLE_DURATION = 1.6;
const BIRD_WING_SPAN = 0.9;
const BIRD_NEAR = [225, 228, 235];
const BIRD_NOISES = [
  "Squawk!", "Caw!", "Scatter!", "Flap flap flap!",
  "Tweet tweet!", "Yikes, feathers!", "Shoo!", "Get away!",
];

const LEMUR_CELL = 17;
const LEMUR_RANGE = Math.ceil(MAX_DIST / LEMUR_CELL) + 1;
const LEMUR_DENSITY = 0.05;
const LEMUR_RADIUS = 0.45;
const LEMUR_SPEED = 3;
const LEMUR_WALK_MIN = 1.5;
const LEMUR_WALK_MAX = 4;
const LEMUR_PAUSE_MIN = 0.6;
const LEMUR_PAUSE_MAX = 1.8;
const LEMUR_BODY_LEN = 0.7;
const LEMUR_BODY_HEIGHT = 0.35;
const LEMUR_BODY_WIDTH = 0.3;
const LEMUR_TAIL_LEN = 0.9;
const LEMUR_NEAR = [225, 175, 110];
const BACON_TOUCH_RADIUS = 1.0;
const BACON_BOSS_TOUCH_RADIUS = 2.4;
const BACON_HEIGHT = 1.2;
const BACON_POPUP_DURATION = 1.1;
const BACON_POPUP_RISE = 1.1;
const BACON_DESPAWN_BOUNCE_DURATION = 0.26;
const BACON_DESPAWN_BOUNCE_HEIGHT = 0.85;
const BACON_DESPAWN_POP_DURATION = 0.3;
const BACON_DESPAWN_TOTAL_DURATION = BACON_DESPAWN_BOUNCE_DURATION + BACON_DESPAWN_POP_DURATION;
const BACON_DESPAWN_PARTICLE_COUNT = 9;
const BACON_DESPAWN_PARTICLE_DIST = 0.9;
const BOSS_BACON_CHANCE = 0.1;
const BOSS_BACON_SCALE = 10;
const BACON_SIZE_WEIGHTS = [
  { size: 1, weight: 32 },
  { size: 2, weight: 27 },
  { size: 3, weight: 20 },
  { size: 4, weight: 13 },
  { size: 5, weight: 8 },
];

function baconClearance(scale) {
  return 0.9 + 0.15 * (scale - 1);
}

function pickBaconSize(rng) {
  const total = BACON_SIZE_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = rng() * total;
  for (const w of BACON_SIZE_WEIGHTS) {
    if (r < w.weight) return w.size;
    r -= w.weight;
  }
  return BACON_SIZE_WEIGHTS[BACON_SIZE_WEIGHTS.length - 1].size;
}

const BACON_MILL_SPEED = 0.6;
const BACON_MILL_WALK_MIN = 0.5;
const BACON_MILL_WALK_MAX = 1.4;
const BACON_MILL_PAUSE_MIN = 1.2;
const BACON_MILL_PAUSE_MAX = 3.2;
const BACON_MILL_BOUNCE_FREQ = 5;
const BACON_MILL_BOUNCE_HEIGHT = 0.14;
const BACON_MILL_SQUISH_AMOUNT = 0.32;

const BUILDING_CELL = 46;
const BUILDING_RANGE = Math.ceil((MAX_DIST + 25) / BUILDING_CELL) + 1;
const BUILDING_DENSITY = 0.28;
const DOOR_WIDTH = 1.8;
const MIN_ROOM_SIZE = 3.2;
const WALL_HEIGHT = 3;

const PANTS_CELL = 13;
const PANTS_RANGE = Math.ceil(MAX_DIST / PANTS_CELL) + 1;
const PANTS_DENSITY = 0.09;
const PANTS_ROOM_CHANCE = 0.15;
const PANTS_WALK_SPEED = 2.2;
const PANTS_WALK_MIN = 1.2;
const PANTS_WALK_MAX = 3.2;
const PANTS_PAUSE_MIN = 0.8;
const PANTS_PAUSE_MAX = 2.2;
const PANTS_NOTICE_RADIUS = 7;
const PANTS_FLEE_SPEED = 9.5;
const PANTS_FLEE_DURATION = 3;
const PANTS_RAMP_DURATION = 0.35;
const PANTS_TURN_SPEED = 10;
const PANTS_TURN_RAMP_DURATION = 0.3;
const PANTS_FLEE_ARC_DEG = 120;
const PANTS_BUBBLE_DURATION = 2;
const PANTS_RADIUS = 0.4;
const PANTS_WAIST_HALF = 0.58;
const PANTS_DEPTH_HALF = 0.3;
const PANTS_BELT_HEIGHT = 0.16;
const PANTS_LEG_TOP_HALF = PANTS_WAIST_HALF * 0.52;
const PANTS_LEG_LEN = 1.05;
const PANTS_ANKLE_HALF = PANTS_LEG_TOP_HALF * 0.82;
const PANTS_ANKLE_DEPTH_HALF = 0.2;
const PANTS_PHRASES = [
  "Hee hee!", "Eek!", "Nope nope nope!", "Whee!", "Yikes!",
  "Can't catch me!", "Squeak!", "Not today!", "Byeee!", "Tag, you're it!",
];

const PANTS_APPRECIATION_WITNESS_RADIUS = 9;
const PANTS_APPRECIATION_COOLDOWN = 10;
const PANTS_APPRECIATION_CAP = 16;
const PANTS_APPRECIATION_BIG_FONT = 22;
const PANTS_APPRECIATION_TIERS = [
  { max: 5, phrases: ["Ooh, bacon!", "Mmm, smells good!", "Nice bacon!", "Yummy!"] },
  { max: 10, phrases: ["Now THAT'S bacon!", "So much bacon!", "Bacon galore!", "What a haul!"] },
  { max: 15, phrases: ["Incredible bacon!", "Bacon jackpot!", "Unbelievable stash!", "A bacon fortune!"] },
  { max: Infinity, phrases: ["BACOOOON!!!", "THE MOTHERLODE!!!", "BACON HEAVEN!!!"], big: true },
];

const PANTS_PROTECTION_COOLDOWN = 6;
const PANTS_PROTECTED_PHRASES = [
  "This bacon protects me!", "Can't scare me, bacon's got my back!", "Bacon shield, activated!",
  "No fear, bacon's here!", "Safe as long as there's bacon!", "Bacon knows no fear!",
];

const SKY_CYCLE = 120;
const SUN_RISE_BEARING = 0;
const SUN_RADIUS_FRAC = 0.045;
const MOON_RADIUS_FRAC = 0.035;
const SUN_COLOR = "#ffd166";
const MOON_COLOR = "#dfe6f0";

const CHASE_DIST = 9;
const CHASE_HEIGHT = 2.8;
const PITCH_DEG = 9;
const PITCH_RAD = (PITCH_DEG * Math.PI) / 180;
const PITCH_COS = Math.cos(PITCH_RAD);
const PITCH_SIN = Math.sin(PITCH_RAD);
const PITCH_TAN = Math.tan(PITCH_RAD);
const MOVE_SPEED = 9;
const MOVE_SPEED_BACK = 5.5;
const NUBBY_ACCEL = 30;
const NUBBY_DECEL = 45;
const TURN_SPEED = 2.3;
const CHAR_RADIUS = 0.55;
const NUBBY_TIP_HEIGHT = 2 * CHAR_RADIUS + CHAR_RADIUS * 0.4;
const SQUISH_AMOUNT = 0.16;
const SQUISH_SETTLE_K = 220;
const SQUISH_SETTLE_C = 14;
const SPRINT_MULTIPLIER = 1.6;
const JUMP_VELOCITY = 8.2;
const JUMP_GRAVITY = 24;
const LEMUR_JUMP_CLEAR_HEIGHT = 0.5;
const PANTS_JUMP_CLEAR_HEIGHT = 0.5;

const STAMINA_DRAIN_RATE = 1 / 3.5;
const STAMINA_REFILL_RATE = 1 / 5;
const STAMINA_BAR_FADE_SPEED = 6;
const STAMINA_BAR_WIDTH = 70;
const STAMINA_BAR_HEIGHT = 10;
const RUNNING_NOTICE_MULTIPLIER = 1.5;
const COMPASS_RADIUS = 24;
const COMPASS_LEFT_MARGIN = 46;
const COMPASS_TOP_MARGIN = 40;
const COMPASS_DIRS = [
  { label: "N", azimuth: 0 },
  { label: "E", azimuth: Math.PI / 2 },
  { label: "S", azimuth: Math.PI },
  { label: "W", azimuth: Math.PI * 1.5 },
];

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

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
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
for (let i = 0; i < BANDS; i++) {
  const t = i / (BANDS - 1);
  const alpha = 1 - t;
  gridBandColor.push(bandRgba(GRID_NEAR, t, alpha));
}

function itemColor(nearRGB, dist) {
  const t = Math.min(1, Math.max(0, dist / MAX_DIST));
  return bandRgba(nearRGB, t, 1 - t);
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
let currentLakes = [];

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
  for (const l of currentLakes) {
    const dist = Math.hypot(x - l.cx, z - l.cz);
    const bedHeight = l.waterY - LAKE_BASIN_DEPTH;
    if (dist < l.radius) {
      h = bedHeight;
    } else if (dist < l.radius + LAKE_SHORE_BLEND) {
      const t = smooth(1 - (dist - l.radius) / LAKE_SHORE_BLEND);
      h = lerp(h, bedHeight, t);
    }
  }
  return h;
}

const gridHeightCache = new Float64Array(GRID_N * GRID_N);
let gridCacheGX = null, gridCacheGZ = null, gridCacheSig = "";

function ensureGridHeights(baseGX, baseGZ) {
  const sig = currentBuildings.map((b) => b.key).join("|") + "||" + currentLakes.map((l) => l.key).join("|");
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
  const roomsWanted = 1;

  const padHeight = terrainHeightRaw(cx, cz);
  const footRadius = Math.hypot(width, depth) / 2 + 1.6;
  const padRadius = footRadius + 10;

  // Water is the more fundamental terrain feature — buildings avoid lakes, not the other
  // way around (see #65).
  if (getNearbyLakes(cx, cz).some((l) => Math.hypot(cx - l.cx, cz - l.cz) < l.radius + footRadius + 4)) {
    return null;
  }

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
    const size = pickBaconSize(rng);
    const clearance = baconClearance(size);
    for (let attempt = 0; attempt < 6; attempt++) {
      const lx = (rng() - 0.5) * (width - 2.4);
      const lz = (rng() - 0.5) * (depth - 2.4);
      const wx = cx + lx, wz = cz + lz;
      if (walls.every((w) => pointToSegmentDist(wx, wz, w) > clearance)) {
        bacon.push({ x: wx, z: wz, y: padHeight, rot: rng() * Math.PI * 2, scale: size, boss: false, key: ix + "_" + iz + "_b" + i });
        break;
      }
    }
  }

  if (rng() < BOSS_BACON_CHANCE) {
    const clearance = baconClearance(BOSS_BACON_SCALE);
    for (let attempt = 0; attempt < 8; attempt++) {
      const lx = (rng() - 0.5) * (width - 2.4);
      const lz = (rng() - 0.5) * (depth - 2.4);
      const wx = cx + lx, wz = cz + lz;
      if (walls.every((w) => pointToSegmentDist(wx, wz, w) > clearance)) {
        bacon.push({ x: wx, z: wz, y: padHeight, rot: rng() * Math.PI * 2, scale: BOSS_BACON_SCALE, boss: true, key: ix + "_" + iz + "_bossb" });
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

// Rivers flow downhill from a point on the lake's rim via gradient descent, sampling terrain
// height across a forward-facing arc rather than the full circle. Considering the full circle
// (including doubling back toward where it just came from) let the path get stuck ping-ponging
// between two points forever whenever a small dip sat just behind it — a real bug caught by
// checking the generated path's heights, not just that it ran without erroring. Restricting
// each step to a forward arc makes a hairpin-turn physically impossible, so it can only curve
// and continue, never oscillate. Stops once several consecutive steps find no further downhill
// direction within that arc (the land has leveled out).
function buildRiver(lakeCx, lakeCz, lakeRadius, rng) {
  const startAngle = rng() * Math.PI * 2;
  let x = lakeCx + Math.cos(startAngle) * lakeRadius;
  let z = lakeCz + Math.sin(startAngle) * lakeRadius;
  let heading = startAngle;
  const arc = (RIVER_FORWARD_ARC_DEG * Math.PI) / 180;
  const points = [{ x, z, y: terrainHeightRaw(x, z) }];
  let flatStreak = 0;
  for (let step = 0; step < RIVER_MAX_STEPS; step++) {
    const curH = terrainHeightRaw(x, z);
    let bestAngle = null, bestH = curH;
    for (let i = 0; i < RIVER_SAMPLE_DIRS; i++) {
      const offset = -arc / 2 + (i / (RIVER_SAMPLE_DIRS - 1)) * arc;
      const a = heading + offset;
      const nx = x + Math.cos(a) * RIVER_STEP, nz = z + Math.sin(a) * RIVER_STEP;
      const nh = terrainHeightRaw(nx, nz);
      if (nh < bestH) {
        bestH = nh;
        bestAngle = a;
      }
    }
    if (bestAngle === null) {
      flatStreak++;
      if (flatStreak >= RIVER_FLAT_STOP_STREAK) break;
      bestAngle = heading;
    } else {
      flatStreak = 0;
    }
    heading = bestAngle;
    x += Math.cos(heading) * RIVER_STEP;
    z += Math.sin(heading) * RIVER_STEP;
    if (step > 2 && Math.hypot(x - lakeCx, z - lakeCz) < lakeRadius) break;
    points.push({ x, z, y: terrainHeightRaw(x, z) });
  }
  return points.length >= 4 ? points : null;
}

// Lake/river shapes are entirely deterministic (SEED + cell coords) and never change once
// generated, unlike buildings/trees which are cheap enough to recompute every frame — river
// pathing is not, so each cell's result is generated once and reused for the rest of the
// session (cleared on resetWorld / New World).
const lakeCache = new Map();

function buildLake(ix, iz) {
  const key = ix + "_" + iz;
  if (lakeCache.has(key)) return lakeCache.get(key);

  let lake = null;
  if (hash2(ix, iz, SEED + 991133) < LAKE_DENSITY) {
    const rng = makeRng(ix, iz, SEED + 5005);
    const jx = rng(), jz = rng();
    const cx = (ix + 0.5 + (jx - 0.5) * 0.5) * LAKE_CELL;
    const cz = (iz + 0.5 + (jz - 0.5) * 0.5) * LAKE_CELL;
    const radius = LAKE_RADIUS_MIN + rng() * (LAKE_RADIUS_MAX - LAKE_RADIUS_MIN);
    const waterY = terrainHeightRaw(cx, cz);

    let flat = true;
    const RING = 8;
    for (let i = 0; i < RING; i++) {
      const a = (i / RING) * Math.PI * 2;
      const ex = cx + Math.cos(a) * radius, ez = cz + Math.sin(a) * radius;
      if (Math.abs(terrainHeightRaw(ex, ez) - waterY) > LAKE_FLATNESS_MAX) {
        flat = false;
        break;
      }
    }

    if (flat) {
      const river = rng() < RIVER_CHANCE ? buildRiver(cx, cz, radius, rng) : null;
      lake = { cx, cz, radius, waterY, key, river };
    }
  }

  lakeCache.set(key, lake);
  return lake;
}

function getNearbyLakes(px, pz) {
  const list = [];
  const cix = Math.floor(px / LAKE_CELL), ciz = Math.floor(pz / LAKE_CELL);
  for (let dz = -LAKE_RANGE; dz <= LAKE_RANGE; dz++) {
    for (let dx = -LAKE_RANGE; dx <= LAKE_RANGE; dx++) {
      const l = buildLake(cix + dx, ciz + dz);
      if (l && Math.hypot(l.cx - px, l.cz - pz) < MAX_DIST + l.radius + 40) list.push(l);
    }
  }
  return list;
}

// Bacon mill about inside their building's footprint (never through the door — that gap
// is only for the player), bouncing gently off each other and the walls. Confinement uses
// the building's rectangular footprint rather than `walls`, since `walls` has a door gap.
const baconMillState = new Map();

function updateBaconMilling(dt) {
  const activeKeys = new Set();
  for (const b of currentBuildings) {
    const hw = b.width / 2, hd = b.depth / 2;

    for (const item of b.bacon) {
      activeKeys.add(item.key);
      if (collectedBacon.has(item.key)) continue;

      const clearance = baconClearance(item.scale);
      const minX = b.cx - hw + clearance, maxX = b.cx + hw - clearance;
      const minZ = b.cz - hd + clearance, maxZ = b.cz + hd - clearance;

      let st = baconMillState.get(item.key);
      if (!st) {
        st = {
          x: clamp(item.x, minX, maxX), z: clamp(item.z, minZ, maxZ),
          heading: item.rot, walkTimer: 0,
          pauseTimer: BACON_MILL_PAUSE_MIN + Math.random() * (BACON_MILL_PAUSE_MAX - BACON_MILL_PAUSE_MIN),
          bouncePhase: 0,
        };
        baconMillState.set(item.key, st);
      }
      st.minX = minX; st.maxX = maxX; st.minZ = minZ; st.maxZ = maxZ;

      if (st.pauseTimer > 0) {
        st.pauseTimer -= dt;
        if (st.pauseTimer <= 0) {
          st.heading = Math.random() * Math.PI * 2;
          st.walkTimer = BACON_MILL_WALK_MIN + Math.random() * (BACON_MILL_WALK_MAX - BACON_MILL_WALK_MIN);
        }
      } else {
        st.walkTimer -= dt;
        const speed = BACON_MILL_SPEED / Math.sqrt(Math.max(1, item.scale));
        const fx = Math.sin(st.heading), fz = Math.cos(st.heading);
        const nx = st.x + fx * speed * dt;
        const nz = st.z + fz * speed * dt;
        const cx2 = clamp(nx, minX, maxX), cz2 = clamp(nz, minZ, maxZ);
        const hitWall = cx2 !== nx || cz2 !== nz;
        st.x = cx2;
        st.z = cz2;
        st.bouncePhase += dt * BACON_MILL_BOUNCE_FREQ;
        if (hitWall || st.walkTimer <= 0) {
          st.pauseTimer = BACON_MILL_PAUSE_MIN + Math.random() * (BACON_MILL_PAUSE_MAX - BACON_MILL_PAUSE_MIN);
        }
      }

      item.x = st.x;
      item.z = st.z;
      item.rot = st.heading;
      if (st.pauseTimer <= 0) {
        item.y += Math.abs(Math.sin(st.bouncePhase)) * BACON_MILL_BOUNCE_HEIGHT;
        // Squash-and-stretch: springy tall at the top of each hop, folded short and wide
        // at ground contact — cos(2x) hits +1 at contact (phase 0, pi, ...) and -1 at the
        // apex (phase pi/2, 3pi/2, ...), matching |sin| bounce's own contact/apex timing.
        item.squish = Math.cos(2 * st.bouncePhase);
      } else {
        item.squish = 0;
      }
    }

    for (let i = 0; i < b.bacon.length; i++) {
      const a = b.bacon[i];
      if (collectedBacon.has(a.key)) continue;
      const stA = baconMillState.get(a.key);
      for (let j = i + 1; j < b.bacon.length; j++) {
        const c = b.bacon[j];
        if (collectedBacon.has(c.key)) continue;
        const stC = baconMillState.get(c.key);
        const dx = stC.x - stA.x, dz = stC.z - stA.z;
        const dist = Math.hypot(dx, dz);
        const minDist = baconClearance(a.scale) + baconClearance(c.scale);
        if (dist > 0.0001 && dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist, uz = dz / dist;
          stA.x = clamp(stA.x - ux * push, stA.minX, stA.maxX);
          stA.z = clamp(stA.z - uz * push, stA.minZ, stA.maxZ);
          stC.x = clamp(stC.x + ux * push, stC.minX, stC.maxX);
          stC.z = clamp(stC.z + uz * push, stC.minZ, stC.maxZ);
          a.x = stA.x; a.z = stA.z;
          c.x = stC.x; c.z = stC.z;
        }
      }
    }
  }

  for (const k of Array.from(baconMillState.keys())) {
    if (!activeKeys.has(k)) baconMillState.delete(k);
  }
}

const treeWobbles = new Map();

function triggerTreeWobble(key, dirX, dirZ) {
  let w = treeWobbles.get(key);
  if (!w) {
    w = { dirX, dirZ, offset: 0, vel: 0 };
    treeWobbles.set(key, w);
  } else {
    w.dirX = dirX;
    w.dirZ = dirZ;
  }
  w.vel = Math.min(TREE_WOBBLE_MAX_VEL, w.vel + TREE_WOBBLE_KICK);
}

function updateTreeWobbles(dt) {
  for (const [key, w] of treeWobbles.entries()) {
    const accel = -TREE_WOBBLE_K * w.offset - TREE_WOBBLE_C * w.vel;
    w.vel += accel * dt;
    w.offset += w.vel * dt;
    if (w.offset > TREE_WOBBLE_MAX_OFFSET) { w.offset = TREE_WOBBLE_MAX_OFFSET; w.vel = Math.min(w.vel, 0); }
    if (w.offset < -TREE_WOBBLE_MAX_OFFSET) { w.offset = -TREE_WOBBLE_MAX_OFFSET; w.vel = Math.max(w.vel, 0); }
    if (Math.abs(w.offset) < 0.001 && Math.abs(w.vel) < 0.01) {
      treeWobbles.delete(key);
    }
  }
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
      if (currentLakes.some((l) => Math.hypot(tx - l.cx, tz - l.cz) < l.radius + 2)) continue;
      const h0 = terrainHeight(tx, tz);
      const h1 = terrainHeight(tx + 1, tz);
      const h2 = terrainHeight(tx, tz + 1);
      const slope = Math.abs(h1 - h0) + Math.abs(h2 - h0);
      if (slope > 3.2) continue;
      const scale = 0.75 + hash2(ix, iz, SEED + 3333) * 1.0;
      const key = ix + "_" + iz;
      const w = treeWobbles.get(key);
      const leanX = w ? w.dirX * w.offset : 0;
      const leanZ = w ? w.dirZ * w.offset : 0;
      trees.push({ x: tx, z: tz, y: h0, key, scale, leanX, leanZ });
    }
  }
  return trees;
}

function treeSegments(t) {
  const trunkH = 1.6 * t.scale;
  const baseR = 0.9 * t.scale;
  const baseY = t.y + trunkH;
  const canopyX = t.x + t.leanX, canopyZ = t.z + t.leanZ;
  const trunkTop = { x: canopyX, y: baseY, z: canopyZ };
  const apex = { x: t.x + t.leanX * 1.5, y: baseY + 2.6 * t.scale, z: t.z + t.leanZ * 1.5 };
  const segs = [[{ x: t.x, y: t.y, z: t.z }, trunkTop]];
  const N = 6;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push({ x: canopyX + Math.cos(a) * baseR, y: baseY, z: canopyZ + Math.sin(a) * baseR });
  }
  for (let i = 0; i < N; i++) {
    segs.push([pts[i], pts[(i + 1) % N]]);
    segs.push([pts[i], apex]);
  }
  return segs;
}

function getNearbyRocks(px, pz) {
  const rocks = [];
  const cix = Math.floor(px / ROCK_CELL), ciz = Math.floor(pz / ROCK_CELL);
  for (let dz = -ROCK_RANGE; dz <= ROCK_RANGE; dz++) {
    for (let dx = -ROCK_RANGE; dx <= ROCK_RANGE; dx++) {
      const ix = cix + dx, iz = ciz + dz;
      const r = hash2(ix, iz, SEED + 883311);
      if (r >= ROCK_DENSITY) continue;
      const jx = hash2(ix, iz, SEED + 883322);
      const jz = hash2(ix, iz, SEED + 883333);
      const rx = (ix + 0.5 + (jx - 0.5) * 0.7) * ROCK_CELL;
      const rz = (iz + 0.5 + (jz - 0.5) * 0.7) * ROCK_CELL;
      if (Math.hypot(rx - px, rz - pz) > MAX_DIST + ROCK_CELL) continue;
      if (currentBuildings.some((b) => Math.hypot(rx - b.cx, rz - b.cz) < b.footRadius + 3)) continue;
      if (currentLakes.some((l) => Math.hypot(rx - l.cx, rz - l.cz) < l.radius + 2)) continue;
      const scale = 0.7 + hash2(ix, iz, SEED + 883344) * 0.8;
      const rot = hash2(ix, iz, SEED + 883355) * Math.PI * 2;
      const jitterBase = [], jitterTop = [];
      for (let i = 0; i < 6; i++) {
        jitterBase.push(0.7 + hash2(ix, iz, SEED + 883400 + i) * 0.6);
        jitterTop.push(0.5 + hash2(ix, iz, SEED + 883500 + i) * 0.6);
      }
      rocks.push({ x: rx, z: rz, y: terrainHeight(rx, rz), scale, rot, jitterBase, jitterTop, key: ix + "_" + iz });
    }
  }
  return rocks;
}

function rockHeight(scale) {
  return 0.5 * scale;
}

function rockSegments(rock) {
  const N = 6;
  const baseR = 0.55 * rock.scale;
  const topR = 0.35 * rock.scale;
  const height = rockHeight(rock.scale);
  const cosR = Math.cos(rock.rot), sinR = Math.sin(rock.rot);
  const place = (lx, lz, ly) => ({
    x: rock.x + lx * cosR - lz * sinR,
    y: rock.y + ly,
    z: rock.z + lx * sinR + lz * cosR,
  });
  const basePts = [], topPts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const br = baseR * rock.jitterBase[i];
    const tr = topR * rock.jitterTop[i];
    basePts.push(place(Math.cos(a) * br, Math.sin(a) * br, 0));
    topPts.push(place(Math.cos(a) * tr, Math.sin(a) * tr, height * (0.6 + rock.jitterTop[i] * 0.5)));
  }
  const segs = [];
  for (let i = 0; i < N; i++) {
    segs.push([basePts[i], basePts[(i + 1) % N]]);
    segs.push([topPts[i], topPts[(i + 1) % N]]);
    segs.push([basePts[i], topPts[i]]);
  }
  segs.push([basePts[0], topPts[3]]);
  segs.push([basePts[2], topPts[5]]);
  return segs;
}

function baconSegments(item) {
  const scale = item.scale || 1;
  const squish = item.squish || 0;
  const stretch = 1 - BACON_MILL_SQUISH_AMOUNT * squish;
  const fold = 1 + BACON_MILL_SQUISH_AMOUNT * squish;
  const height = BACON_HEIGHT * scale * stretch;
  const cosR = Math.cos(item.rot), sinR = Math.sin(item.rot);
  const place = (right, fwd, up) => ({
    x: item.x + right * cosR - fwd * sinR,
    y: item.y + up,
    z: item.z + right * sinR + fwd * cosR,
  });
  const M = 5;
  const frontPts = [], backPts = [];
  for (let i = 0; i <= M; i++) {
    const t = i / M;
    const up = t * height;
    const wave = Math.sin(t * Math.PI * 2.6) * 0.18 * scale * fold;
    frontPts.push(place(wave, 0.11 * scale * fold, up));
    backPts.push(place(wave, -0.11 * scale * fold, up));
  }
  const segs = [];
  for (let i = 0; i < M; i++) {
    segs.push([frontPts[i], frontPts[i + 1]]);
    segs.push([backPts[i], backPts[i + 1]]);
  }
  segs.push([frontPts[0], backPts[0]]);
  segs.push([frontPts[M], backPts[M]]);
  for (let i = 1; i < M; i++) {
    segs.push([frontPts[i], backPts[i]]);
  }
  return segs;
}

// Tracks removed entities (scared-off pants, startled bird flocks, collected bacon) by
// key -> the `skyTime` they were removed at, so `has()` can let a key respawn once its
// timeout has elapsed rather than keeping an area permanently depopulated. `skyTime` (not
// wall-clock time) is used so respawn timing is tied to the game clock, same clock the
// day/night cycle runs on.
class RespawnSet {
  constructor(timeout) {
    this.timeout = timeout;
    this.removedAt = new Map();
  }
  has(key) {
    const t = this.removedAt.get(key);
    if (t === undefined) return false;
    if (skyTime - t >= this.timeout) {
      this.removedAt.delete(key);
      return false;
    }
    return true;
  }
  add(key) {
    this.removedAt.set(key, skyTime);
  }
  delete(key) {
    this.removedAt.delete(key);
  }
  clear() {
    this.removedAt.clear();
  }
}

const PANTS_RESPAWN_TIMEOUT = 60;
const BIRD_RESPAWN_TIMEOUT = 45;
const BACON_RESPAWN_TIMEOUT = 75;

const goneKeys = new RespawnSet(PANTS_RESPAWN_TIMEOUT);

function getNearbyPantsBase(px, pz) {
  const list = [];
  const cix = Math.floor(px / PANTS_CELL), ciz = Math.floor(pz / PANTS_CELL);
  for (let dz = -PANTS_RANGE; dz <= PANTS_RANGE; dz++) {
    for (let dx = -PANTS_RANGE; dx <= PANTS_RANGE; dx++) {
      const ix = cix + dx, iz = ciz + dz;
      const key = ix + "_" + iz;
      if (goneKeys.has(key)) continue;
      const r = hash2(ix, iz, SEED + 662211);
      if (r >= PANTS_DENSITY) continue;
      const jx = hash2(ix, iz, SEED + 662222);
      const jz = hash2(ix, iz, SEED + 662233);
      const bx = (ix + 0.5 + (jx - 0.5) * 0.7) * PANTS_CELL;
      const bz = (iz + 0.5 + (jz - 0.5) * 0.7) * PANTS_CELL;
      if (Math.hypot(bx - px, bz - pz) > MAX_DIST + PANTS_CELL) continue;
      list.push({ key, baseX: bx, baseZ: bz });
    }
  }
  for (const b of currentBuildings) {
    if (!b.bacon.length) continue;
    const key = "room_" + b.key;
    if (goneKeys.has(key)) continue;
    const [ix, iz] = b.key.split("_").map(Number);
    const r = hash2(ix, iz, SEED + 778899);
    if (r >= PANTS_ROOM_CHANCE) continue;
    const jx = hash2(ix, iz, SEED + 778811);
    const jz = hash2(ix, iz, SEED + 778822);
    const hw = Math.max(0.5, b.width / 2 - 1.4), hd = Math.max(0.5, b.depth / 2 - 1.4);
    const bx = b.cx + (jx - 0.5) * 2 * hw;
    const bz = b.cz + (jz - 0.5) * 2 * hd;
    if (Math.hypot(bx - px, bz - pz) > MAX_DIST + b.padRadius) continue;
    list.push({ key, baseX: bx, baseZ: bz });
  }
  return list;
}

const pantsState = new Map();

function angleDiff(target, current) {
  let d = (target - current) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

let skyTime = 0;

function celestialPosition(angle, riseBearing) {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const elevation = Math.sin(a);
  const azimuth = a < Math.PI / 2 || a >= Math.PI * 1.5 ? riseBearing : riseBearing + Math.PI;
  return { elevation, azimuth };
}

function celestialScreenPos(elevation, azimuth, playerHeading) {
  const relBearing = angleDiff(azimuth, playerHeading);
  if (Math.abs(relBearing) > 1.3) return null;
  const vertAngle = elevation + PITCH_RAD;
  if (Math.abs(vertAngle) > 1.3) return null;
  return { sx: CX + Math.tan(relBearing) * FOCAL, sy: CY - Math.tan(vertAngle) * FOCAL };
}

function drawSkyBody(elevation, azimuth, radius, color) {
  if (elevation <= 0) return;
  const pos = celestialScreenPos(elevation, azimuth, player.heading);
  if (!pos) return;
  ctx.beginPath();
  ctx.arc(pos.sx, pos.sy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawSkyBodies() {
  const sunAngle = (skyTime / SKY_CYCLE) * Math.PI * 2;
  const moonAngle = sunAngle + Math.PI;
  const sun = celestialPosition(sunAngle, SUN_RISE_BEARING);
  const moon = celestialPosition(moonAngle, SUN_RISE_BEARING);
  const radius = Math.min(W, H) * SUN_RADIUS_FRAC;
  const moonRadius = Math.min(W, H) * MOON_RADIUS_FRAC;
  drawSkyBody(sun.elevation, sun.azimuth, radius, SUN_COLOR);
  drawSkyBody(moon.elevation, moon.azimuth, moonRadius, MOON_COLOR);
}

function buildingContaining(x, z) {
  for (const b of currentBuildings) {
    const hw = b.width / 2, hd = b.depth / 2;
    if (x >= b.cx - hw && x <= b.cx + hw && z >= b.cz - hd && z <= b.cz + hd) return b;
  }
  return null;
}

function roomBaconAppreciationValue(b) {
  let total = 0;
  for (const item of b.bacon) {
    if (!collectedBacon.has(item.key)) total += item.scale || 1;
  }
  return Math.min(PANTS_APPRECIATION_CAP, total);
}

function pantsAppreciationTier(value) {
  for (const tier of PANTS_APPRECIATION_TIERS) {
    if (value <= tier.max) return tier;
  }
  return PANTS_APPRECIATION_TIERS[PANTS_APPRECIATION_TIERS.length - 1];
}

function getNearbyPants(px, pz) {
  const bases = getNearbyPantsBase(px, pz);
  const activeKeys = new Set();
  const result = [];
  for (const base of bases) {
    activeKeys.add(base.key);
    let st = pantsState.get(base.key);
    if (!st) {
      st = {
        x: base.baseX, z: base.baseZ,
        fleeing: false, facing: Math.random() * Math.PI * 2, fleeHeading: 0, legPhase: 0,
        fleeTimer: 0, bubbleTimer: 0, bubbleText: "", bubbleFontSize: 13,
        walkTimer: PANTS_WALK_MIN + Math.random() * (PANTS_WALK_MAX - PANTS_WALK_MIN),
        pauseTimer: 0, appreciationCooldown: Math.random() * PANTS_APPRECIATION_COOLDOWN,
        protectionCooldown: Math.random() * PANTS_PROTECTION_COOLDOWN,
      };
      pantsState.set(base.key, st);
    }
    result.push({
      key: base.key,
      x: st.x,
      z: st.z,
      y: terrainHeight(st.x, st.z),
      heading: st.facing,
      legPhase: st.legPhase,
      fleeing: st.fleeing,
      bubbleTimer: st.bubbleTimer,
      bubbleText: st.bubbleText,
      bubbleFontSize: st.bubbleFontSize,
    });
  }
  for (const k of Array.from(pantsState.keys())) {
    if (!activeKeys.has(k)) pantsState.delete(k);
  }
  return result;
}

function updatePants(dt, noticeMultiplier = 1) {
  let scares = 0;
  for (const [key, st] of pantsState.entries()) {
    if (!st.fleeing) {
      let scareX = player.x, scareZ = player.z;
      let noticed = Math.hypot(st.x - player.x, st.z - player.z) < PANTS_NOTICE_RADIUS * noticeMultiplier
        && !wallBlocksLineOfSight(player.x, player.z, st.x, st.z);
      if (!noticed) {
        for (const l of currentLemurs) {
          if (Math.hypot(st.x - l.x, st.z - l.z) < PANTS_NOTICE_RADIUS
            && !wallBlocksLineOfSight(l.x, l.z, st.x, st.z)) {
            noticed = true;
            scareX = l.x;
            scareZ = l.z;
            break;
          }
        }
      }
      const room = buildingContaining(st.x, st.z);
      const roomValue = room ? roomBaconAppreciationValue(room) : 0;
      const protectedByBacon = roomValue > 0;
      let bubbleFiredThisFrame = false;

      if (noticed && !protectedByBacon) {
        st.fleeing = true;
        const awayHeading = Math.atan2(st.x - scareX, st.z - scareZ);
        const arcSpread = (Math.random() - 0.5) * (PANTS_FLEE_ARC_DEG * Math.PI / 180);
        st.fleeHeading = awayHeading + arcSpread;
        st.fleeTimer = PANTS_FLEE_DURATION;
        st.bubbleTimer = PANTS_BUBBLE_DURATION;
        st.bubbleText = PANTS_PHRASES[Math.floor(Math.random() * PANTS_PHRASES.length)];
        st.bubbleFontSize = 13;
        scares++;
      } else if (noticed && protectedByBacon) {
        st.protectionCooldown -= dt;
        if (st.protectionCooldown <= 0
          && Math.hypot(st.x - player.x, st.z - player.z) < PANTS_APPRECIATION_WITNESS_RADIUS
          && !wallBlocksLineOfSight(player.x, player.z, st.x, st.z)) {
          st.bubbleTimer = PANTS_BUBBLE_DURATION;
          st.bubbleText = PANTS_PROTECTED_PHRASES[Math.floor(Math.random() * PANTS_PROTECTED_PHRASES.length)];
          st.bubbleFontSize = 13;
          st.protectionCooldown = PANTS_PROTECTION_COOLDOWN;
          bubbleFiredThisFrame = true;
        }
      } else if (st.pauseTimer > 0) {
        st.pauseTimer -= dt;
        if (st.pauseTimer <= 0) {
          st.facing = Math.random() * Math.PI * 2;
          st.walkTimer = PANTS_WALK_MIN + Math.random() * (PANTS_WALK_MAX - PANTS_WALK_MIN);
        }
      } else {
        st.walkTimer -= dt;
        const fx = Math.sin(st.facing), fz = Math.cos(st.facing);
        let nx = st.x + fx * PANTS_WALK_SPEED * dt;
        let nz = st.z + fz * PANTS_WALK_SPEED * dt;
        for (const t of currentTrees) {
          const dx = nx - t.x, dz = nz - t.z;
          const treeDist = Math.hypot(dx, dz);
          const minDist = PANTS_RADIUS + TREE_RADIUS * t.scale;
          if (treeDist > 0.0001 && treeDist < minDist) {
            const push = minDist - treeDist;
            nx += (dx / treeDist) * push;
            nz += (dz / treeDist) * push;
          }
        }
        for (const r of currentRocks) {
          const dx = nx - r.x, dz = nz - r.z;
          const rockDist = Math.hypot(dx, dz);
          const minDist = PANTS_RADIUS + ROCK_RADIUS * r.scale;
          if (rockDist > 0.0001 && rockDist < minDist) {
            const push = minDist - rockDist;
            nx += (dx / rockDist) * push;
            nz += (dz / rockDist) * push;
          }
        }
        for (const b of currentBuildings) {
          if (Math.hypot(nx - b.cx, nz - b.cz) > b.footRadius + 4) continue;
          for (const seg of b.walls) {
            [nx, nz] = resolveWallCollision(nx, nz, seg, PANTS_RADIUS + 0.12);
          }
        }
        st.x = nx;
        st.z = nz;
        st.legPhase += dt * 6;
        if (st.walkTimer <= 0) {
          st.pauseTimer = PANTS_PAUSE_MIN + Math.random() * (PANTS_PAUSE_MAX - PANTS_PAUSE_MIN);
        }
      }
      if (!(noticed && !protectedByBacon) && !bubbleFiredThisFrame) {
        st.appreciationCooldown -= dt;
        if (st.appreciationCooldown <= 0) {
          if (roomValue > 0
            && Math.hypot(st.x - player.x, st.z - player.z) < PANTS_APPRECIATION_WITNESS_RADIUS
            && !wallBlocksLineOfSight(player.x, player.z, st.x, st.z)) {
            const tier = pantsAppreciationTier(roomValue);
            st.bubbleTimer = PANTS_BUBBLE_DURATION;
            st.bubbleText = tier.phrases[Math.floor(Math.random() * tier.phrases.length)];
            st.bubbleFontSize = tier.big ? PANTS_APPRECIATION_BIG_FONT : 13;
            st.appreciationCooldown = PANTS_APPRECIATION_COOLDOWN;
          }
        }
      }
    }
    if (st.fleeing) {
      const elapsed = PANTS_FLEE_DURATION - st.fleeTimer;
      const rampT = Math.min(1, elapsed / PANTS_RAMP_DURATION);
      const turnRampT = Math.min(1, elapsed / PANTS_TURN_RAMP_DURATION);
      const turnStep = PANTS_TURN_SPEED * turnRampT * dt;
      const diff = angleDiff(st.fleeHeading, st.facing);
      if (Math.abs(diff) <= turnStep) st.facing = st.fleeHeading;
      else st.facing += Math.sign(diff) * turnStep;

      const speed = PANTS_FLEE_SPEED * rampT;
      const fx = Math.sin(st.facing), fz = Math.cos(st.facing);
      let nx = st.x + fx * speed * dt;
      let nz = st.z + fz * speed * dt;
      for (const t of currentTrees) {
        const dx = nx - t.x, dz = nz - t.z;
        const treeDist = Math.hypot(dx, dz);
        const minDist = PANTS_RADIUS + TREE_RADIUS * t.scale;
        if (treeDist > 0.0001 && treeDist < minDist) {
          const push = minDist - treeDist;
          nx += (dx / treeDist) * push;
          nz += (dz / treeDist) * push;
        }
      }
      for (const r of currentRocks) {
        const dx = nx - r.x, dz = nz - r.z;
        const rockDist = Math.hypot(dx, dz);
        const minDist = PANTS_RADIUS + ROCK_RADIUS * r.scale;
        if (rockDist > 0.0001 && rockDist < minDist) {
          const push = minDist - rockDist;
          nx += (dx / rockDist) * push;
          nz += (dz / rockDist) * push;
        }
      }
      for (const b of currentBuildings) {
        if (Math.hypot(nx - b.cx, nz - b.cz) > b.footRadius + 4) continue;
        for (const seg of b.walls) {
          [nx, nz] = resolveWallCollision(nx, nz, seg, PANTS_RADIUS + 0.12);
        }
      }
      st.x = nx;
      st.z = nz;
      st.legPhase += dt * 16 * rampT;
      st.fleeTimer -= dt;
      if (st.bubbleTimer > 0) st.bubbleTimer -= dt;
      if (st.fleeTimer <= 0) {
        goneKeys.add(key);
        pantsState.delete(key);
      }
    }
  }
  return scares;
}

function pantsSegments(p) {
  const bounce = Math.abs(Math.sin(p.legPhase)) * (p.fleeing ? 0.1 : 0.05);
  const beltBottomY = p.y + PANTS_LEG_LEN + bounce;
  const beltTopY = beltBottomY + PANTS_BELT_HEIGHT;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const rx = Math.cos(p.heading), rz = -Math.sin(p.heading);
  const swing = Math.sin(p.legPhase) * (p.fleeing ? 0.36 : 0.16);
  const pt = (right, fwd, y) => ({
    x: p.x + rx * right + fx * fwd,
    y,
    z: p.z + rz * right + fz * fwd,
  });

  const beltTLf = pt(-PANTS_WAIST_HALF, PANTS_DEPTH_HALF, beltTopY);
  const beltTRf = pt(PANTS_WAIST_HALF, PANTS_DEPTH_HALF, beltTopY);
  const beltTRb = pt(PANTS_WAIST_HALF, -PANTS_DEPTH_HALF, beltTopY);
  const beltTLb = pt(-PANTS_WAIST_HALF, -PANTS_DEPTH_HALF, beltTopY);
  const beltBLf = pt(-PANTS_WAIST_HALF, PANTS_DEPTH_HALF, beltBottomY);
  const beltBRf = pt(PANTS_WAIST_HALF, PANTS_DEPTH_HALF, beltBottomY);
  const beltBRb = pt(PANTS_WAIST_HALF, -PANTS_DEPTH_HALF, beltBottomY);
  const beltBLb = pt(-PANTS_WAIST_HALF, -PANTS_DEPTH_HALF, beltBottomY);

  const legTopLf = pt(-PANTS_LEG_TOP_HALF, PANTS_DEPTH_HALF, beltBottomY);
  const legTopLb = pt(-PANTS_LEG_TOP_HALF, -PANTS_DEPTH_HALF, beltBottomY);
  const legTopRf = pt(PANTS_LEG_TOP_HALF, PANTS_DEPTH_HALF, beltBottomY);
  const legTopRb = pt(PANTS_LEG_TOP_HALF, -PANTS_DEPTH_HALF, beltBottomY);

  const ankleLf = pt(-PANTS_ANKLE_HALF, PANTS_ANKLE_DEPTH_HALF + swing, p.y + bounce);
  const ankleLb = pt(-PANTS_ANKLE_HALF, -PANTS_ANKLE_DEPTH_HALF + swing, p.y + bounce);
  const ankleRf = pt(PANTS_ANKLE_HALF, PANTS_ANKLE_DEPTH_HALF - swing, p.y + bounce);
  const ankleRb = pt(PANTS_ANKLE_HALF, -PANTS_ANKLE_DEPTH_HALF - swing, p.y + bounce);

  const crotch = pt(0, 0, beltBottomY - 0.05);
  const seamTop = pt(0, PANTS_DEPTH_HALF, beltBottomY);

  return [
    [beltTLf, beltTRf], [beltTRf, beltTRb], [beltTRb, beltTLb], [beltTLb, beltTLf],
    [beltBLf, beltBRf], [beltBRf, beltBRb], [beltBRb, beltBLb], [beltBLb, beltBLf],
    [beltTLf, beltBLf], [beltTRf, beltBRf], [beltTRb, beltBRb], [beltTLb, beltBLb],
    [seamTop, crotch],
    [legTopLf, legTopLb],
    [legTopLf, ankleLf], [legTopLb, ankleLb], [ankleLf, ankleLb],
    [legTopRf, legTopRb],
    [legTopRf, ankleRf], [legTopRb, ankleRb], [ankleRf, ankleRb],
  ];
}

const birdFlockState = new Map();
const goneBirdFlocks = new RespawnSet(BIRD_RESPAWN_TIMEOUT);
let currentBirds = [];

function getNearbyBirdFlocksBase(px, pz) {
  const list = [];
  const cix = Math.floor(px / BIRD_FLOCK_CELL), ciz = Math.floor(pz / BIRD_FLOCK_CELL);
  for (let dz = -BIRD_FLOCK_RANGE; dz <= BIRD_FLOCK_RANGE; dz++) {
    for (let dx = -BIRD_FLOCK_RANGE; dx <= BIRD_FLOCK_RANGE; dx++) {
      const ix = cix + dx, iz = ciz + dz;
      const key = ix + "_" + iz;
      if (goneBirdFlocks.has(key)) continue;
      const r = hash2(ix, iz, SEED + 991122);
      if (r >= BIRD_FLOCK_DENSITY) continue;
      const jx = hash2(ix, iz, SEED + 991133);
      const jz = hash2(ix, iz, SEED + 991144);
      const bx = (ix + 0.5 + (jx - 0.5) * 0.7) * BIRD_FLOCK_CELL;
      const bz = (iz + 0.5 + (jz - 0.5) * 0.7) * BIRD_FLOCK_CELL;
      if (Math.hypot(bx - px, bz - pz) > MAX_DIST + BIRD_FLOCK_CELL) continue;
      if (currentBuildings.some((b) => Math.hypot(bx - b.cx, bz - b.cz) < b.footRadius + 3)) continue;
      const count = BIRD_FLOCK_MIN_COUNT + Math.floor(hash2(ix, iz, SEED + 991155) * (BIRD_FLOCK_MAX_COUNT - BIRD_FLOCK_MIN_COUNT + 1));
      const birds = [];
      for (let i = 0; i < count; i++) {
        birds.push({
          offX: (hash2(ix, iz, SEED + 991200 + i * 3) - 0.5) * 3,
          offZ: (hash2(ix, iz, SEED + 991201 + i * 3) - 0.5) * 3,
          idlePhase: hash2(ix, iz, SEED + 991202 + i * 3) * Math.PI * 2,
        });
      }
      list.push({ key, baseX: bx, baseZ: bz, birds });
    }
  }
  return list;
}

function refreshBirdFlocks(px, pz) {
  const bases = getNearbyBirdFlocksBase(px, pz);
  const activeKeys = new Set();
  for (const base of bases) {
    activeKeys.add(base.key);
    if (!birdFlockState.has(base.key)) {
      birdFlockState.set(base.key, {
        x: base.baseX, z: base.baseZ,
        flying: false, facing: 0, fleeHeading: 0, fleeTimer: 0,
        bubbleTimer: 0, bubbleText: "",
        birds: base.birds.map((b) => ({ ...b, flapPhase: Math.random() * Math.PI * 2 })),
      });
    }
  }
  for (const k of Array.from(birdFlockState.keys())) {
    if (!activeKeys.has(k)) birdFlockState.delete(k);
  }
}

function updateBirdFlocks(dt, noticeMultiplier = 1) {
  for (const [key, st] of birdFlockState.entries()) {
    if (!st.flying) {
      let scareX = player.x, scareZ = player.z;
      let noticed = Math.hypot(st.x - player.x, st.z - player.z) < BIRD_NOTICE_RADIUS * noticeMultiplier
        && !wallBlocksLineOfSight(player.x, player.z, st.x, st.z);
      if (!noticed) {
        for (const p of currentPants) {
          const mult = p.fleeing ? BIRD_NOTICE_PANTS_FLEEING_MULT : 1;
          if (Math.hypot(st.x - p.x, st.z - p.z) < BIRD_NOTICE_RADIUS * mult
            && !wallBlocksLineOfSight(p.x, p.z, st.x, st.z)) {
            noticed = true;
            scareX = p.x;
            scareZ = p.z;
            break;
          }
        }
      }
      if (noticed) {
        st.flying = true;
        const awayHeading = Math.atan2(st.x - scareX, st.z - scareZ);
        const arcSpread = (Math.random() - 0.5) * (BIRD_FLEE_ARC_DEG * Math.PI / 180);
        st.fleeHeading = awayHeading + arcSpread;
        st.fleeTimer = BIRD_FLEE_DURATION;
        st.bubbleTimer = BIRD_BUBBLE_DURATION;
        st.bubbleText = BIRD_NOISES[Math.floor(Math.random() * BIRD_NOISES.length)];
      } else {
        for (const b of st.birds) b.idlePhase += dt * 2;
      }
    }
    if (st.flying) {
      const elapsed = BIRD_FLEE_DURATION - st.fleeTimer;
      const rampT = Math.min(1, elapsed / BIRD_RAMP_DURATION);
      const turnRampT = Math.min(1, elapsed / BIRD_TURN_RAMP_DURATION);
      const turnStep = BIRD_TURN_SPEED * turnRampT * dt;
      const diff = angleDiff(st.fleeHeading, st.facing);
      if (Math.abs(diff) <= turnStep) st.facing = st.fleeHeading;
      else st.facing += Math.sign(diff) * turnStep;
      const speed = BIRD_FLEE_SPEED * rampT;
      const fx = Math.sin(st.facing), fz = Math.cos(st.facing);
      st.x += fx * speed * dt;
      st.z += fz * speed * dt;
      for (const b of st.birds) b.flapPhase += dt * 14;
      st.fleeTimer -= dt;
      if (st.bubbleTimer > 0) st.bubbleTimer -= dt;
      if (st.fleeTimer <= 0) {
        goneBirdFlocks.add(key);
        birdFlockState.delete(key);
      }
    }
  }

  rebuildCurrentBirds();
}

function rebuildCurrentBirds() {
  currentBirds = [];
  for (const st of birdFlockState.values()) {
    const elapsed = st.flying ? BIRD_FLEE_DURATION - st.fleeTimer : 0;
    const climb = st.flying ? Math.min(1, elapsed / BIRD_RISE_DURATION) * BIRD_RISE_HEIGHT : 0;
    const liftT = st.flying ? Math.min(1, elapsed / BIRD_TAKEOFF_DURATION) : 0;
    for (const b of st.birds) {
      const bx = st.x + b.offX, bz = st.z + b.offZ;
      currentBirds.push({
        x: bx,
        y: terrainHeight(bx, bz) + climb,
        z: bz,
        flapPhase: b.flapPhase,
        idlePhase: b.idlePhase,
        heading: st.facing,
        flying: st.flying,
        liftT,
      });
    }
  }
}

function birdSegments(bird) {
  if (bird.flying) {
    const liftT = bird.liftT ?? 1;
    const flap = (Math.sin(bird.flapPhase) * 0.4 + 0.15) * liftT;
    const span = BIRD_WING_SPAN * liftT;
    const center = { x: bird.x, y: bird.y, z: bird.z };
    const left = { x: bird.x - span, y: bird.y + flap, z: bird.z };
    const right = { x: bird.x + span, y: bird.y + flap, z: bird.z };
    return [[left, center], [center, right]];
  }
  const bob = Math.abs(Math.sin(bird.idlePhase)) * 0.04;
  const bodyY = bird.y + 0.1 + bob;
  const fx = Math.sin(bird.heading), fz = Math.cos(bird.heading);
  const rx = Math.cos(bird.heading), rz = -Math.sin(bird.heading);
  const pt = (right, fwd, up) => ({
    x: bird.x + rx * right + fx * fwd,
    y: up,
    z: bird.z + rz * right + fz * fwd,
  });
  const beak = pt(0, 0.18, bodyY + 0.05);
  const tail = pt(0, -0.16, bodyY + 0.08);
  const left = pt(-0.13, 0, bodyY);
  const right = pt(0.13, 0, bodyY);
  const top = pt(0, 0, bodyY + 0.12);
  return [
    [beak, left], [left, tail], [tail, right], [right, beak],
    [left, top], [right, top],
  ];
}

const lemurState = new Map();

function getNearbyLemursBase(px, pz) {
  const list = [];
  const cix = Math.floor(px / LEMUR_CELL), ciz = Math.floor(pz / LEMUR_CELL);
  for (let dz = -LEMUR_RANGE; dz <= LEMUR_RANGE; dz++) {
    for (let dx = -LEMUR_RANGE; dx <= LEMUR_RANGE; dx++) {
      const ix = cix + dx, iz = ciz + dz;
      const r = hash2(ix, iz, SEED + 774411);
      if (r >= LEMUR_DENSITY) continue;
      const jx = hash2(ix, iz, SEED + 774422);
      const jz = hash2(ix, iz, SEED + 774433);
      const bx = (ix + 0.5 + (jx - 0.5) * 0.7) * LEMUR_CELL;
      const bz = (iz + 0.5 + (jz - 0.5) * 0.7) * LEMUR_CELL;
      if (Math.hypot(bx - px, bz - pz) > MAX_DIST + LEMUR_CELL) continue;
      list.push({ key: ix + "_" + iz, baseX: bx, baseZ: bz });
    }
  }
  return list;
}

function getNearbyLemurs(px, pz) {
  const bases = getNearbyLemursBase(px, pz);
  const activeKeys = new Set();
  const result = [];
  for (const base of bases) {
    activeKeys.add(base.key);
    let st = lemurState.get(base.key);
    if (!st) {
      st = {
        x: base.baseX, z: base.baseZ,
        heading: Math.random() * Math.PI * 2,
        walkTimer: LEMUR_WALK_MIN + Math.random() * (LEMUR_WALK_MAX - LEMUR_WALK_MIN),
        pauseTimer: 0, legPhase: 0,
      };
      lemurState.set(base.key, st);
    }
    result.push({
      key: base.key,
      x: st.x,
      z: st.z,
      y: terrainHeight(st.x, st.z),
      heading: st.heading,
      legPhase: st.legPhase,
    });
  }
  for (const k of Array.from(lemurState.keys())) {
    if (!activeKeys.has(k)) lemurState.delete(k);
  }
  return result;
}

function updateLemurs(dt) {
  for (const st of lemurState.values()) {
    if (st.pauseTimer > 0) {
      st.pauseTimer -= dt;
      if (st.pauseTimer <= 0) {
        st.heading = Math.random() * Math.PI * 2;
        st.walkTimer = LEMUR_WALK_MIN + Math.random() * (LEMUR_WALK_MAX - LEMUR_WALK_MIN);
      }
      continue;
    }
    st.walkTimer -= dt;
    const fx = Math.sin(st.heading), fz = Math.cos(st.heading);
    let nx = st.x + fx * LEMUR_SPEED * dt;
    let nz = st.z + fz * LEMUR_SPEED * dt;
    for (const t of currentTrees) {
      const dx = nx - t.x, dz = nz - t.z;
      const dist = Math.hypot(dx, dz);
      const minDist = LEMUR_RADIUS + TREE_RADIUS * t.scale;
      if (dist > 0.0001 && dist < minDist) {
        const push = minDist - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
        triggerTreeWobble(t.key, -dx / dist, -dz / dist);
      }
    }
    for (const r of currentRocks) {
      const dx = nx - r.x, dz = nz - r.z;
      const dist = Math.hypot(dx, dz);
      const minDist = LEMUR_RADIUS + ROCK_RADIUS * r.scale;
      if (dist > 0.0001 && dist < minDist) {
        const push = minDist - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      }
    }
    for (const p of currentPants) {
      const dx = nx - p.x, dz = nz - p.z;
      const dist = Math.hypot(dx, dz);
      const minDist = LEMUR_RADIUS + PANTS_RADIUS;
      if (dist > 0.0001 && dist < minDist) {
        const push = minDist - dist;
        const ux = dx / dist, uz = dz / dist;
        nx += ux * push * 0.5;
        nz += uz * push * 0.5;
        const pst = pantsState.get(p.key);
        if (pst) {
          let px2 = pst.x - ux * push * 0.5;
          let pz2 = pst.z - uz * push * 0.5;
          for (const b of currentBuildings) {
            if (Math.hypot(px2 - b.cx, pz2 - b.cz) > b.footRadius + 4) continue;
            for (const seg of b.walls) {
              [px2, pz2] = resolveWallCollision(px2, pz2, seg, PANTS_RADIUS + 0.12);
            }
          }
          pst.x = px2;
          pst.z = pz2;
        }
      }
    }
    for (const b of currentBuildings) {
      if (Math.hypot(nx - b.cx, nz - b.cz) > b.footRadius + 4) continue;
      for (const seg of b.walls) {
        [nx, nz] = resolveWallCollision(nx, nz, seg, LEMUR_RADIUS + 0.12);
      }
    }
    st.x = nx;
    st.z = nz;
    st.legPhase += dt * 6;
    if (st.walkTimer <= 0) {
      st.pauseTimer = LEMUR_PAUSE_MIN + Math.random() * (LEMUR_PAUSE_MAX - LEMUR_PAUSE_MIN);
    }
  }
}

function lemurSegments(l) {
  const bodyLen = LEMUR_BODY_LEN, bodyH = LEMUR_BODY_HEIGHT, bodyW = LEMUR_BODY_WIDTH;
  const bob = Math.abs(Math.sin(l.legPhase)) * 0.05;
  const bodyY = l.y + bodyH + bob;
  const fx = Math.sin(l.heading), fz = Math.cos(l.heading);
  const rx = Math.cos(l.heading), rz = -Math.sin(l.heading);
  const pt = (right, fwd, up) => ({
    x: l.x + rx * right + fx * fwd,
    y: up,
    z: l.z + rz * right + fz * fwd,
  });

  const frontTL = pt(-bodyW, bodyLen / 2, bodyY + bodyH / 2);
  const frontTR = pt(bodyW, bodyLen / 2, bodyY + bodyH / 2);
  const frontBL = pt(-bodyW, bodyLen / 2, bodyY - bodyH / 2);
  const frontBR = pt(bodyW, bodyLen / 2, bodyY - bodyH / 2);
  const backTL = pt(-bodyW * 0.8, -bodyLen / 2, bodyY + bodyH * 0.4);
  const backTR = pt(bodyW * 0.8, -bodyLen / 2, bodyY + bodyH * 0.4);
  const backBL = pt(-bodyW * 0.8, -bodyLen / 2, bodyY - bodyH * 0.4);
  const backBR = pt(bodyW * 0.8, -bodyLen / 2, bodyY - bodyH * 0.4);

  const earL = pt(-bodyW * 0.5, bodyLen / 2 + 0.15, bodyY + bodyH * 0.9);
  const earR = pt(bodyW * 0.5, bodyLen / 2 + 0.15, bodyY + bodyH * 0.9);

  const tailBase = pt(0, -bodyLen / 2, bodyY);
  const tailMid = pt(0, -bodyLen / 2 - LEMUR_TAIL_LEN * 0.5, bodyY + LEMUR_TAIL_LEN * 0.5);
  const tailTip = pt(0, -bodyLen / 2 - LEMUR_TAIL_LEN * 0.3, bodyY + LEMUR_TAIL_LEN * 0.9);

  return [
    [frontTL, frontTR], [frontTR, frontBR], [frontBR, frontBL], [frontBL, frontTL],
    [backTL, backTR], [backTR, backBR], [backBR, backBL], [backBL, backTL],
    [frontTL, backTL], [frontTR, backTR], [frontBL, backBL], [frontBR, backBR],
    [frontTL, earL], [frontTR, earR],
    [tailBase, tailMid], [tailMid, tailTip],
  ];
}

function sphereSegments(cx, footY, cz, R, vScale, hScale, tipY) {
  const segs = [];
  const N = 8;
  const centerY = footY + R * vScale;
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
  const top = { x: cx, y: centerY + R * vScale, z: cz };
  const bottom = { x: cx, y: footY, z: cz };
  for (let i = 0; i < N; i++) {
    segs.push([rings[rings.length - 1][i], top]);
    segs.push([rings[0][i], bottom]);
  }
  const eye = { x: cx, y: tipY, z: cz };
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

function clipPolygonNear(points) {
  const result = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const cur = points[i];
    const next = points[(i + 1) % n];
    const curIn = cur.z > NEAR;
    const nextIn = next.z > NEAR;
    if (curIn) result.push(cur);
    if (curIn !== nextIn) {
      const t = (NEAR - cur.z) / (next.z - cur.z);
      result.push(lerp3(cur, next, t));
    }
  }
  return result;
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
const collectedBacon = new RespawnSet(BACON_RESPAWN_TIMEOUT);
let currentTrees = [];
let currentRocks = [];
let currentBacon = [];
let currentPants = [];
let currentLemurs = [];
let baconPopups = [];
let baconDespawns = [];
let started = false;
let squishPhase = 0;
let squishValue = 0;
let squishVel = 0;
let currentSpeed = 0;
let playerAirY = 0;
let playerVY = 0;
let jumpRequested = false;
let stamina = 1;
let staminaExhausted = false;
let staminaBarOpacity = 0;
const keys = { forward: false, backward: false, left: false, right: false, space: false, shift: false };

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

function spawnBaconPopup(x, y, z, points) {
  baconPopups.push({ x, y, z, age: 0, text: `+${points}` });
}

function updateBaconPopups(dt) {
  for (const p of baconPopups) p.age += dt;
  baconPopups = baconPopups.filter((p) => p.age < BACON_POPUP_DURATION);
}

function triggerBaconDespawn(item) {
  const scale = item.scale || 1;
  const sizeFactor = Math.min(2.5, Math.sqrt(scale));
  const count = BACON_DESPAWN_PARTICLE_COUNT + (item.boss ? 5 : 0);
  const particles = [];
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    particles.push({
      dx: Math.sin(theta),
      dz: Math.cos(theta),
      dy: 0.4 + Math.random() * 0.8,
      dist: BACON_DESPAWN_PARTICLE_DIST * sizeFactor * (0.7 + Math.random() * 0.6),
    });
  }
  baconDespawns.push({
    x: item.x, y: item.y, z: item.z, rot: item.rot, scale,
    boss: !!item.boss, sizeFactor, age: 0, particles,
  });
}

function updateBaconDespawns(dt) {
  for (const d of baconDespawns) d.age += dt;
  baconDespawns = baconDespawns.filter((d) => d.age < BACON_DESPAWN_TOTAL_DURATION);
}

function resetWorld(newSeed) {
  SEED = newSeed;
  player = { x: 0, z: 0, heading: 0 };
  baconCollected = 0;
  pantsScared = 0;
  collectedBacon.clear();
  pantsState.clear();
  goneKeys.clear();
  baconPopups = [];
  baconDespawns = [];
  lemurState.clear();
  baconMillState.clear();
  birdFlockState.clear();
  goneBirdFlocks.clear();
  currentBirds = [];
  treeWobbles.clear();
  skyTime = 0;
  squishPhase = 0;
  squishValue = 0;
  squishVel = 0;
  currentSpeed = 0;
  playerAirY = 0;
  playerVY = 0;
  jumpRequested = false;
  stamina = 1;
  staminaExhausted = false;
  staminaBarOpacity = 0;
  lakeCache.clear();
  currentLakes = [];
  gridCacheGX = null;
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

function segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1x = bx - ax, d1z = bz - az;
  const d2x = dx - cx, d2z = dz - cz;
  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((cx - ax) * d2z - (cz - az) * d2x) / denom;
  const u = ((cx - ax) * d1z - (cz - az) * d1x) / denom;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

function wallBlocksLineOfSight(ax, az, bx, bz) {
  for (const b of currentBuildings) {
    for (const seg of b.walls) {
      if (segmentsIntersect(ax, az, bx, bz, seg.ax, seg.az, seg.bx, seg.bz)) return true;
    }
  }
  return false;
}

function update(dt) {
  if (keys.left) player.heading -= TURN_SPEED * dt;
  if (keys.right) player.heading += TURN_SPEED * dt;

  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  const hasMoveInput = keys.forward || keys.backward;
  const wantsSprint = keys.shift && !staminaExhausted && stamina > 0;
  const sprinting = wantsSprint && hasMoveInput;
  const sprintMul = wantsSprint ? SPRINT_MULTIPLIER : 1;
  const noticeMultiplier = sprinting ? RUNNING_NOTICE_MULTIPLIER : 1;

  if (sprinting) {
    stamina = Math.max(0, stamina - STAMINA_DRAIN_RATE * dt);
    if (stamina <= 0) staminaExhausted = true;
  } else if (stamina < 1) {
    stamina = Math.min(1, stamina + STAMINA_REFILL_RATE * dt);
    if (stamina >= 1) staminaExhausted = false;
  }
  const staminaBarTarget = sprinting || stamina < 1 ? 1 : 0;
  const barDiff = staminaBarTarget - staminaBarOpacity;
  staminaBarOpacity += Math.sign(barDiff) * Math.min(Math.abs(barDiff), STAMINA_BAR_FADE_SPEED * dt);

  let targetSpeed = 0;
  if (keys.forward) targetSpeed += MOVE_SPEED * sprintMul;
  if (keys.backward) targetSpeed -= MOVE_SPEED_BACK * sprintMul;
  const rate = Math.abs(targetSpeed) > Math.abs(currentSpeed) ? NUBBY_ACCEL : NUBBY_DECEL;
  const maxDelta = rate * dt;
  const speedDiff = targetSpeed - currentSpeed;
  if (Math.abs(speedDiff) <= maxDelta) currentSpeed = targetSpeed;
  else currentSpeed += Math.sign(speedDiff) * maxDelta;
  const moveAmt = currentSpeed * dt;

  if (jumpRequested) {
    jumpRequested = false;
    if (playerAirY <= 0) playerVY = JUMP_VELOCITY;
  }
  if (playerAirY > 0 || playerVY !== 0) {
    playerVY -= JUMP_GRAVITY * dt;
    playerAirY += playerVY * dt;
    if (playerAirY <= 0) {
      playerAirY = 0;
      playerVY = 0;
    }
  }

  updateTreeWobbles(dt);
  currentLakes = getNearbyLakes(player.x, player.z);
  currentBuildings = getNearbyBuildings(player.x, player.z);
  currentTrees = getNearbyTrees(player.x, player.z);
  currentRocks = getNearbyRocks(player.x, player.z);
  updateBaconMilling(dt);
  refreshCurrentBacon();
  updateLemurs(dt);
  currentLemurs = getNearbyLemurs(player.x, player.z);
  const scares = updatePants(dt, noticeMultiplier);
  currentPants = getNearbyPants(player.x, player.z);
  refreshBirdFlocks(player.x, player.z);
  updateBirdFlocks(dt, noticeMultiplier);
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
        triggerTreeWobble(t.key, -dx / dist, -dz / dist);
      }
    }
    for (const r of currentRocks) {
      if (playerAirY > rockHeight(r.scale)) continue;
      const dx = nx - r.x, dz = nz - r.z;
      const dist = Math.hypot(dx, dz);
      const minDist = CHAR_RADIUS + ROCK_RADIUS * r.scale;
      if (dist > 0.0001 && dist < minDist) {
        const push = minDist - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      }
    }
    for (const l of currentLemurs) {
      if (playerAirY > LEMUR_JUMP_CLEAR_HEIGHT) continue;
      const dx = nx - l.x, dz = nz - l.z;
      const dist = Math.hypot(dx, dz);
      const minDist = CHAR_RADIUS + LEMUR_RADIUS;
      if (dist > 0.0001 && dist < minDist) {
        const push = minDist - dist;
        const ux = dx / dist, uz = dz / dist;
        nx += ux * push * 0.5;
        nz += uz * push * 0.5;
        const lst = lemurState.get(l.key);
        if (lst) {
          lst.x -= ux * push * 0.5;
          lst.z -= uz * push * 0.5;
        }
      }
    }
    for (const p of currentPants) {
      if (playerAirY > PANTS_JUMP_CLEAR_HEIGHT) continue;
      const dx = nx - p.x, dz = nz - p.z;
      const dist = Math.hypot(dx, dz);
      const minDist = CHAR_RADIUS + PANTS_RADIUS;
      if (dist > 0.0001 && dist < minDist) {
        const push = minDist - dist;
        const ux = dx / dist, uz = dz / dist;
        nx += ux * push * 0.5;
        nz += uz * push * 0.5;
        const pst = pantsState.get(p.key);
        if (pst) {
          let px2 = pst.x - ux * push * 0.5;
          let pz2 = pst.z - uz * push * 0.5;
          for (const b of currentBuildings) {
            if (Math.hypot(px2 - b.cx, pz2 - b.cz) > b.footRadius + 4) continue;
            for (const seg of b.walls) {
              [px2, pz2] = resolveWallCollision(px2, pz2, seg, PANTS_RADIUS + 0.12);
            }
          }
          pst.x = px2;
          pst.z = pz2;
        }
      }
    }
    for (const b of currentBuildings) {
      if (Math.hypot(nx - b.cx, nz - b.cz) > b.footRadius + 4) continue;
      for (const seg of b.walls) {
        [nx, nz] = resolveWallCollision(nx, nz, seg, CHAR_RADIUS + 0.12);
      }
    }
    for (const l of currentLakes) {
      const dx = nx - l.cx, dz = nz - l.cz;
      const dist = Math.hypot(dx, dz);
      const minDist = CHAR_RADIUS + l.radius;
      if (dist > 0.0001 && dist < minDist) {
        const push = minDist - dist;
        nx += (dx / dist) * push;
        nz += (dz / dist) * push;
      }
    }
    player.x = nx;
    player.z = nz;
    squishPhase += Math.abs(moveAmt) * 1.6;
    const newSquish = Math.sin(squishPhase) * SQUISH_AMOUNT;
    squishVel = (newSquish - squishValue) / dt;
    squishValue = newSquish;
  } else if (squishValue !== 0 || squishVel !== 0) {
    const accel = -SQUISH_SETTLE_K * squishValue - SQUISH_SETTLE_C * squishVel;
    squishVel += accel * dt;
    squishValue += squishVel * dt;
    if (Math.abs(squishValue) < 0.002 && Math.abs(squishVel) < 0.02) {
      squishValue = 0;
      squishVel = 0;
    }
  }

  for (const item of currentBacon) {
    const touchRadius = item.boss ? BACON_BOSS_TOUCH_RADIUS : BACON_TOUCH_RADIUS;
    if (Math.hypot(item.x - player.x, item.z - player.z) < touchRadius) {
      collectedBacon.add(item.key);
      const points = item.scale || 1;
      baconCollected += points;
      spawnBaconPopup(item.x, item.y + NUBBY_TIP_HEIGHT, item.z, points);
      triggerBaconDespawn(item);
      if (baconCollected > bestBacon) {
        bestBacon = baconCollected;
        localStorage.setItem(BEST_BACON_KEY, String(bestBacon));
      }
    }
  }
  currentBacon = currentBacon.filter((item) => !collectedBacon.has(item.key));
  updateBaconPopups(dt);
  updateBaconDespawns(dt);

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

let bandPaths = { grid: [] };

function strokeWireItem(segs, cam, color, lineWidth, blur) {
  const path = new Path2D();
  let any = false;
  for (const [a, b] of segs) {
    const pa = project(a.x, a.y, a.z, cam), pb = project(b.x, b.y, b.z, cam);
    const clipped = clipNear(pa, pb);
    if (!clipped) continue;
    const [ca, cb] = clipped;
    const sa = toScreen(ca), sb = toScreen(cb);
    path.moveTo(sa.sx, sa.sy);
    path.lineTo(sb.sx, sb.sy);
    any = true;
  }
  if (!any) return;
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.stroke(path);
}

function drawWallItem(it, cam) {
  const a = project(it.seg.ax, it.padHeight, it.seg.az, cam);
  const b = project(it.seg.bx, it.padHeight, it.seg.bz, cam);
  const c = project(it.seg.bx, it.padHeight + WALL_HEIGHT, it.seg.bz, cam);
  const d = project(it.seg.ax, it.padHeight + WALL_HEIGHT, it.seg.az, cam);
  const poly = clipPolygonNear([a, b, c, d]);
  if (poly.length < 3) return;
  const screenPts = poly.map(toScreen);
  const t = Math.min(1, Math.max(0, it.dist / MAX_DIST));
  const fillA = lerp(0.55, 0, t);
  const edgeA = lerp(1, 0, t);
  ctx.beginPath();
  ctx.moveTo(screenPts[0].sx, screenPts[0].sy);
  for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i].sx, screenPts[i].sy);
  ctx.closePath();
  ctx.fillStyle = `rgba(16,20,28,${fillA.toFixed(3)})`;
  ctx.shadowBlur = 0;
  ctx.fill();
  const edgeColor = `rgba(${BUILDING_NEAR[0]},${BUILDING_NEAR[1]},${BUILDING_NEAR[2]},${edgeA.toFixed(3)})`;
  ctx.shadowBlur = GLOW_BLUR;
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = edgeColor;
  ctx.shadowColor = edgeColor;
  ctx.stroke();
}

function riverArcLengths(river) {
  const lens = [0];
  for (let i = 1; i < river.length; i++) {
    lens.push(lens[i - 1] + Math.hypot(river[i].x - river[i - 1].x, river[i].z - river[i - 1].z));
  }
  return lens;
}

function pointAtArcLength(river, lens, target) {
  const total = lens[lens.length - 1];
  if (target <= 0) return river[0];
  if (target >= total) return river[river.length - 1];
  for (let i = 1; i < lens.length; i++) {
    if (lens[i] >= target) {
      const segLen = lens[i] - lens[i - 1];
      const t = segLen > 0 ? (target - lens[i - 1]) / segLen : 0;
      const a = river[i - 1], b = river[i];
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
    }
  }
  return river[river.length - 1];
}

function riverBankPoints(river) {
  const left = [], right = [];
  for (let i = 0; i < river.length; i++) {
    const p = river[i];
    const prev = river[Math.max(0, i - 1)];
    const next = river[Math.min(river.length - 1, i + 1)];
    const dx = next.x - prev.x, dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len;
    left.push({ x: p.x + nx * RIVER_HALF_WIDTH, y: p.y, z: p.z + nz * RIVER_HALF_WIDTH });
    right.push({ x: p.x - nx * RIVER_HALF_WIDTH, y: p.y, z: p.z - nz * RIVER_HALF_WIDTH });
  }
  return { left, right };
}

// Rivers are rendered as a filled ribbon (per segment, so near-plane clipping stays correct)
// plus glowing bank edges and a handful of short flow ticks that march from the lake outward
// over time — `pos` increases with skyTime and river points are ordered lake-edge-first, so
// the ticks always travel away from the lake, matching how rivers actually flow.
function drawRiver(river, cam, dist) {
  const lens = riverArcLengths(river);
  const total = lens[lens.length - 1];
  const { left, right } = riverBankPoints(river);
  const t = Math.min(1, Math.max(0, dist / MAX_DIST));

  ctx.shadowBlur = 0;
  ctx.fillStyle = `rgba(${WATER_NEAR[0]},${WATER_NEAR[1]},${WATER_NEAR[2]},${lerp(0.35, 0, t).toFixed(3)})`;
  for (let i = 0; i < river.length - 1; i++) {
    const a = project(left[i].x, left[i].y, left[i].z, cam);
    const b = project(left[i + 1].x, left[i + 1].y, left[i + 1].z, cam);
    const c = project(right[i + 1].x, right[i + 1].y, right[i + 1].z, cam);
    const d = project(right[i].x, right[i].y, right[i].z, cam);
    const poly = clipPolygonNear([a, b, c, d]);
    if (poly.length < 3) continue;
    const screenPts = poly.map(toScreen);
    ctx.beginPath();
    ctx.moveTo(screenPts[0].sx, screenPts[0].sy);
    for (let j = 1; j < screenPts.length; j++) ctx.lineTo(screenPts[j].sx, screenPts[j].sy);
    ctx.closePath();
    ctx.fill();
  }

  const bankSegs = [];
  for (let i = 0; i < river.length - 1; i++) {
    bankSegs.push([left[i], left[i + 1]]);
    bankSegs.push([right[i], right[i + 1]]);
  }
  strokeWireItem(bankSegs, cam, itemColor(WATER_NEAR, dist), 1, GLOW_BLUR);

  const flowSegs = [];
  const phase = (skyTime * RIVER_FLOW_SPEED) % RIVER_FLOW_MARK_SPACING;
  const markCount = Math.floor(total / RIVER_FLOW_MARK_SPACING);
  for (let k = 0; k <= markCount; k++) {
    const pos = k * RIVER_FLOW_MARK_SPACING + phase;
    if (pos > total) continue;
    const pt = pointAtArcLength(river, lens, pos);
    const pt2 = pointAtArcLength(river, lens, Math.min(total, pos + 0.5));
    const ddx = pt2.x - pt.x, ddz = pt2.z - pt.z;
    const len = Math.hypot(ddx, ddz) || 1;
    const tx = ddx / len, tz = ddz / len;
    const half = RIVER_FLOW_MARK_LEN / 2;
    flowSegs.push([
      { x: pt.x - tx * half, y: pt.y + 0.02, z: pt.z - tz * half },
      { x: pt.x + tx * half, y: pt.y + 0.02, z: pt.z + tz * half },
    ]);
  }
  strokeWireItem(flowSegs, cam, WATER_FLOW_COLOR, 2, GLOW_BLUR * 1.3);
}

function drawLake(l, cam) {
  const N = 24;
  const ring = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    ring.push({ x: l.cx + Math.cos(a) * l.radius, y: l.waterY, z: l.cz + Math.sin(a) * l.radius });
  }
  const projPts = ring.map((p) => project(p.x, p.y, p.z, cam));
  const poly = clipPolygonNear(projPts);
  if (poly.length < 3) return;
  const screenPts = poly.map(toScreen);
  const centerProj = project(l.cx, l.waterY, l.cz, cam);
  const t = Math.min(1, Math.max(0, centerProj.z / MAX_DIST));

  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(screenPts[0].sx, screenPts[0].sy);
  for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i].sx, screenPts[i].sy);
  ctx.closePath();
  ctx.fillStyle = `rgba(${WATER_NEAR[0]},${WATER_NEAR[1]},${WATER_NEAR[2]},${lerp(0.4, 0, t).toFixed(3)})`;
  ctx.fill();

  const rimSegs = [];
  for (let i = 0; i < N; i++) rimSegs.push([ring[i], ring[(i + 1) % N]]);
  const shimmer = 0.75 + Math.sin(skyTime * 0.6 + l.cx) * 0.25;
  strokeWireItem(rimSegs, cam, itemColor(WATER_NEAR, centerProj.z), 1.4, GLOW_BLUR * shimmer);

  if (l.river) drawRiver(l.river, cam, centerProj.z);
}

function drawSceneObjects(cam) {
  const items = [];
  for (const l of currentLakes) {
    const c = project(l.cx, l.waterY, l.cz, cam);
    if (c.z < NEAR - 3 || c.z > MAX_DIST + l.radius + 40) continue;
    items.push({ type: "lake", dist: c.z, obj: l });
  }
  for (const t of currentTrees) {
    const c = project(t.x, t.y, t.z, cam);
    if (c.z < NEAR - 3 || c.z > MAX_DIST + 5) continue;
    items.push({ type: "tree", dist: c.z, obj: t });
  }
  for (const it of currentBacon) {
    const c = project(it.x, it.y, it.z, cam);
    if (c.z < NEAR - 3 || c.z > MAX_DIST + 5) continue;
    items.push({ type: "bacon", dist: c.z, obj: it });
  }
  for (const p of currentPants) {
    const c = project(p.x, p.y + 0.25, p.z, cam);
    if (c.z < NEAR - 3 || c.z > MAX_DIST + 5) continue;
    items.push({ type: "pants", dist: c.z, obj: p });
  }
  for (const r of currentRocks) {
    const c = project(r.x, r.y, r.z, cam);
    if (c.z < NEAR - 3 || c.z > MAX_DIST + 5) continue;
    items.push({ type: "rock", dist: c.z, obj: r });
  }
  for (const l of currentLemurs) {
    const c = project(l.x, l.y + 0.3, l.z, cam);
    if (c.z < NEAR - 3 || c.z > MAX_DIST + 5) continue;
    items.push({ type: "lemur", dist: c.z, obj: l });
  }
  for (const bird of currentBirds) {
    const c = project(bird.x, bird.y, bird.z, cam);
    if (c.z < NEAR - 3 || c.z > MAX_DIST + 5) continue;
    items.push({ type: "bird", dist: c.z, obj: bird });
  }
  for (const b of currentBuildings) {
    for (const seg of b.walls) {
      const midx = (seg.ax + seg.bx) / 2, midz = (seg.az + seg.bz) / 2;
      const c = project(midx, b.padHeight + WALL_HEIGHT / 2, midz, cam);
      if (c.z < NEAR - 3 || c.z > MAX_DIST + 15) continue;
      items.push({ type: "wall", dist: c.z, seg, padHeight: b.padHeight });
    }
  }
  items.sort((a, b) => b.dist - a.dist);

  for (const it of items) {
    if (it.type === "tree") {
      strokeWireItem(treeSegments(it.obj), cam, itemColor(TREE_NEAR, it.dist), 1, GLOW_BLUR);
    } else if (it.type === "bacon") {
      const w = it.obj.boss ? 2.4 : 1.4;
      const blur = it.obj.boss ? BACON_GLOW_BLUR * 1.6 : BACON_GLOW_BLUR;
      strokeWireItem(baconSegments(it.obj), cam, itemColor(BACON_NEAR, it.dist), w, blur);
    } else if (it.type === "pants") {
      strokeWireItem(pantsSegments(it.obj), cam, itemColor(PANTS_NEAR, it.dist), 1.8, GLOW_BLUR);
    } else if (it.type === "rock") {
      strokeWireItem(rockSegments(it.obj), cam, itemColor(ROCK_NEAR, it.dist), 1, GLOW_BLUR);
    } else if (it.type === "lemur") {
      strokeWireItem(lemurSegments(it.obj), cam, itemColor(LEMUR_NEAR, it.dist), 1.4, GLOW_BLUR);
    } else if (it.type === "bird") {
      strokeWireItem(birdSegments(it.obj), cam, itemColor(BIRD_NEAR, it.dist), 1.2, GLOW_BLUR);
    } else if (it.type === "lake") {
      drawLake(it.obj, cam);
    } else {
      drawWallItem(it, cam);
    }
  }
  ctx.shadowBlur = 0;
}

function drawThoughtBubble(sx, sy, text, alpha, fontSize = 13) {
  const scale = fontSize / 13;
  ctx.font = `${fontSize}px system-ui, sans-serif`;
  const padX = 9 * scale, padY = 6 * scale;
  const metrics = ctx.measureText(text);
  const w = metrics.width + padX * 2;
  const h = 14 * scale + padY * 2;
  const bx = sx - w / 2, by = sy - h - 16 * scale;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.strokeStyle = "rgba(20,20,30,0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 9 * scale);
  else ctx.rect(bx, by, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx - 5 * scale, by + h + 5 * scale, 4 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sx - 1 * scale, by + h + 13 * scale, 2.3 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(20,20,30,0.92)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, sx, by + h / 2 + 1);
  ctx.globalAlpha = 1;
}

function drawPantsBubbles(cam) {
  for (const p of currentPants) {
    if (!p.bubbleTimer || p.bubbleTimer <= 0) continue;
    const headY = p.y + PANTS_LEG_LEN + PANTS_BELT_HEIGHT + 0.3;
    const proj = project(p.x, headY, p.z, cam);
    if (proj.z <= NEAR) continue;
    const screen = toScreen(proj);
    const alpha = Math.min(1, p.bubbleTimer / 0.35);
    drawThoughtBubble(screen.sx, screen.sy, p.bubbleText, alpha, p.bubbleFontSize || 13);
  }
}

function drawSpeechBubble(sx, sy, text, alpha) {
  ctx.font = "13px system-ui, sans-serif";
  const padX = 9, padY = 6;
  const metrics = ctx.measureText(text);
  const w = metrics.width + padX * 2;
  const h = 14 + padY * 2;
  const bx = sx - w / 2, by = sy - h - 16;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.strokeStyle = "rgba(20,20,30,0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 8);
  else ctx.rect(bx, by, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx - 6, by + h - 1);
  ctx.lineTo(sx + 2, by + h + 12);
  ctx.lineTo(sx + 9, by + h - 1);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(20,20,30,0.92)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, sx, by + h / 2 + 1);
  ctx.globalAlpha = 1;
}

function drawBirdBubbles(cam) {
  for (const st of birdFlockState.values()) {
    if (!st.bubbleTimer || st.bubbleTimer <= 0) continue;
    const groundY = terrainHeight(st.x, st.z);
    const headY = groundY + (st.flying ? BIRD_RISE_HEIGHT * 0.6 : 0.4);
    const proj = project(st.x, headY, st.z, cam);
    if (proj.z <= NEAR) continue;
    const screen = toScreen(proj);
    const alpha = Math.min(1, st.bubbleTimer / 0.35);
    drawSpeechBubble(screen.sx, screen.sy, st.bubbleText, alpha);
  }
}

function drawBaconDespawns(cam) {
  for (const d of baconDespawns) {
    const w = d.boss ? 2.4 : 1.4;
    const blur = d.boss ? BACON_GLOW_BLUR * 1.6 : BACON_GLOW_BLUR;
    const camDist = project(d.x, d.y, d.z, cam).z;
    const color = itemColor(BACON_NEAR, camDist);
    if (d.age < BACON_DESPAWN_BOUNCE_DURATION) {
      const t = d.age / BACON_DESPAWN_BOUNCE_DURATION;
      const bounceY = Math.sin(t * Math.PI) * BACON_DESPAWN_BOUNCE_HEIGHT * d.sizeFactor * 0.5;
      const segs = baconSegments({ x: d.x, y: d.y + bounceY, z: d.z, rot: d.rot, scale: d.scale });
      strokeWireItem(segs, cam, color, w, blur);
    } else {
      const t2 = (d.age - BACON_DESPAWN_BOUNCE_DURATION) / BACON_DESPAWN_POP_DURATION;
      const alpha = Math.max(0, 1 - t2);
      const innerT = Math.max(0, t2 - 0.15);
      const segs = d.particles.map((p) => [
        { x: d.x + p.dx * p.dist * innerT * 0.6, y: d.y + p.dy * p.dist * innerT * 0.6, z: d.z + p.dz * p.dist * innerT * 0.6 },
        { x: d.x + p.dx * p.dist * t2, y: d.y + p.dy * p.dist * t2, z: d.z + p.dz * p.dist * t2 },
      ]);
      ctx.globalAlpha = alpha;
      strokeWireItem(segs, cam, color, w, blur);
      ctx.globalAlpha = 1;
    }
  }
}

function drawStaminaBar(cam) {
  if (staminaBarOpacity <= 0.001) return;
  const headY = terrainHeight(player.x, player.z) + NUBBY_TIP_HEIGHT + 0.5;
  const proj = project(player.x, headY, player.z, cam);
  if (proj.z <= NEAR) return;
  const screen = toScreen(proj);

  const w = STAMINA_BAR_WIDTH, h = STAMINA_BAR_HEIGHT;
  const bx = screen.sx - w / 2, by = screen.sy - h / 2;
  ctx.globalAlpha = staminaBarOpacity;

  ctx.fillStyle = "rgba(13,15,20,0.75)";
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 4);
  else ctx.rect(bx, by, w, h);
  ctx.fill();
  ctx.stroke();

  const pad = 1.5;
  const fillW = Math.max(0, (w - pad * 2) * stamina);
  ctx.fillStyle = stamina > 0.3 ? "#4dff9f" : "#ff4d8d";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx + pad, by + pad, fillW, h - pad * 2, 2);
  else ctx.rect(bx + pad, by + pad, fillW, h - pad * 2);
  ctx.fill();

  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 4;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.fillText(`${Math.round(stamina * 100)}%`, screen.sx, by - 9);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawCompass() {
  const cx = COMPASS_LEFT_MARGIN, cy = COMPASS_TOP_MARGIN, r = COMPASS_RADIUS;
  const ringColor = "rgba(90,170,210,0.6)";

  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = GLOW_BLUR;
  ctx.shadowColor = ringColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Fixed marker at the top of the ring shows "straight ahead" — the cardinal labels
  // rotate around it as the player turns, same convention as `celestialScreenPos`.
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cx, cy - r - 8);
  ctx.lineTo(cx - 4, cy - r - 1);
  ctx.lineTo(cx + 4, cy - r - 1);
  ctx.closePath();
  ctx.fill();

  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const dir of COMPASS_DIRS) {
    const rel = angleDiff(dir.azimuth, player.heading);
    const x = cx + Math.sin(rel) * r;
    const y = cy - Math.cos(rel) * r;
    ctx.fillStyle = dir.label === "N" ? "#ff4d8d" : "#ffffff";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.fillText(dir.label, x, y);
    ctx.shadowBlur = 0;
  }
}

function drawBaconPopups(cam) {
  for (const p of baconPopups) {
    const t = p.age / BACON_POPUP_DURATION;
    const proj = project(p.x, p.y + t * BACON_POPUP_RISE, p.z, cam);
    if (proj.z <= NEAR) continue;
    const screen = toScreen(proj);
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const color = `rgb(${BACON_NEAR[0]},${BACON_NEAR[1]},${BACON_NEAR[2]})`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.fillText(p.text, screen.sx, screen.sy);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
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

  drawSkyBodies();

  bandPaths = { grid: [] };
  for (let i = 0; i < BANDS; i++) {
    bandPaths.grid.push(new Path2D());
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

  ctx.lineWidth = 1;
  ctx.shadowBlur = GLOW_BLUR;
  for (let i = 0; i < BANDS; i++) {
    ctx.shadowColor = gridBandColor[i];
    ctx.strokeStyle = gridBandColor[i];
    ctx.stroke(bandPaths.grid[i]);
  }
  ctx.shadowBlur = 0;

  drawSceneObjects(cam);

  const R = CHAR_RADIUS;
  const py = terrainHeight(player.x, player.z) + playerAirY;
  const footY = py;
  const tipY = py + NUBBY_TIP_HEIGHT;
  const vScale = 1 + squishValue;
  const hScale = 1 - squishValue;
  const nub = sphereSegments(player.x, footY, player.z, R, vScale, hScale, tipY);
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

  drawPantsBubbles(cam);
  drawBirdBubbles(cam);
  drawBaconDespawns(cam);
  drawBaconPopups(cam);
  drawStaminaBar(cam);
  drawCompass();
}

let lastTime = null;
function loop(now) {
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05);
  skyTime += dt;
  if (started) {
    update(dt);
  } else {
    currentLakes = getNearbyLakes(player.x, player.z);
    currentBuildings = getNearbyBuildings(player.x, player.z);
    currentTrees = getNearbyTrees(player.x, player.z);
    currentRocks = getNearbyRocks(player.x, player.z);
    refreshCurrentBacon();
    currentPants = getNearbyPants(player.x, player.z);
    currentLemurs = getNearbyLemurs(player.x, player.z);
    refreshBirdFlocks(player.x, player.z);
    rebuildCurrentBirds();
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
  } else if (e.code === "Space") {
    if (!keys.space) jumpRequested = true;
    keys.space = true;
    e.preventDefault();
  } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    keys.shift = true;
  }
});
window.addEventListener("keyup", (e) => {
  const dir = KEY_MAP[e.code];
  if (dir) keys[dir] = false;
  else if (e.code === "Space") keys.space = false;
  else if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.shift = false;
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
