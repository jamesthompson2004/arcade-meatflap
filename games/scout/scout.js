const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bonesEl = document.getElementById("bones");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const overlaySub = document.getElementById("overlay-sub");
const restartBtn = document.getElementById("restart-btn");

const W = canvas.width;
const H = canvas.height;
const GROUND_Y = H - 34;
const BEST_KEY = "meatflap-scout-best";

const GRAVITY = 0.7;
const JUMP_VELOCITY = -12.5;
const BASE_SPEED = 4.2;
const MAX_SPEED_BONUS = 3.5;
const DOG_X = 70;
const NORMAL_HEIGHT = 34;
const DUCK_HEIGHT = 18;
const DOG_WIDTH = 42;

const CHAPTERS = [
  { at: 0, name: "Chapter 1 — The Backyard", sky: ["#1a2740", "#10141c"], ground: "#22304a" },
  { at: 900, name: "Chapter 2 — The Park", sky: ["#173a2e", "#10141c"], ground: "#1f4535" },
  { at: 2200, name: "Chapter 3 — The Forest", sky: ["#131a33", "#0d0f14"], ground: "#182238" },
  { at: 4000, name: "Chapter 4 — The Beach", sky: ["#26495a", "#10141c"], ground: "#2c5264" },
  { at: 6500, name: "Chapter 5 — Home Again", sky: ["#3a2140", "#10141c"], ground: "#402850" },
];

let dog, obstacles, bones, distance, gameSpeed, bonesCollected, best, state, frame;
let chapterIndex, banner, nextObstacleAt, nextBoneAt, duckHeld, loopId;

function resetState() {
  dog = { y: GROUND_Y - NORMAL_HEIGHT, vy: 0, grounded: true, ducking: false };
  obstacles = [];
  bones = [];
  distance = 0;
  gameSpeed = BASE_SPEED;
  bonesCollected = 0;
  best = Number(localStorage.getItem(BEST_KEY) || 0);
  state = "waiting";
  frame = 0;
  chapterIndex = 0;
  banner = { text: "", timer: 0 };
  nextObstacleAt = 300;
  nextBoneAt = 500;
  duckHeld = false;
  updateHud();
  overlay.classList.remove("hidden");
  overlayText.textContent = "Scout smells an adventure.";
  overlaySub.textContent = "Jump the junk, duck the branches, grab every bone.";
  restartBtn.textContent = "Let's Go";
  draw();
}

function updateHud() {
  scoreEl.textContent = Math.floor(distance / 10) + bonesCollected * 5;
  bonesEl.textContent = bonesCollected;
  bestEl.textContent = best;
}

function currentChapter() {
  return CHAPTERS[chapterIndex];
}

function startRun() {
  state = "playing";
  overlay.classList.add("hidden");
}

function jump() {
  if (state === "waiting") {
    startRun();
    return;
  }
  if (state !== "playing") return;
  if (dog.grounded && !dog.ducking) {
    dog.vy = JUMP_VELOCITY;
    dog.grounded = false;
  }
}

function setDuck(on) {
  duckHeld = on;
}

function spawnObstacle() {
  const kinds = ["can", "rock", "bush", "branch"];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  if (kind === "branch") {
    const bottomY = GROUND_Y - 26;
    obstacles.push({ type: "branch", x: W, width: 46, bottomY });
  } else {
    const height = kind === "rock" ? 24 : kind === "can" ? 38 : 30;
    const width = kind === "can" ? 24 : 32;
    obstacles.push({ type: "ground", kind, x: W, width, height });
  }
}

