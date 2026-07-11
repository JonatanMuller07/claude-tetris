'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (nut)
  '#f06292', // + - plus pentomino
  '#9575cd', // U - U pentomino
  '#4db6ac', // Y - Y pentomino
  '#fff176', // single - Tetris reward
  '#ff5252', // bomb
  '#fff59d', // lightning
  '#f48fb1', // dye
  '#a1887f', // gravity
  '#006064', // freeze - dark teal so the white snowflake icon is visible
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hollow center)
  [[0,9,0],[9,9,9],[0,9,0]],                  // + - plus pentomino
  [[10,0,10],[10,10,10]],                     // U pentomino
  [[0,11],[11,11],[0,11],[0,11]],             // Y pentomino
  [[12]],                                     // single - Tetris reward
  [[13]],                                     // bomb power-up
  [[14]],                                     // lightning power-up
  [[15]],                                     // dye power-up
  [[16]],                                     // gravity power-up
  [[17]],                                     // freeze power-up
];

// spawn weight per piece type (index = type, 0 unused); classic pieces are
// twice as likely as the tuerca/pentominoes, so those show up occasionally.
// The single block (type 12) never spawns randomly - it's only awarded after a Tetris.
// Power-up types (13-17) never spawn randomly either - they're queued by clearLines().
const PIECE_WEIGHTS = [0, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
const SINGLE_TYPE = 12;

const BOMB_TYPE = 13;
const LIGHTNING_TYPE = 14;
const DYE_TYPE = 15;
const GRAVITY_TYPE = 16;
const FREEZE_TYPE = 17;
const POWERUP_TYPES = [BOMB_TYPE, LIGHTNING_TYPE, DYE_TYPE, GRAVITY_TYPE, FREEZE_TYPE];
const POWERUP_ICONS = {
  [BOMB_TYPE]: '💣',
  [LIGHTNING_TYPE]: '⚡',
  [DYE_TYPE]: '🎨',
  [GRAVITY_TYPE]: '⬇',
  [FREEZE_TYPE]: '❄',
};
const POWERUP_LINE_INTERVAL = 5;
const TUERCA_TYPE = 8;
const PLUS_TYPE = 9;
const POWERUP_TRIGGER_TYPES = [TUERCA_TYPE, PLUS_TYPE];
const POWERUP_TRIGGER_CHANCE = 0.4;
const FREEZE_DURATION_MS = 5000;
const POWERUP_NAMES = {
  [BOMB_TYPE]: '💣 ¡Bomba!',
  [LIGHTNING_TYPE]: '⚡ ¡Rayo!',
  [DYE_TYPE]: '🎨 ¡Tinte!',
  [GRAVITY_TYPE]: '⬇ ¡Gravedad!',
  [FREEZE_TYPE]: '❄ ¡Congelado 5s!',
};
const POWERUP_DESCRIPTIONS = {
  [BOMB_TYPE]: 'Destruye un área de 3×3 alrededor de donde cae la pieza.',
  [LIGHTNING_TYPE]: 'Elimina toda la fila y la columna donde cae la pieza.',
  [DYE_TYPE]: 'Elige un color al azar entre los bloques del tablero y lo elimina por completo.',
  [GRAVITY_TYPE]: 'Hace caer todos los bloques del tablero, cerrando los huecos como si fuera gravedad.',
  [FREEZE_TYPE]: 'Congela la caída de las piezas durante 5 segundos.',
};

const TOAST_DURATION_MS = 1500;

const LINE_SCORES = [0, 100, 300, 500, 800];

const TSPIN_TYPE = 3; // T piece
const TSPIN_LABELS = ['', 'SIMPLE', 'DOBLE', 'TRIPLE'];
const TSPIN_SCORES = [400, 800, 1200, 1600]; // by lines cleared while T-spinning, ×level
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000]; // by lines cleared, ×level
const COMBO_BASE_SCORE = 50; // ×combo×level
const B2B_MULTIPLIER = 1.5;

