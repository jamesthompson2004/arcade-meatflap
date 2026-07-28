const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const restartBtn = document.getElementById("restart-btn");

const GRID = 20;
const CELLS = canvas.width / GRID;
const TICK_MS = 110;
const BEST_KEY = "meatflap-snake-best";

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

function draw() {
  ctx.fillStyle = "#10141c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ff4d8d";
  ctx.fillRect(food.x * GRID + 2, food.y * GRID + 2, GRID - 4, GRID - 4);

  snake.forEach((segment, i) => {
    ctx.fillStyle = i === 0 ? "#4dff9f" : "#2fbf7a";
    ctx.fillRect(segment.x * GRID + 1, segment.y * GRID + 1, GRID - 2, GRID - 2);
  });
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
  if (Math.abs(dx) > Math.abs(dy)) {
    setDirection(dx > 0 ? 1 : -1, 0);
  } else {
    setDirection(0, dy > 0 ? 1 : -1);
  }
  touchStart = null;
});

restartBtn.addEventListener("click", resetState);

resetState();
draw();
clearInterval(loopId);
loopId = setInterval(tick, TICK_MS);
