const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const restartBtn = document.getElementById("restart-btn");

const W = canvas.width;
const H = canvas.height;
const BEST_KEY = "meatflap-flappy-best";

const GRAVITY = 0.45;
const FLAP_VELOCITY = -8;
const PIPE_SPEED = 2.6;
const PIPE_GAP = 150;
const PIPE_SPACING = 220;
const PIPE_WIDTH = 56;
const BIRD_X = 90;
const BIRD_RADIUS = 14;

let bird, pipes, score, best, state, frame, loopId;

function resetState() {
  bird = { y: H / 2, vy: 0 };
  pipes = [];
  score = 0;
  frame = 0;
  best = Number(localStorage.getItem(BEST_KEY) || 0);
  state = "waiting";
  updateHud();
  overlay.classList.remove("hidden");
  overlayText.textContent = "Tap to Fly";
  restartBtn.textContent = "Start";
  draw();
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

function spawnPipe() {
  const margin = 60;
  const gapY = margin + Math.random() * (H - margin * 2 - PIPE_GAP);
  pipes.push({ x: W, gapY, passed: false });
}

function flap() {
  if (state === "waiting") {
    state = "playing";
    overlay.classList.add("hidden");
    spawnPipe();
  }
  if (state === "gameover") return;
  bird.vy = FLAP_VELOCITY;
}

function endGame() {
  state = "gameover";
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }
  updateHud();
  overlayText.textContent = `Crashed — Score ${score}`;
  restartBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

function update() {
  if (state !== "playing") return;

  frame++;
  bird.vy += GRAVITY;
  bird.y += bird.vy;

  if (bird.y - BIRD_RADIUS < 0) {
    bird.y = BIRD_RADIUS;
    bird.vy = 0;
  }
  if (bird.y + BIRD_RADIUS > H) {
    endGame();
    return;
  }

  pipes.forEach((p) => (p.x -= PIPE_SPEED));

  if (pipes.length && pipes[pipes.length - 1].x < W - PIPE_SPACING) {
    spawnPipe();
  }
  pipes = pipes.filter((p) => p.x + PIPE_WIDTH > 0);

  for (const p of pipes) {
    const withinX = BIRD_X + BIRD_RADIUS > p.x && BIRD_X - BIRD_RADIUS < p.x + PIPE_WIDTH;
    const hitsGap = bird.y - BIRD_RADIUS < p.gapY || bird.y + BIRD_RADIUS > p.gapY + PIPE_GAP;
    if (withinX && hitsGap) {
      endGame();
      return;
    }
    if (!p.passed && p.x + PIPE_WIDTH < BIRD_X - BIRD_RADIUS) {
      p.passed = true;
      score += 1;
      updateHud();
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#2fbf7a";
  pipes.forEach((p) => {
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.gapY);
    ctx.fillRect(p.x, p.gapY + PIPE_GAP, PIPE_WIDTH, H - (p.gapY + PIPE_GAP));
  });

  ctx.save();
  ctx.translate(BIRD_X, bird.y);
  const angle = Math.max(-0.5, Math.min(0.9, bird.vy / 12));
  ctx.rotate(angle);
  ctx.fillStyle = "#4dff9f";
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0d0f14";
  ctx.beginPath();
  ctx.arc(5, -4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function loop() {
  update();
  draw();
}

document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "ArrowUp") {
    e.preventDefault();
    if (state === "gameover") {
      resetState();
    } else {
      flap();
    }
  }
});

canvas.addEventListener("pointerdown", () => {
  if (state === "gameover") {
    resetState();
  } else {
    flap();
  }
});

restartBtn.addEventListener("click", () => {
  resetState();
  flap();
});

resetState();
clearInterval(loopId);
loopId = setInterval(loop, 1000 / 60);