const THEME_COLORS = {
  dark: { grid: '#22222e' },
  light: { grid: '#dcdce6' },
};

// Modo Desafío: cada entrada define una mecánica especial + un objetivo con
// recompensa grande de puntos. Son no bloqueantes: si no se cumple el
// objetivo (se acaba el tiempo, etc.) el juego sigue en modo libre/endless.
const CHALLENGES = {
  sprint40: {
    id: 'sprint40',
    name: 'Sprint 40',
    desc: 'Limpiá 40 líneas antes de que se agote el cronómetro de 2:00.',
    reward: 8000,
    hasTimer: true,
    timerMs: 120000,
    onTick(dt) {
      challengeTimer -= dt;
      if (challengeTimer <= 0) {
        challengeTimer = 0;
        challengeDone = true;
        showToast('⏱ ¡Tiempo agotado! Seguís en modo libre');
      }
    },
    goalText() {
      return `Líneas: ${challengeLines}/40`;
    },
    isComplete() {
      return challengeLines >= 40;
    },
  },
  garbage: {
    id: 'garbage',
    name: 'Basura Ascendente',
    desc: 'Cada 10s sube una fila de basura desde abajo. Limpiá 30 líneas.',
    reward: 6000,
    onTick(dt) {
      garbageTimer += dt;
      if (garbageTimer >= 10000) {
        garbageTimer -= 10000;
        addGarbageRow();
      }
    },
    goalText() {
      return `Líneas: ${challengeLines}/30`;
    },
    isComplete() {
      return challengeLines >= 30;
    },
  },
  precargado: {
    id: 'precargado',
    name: 'Tablero Cargado',
    desc: 'Empezás con bloques fijos pre-colocados. Limpiá todo el tablero.',
    reward: 5000,
    setup() {
      fillPrecargado();
    },
    goalText() {
      return `Bloques restantes: ${countBoardCells()}`;
    },
    isComplete() {
      return isBoardEmpty();
    },
  },
  invisible: {
    id: 'invisible',
    name: 'Piezas Invisibles',
    desc: 'Los bloques ya apoyados son invisibles. Limpiá 10 líneas a ciegas.',
    reward: 7000,
    setup() {
      invisibleMode = true;
    },
    goalText() {
      return `Líneas: ${challengeLines}/10`;
    },
    isComplete() {
      return challengeLines >= 10;
    },
  },
  inverse: {
    id: 'inverse',
    name: 'Rotación Inversa',
    desc: 'La rotación gira al revés. Limpiá 20 líneas.',
    reward: 5000,
    setup() {
      inverseRotate = true;
    },
    goalText() {
      return `Líneas: ${challengeLines}/20`;
    },
    isComplete() {
      return challengeLines >= 20;
    },
  },
};
const CHALLENGE_ORDER = ['sprint40', 'garbage', 'precargado', 'invisible', 'inverse'];

const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 20;
const ENERGY_TSPIN_BONUS = 15;
const QUEUE_SIZE = 5;
const SLOW_DURATION_MS = 10000;
const SLOW_FACTOR = 1.8;
const VISION_DURATION_MS = 12000;

