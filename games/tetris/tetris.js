const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const baconCountEl = document.getElementById("bacon-count");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const overlaySub = document.getElementById("overlay-sub");
const startBtn = document.getElementById("start-btn");
const boardWrap = canvas.parentElement;

const CELL = 24;
const COLS = canvas.width / CELL;
const ROWS = canvas.height / CELL;
const BEST_KEY = "meatflap-tetris-best";
const LINES_PER_LEVEL = 10;

// Each shape is a 4x4 binary grid in its spawn orientation.
const SHAPES = {
  I: { color: "#4dd8ff", cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  O: { color: "#ffe14d", cells: [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]] },
  T: { color: "#b04dff", cells: [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]] },
  S: { color: "#4dff9f", cells: [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]] },
  Z: { color: "#ff4d8d", cells: [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]] },
  J: { color: "#4d7bff", cells: [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]] },
  L: { color: "#ff9f4d", cells: [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]] },
};
const SHAPE_TYPES = Object.keys(SHAPES);

const BACON_STRIPE_A = "#ffd9e6";
const BACON_STRIPE_B = "#ff6f91";

let board, current, next, score, best, level, linesCleared, baconSizzled;
let running, over, loopId, dropTimer;
let piecesSinceBacon, baconThreshold;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function rotateMatrix(cells) {
  const n = cells.length;
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      out[x][n - 1 - y] = cells[y][x];
    }
  }
  return out;
}

function rollBaconThreshold() {
  return 4 + Math.floor(Math.random() * 4); // every 4-7 pieces
}

function makePiece(type, isBacon) {
  const shape = SHAPES[type];
  return {
    type,
    color: shape.color,
    cells: shape.cells.map((row) => row.slice()),
    row: -2,
    col: Math.floor((COLS - 4) / 2),
    isBacon: !!isBacon,
  };
}

function spawnNext() {
  const type = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
  piecesSinceBacon += 1;
  let isBacon = false;
  if (piecesSinceBacon >= baconThreshold) {
    isBacon = true;
    piecesSinceBacon = 0;
    baconThreshold = rollBaconThreshold();
  }
  return makePiece(type, isBacon);
}

function collides(piece, row, col, cells) {
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      if (!cells[y][x]) continue;
      const br = row + y;
      const bc = col + x;
      if (bc < 0 || bc >= COLS || br >= ROWS) return true;
      if (br >= 0 && board[br][bc]) return true;
    }
  }
  return false;
}

function resetState() {
  board = emptyBoard();
  score = 0;
  level = 1;
  linesCleared = 0;
  baconSizzled = 0;
  running = true;
  over = false;
  piecesSinceBacon = 0;
  baconThreshold = rollBaconThreshold();
  best = Number(localStorage.getItem(BEST_KEY) || 0);
  next = spawnNext();
  current = spawnNext();
  updateHud();
  overlay.classList.add("hidden");
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  levelEl.textContent = level;
  linesEl.textContent = linesCleared;
  baconCountEl.textContent = baconSizzled;
}

function tickDelay() {
  return Math.max(120, 800 - (level - 1) * 60);
}

function lockPiece() {
  const overflowsTop = current.cells.some((rowCells, y) =>
    rowCells.some((filled, x) => filled && current.row + y < 0)
  );
  if (overflowsTop) {
    endGame();
    return;
  }

  current.cells.forEach((rowCells, y) => {
    rowCells.forEach((filled, x) => {
      if (!filled) return;
      const br = current.row + y;
      const bc = current.col + x;
      board[br][bc] = { color: current.color, bacon: current.isBacon };
    });
  });

  clearLines();

  current = next;
  next = spawnNext();
  drawNext();

  if (collides(current, current.row, current.col, current.cells)) {
    endGame();
  }
}

function clearLines() {
  const fullRows = [];
  for (let y = 0; y < ROWS; y++) {
    if (board[y].every((cell) => cell)) fullRows.push(y);
  }
  if (fullRows.length === 0) return;

  const hadBacon = fullRows.some((y) => board[y].some((cell) => cell && cell.bacon));
  const baconCellsCleared = fullRows.reduce(
    (sum, y) => sum + board[y].filter((cell) => cell && cell.bacon).length,
    0
  );

  fullRows.forEach((y) => {
    board.splice(y, 1);
    board.unshift(Array(COLS).fill(null));
  });

  const baseTable = { 1: 100, 2: 300, 3: 500, 4: 800 };
  let gained = (baseTable[fullRows.length] || 800) * level;
  if (hadBacon) gained *= 2;

  score += gained;
  linesCleared += fullRows.length;
  const newLevel = Math.floor(linesCleared / LINES_PER_LEVEL) + 1;
  if (newLevel !== level) level = newLevel;

  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }

  if (hadBacon) {
    baconSizzled += baconCellsCleared;
    sizzleFlash();
  }

  updateHud();
}

