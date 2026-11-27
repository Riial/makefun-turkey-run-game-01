// main.js — the game coordinator: it owns the world, runs the loop, spawns
// obstacles and pickups, resolves hits and near misses, and switches between
// title, play, paused, caught and escaped. The pieces (turkey, farmer,
// obstacles, stages, HUD, screens, sound, particles) each do one job.

import { VIEW_W, VIEW_H, GROUND_Y, clamp, mulberry32 } from './render.js';
import {
  createParticles, spawnFeathers, spawnDust, spawnLeaf, spawnEmber, spawnPopup,
  updateParticles, drawParticles, drawPopups,
} from './particles.js';
import {
  createAudio, ensureAudio, setMuted, updateMusic, playJump, playLand, playPickup,
  playGolden, playFeather, playNearMiss, playHit, playSlip, playGobble, playWin,
  playLose, playWhistle, playStep, playDash, playClick,
} from './audio.js';
import { createInput, isDown, pressed, consumeClick, clickIn } from './input.js';
import { createTurkey, updateTurkey, tryJump, turkeyBox, drawTurkey } from './turkey.js';
import { createFarmer, updateFarmer, startSearch, drawFarmer, CAUGHT_GAP, MAX_GAP } from './farmer.js';
import {
  pickObstacleType, makeObstacle, updateObstacles, obstacleHit, checkPassed,
  nearCover, drawObstacles, drawCovers,
} from './obstacles.js';
import { STAGES, stageFor, ESCAPE_DISTANCE, PX_PER_METER, drawBackground, drawGround } from './stages.js';
import { drawHUD } from './hud.js';
import { drawTitle, drawCaught, drawEscaped, drawPaused } from './screens.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