const SKILLS = {
  vision: {
    name: '👁 Ver siguientes 5',
    desc: 'Revelá las próximas 5 piezas de la cola durante unos segundos.',
    apply: () => useVisionSkill(),
  },
  swap: {
    name: '🔄 Cambiar pieza',
    desc: 'Intercambiá la pieza actual por otra al azar del pool.',
    apply: () => useSwapSkill(),
  },
  slow: {
    name: '🐢 Ralentizar 10s',
    desc: 'Reduce la velocidad de caída durante 10 segundos.',
    apply: () => useSlowSkill(),
  },
  undo: {
    name: '↩ Deshacer',
    desc: 'Deshace la última pieza colocada, restaurando tablero y puntaje.',
    apply: () => useUndoSkill(),
  },
};
const SKILL_ORDER = ['vision', 'swap', 'slow', 'undo'];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const infoBtn = document.getElementById('info-btn');
const infoOverlay = document.getElementById('info-overlay');
const infoCloseBtn = document.getElementById('info-close-btn');
const powerupList = document.getElementById('powerup-list');
const comboSection = document.getElementById('combo-section');
const comboValueEl = document.getElementById('combo-value');
const challengeOverlay = document.getElementById('challenge-overlay');
const challengeListEl = document.getElementById('challenge-list');
const challengeSection = document.getElementById('challenge-section');
const challengeNameEl = document.getElementById('challenge-name');
const challengeGoalEl = document.getElementById('challenge-goal');
const challengeTimerEl = document.getElementById('challenge-timer');
const energyFillEl = document.getElementById('energy-fill');
const energyHintEl = document.getElementById('energy-hint');
const holdSection = document.getElementById('hold-section');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const visionSection = document.getElementById('vision-section');
const visionCanvas = document.getElementById('vision-canvas');
const visionCtx = visionCanvas.getContext('2d');
const skillOverlay = document.getElementById('skill-overlay');
const skillListEl = document.getElementById('skill-list');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let currentTheme = 'dark';
let rewardPending = false;
let powerupPending = false;
let nextPowerupAt = POWERUP_LINE_INTERVAL;
let freezeUntil = 0;
let toast = null;
let infoOpen = false;
let combo = -1;
let b2b = false;
let lastRotated = false;
let flashEffect = null;
let audioCtx = null;
let challenge = null;
let challengeLines = 0;
let challengeTimer = 0;
let challengeDone = false;
let invisibleMode = false;
let inverseRotate = false;
let garbageTimer = 0;
let menuOpen = true;
let energy = 0;
let skillMenuOpen = false;
let queue = [];
let visionUntil = 0;
let slowUntil = 0;
let heldType = null;
let holdLocked = false;
let undoSnapshot = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function weightedRandomType() {
  const totalWeight = PIECE_WEIGHTS.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * totalWeight;
  for (let type = 1; type < PIECE_WEIGHTS.length; type++) {
    roll -= PIECE_WEIGHTS[type];
    if (roll < 0) return type;
  }
  return PIECE_WEIGHTS.length - 1;
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function ensureQueue() {
  while (queue.length < QUEUE_SIZE) queue.push(weightedRandomType());
}

function nextQueuedPiece() {
  ensureQueue();
  const type = queue.shift();
  ensureQueue();
  if (POWERUP_TRIGGER_TYPES.includes(type) && Math.random() < POWERUP_TRIGGER_CHANCE) {
    powerupPending = true;
  }
  return makePiece(type);
}

function randomPowerupType() {
  return POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
}

function isPowerup(type) {
  return POWERUP_TYPES.includes(type);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function rotateCCW(shape) {
  return rotateCW(rotateCW(rotateCW(shape)));
}

function tryRotate() {
  const rotated = inverseRotate ? rotateCCW(current.shape) : rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastRotated = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function isTSpin() {
  if (current.type !== TSPIN_TYPE || !lastRotated) return false;
  const corners = [
    [current.x, current.y],
    [current.x + 2, current.y],
    [current.x, current.y + 2],
    [current.x + 2, current.y + 2],
  ];
  let filled = 0;
  for (const [cx, cy] of corners) {
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS || board[cy][cx]) filled++;
  }
  return filled >= 3;
}

function isBoardEmpty() {
  return board.every(row => row.every(v => v === 0));
}

function countBoardCells() {
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) n++;
  return n;
}

function fillPrecargado() {
  const filledRows = 6;
  const density = 0.55;
  for (let r = ROWS - filledRows; r < ROWS; r++) {
    let hasHole = false;
    for (let c = 0; c < COLS; c++) {
      if (Math.random() < density) {
        board[r][c] = 1 + Math.floor(Math.random() * 7);
      } else {
        hasHole = true;
      }
    }
    if (!hasHole) board[r][Math.floor(Math.random() * COLS)] = 0;
  }
}

function addGarbageRow() {
  const hole = Math.floor(Math.random() * COLS);
  const row = Array.from({ length: COLS }, (_, c) => (c === hole ? 0 : 1 + Math.floor(Math.random() * 7)));
  board.shift();
  board.push(row);
  current.y--;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
}

function triggerFlash(color, duration = 350) {
  flashEffect = { color, start: performance.now(), duration };
}

function getAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = Ctx ? new Ctx() : null;
  }
  return audioCtx;
}