function sizzleFlash() {
  boardWrap.classList.remove("sizzle-flash");
  // Force reflow so the animation can restart if it's still running.
  void boardWrap.offsetWidth;
  boardWrap.classList.add("sizzle-flash");
}

function endGame() {
  running = false;
  over = true;
  clearTimeout(loopId);
  overlayText.textContent = `Game Over — Score ${score}`;
  overlaySub.textContent =
    baconSizzled > 0
      ? `You sizzled ${baconSizzled} bacon block${baconSizzled === 1 ? "" : "s"}. Best: ${best}.`
      : `Best: ${best}. No bacon sizzled this run — keep an eye out for the greasy piece.`;
  startBtn.textContent = "Play Again";
  overlay.classList.remove("hidden");
}

function moveBy(dx, dy) {
  if (!running) return false;
  const row = current.row + dy;
  const col = current.col + dx;
  if (collides(current, row, col, current.cells)) return false;
  current.row = row;
  current.col = col;
  return true;
}

function rotate() {
  if (!running) return;
  const rotated = rotateMatrix(current.cells);
  const kicks = [0, -1, 1, -2, 2];
  for (const dx of kicks) {
    if (!collides(current, current.row, current.col + dx, rotated)) {
      current.cells = rotated;
      current.col += dx;
      draw();
      return;
    }
  }
}

function gravityTick() {
  if (!running) return;
  if (!moveBy(0, 1)) lockPiece();
  draw();
}

function softDrop() {
  if (!running) return;
  if (moveBy(0, 1)) {
    score += 1;
    updateHud();
    draw();
  } else {
    lockPiece();
    draw();
  }
}

function hardDrop() {
  if (!running) return;
  let cells = 0;
  while (moveBy(0, 1)) cells += 1;
  score += cells * 2;
  updateHud();
  lockPiece();
  draw();
}

function drawCell(context, px, py, size, color, isBacon) {
  if (isBacon) {
    context.save();
    context.beginPath();
    context.rect(px, py, size, size);
    context.clip();
    context.fillStyle = BACON_STRIPE_A;
    context.fillRect(px, py, size, size);
    context.fillStyle = BACON_STRIPE_B;
    const stripeWidth = size / 3;
    for (let i = -1; i < 3; i++) {
      context.beginPath();
      context.moveTo(px + i * stripeWidth, py + size);
      context.lineTo(px + i * stripeWidth + stripeWidth, py + size);
      context.lineTo(px + i * stripeWidth + stripeWidth + size, py);
      context.lineTo(px + i * stripeWidth + size, py);
      context.closePath();
      context.fill();
    }
    context.restore();
    context.strokeStyle = "#0d0f14";
    context.lineWidth = 1;
    context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    return;
  }
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
}

function draw() {
  ctx.fillStyle = "#10141c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (cell) drawCell(ctx, x * CELL, y * CELL, CELL, cell.color, cell.bacon);
    }
  }

  if (current) {
    current.cells.forEach((row, y) => {
      row.forEach((filled, x) => {
        if (!filled) return;
        const py = current.row + y;
        if (py < 0) return;
        drawCell(ctx, (current.col + x) * CELL, py * CELL, CELL, current.color, current.isBacon);
      });
    });
  }
}

function drawNext() {
  nextCtx.fillStyle = "#10141c";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;
  next.cells.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (!filled) return;
      drawCell(nextCtx, x * CELL, y * CELL, CELL, next.color, next.isBacon);
    });
  });
}

document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      if (moveBy(-1, 0)) draw();
      break;
    case "ArrowRight":
    case "d":
    case "D":
      if (moveBy(1, 0)) draw();
      break;
    case "ArrowDown":
    case "s":
    case "S":
      softDrop();
      break;
    case "ArrowUp":
    case "w":
    case "W":
      rotate();
      break;
    case " ":
      e.preventDefault();
      if (over) {
        resetState();
        draw();
        drawNext();
        restartLoop();
      } else {
        hardDrop();
      }
      break;
  }
});

startBtn.addEventListener("click", () => {
  resetState();
  draw();
  drawNext();
  restartLoop();
});

function loop() {
  if (running) gravityTick();
  loopId = setTimeout(loop, tickDelay());
}

function restartLoop() {
  clearTimeout(loopId);
  loop();
}

board = emptyBoard();
draw();