function bestScore() {
  try {
    return Number(window.localStorage.getItem('fowlplay-best') || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem('fowlplay-best', String(Math.floor(score)));
  } catch {
    // Storage may be unavailable; the best score is a nicety, not a rule.
  }
}

export function createWorld(seed) {
  const rng = mulberry32(seed ?? ((Date.now() % 2147483647) + 1));
  return {
    mode: 'title', // 'title' | 'play' | 'paused' | 'caught' | 'escaped'
    time: 0,
    runTime: 0,
    distance: 0,
    score: 0,
    best: bestScore(),
    lives: 3,
    combo: 0,
    comboT: 0,
    dash: 100,
    dashT: 0,
    dashing: false,
    stumbleT: 0,
    speed: 0,
    stage: 0,
    shake: 0,
    flash: 0,
    bgFar: 0,
    bgMid: 0,
    rng,
    turkey: createTurkey(),
    farmer: createFarmer(),
    obstacles: [],
    pickups: [],
    particles: createParticles(),
    audio: createAudio(),
    input: createInput(canvas),
    ui: {},
    nearCover: null,
    obstacleTimer: 1.0,
    pickupTimer: 1.4,
    leafTimer: 0.5,
    hideCover: null,
  };
}

function resetRun(W) {
  W.distance = 0;
  W.score = 0;
  W.lives = 3;
  W.combo = 0;
  W.comboT = 0;
  W.dash = 100;
  W.dashT = 0;
  W.dashing = false;
  W.stumbleT = 0;
  W.stage = 0;
  W.runTime = 0;
  W.shake = 0;
  W.flash = 0;
  W.obstacles = [];
  W.pickups = [];
  W.particles = createParticles();
  W.turkey = createTurkey();
  W.farmer = createFarmer();
  W.obstacleTimer = 1.1;
  W.pickupTimer = 1.2;
  W.nearCover = null;
  W.hideCover = null;
  W.bgFar = 0;
  W.bgMid = 0;
}

function startGame(W) {
  ensureAudio(W.audio);
  W.audio.musicOn = true;
  resetRun(W);
  W.mode = 'play';
  playGobble(W.audio);
  announce('FOWL PLAY: the turkey runs. Jump with Space, slide with Down.');
}

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

function endRun(W, kind) {
  W.mode = kind;
  W.audio.musicOn = false;
  if (W.score > W.best) {
    W.best = Math.floor(W.score);
    saveBest(W.best);
  }
  if (kind === 'escaped') {
    playWin(W.audio);
    spawnFeathers(W.particles, 640, 300, 60, W.rng);
    announce(`Pardoned! You escaped with ${Math.floor(W.score)} points.`);
  } else {
    playLose(W.audio);
    spawnFeathers(W.particles, W.turkey.x + 30, GROUND_Y - 60, 36, W.rng);
    announce(`Caught for dinner. Score ${Math.floor(W.score)}.`);
  }
}

function currentSpeed(W) {
  const stage = STAGES[W.stage];
  let speed = 380 + stage.speedBonus + W.distance * 0.02;
  if (W.stumbleT > 0) speed *= 0.55;
  if (W.dashing) speed *= 1.5;
  return Math.min(speed, 760);
}

function spawnPickup(W) {
  const roll = W.rng();
  const kind = roll < 0.58 ? 'corn' : roll < 0.72 ? 'golden' : 'feather';
  const airy = W.rng() < 0.55;
  const y = airy ? GROUND_Y - 150 - W.rng() * 90 : GROUND_Y - 46;
  W.pickups.push({ kind, x: 1400, y, r: kind === 'golden' ? 20 : 16, phase: W.rng() * 6 });
}

function updatePickups(W, dt) {
  for (const p of W.pickups) {
    p.x -= W.speed * dt;
    p.phase += dt * 4;
  }
  W.pickups = W.pickups.filter((p) => p.x > -60);
}

function collectPickups(W) {
  const box = turkeyBox(W.turkey);
  for (const p of W.pickups) {
    const py = p.y + Math.sin(p.phase) * 4;
    const overlap =
      box.x < p.x + p.r && box.x + box.w > p.x - p.r &&
      box.y < py + p.r && box.y + box.h > py - p.r;
    if (!overlap) continue;
    p.taken = true;
    if (p.kind === 'corn') {
      W.score += 100;
      spawnPopup(W.particles, '+100', p.x, py - 30, '#ffd94d', 24);
      playPickup(W.audio);
    } else if (p.kind === 'golden') {
      W.score += 500;
      spawnPopup(W.particles, '+500', p.x, py - 30, '#ffcf5c', 32);
      playGolden(W.audio);
      spawnFeathers(W.particles, p.x, py, 8, W.rng);
    } else {
      W.dash = clamp(W.dash + 40, 0, 100);
      W.score += 50;
      spawnPopup(W.particles, 'DASH +40', p.x, py - 30, '#7ec8ff', 24);
      playFeather(W.audio);
    }
  }
  W.pickups = W.pickups.filter((p) => !p.taken);
}

function drawPickups(ctx, W) {
  for (const p of W.pickups) {
    const y = p.y + Math.sin(p.phase) * 4;
    ctx.save();
    ctx.translate(p.x, y);
    if (p.kind === 'corn' || p.kind === 'golden') {
      // A corn cob: golden kernels with a green husk.
      ctx.rotate(-0.4);
      ctx.fillStyle = p.kind === 'golden' ? '#ffcf5c' : '#ffd94d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.kind === 'golden' ? '#e8a33d' : '#d9a441';
      for (let ky = -12; ky <= 12; ky += 7) {
        ctx.fillRect(-8, ky, 16, 2);
      }
      ctx.fillStyle = '#5a8f3e';
      ctx.beginPath();
      ctx.moveTo(-9, 8);
      ctx.lineTo(0, 26);
      ctx.lineTo(9, 8);
      ctx.closePath();
      ctx.fill();
      if (p.kind === 'golden') {
        ctx.strokeStyle = 'rgba(255, 207, 92, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26 + Math.sin(p.phase) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // A white feather: dash fuel.
      ctx.rotate(-0.6 + Math.sin(p.phase) * 0.2);
      ctx.fillStyle = '#f5ead2';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9b896';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(0, 16);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function applyHit(W) {
  const T = W.turkey;
  T.invulnT = 1.5;
  W.lives -= 1;
  W.combo = 0;
  W.comboT = 0;
  W.stumbleT = 1.0;
  W.shake = 14;
  W.farmer.gap = Math.max(CAUGHT_GAP, W.farmer.gap - 90);
  spawnFeathers(W.particles, T.x + 30, GROUND_Y - 60, 26, W.rng);
  playHit(W.audio);
  spawnPopup(W.particles, 'OUCH!', T.x + 40, GROUND_Y - 170, '#ff5a4d', 30);
  if (W.lives <= 0) endRun(W, 'caught');
}

function applySlip(W) {
  const T = W.turkey;
  T.invulnT = 1.0;
  W.stumbleT = 0.8;
  W.farmer.gap = Math.max(CAUGHT_GAP, W.farmer.gap - 60);
  spawnDust(W.particles, T.x + 30, GROUND_Y, 10, W.rng);
  playSlip(W.audio);
  spawnPopup(W.particles, 'SLIP!', T.x + 40, GROUND_Y - 150, '#bfe8ff', 26);
}

function applyNearMiss(W, ob) {
  W.combo += 1;
  W.comboT = 3.5;
  const mult = Math.min(W.combo, 5);
  const gain = 150 * mult;
  W.score += gain;
  const label = mult >= 2 ? `CLOSE CALL! +${gain}` : `CLOSE CALL! +${gain}`;
  spawnPopup(W.particles, label, W.turkey.x + 60, GROUND_Y - 190, '#ffd94d', 30);
  if (mult >= 2) spawnPopup(W.particles, `COMBO x${mult}`, W.turkey.x + 60, GROUND_Y - 150, '#ff9f2a', 24);
  playNearMiss(W.audio);
  spawnFeathers(W.particles, W.turkey.x + 40, GROUND_Y - 80, 5, W.rng);
}

function updatePlay(W, dt) {
  const input = W.input;
  const T = W.turkey;

  W.time += dt;
  W.runTime += dt;
  W.speed = currentSpeed(W);
  W.bgFar += W.speed * dt * 0.15;
  W.bgMid += W.speed * dt * 0.45;
  W.distance += (W.speed * dt) / PX_PER_METER;
  W.score += W.speed * dt * 0.05;
  W.stumbleT = Math.max(0, W.stumbleT - dt);
  W.shake = Math.max(0, W.shake - dt * 30);
  W.flash = Math.max(0, W.flash - dt * 2);

  // Stage changes: the run gets faster, busier, and the farmer meaner.
  const nextStage = stageFor(W.distance);
  if (nextStage !== W.stage) {
    W.stage = nextStage;
    W.flash = 0.7;
    spawnPopup(W.particles, `${STAGES[nextStage].name}!`, 640, 300, '#ffd94d', 56);
    playGobble(W.audio);
  }

  // Dash: Shift spends the meter for a burst of speed.
  if (pressed(input, 'ShiftLeft', 'ShiftRight') && W.dash >= 25 && !W.dashing) {
    W.dashing = true;
    W.dashT = 0.7;
    playDash(W.audio);
    spawnDust(W.particles, T.x, GROUND_Y, 8, W.rng);
  }
  if (W.dashing) {
    W.dashT -= dt;
    W.dash = Math.max(0, W.dash - 45 * dt);
    if (W.dashT <= 0 || W.dash <= 0) W.dashing = false;
  } else {
    W.dash = Math.min(100, W.dash + 10 * dt);
  }

  // Hide: Down by a cover ducks the turkey out of sight.
  W.nearCover = nearCover(W);
  if (
    pressed(input, 'ArrowDown', 'KeyS') &&
    !T.hidden &&
    T.hideCooldown <= 0 &&
    T.onGround &&
    W.nearCover
  ) {
    T.hidden = true;
    T.hideT = 1.8;
    T.hideCooldown = 6;
    W.hideCover = W.nearCover;
    startSearch(W.farmer);
    playGobble(W.audio);
    spawnPopup(W.particles, 'HIDDEN…', T.x + 40, GROUND_Y - 180, '#bfe8ff', 26);
  }

  // Jump: Space, Up, W or a click anywhere that is not a HUD button.
  const clicked = consumeClick(input);
  let clickUsed = false;
  if (clicked) {
    if (clickIn(input, W.ui.soundBtn)) {
      setMuted(W.audio, !W.audio.muted);
      playClick(W.audio);
      clickUsed = true;
    } else if (clickIn(input, W.ui.pauseBtn)) {
      W.mode = 'paused';
      W.audio.musicOn = false;
      playClick(W.audio);
      clickUsed = true;
    }
  }
  if (pressed(input, 'Space', 'ArrowUp', 'KeyW') || (clicked && !clickUsed)) {
    tryJump(T, { jump: () => playJump(W.audio) });
  }
  if (pressed(input, 'KeyP', 'Escape')) {
    W.mode = 'paused';
    W.audio.musicOn = false;
  }
  if (pressed(input, 'KeyM')) setMuted(W.audio, !W.audio.muted);
  if (pressed(input, 'KeyR')) {
    startGame(W);
    return;
  }

  updateTurkey(T, W, dt, input, null);
  if (T.landed) {
    spawnDust(W.particles, T.x + 30, GROUND_Y, 8, W.rng);
    playLand(W.audio);
  }

  // The farmer: footsteps, giving up a search, or the catch.
  for (const ev of updateFarmer(W.farmer, W, dt)) {
    if (ev === 'step') playStep(W.audio);
    if (ev === 'lost') {
      W.score += 150;
      spawnPopup(W.particles, 'LOST YOU! +150', W.turkey.x + 60, GROUND_Y - 190, '#7ed67e', 30);
      playGobble(W.audio);
    }
    if (ev === 'caught') {
      endRun(W, 'caught');
      return;
    }
  }

  // Spawning: obstacles, pickups, and a falling knife's whistle.
  W.obstacleTimer -= dt;
  if (W.obstacleTimer <= 0) {
    const type = pickObstacleType(W);
    const ob = makeObstacle(type, 1400, W);
    W.obstacles.push(ob);
    if (type === 'fallingKnife') playWhistle(W.audio);
    W.obstacleTimer = STAGES[W.stage].spawnGap * (0.85 + W.rng() * 0.4);
  }
  W.pickupTimer -= dt;
  if (W.pickupTimer <= 0) {
    spawnPickup(W);
    W.pickupTimer = 1.6 + W.rng() * 1.1;
  }

  updateObstacles(W, dt);
  updatePickups(W, dt);
  updateParticles(W.particles, dt);

  // Ambient life: leaves on the farm, embers in the kitchen.
  W.leafTimer -= dt;
  if (W.leafTimer <= 0) {
    W.leafTimer = W.stage === 0 ? 0.5 : 1.4;
    if (W.stage === 0) spawnLeaf(W.particles, 1300, 120 + W.rng() * 300, W.rng);
    if (W.stage === 2) {
      const ovens = W.obstacles.filter((o) => o.type === 'oven');
      const ox = ovens.length ? ovens[0].x + 66 : 900 + W.rng() * 300;
      spawnEmber(W.particles, ox, GROUND_Y - 130, W.rng);
    }
  }

  // Collisions and near misses (never while hidden or briefly invulnerable).
  if (!T.hidden && T.invulnT <= 0) {
    const box = turkeyBox(T);
    for (const ob of W.obstacles) {
      const res = obstacleHit(W, ob, box);
      if (res === 'hit') {
        ob.hit = true;
        applyHit(W);
        if (W.mode !== 'play') return;
        break;
      }
      if (res === 'slip') {
        ob.hit = true;
        applySlip(W);
        break;
      }
    }
    if (W.mode === 'play') {
      for (const ob of W.obstacles) {
        if (checkPassed(W, ob, box)) applyNearMiss(W, ob);
      }
    }
  } else {
    // Still mark obstacles as passed while hidden, so no phantom near miss.
    const box = turkeyBox(T);
    for (const ob of W.obstacles) checkPassed(W, ob, box);
  }
  collectPickups(W);

  // Combo decay.
  if (W.comboT > 0) {
    W.comboT -= dt;
    if (W.comboT <= 0) W.combo = 0;
  }

  // Escape!
  if (W.distance >= ESCAPE_DISTANCE) {
    endRun(W, 'escaped');
    return;
  }

  updateMusic(W.audio);
}

function updateTitle(W, dt) {
  W.time += dt;
  W.bgFar += 26 * dt;
  W.bgMid += 60 * dt;
  updateParticles(W.particles, dt);
  const input = W.input;
  const clicked = consumeClick(input);
  if (pressed(input, 'Space', 'Enter', 'ArrowUp', 'KeyW') || (clicked && clickIn(input, W.ui.startBtn || { x: 0, y: 0, w: 0, h: 0 }))) {
    playClick(W.audio);
    startGame(W);
    return;
  }
  if (clicked) {
    // A click anywhere on the title starts the run.
    playClick(W.audio);
    startGame(W);
  }
  if (pressed(input, 'KeyM')) setMuted(W.audio, !W.audio.muted);
}

function updateEnd(W, dt) {
  updateParticles(W.particles, dt);
  const input = W.input;
  const clicked = consumeClick(input);
  if (pressed(input, 'KeyR', 'Space', 'Enter') || (clicked && clickIn(input, W.ui.restartBtn || { x: 0, y: 0, w: 0, h: 0 }))) {
    playClick(W.audio);
    startGame(W);
  }
}

function updatePaused(W, dt) {
  updateParticles(W.particles, dt);
  const input = W.input;
  const clicked = consumeClick(input);
  if (pressed(input, 'KeyP', 'Escape') || (clicked && clickIn(input, W.ui.resumeBtn || { x: 0, y: 0, w: 0, h: 0 }))) {
    W.mode = 'play';
    W.audio.musicOn = true;
    playClick(W.audio);
    return;
  }
  if (pressed(input, 'KeyR')) {
    startGame(W);
  }
  if (pressed(input, 'KeyM')) setMuted(W.audio, !W.audio.muted);
}

function render(W) {
  ctx.save();
  if (W.shake > 0.5) {
    ctx.translate((W.rng() - 0.5) * W.shake, (W.rng() - 0.5) * W.shake);
  }
  if (W.mode === 'title') {
    drawTitle(ctx, W, W.input);
  } else {
    drawBackground(ctx, W);
    drawGround(ctx, W);
    drawPickups(ctx, W);
    drawObstacles(ctx, W);
    drawFarmer(ctx, W.farmer, W);
    drawTurkey(ctx, W.turkey, W);
    drawCovers(ctx, W);
    drawParticles(ctx, W.particles);
    drawPopups(ctx, W.particles);
    if (W.flash > 0) {
      ctx.fillStyle = `rgba(255, 243, 196, ${W.flash * 0.35})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (W.mode === 'play' || W.mode === 'paused') drawHUD(ctx, W, W.input);
    if (W.mode === 'caught') drawCaught(ctx, W, W.input);
    if (W.mode === 'escaped') drawEscaped(ctx, W, W.input);
    if (W.mode === 'paused') drawPaused(ctx, W, W.input);
  }
  ctx.restore();
}

function frame(W, last) {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  if (W.mode === 'play') updatePlay(W, dt);
  else if (W.mode === 'title') updateTitle(W, dt);
  else if (W.mode === 'paused') updatePaused(W, dt);
  else updateEnd(W, dt);
  render(W);
  window.__shotReady = true;
  requestAnimationFrame(() => frame(W, now));
}

// Deterministic screenshot scenes: fixed seed, fixed positions, no randomness
// after setup, and no running loop — one rendered frame per shot.
function setupShot(W, name) {
  W.rng = mulberry32(7);
  W.time = 3.7;
  W.best = 12450;
  if (name === 'title') {
    W.mode = 'title';
    W.bgFar = 240;
    W.bgMid = 520;
    return;
  }
  if (name === 'farmyard') {
    W.mode = 'play';
    W.distance = 320;
    W.stage = 0;
    W.score = 2450;
    W.lives = 3;
    W.dash = 80;
    W.turkey.y = GROUND_Y - 64;
    W.turkey.vy = -320;
    W.turkey.onGround = false;
    W.turkey.runPhase = 2.4;
    W.farmer.gap = 95;
    W.farmer.runPhase = 1.1;
    W.obstacles = [
      makeObstacle('cover', 150, W),
      makeObstacle('haybale', 560, W),
      makeObstacle('fence', 830, W),
      makeObstacle('pumpkin', 1060, W),
    ];
    W.pickups = [
      { kind: 'corn', x: 700, y: GROUND_Y - 150, r: 16, phase: 1 },
      { kind: 'corn', x: 760, y: GROUND_Y - 180, r: 16, phase: 2 },
      { kind: 'feather', x: 980, y: GROUND_Y - 90, r: 16, phase: 0.5 },
    ];
    spawnLeaf(W.particles, 900, 200, W.rng);
    spawnLeaf(W.particles, 400, 120, W.rng);
    spawnDust(W.particles, 300, GROUND_Y, 6, W.rng);
    return;
  }
  if (name === 'kitchen') {
    W.mode = 'play';
    W.distance = 1500;
    W.stage = 2;
    W.score = 9840;
    W.lives = 3;
    W.combo = 5;
    W.dash = 70;
    W.turkey.sliding = true;
    W.turkey.runPhase = 0.6;
    W.farmer.gap = 110;
    W.farmer.runPhase = 2.0;
    const knife = makeObstacle('fallingKnife', 900, W);
    knife.state = 'warn';
    knife.warnT = 0.55;
    const hang = makeObstacle('hangingKnife', 430, W);
    hang.phase = 0.6;
    W.obstacles = [
      makeObstacle('oven', 580, W),
      hang,
      knife,
      makeObstacle('oven', 1120, W),
    ];
    W.pickups = [
      { kind: 'golden', x: 760, y: GROUND_Y - 170, r: 20, phase: 1.2 },
      { kind: 'corn', x: 1000, y: GROUND_Y - 60, r: 16, phase: 0.4 },
    ];
    spawnPopup(W.particles, 'CLOSE CALL! +750', 640, 300, '#ffd94d', 32);
    spawnPopup(W.particles, 'COMBO x5', 640, 340, '#ff9f2a', 24);
    spawnEmber(W.particles, 646, GROUND_Y - 130, W.rng);
    spawnEmber(W.particles, 1186, GROUND_Y - 130, W.rng);
    return;
  }
  if (name === 'escaped') {
    W.mode = 'escaped';
    W.distance = ESCAPE_DISTANCE;
    W.score = 12450;
    W.runTime = 107.4;
    W.lives = 2;
    spawnFeathers(W.particles, 640, 300, 50, W.rng);
    spawnFeathers(W.particles, 300, 200, 20, W.rng);
    spawnFeathers(W.particles, 980, 200, 20, W.rng);
    return;
  }
  W.mode = 'title';
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number(params.get('seed') || 0);
const W = createWorld(seedParam || undefined);
window.__fowl = W;

if (shot) {
  setupShot(W, shot);
  render(W);
  window.__shotReady = true;
} else {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && W.mode === 'play') {
      W.mode = 'paused';
      W.audio.musicOn = false;
    }
  });
  requestAnimationFrame(() => frame(W, performance.now()));
}