function playTone(freq, duration, delay = 0, type = 'sine', gain = 0.15) {
  const ctxA = getAudioCtx();
  if (!ctxA) return;
  const osc = ctxA.createOscillator();
  const gainNode = ctxA.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gainNode);
  gainNode.connect(ctxA.destination);
  const startTime = ctxA.currentTime + delay;
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playComboSound(comboCount) {
  playTone(440 + Math.min(comboCount, 10) * 60, 0.15, 0, 'square', 0.12);
}

function playTSpinSound() {
  playTone(660, 0.12, 0, 'sawtooth', 0.15);
  playTone(880, 0.15, 0.08, 'sawtooth', 0.15);
}

function playB2BSound() {
  playTone(523.25, 0.1, 0, 'triangle', 0.15);
  playTone(659.25, 0.1, 0.08, 'triangle', 0.15);
  playTone(783.99, 0.15, 0.16, 'triangle', 0.15);
}

function playPerfectClearSound() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(f, 0.18, i * 0.09, 'sine', 0.18));
}

function bombEffect(cx, cy) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nx = cx + dc, ny = cy + dr;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) board[ny][nx] = 0;
    }
  }
}

function lightningEffect(cx, cy) {
  if (cy >= 0 && cy < ROWS) board[cy].fill(0);
  for (let r = 0; r < ROWS; r++) {
    if (cx >= 0 && cx < COLS) board[r][cx] = 0;
  }
}

function dyeEffect() {
  const colors = new Set();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) colors.add(board[r][c]);
  if (colors.size === 0) return;
  const pool = [...colors];
  const target = pool[Math.floor(Math.random() * pool.length)];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === target) board[r][c] = 0;
}

function gravityEffect() {
  for (let c = 0; c < COLS; c++) {
    const values = [];
    for (let r = 0; r < ROWS; r++)
      if (board[r][c]) values.push(board[r][c]);
    const gap = ROWS - values.length;
    for (let r = 0; r < ROWS; r++)
      board[r][c] = r < gap ? 0 : values[r - gap];
  }
}

function freezeEffect() {
  freezeUntil = performance.now() + FREEZE_DURATION_MS;
}

function showToast(text) {
  toast = { text, expires: performance.now() + TOAST_DURATION_MS };
}

function applyPowerup(piece) {
  switch (piece.type) {
    case BOMB_TYPE: bombEffect(piece.x, piece.y); break;
    case LIGHTNING_TYPE: lightningEffect(piece.x, piece.y); break;
    case DYE_TYPE: dyeEffect(); break;
    case GRAVITY_TYPE: gravityEffect(); break;
    case FREEZE_TYPE: freezeEffect(); break;
  }
  showToast(POWERUP_NAMES[piece.type]);
}

function updateComboHUD() {
  if (combo > 0) {
    comboSection.classList.remove('hidden');
    comboValueEl.textContent = `x${combo + 1}`;
    comboValueEl.classList.remove('combo-value');
    void comboValueEl.offsetWidth; // restart pulse animation
    comboValueEl.classList.add('combo-value');
  } else {
    comboSection.classList.add('hidden');
  }
}

