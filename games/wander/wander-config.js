// Player-editable tuning knobs (#24), shared between wander.js (the game) and settings.html
// (the editable sheet) so both always agree on the defaults and the localStorage key.
//
// Most of the world (trees/rocks/pants/lemurs/birds/buildings) regenerates fresh every frame
// straight from these values with no caching, so changes apply immediately to unexplored
// areas. Lakes are the one exception (cached per-session — river pathing is too expensive to
// redo every frame, see buildLake in wander.js), so a lake/river-density change only fully
// takes hold after "New World". Sizes are stored as a %± adjustment from the original base
// value rather than an absolute override, so the sheet always reads relative to what the game
// originally shipped with.
const CONFIG_STORAGE_KEY = "meatflap-wander-config";
const CONFIG_DEFAULTS = {
  treeDensity: 0.16,
  rockDensity: 0.16,
  buildingDensity: 0.28,
  lemurDensity: 0.05,
  lakeDensity: 0.2,
  riverChance: 0.75,
  pantsDensity: 0.09,
  pantsRoomChance: 0.15,
  birdFlockDensity: 0.06,
  birdSchoolMin: 1,
  birdSchoolMax: 12,
  bossBaconChance: 0.1,
  dayNightSeconds: 120,
  moveSpeed: 9,
  accel: 30,
  decel: 45,
  sprintMultiplier: 1.6,
  staminaDrainSeconds: 7,
  staminaRefillSeconds: 5,
  pantsNoticeRadius: 7,
  pantsFleeSpeed: 9.5,
  birdNoticeRadius: 6,
  birdFleeSpeed: 11,
  fishEventMinSeconds: 7,
  fishEventMaxSeconds: 16,
  fishSchoolMin: 1,
  fishSchoolMax: 6,
  treeSizePercent: 0,
  rockSizePercent: 0,
  bossBaconSizePercent: 0,
};

function loadWanderConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return { ...CONFIG_DEFAULTS };
    return { ...CONFIG_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}