function spawnBone() {
  const highBone = Math.random() < 0.4;
  const y = highBone ? GROUND_Y - 80 : GROUND_Y - 16;
  bones.push({ x: W, y, taken: false });
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function update() {
  if (state !== "playing") return;

  frame++;
  distance += gameSpeed;
  gameSpeed = BASE_SPEED + Math.min(distance / 4500, 1) * MAX_SPEED_BONUS;

  dog.ducking = dog.grounded && duckHeld;
  const dogHeight = dog.ducking ? DUCK_HEIGHT : NORMAL_HEIGHT;

  if (!dog.grounded) {
    dog.vy += GRAVITY;
    dog.y += dog.vy;
    if (dog.y >= GROUND_Y - NORMAL_HEIGHT) {
      dog.y = GROUND_Y - NORMAL_HEIGHT;
      dog.vy = 0;
      dog.grounded = true;
    }
  } else {
    dog.y = GROUND_Y - dogHeight;
  }

  const dogTop = dog.y;
  const dogBottom = dog.y + dogHeight;

  obstacles.forEach((o) => (o.x -= gameSpeed));
  bones.forEach((b) => (b.x -= gameSpeed));
  obstacles = obstacles.filter((o) => o.x + o.width > -10);
  bones = bones.filter((b) => !b.taken && b.x > -20);

  if (distance > nextObstacleAt) {
    spawnObstacle();
    const gap = gameSpeed * (46 + Math.random() * 34);
    nextObstacleAt = distance + gap;
  }
  if (distance > nextBoneAt) {
    spawnBone();
    nextBoneAt = distance + 260 + Math.random() * 260;
  }

  for (const o of obstacles) {
    const hitX = DOG_X + DOG_WIDTH > o.x && DOG_X < o.x + o.width;
    if (!hitX) continue;
    if (o.type === "ground") {
      if (dogBottom > GROUND_Y - o.height) {
        endRun();
        return;
      }
    } else if (o.type === "branch") {
      if (dogTop < o.bottomY) {
        endRun();
        return;
      }
    }
  }

  for (const b of bones) {
    if (b.taken) continue;
    const boneSize = 16;
    if (rectsOverlap(DOG_X, dogTop, DOG_WIDTH, dogHeight, b.x, b.y - boneSize / 2, boneSize, boneSize)) {
      b.taken = true;
      bonesCollected += 1;
    }
  }

  const next = CHAPTERS[chapterIndex + 1];
  if (next && distance >= next.at) {
    chapterIndex += 1;
    banner = { text: currentChapter().name, timer: 110 };
  }
  if (banner.timer > 0) banner.timer -= 1;

  updateHud();
}

function drawDog() {
  const dogHeight = dog.ducking ? DUCK_HEIGHT : NORMAL_HEIGHT;
  const x = DOG_X;
  const y = dog.y;
  const bounce = dog.grounded ? Math.sin(frame / 4) * 2 : 0;

  ctx.fillStyle = "#e0a45c";

  // body
  ctx.beginPath();
  ctx.roundRect(x, y + bounce, DOG_WIDTH, dogHeight, 8);
  ctx.fill();

  // head
  ctx.beginPath();
  ctx.arc(x + DOG_WIDTH - 4, y + bounce + dogHeight * 0.35, dogHeight * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // ear
  ctx.fillStyle = "#c9863f";
  ctx.beginPath();
  ctx.moveTo(x + DOG_WIDTH + 2, y + bounce + dogHeight * 0.1);
  ctx.lineTo(x + DOG_WIDTH + 12, y + bounce + dogHeight * 0.05);
  ctx.lineTo(x + DOG_WIDTH + 4, y + bounce + dogHeight * 0.55);
  ctx.closePath();
  ctx.fill();

  // snout
  ctx.fillStyle = "#171a1c";
  ctx.beginPath();
  ctx.arc(x + DOG_WIDTH + 8, y + bounce + dogHeight * 0.42, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // tail (wag)
  const wag = Math.sin(frame / 3) * 0.5;
  ctx.strokeStyle = "#e0a45c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + bounce + dogHeight * 0.3);
  ctx.quadraticCurveTo(x - 12, y + bounce - 6 + wag * 8, x - 16, y + bounce - 14 + wag * 6);
  ctx.stroke();

  // legs
  if (dog.grounded && !dog.ducking) {
    const legPhase = Math.floor(frame / 5) % 2;
    ctx.fillStyle = "#c9863f";
    ctx.fillRect(x + 6, y + dogHeight, 6, legPhase === 0 ? 6 : 3);
    ctx.fillRect(x + DOG_WIDTH - 12, y + dogHeight, 6, legPhase === 0 ? 3 : 6);
  }
}

function drawBone(b) {
  ctx.fillStyle = "#f2ead8";
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillRect(-7, -2.5, 14, 5);
  [-7, 7].forEach((sx) => {
    ctx.beginPath();
    ctx.arc(sx, -3, 3, 0, Math.PI * 2);
    ctx.arc(sx, 3, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawObstacle(o) {
  if (o.type === "branch") {
    ctx.fillStyle = "#6b4226";
    ctx.fillRect(o.x, 0, o.width, o.bottomY);
    ctx.fillStyle = "#3f7d4f";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(o.x + 8 + i * 14, o.bottomY, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const y = GROUND_Y - o.height;
  if (o.kind === "can") {
    ctx.fillStyle = "#5b6472";
    ctx.fillRect(o.x, y, o.width, o.height);
    ctx.fillStyle = "#3d4551";
    ctx.fillRect(o.x - 2, y, o.width + 4, 6);
  } else if (o.kind === "rock") {
    ctx.fillStyle = "#7a7f8c";
    ctx.beginPath();
    ctx.roundRect(o.x, y, o.width, o.height, 6);
    ctx.fill();
  } else {
    ctx.fillStyle = "#3f7d4f";
    ctx.beginPath();
    ctx.arc(o.x + o.width / 2, y + o.height / 2, o.width / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  const chap = currentChapter();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, chap.sky[0]);
  grad.addColorStop(1, chap.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = chap.ground;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  bones.forEach(drawBone);
  obstacles.forEach(drawObstacle);
  drawDog();

  if (banner.timer > 0) {
    const alpha = Math.min(1, banner.timer / 30);
    ctx.fillStyle = `rgba(13,15,20,${0.6 * alpha})`;
    ctx.fillRect(0, 16, W, 34);
    ctx.fillStyle = `rgba(231,233,238,${alpha})`;
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(banner.text, W / 2, 38);
  }
}

function endRun() {
  state = "gameover";
  const finalScore = Math.floor(distance / 10) + bonesCollected * 5;
  if (finalScore > best) {
    best = finalScore;
    localStorage.setItem(BEST_KEY, String(best));
  }
  updateHud();
  overlayText.textContent = "Ruff landing!";
  overlaySub.textContent = `Score ${finalScore} • ${bonesCollected} bone${bonesCollected === 1 ? "" : "s"} • ${currentChapter().name}`;
  restartBtn.textContent = "Try Again";
  overlay.classList.remove("hidden");
}

function loop() {
  update();
  draw();
}

document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
    e.preventDefault();
    if (state === "gameover") resetState();
    else jump();
  } else if (e.key === "ArrowDown" || e.key === "s") {
    e.preventDefault();
    setDuck(true);
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowDown" || e.key === "s") setDuck(false);
});

let touchStartY = null;
canvas.addEventListener("touchstart", (e) => {
  touchStartY = e.touches[0].clientY;
});
canvas.addEventListener("touchend", (e) => {
  if (state === "gameover") {
    resetState();
    touchStartY = null;
    return;
  }
  const dy = e.changedTouches[0].clientY - (touchStartY ?? 0);
  if (dy > 40) {
    setDuck(true);
    setTimeout(() => setDuck(false), 350);
  } else {
    jump();
  }
  touchStartY = null;
});

canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") return;
  if (state === "gameover") resetState();
  else jump();
});

restartBtn.addEventListener("click", () => {
  resetState();
  startRun();
});

resetState();
clearInterval(loopId);
loopId = setInterval(loop, 1000 / 60);