function updateEnergyHUD() {
  const pct = Math.min(100, (energy / ENERGY_MAX) * 100);
  energyFillEl.style.width = `${pct}%`;
  energyFillEl.classList.toggle('energy-full', energy >= ENERGY_MAX);
  energyHintEl.classList.toggle('hidden', energy < ENERGY_MAX);
}

function updateHoldHUD() {
  holdSection.classList.remove('hidden');
  holdSection.classList.toggle('hold-locked', holdLocked);
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (heldType == null) return;
  const HB = 30;
  const shape = PIECES[heldType];
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(holdCtx, offX + c, offY + r, shape[r][c], HB);
}

function drawVision() {
  const slot = 36;
  const cellSize = 8;
  visionCtx.clearRect(0, 0, visionCanvas.width, visionCanvas.height);
  const types = queue.slice(0, 5);
  types.forEach((type, i) => {
    const shape = PIECES[type];
    const offX = Math.floor((4 - shape[0].length) / 2) * cellSize;
    const offY = Math.floor((4 - shape.length) / 2) * cellSize;
    const baseX = i * slot;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        visionCtx.fillStyle = COLORS[shape[r][c]];
        visionCtx.fillRect(baseX + offX + c * cellSize + 1, offY + r * cellSize + 1, cellSize - 1, cellSize - 1);
      }
    }
  });
}

function useVisionSkill() {
  ensureQueue();
  visionUntil = performance.now() + VISION_DURATION_MS;
  drawVision();
  visionSection.classList.remove('hidden');
  showToast('👁 ¡Próximas piezas reveladas!');
}

function useSwapSkill() {
  const type = weightedRandomType();
  const shape = PIECES[type].map(row => [...row]);
  const x = Math.floor(COLS / 2) - Math.floor(shape[0].length / 2);
  let y = current.y;
  if (collide(shape, x, y)) y = 0;
  if (collide(shape, x, y)) {
    showToast('No se pudo cambiar la pieza');
    return;
  }
  current = { type, shape, x, y };
  lastRotated = false;
  showToast('🔄 ¡Pieza cambiada!');
}

function useSlowSkill() {
  slowUntil = performance.now() + SLOW_DURATION_MS;
  showToast('🐢 ¡Tiempo ralentizado!');
}

function useUndoSkill() {
  if (!undoSnapshot) {
    showToast('Nada para deshacer');
    return;
  }
  const snap = undoSnapshot;
  board = snap.board.map(row => [...row]);
  score = snap.score;
  lines = snap.lines;
  level = snap.level;
  dropInterval = snap.dropInterval;
  combo = snap.combo;
  b2b = snap.b2b;
  rewardPending = snap.rewardPending;
  powerupPending = snap.powerupPending;
  nextPowerupAt = snap.nextPowerupAt;
  queue = snap.queue.slice();
  heldType = snap.heldType;
  holdLocked = snap.holdLocked;
  current = { type: snap.current.type, shape: snap.current.shape.map(r => [...r]), x: snap.current.x, y: snap.current.y };
  next = { type: snap.next.type, shape: snap.next.shape.map(r => [...r]), x: snap.next.x, y: snap.next.y };
  undoSnapshot = null;
  lastRotated = false;
  updateHUD();
  updateComboHUD();
  updateHoldHUD();
  drawNext();
  showToast('↩ ¡Deshecho!');
}

function holdPiece() {
  if (holdLocked) {
    showToast('📦 Hold bloqueado hasta la próxima pieza');
    return;
  }
  if (isPowerup(current.type) || current.type === SINGLE_TYPE) {
    showToast('No se puede reservar esta pieza');
    return;
  }
  if (heldType == null) {
    heldType = current.type;
    current = next;
    current.x = Math.floor(COLS / 2) - Math.floor(current.shape[0].length / 2);
    current.y = 0;
    next = nextQueuedPiece();
    drawNext();
  } else {
    const incomingType = heldType;
    const shape = PIECES[incomingType].map(row => [...row]);
    const x = Math.floor(COLS / 2) - Math.floor(shape[0].length / 2);
    const y = 0;
    if (collide(shape, x, y)) {
      showToast('No se pudo reservar la pieza');
      return;
    }
    heldType = current.type;
    current = { type: incomingType, shape, x, y };
  }
  lastRotated = false;
  holdLocked = true;
  updateHoldHUD();
  showToast('📦 ¡Pieza reservada!');
}

