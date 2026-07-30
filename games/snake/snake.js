const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const restartBtn = document.getElementById("restart-btn");

const GRID = 20;
const CELLS = canvas.width / GRID;
const START_TICK_MS = 160;
const MIN_TICK_MS = 70;
const SPEEDUP_PER_FOOD = 4;
const BEST_KEY = "meatflap-snake-best";

const BACON_HEAD_COLOR = "#ffab8a";
const BACON_BODY_COLOR = "#ff8c69";
const BACON_STRIPE_COLOR = "#fff1e0";
const BACON_BIT_COLOR = "#e0a868";

let snake, direction, nextDirection, food, score, best, running, loopId;

function resetState() {
  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = direction;
  score = 0;
  running = true;
  best = Number(localStorage.getItem(BEST_KEY) || 0);
  placeFood();
  updateHud();
  overlay.classList.add("hidden");
}

function placeFood() {
  while (true) {
    const candidate = {
      x: Math.floor(Math.random() * CELLS),
      y: Math.floor(Math.random() * CELLS),
    };
    if (!snake.some((s) => s.x === candidate.x && s.y === candidate.y)) {
      food = candidate;
      return;
    }
  }
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

function tickDelay() {
  return Math.max(MIN_TICK_MS, START_TICK_MS - score * SPEEDUP_PER_FOOD);
}

function tick() {
  if (!running) return;

  direction = nextDirection;
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  const hitWall = head.x < 0 || head.y < 0 || head.x >= CELLS || head.y >= CELLS;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);

  if (hitWall || hitSelf) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 1;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();
    placeFood();
  } else {
    snake.pop();
  }

  draw();
}

function segmentDir(i) {
  if (i === 0) return direction;
  const prev = snake[i - 1], cur = snake[i];
  return { x: prev.x - cur.x, y: prev.y - cur.y };
}

function drawBaconSegment(segment, i) {
  const cx = segment.x * GRID + GRID / 2;
  const cy = segment.y * GRID + GRID / 2;
  const size = GRID - 2;
  const dir = segmentDir(i);
  const angle = (dir.x || dir.y) ? Math.atan2(dir.y, dir.x) : 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const half = size / 2;
  const r = size * 0.28;
  ctx.fillStyle = i === 0 ? BACON_HEAD_COLOR : BACON_BODY_COLOR;
  ctx.beginPath();
  ctx.roundRect(-half, -half, size, size, r);
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.strokeStyle = BACON_STRIPE_COLOR;
  ctx.lineWidth = size * 0.16;
  const wobble = Math.sin(i * 0.9) * size * 0.1;
  for (const off of [-0.32, 0.32]) {
    ctx.beginPath();
    ctx.moveTo(-half, off * size + wobble - size * 0.18);
    ctx.lineTo(half, off * size + wobble + size * 0.18);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function draw() {
  ctx.fillStyle = "#10141c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = BACON_BIT_COLOR;
  ctx.beginPath();
  ctx.arc(food.x * GRID + GRID / 2, food.y * GRID + GRID / 2, GRID * 0.28, 0, Math.PI * 2);
  ctx.fill();

  for (let i = snake.length - 1; i >= 0; i--) {
    drawBaconSegment(snake[i], i);
  }
}

function endGame() {
  running = false;
  overlayText.textContent = `Game Over — Score ${score}`;
  overlay.classList.remove("hidden");
}

function setDirection(dx, dy) {
  if (dx === -direction.x && dy === -direction.y) return;
  nextDirection = { x: dx, y: dy };
}

document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp":
    case "w":
      setDirection(0, -1);
      break;
    case "ArrowDown":
    case "s":
      setDirection(0, 1);
      break;
    case "ArrowLeft":
    case "a":
      setDirection(-1, 0);
      break;
    case "ArrowRight":
    case "d":
      setDirection(1, 0);
      break;
    case " ":
      if (!running) resetState();
      break;
  }
});

let touchStart = null;
canvas.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
});
canvas.addEventListener("touchend", (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? 1 : -1, 0);
    } else {
      setDirection(0, dy > 0 ? 1 : -1);
    }
  }
  touchStart = null;
});

const DPAD_DIRECTIONS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

document.querySelectorAll(".dpad-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!running) {
      resetState();
      return;
    }
    const [dx, dy] = DPAD_DIRECTIONS[btn.dataset.dir];
    setDirection(dx, dy);
  });
});

restartBtn.addEventListener("click", resetState);

function loop() {
  tick();
  loopId = setTimeout(loop, tickDelay());
}

resetState();
draw();
clearTimeout(loopId);
loop();