function populateSkillList() {
  skillListEl.innerHTML = '';
  for (const id of SKILL_ORDER) {
    const skill = SKILLS[id];
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'skill-option';
    const name = document.createElement('p');
    name.className = 'skill-option-name';
    name.textContent = skill.name;
    const desc = document.createElement('p');
    desc.className = 'skill-option-desc';
    desc.textContent = skill.desc;
    btn.append(name, desc);
    btn.addEventListener('click', () => chooseSkill(id));
    li.appendChild(btn);
    skillListEl.appendChild(li);
  }
}

function chooseSkill(id) {
  SKILLS[id].apply();
  energy = 0;
  updateEnergyHUD();
  closeSkillMenu();
}

function openSkillMenu() {
  if (skillMenuOpen || menuOpen || infoOpen || paused || gameOver) return;
  if (energy < ENERGY_MAX) {
    showToast('⚡ Energía insuficiente');
    return;
  }
  skillMenuOpen = true;
  cancelAnimationFrame(animId);
  skillOverlay.classList.remove('hidden');
}

function closeSkillMenu() {
  skillMenuOpen = false;
  skillOverlay.classList.add('hidden');
  if (!paused && !gameOver) {
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }
}

function clearLines(tspin) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }

  if (!cleared && !tspin) {
    combo = -1;
    updateComboHUD();
    updateChallengeHUD();
    return;
  }

  if (cleared > 0) energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
  if (tspin) energy = Math.min(ENERGY_MAX, energy + ENERGY_TSPIN_BONUS);
  updateEnergyHUD();

  const messages = [];
  let points = 0;

  if (tspin) {
    points += TSPIN_SCORES[cleared] * level;
    messages.push(cleared === 0 ? 'T-SPIN!' : `T-SPIN ${TSPIN_LABELS[cleared]}!`);
    triggerFlash('#ba68c8');
    playTSpinSound();
  } else {
    points += (LINE_SCORES[cleared] || 0) * level;
  }

  if (cleared > 0) {
    lines += cleared;
    combo++;
    if (combo > 0) {
      points += COMBO_BASE_SCORE * combo * level;
      messages.push(`COMBO x${combo + 1}!`);
      triggerFlash('#4dd0e1');
      playComboSound(combo);
    }
  } else {
    combo = -1;
  }

  const difficult = cleared === 4 || (tspin && cleared > 0);
  if (cleared > 0) {
    if (difficult && b2b) {
      points = Math.round(points * B2B_MULTIPLIER);
      messages.push('BACK-TO-BACK!');
      triggerFlash('#ffd54f');
      playB2BSound();
    }
    b2b = difficult;
  }

  if (cleared > 0 && isBoardEmpty()) {
    points += PERFECT_CLEAR_SCORES[cleared] * level;
    messages.push('¡PERFECT CLEAR!');
    triggerFlash('#ffffff', 600);
    playPerfectClearSound();
  }

  score += points;

  if (cleared > 0) {
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (cleared === 4) rewardPending = true;
    while (lines >= nextPowerupAt) {
      powerupPending = true;
      nextPowerupAt += POWERUP_LINE_INTERVAL;
    }
  }

  if (messages.length) showToast(messages.join('  '));

  if (challenge && !challengeDone && cleared > 0) {
    challengeLines += cleared;
    if (challenge.isComplete()) {
      challengeDone = true;
      const bonus = challenge.reward * level;
      score += bonus;
      showToast(`🏆 ¡DESAFÍO COMPLETADO! +${bonus.toLocaleString()}`);
      triggerFlash('#ffd54f', 600);
      playPerfectClearSound();
      invisibleMode = false;
      inverseRotate = false;
    }
  }

  updateComboHUD();
  updateChallengeHUD();
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  undoSnapshot = {
    board: board.map(row => [...row]),
    score, lines, level, dropInterval, combo, b2b,
    rewardPending, powerupPending, nextPowerupAt,
    queue: queue.slice(),
    heldType, holdLocked,
    current: { type: current.type, shape: current.shape.map(r => [...r]), x: current.x, y: current.y },
    next: { type: next.type, shape: next.shape.map(r => [...r]), x: next.x, y: next.y },
  };
  const tspin = isTSpin();
  if (isPowerup(current.type)) {
    applyPowerup(current);
  } else {
    merge();
  }
  clearLines(tspin);
  spawn();
}

function spawn() {
  lastRotated = false;
  holdLocked = false;
  updateHoldHUD();
  current = next;
  if (rewardPending) {
    next = makePiece(SINGLE_TYPE);
    rewardPending = false;
  } else if (powerupPending) {
    next = makePiece(randomPowerupType());
    powerupPending = false;
  } else {
    next = nextQueuedPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateChallengeHUD() {
  if (!challenge) {
    challengeSection.classList.add('hidden');
    return;
  }
  challengeSection.classList.remove('hidden');
  challengeNameEl.textContent = challenge.name;
  challengeGoalEl.textContent = challengeDone ? '¡Completado! Modo libre' : challenge.goalText();
  if (challenge.hasTimer && !challengeDone) {
    const totalSec = Math.max(0, Math.ceil(challengeTimer / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    challengeTimerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    challengeTimerEl.classList.remove('hidden');
  } else {
    challengeTimerEl.classList.add('hidden');
  }
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  const icon = POWERUP_ICONS[colorIndex];
  if (icon) {
    context.font = `${Math.floor(size * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(icon, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEME_COLORS[currentTheme].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  if (!invisibleMode) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK);
  }

  // ghost
  if (!invisibleMode) {
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  }

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  if (freezeUntil && performance.now() < freezeUntil) {
    ctx.strokeStyle = '#80deea';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  }

  if (slowUntil && performance.now() < slowUntil) {
    ctx.strokeStyle = '#ba68c8';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  }

  if (flashEffect) {
    const elapsed = performance.now() - flashEffect.start;
    if (elapsed < flashEffect.duration) {
      ctx.globalAlpha = 0.35 * (1 - elapsed / flashEffect.duration);
      ctx.fillStyle = flashEffect.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    } else {
      flashEffect = null;
    }
  }

  if (toast) {
    if (performance.now() < toast.expires) {
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = 40;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const width = ctx.measureText(toast.text).width + 24;
      ctx.fillRect(canvas.width / 2 - width / 2, y - 18, width, 36);
      ctx.fillStyle = '#fff';
      ctx.fillText(toast.text, canvas.width / 2, y);
    } else {
      toast = null;
    }
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function applyTheme(theme) {
  currentTheme = theme;
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
  localStorage.setItem('theme', theme);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;

  if (visionUntil && ts > visionUntil) {
    visionUntil = 0;
    visionSection.classList.add('hidden');
  }

  if (freezeUntil && ts < freezeUntil) {
    draw();
    if (!gameOver) animId = requestAnimationFrame(loop);
    return;
  }
  freezeUntil = 0;

  if (challenge && !challengeDone && challenge.onTick) {
    challenge.onTick(dt);
    updateChallengeHUD();
  }

  if (slowUntil && ts > slowUntil) slowUntil = 0;
  const effectiveInterval = slowUntil ? dropInterval * SLOW_FACTOR : dropInterval;

  dropAccum += dt;
  if (dropAccum >= effectiveInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  rewardPending = false;
  powerupPending = false;
  nextPowerupAt = POWERUP_LINE_INTERVAL;
  freezeUntil = 0;
  toast = null;
  infoOpen = false;
  combo = -1;
  b2b = false;
  lastRotated = false;
  flashEffect = null;
  challengeLines = 0;
  challengeDone = false;
  invisibleMode = false;
  inverseRotate = false;
  garbageTimer = 0;
  energy = 0;
  skillMenuOpen = false;
  queue = [];
  visionUntil = 0;
  slowUntil = 0;
  heldType = null;
  holdLocked = false;
  undoSnapshot = null;
  challengeTimer = challenge && challenge.hasTimer ? challenge.timerMs : 0;
  if (challenge && challenge.setup) challenge.setup();
  updateComboHUD();
  updateChallengeHUD();
  updateEnergyHUD();
  updateHoldHUD();
  visionSection.classList.add('hidden');
  skillOverlay.classList.add('hidden');
  infoOverlay.classList.add('hidden');
  lastTime = performance.now();
  next = nextQueuedPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (menuOpen) return;
  if (skillMenuOpen) {
    if (e.code === 'Escape') closeSkillMenu();
    return;
  }
  if (infoOpen) {
    if (e.code === 'Escape') closeInfo();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyQ') { openSkillMenu(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastRotated = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastRotated = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  cancelAnimationFrame(animId);
  menuOpen = true;
  overlay.classList.add('hidden');
  challengeOverlay.classList.remove('hidden');
});

function populateChallengeMenu() {
  challengeListEl.innerHTML = '';
  const options = [
    { id: 'normal', name: 'Normal', desc: 'Tetris clásico endless, sin objetivos especiales.' },
    ...CHALLENGE_ORDER.map(id => CHALLENGES[id]),
  ];
  for (const opt of options) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'challenge-option';
    const name = document.createElement('p');
    name.className = 'challenge-option-name';
    name.textContent = opt.name;
    const desc = document.createElement('p');
    desc.className = 'challenge-option-desc';
    desc.textContent = opt.desc || '';
    btn.append(name, desc);
    btn.addEventListener('click', () => startChallenge(opt.id));
    li.appendChild(btn);
    challengeListEl.appendChild(li);
  }
}

function startChallenge(id) {
  challenge = id === 'normal' ? null : CHALLENGES[id];
  challengeOverlay.classList.add('hidden');
  menuOpen = false;
  init();
}

function populatePowerupList() {
  powerupList.innerHTML = '';
  for (const type of POWERUP_TYPES) {
    const item = document.createElement('li');
    const icon = document.createElement('span');
    icon.className = 'powerup-icon';
    icon.textContent = POWERUP_ICONS[type];
    const text = document.createElement('div');
    const name = document.createElement('p');
    name.className = 'powerup-name';
    name.textContent = POWERUP_NAMES[type];
    const desc = document.createElement('p');
    desc.className = 'powerup-desc';
    desc.textContent = POWERUP_DESCRIPTIONS[type];
    text.append(name, desc);
    item.append(icon, text);
    powerupList.appendChild(item);
  }
}

function openInfo() {
  if (infoOpen || menuOpen) return;
  infoOpen = true;
  cancelAnimationFrame(animId);
  populatePowerupList();
  infoOverlay.classList.remove('hidden');
}

function closeInfo() {
  if (!infoOpen) return;
  infoOpen = false;
  infoOverlay.classList.add('hidden');
  if (!paused && !gameOver) {
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }
}

infoBtn.addEventListener('click', openInfo);

infoCloseBtn.addEventListener('click', closeInfo);

infoOverlay.addEventListener('click', e => {
  if (e.target === infoOverlay) closeInfo();
});

skillOverlay.addEventListener('click', e => {
  if (e.target === skillOverlay) closeSkillMenu();
});

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
  if (!menuOpen) {
    draw();
    drawNext();
  }
});

applyTheme(localStorage.getItem('theme') || 'dark');
populateChallengeMenu();
populateSkillList();
