// turkey.js — the player: a big, readable turkey with run, jump, slide and
// hide moves. Physics live here; the game rules (hits, scoring) live in
// main.js.

import { GROUND_Y, clamp } from './render.js';

export const GRAVITY = 2800;
export const JUMP_SPEED = 980;

export function createTurkey() {
  return {
    x: 300,
    y: GROUND_Y,
    vy: 0,
    w: 66,
    h: 92,
    onGround: true,
    sliding: false,
    slideT: 0,
    hidden: false,
    hideT: 0,
    hideCooldown: 0,
    invulnT: 0,
    runPhase: 0,
    coyote: 0,
    landed: false,
  };
}

// The collision box: shorter while sliding, nothing while hidden.
export function turkeyBox(T) {
  if (T.hidden) return { x: T.x, y: GROUND_Y - 40, w: T.w, h: 40 };
  const h = T.sliding ? 52 : T.h;
  return { x: T.x - 8, y: T.y - h, w: T.w, h };
}

export function updateTurkey(T, W, dt, input, audio) {
  T.landed = false;
  T.invulnT = Math.max(0, T.invulnT - dt);
  T.hideCooldown = Math.max(0, T.hideCooldown - dt);

  if (T.hidden) {
    T.hideT -= dt;
    if (T.hideT <= 0) {
      T.hidden = false;
      T.invulnT = 1.0;
    }
    return;
  }

  // Slide: hold Down while on the ground. Sliding is low and fast to start.
  const wantSlide = input.down.has('ArrowDown') || input.down.has('KeyS');
  T.sliding = wantSlide && T.onGround && T.vy >= 0;
  if (T.sliding) T.slideT += dt;
  else T.slideT = 0;

  // Gravity and landing.
  T.vy += GRAVITY * dt;
  T.y += T.vy * dt;
  if (T.y >= GROUND_Y) {
    if (!T.onGround && T.vy > 500) T.landed = true;
    T.y = GROUND_Y;
    T.vy = 0;
    T.onGround = true;
    T.coyote = 0.12;
  } else {
    T.onGround = false;
    T.coyote = Math.max(0, T.coyote - dt);
  }

  T.runPhase += W.speed * dt * 0.055;
}

export function tryJump(T, audio) {
  if (T.hidden) return false;
  if (T.onGround || T.coyote > 0) {
    T.vy = -JUMP_SPEED;
    T.onGround = false;
    T.coyote = 0;
    T.sliding = false;
    if (audio) audio.jump();
    return true;
  }
  return false;
}

export function drawTurkey(ctx, T, W) {
  const box = turkeyBox(T);
  const cx = T.x + T.w / 2;
  const feetY = T.y + (T.onGround && !T.sliding ? Math.sin(T.runPhase * 2) * 2 : 0);

  // Ground shadow: smaller and fainter the higher the jump.
  const heightAbove = Math.max(0, GROUND_Y - T.y);
  const shadowScale = clamp(1 - heightAbove / 280, 0.45, 1);
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${0.25 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(cx, GROUND_Y + 4, 44 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  if (T.invulnT > 0 && Math.floor(T.invulnT * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.translate(cx, feetY);

  if (T.hidden) {
    // Only the tail fan pokes out above the cover the turkey hides behind.
    ctx.translate(0, -116);
    drawTailFan(ctx, 1.1);
    ctx.restore();
    return;
  }

  const sliding = T.sliding;
  if (sliding) {
    ctx.rotate(-0.32);
    ctx.translate(0, 18);
  }

  // Tail fan: five rounded feathers fanning behind the body.
  ctx.save();
  ctx.translate(-26, -58);
  ctx.rotate(-0.5 + Math.sin(T.runPhase) * 0.05);
  drawTailFan(ctx, 1);
  ctx.restore();

  // Body: warm brown ellipse with a lighter belly.
  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath();
  ctx.ellipse(0, -46, 34, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c98f4e';
  ctx.beginPath();
  ctx.ellipse(6, -36, 22, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing, flapping a little with the run.
  const flap = Math.sin(T.runPhase * 2) * 4;
  ctx.fillStyle = '#6e451f';
  ctx.beginPath();
  ctx.ellipse(-6, -44 + flap * 0.4, 20, 26, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Legs: two orange legs scissoring with the run phase.
  ctx.strokeStyle = '#e8862a';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const legSwing = T.onGround ? Math.sin(T.runPhase * 2) * 12 : 6;
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(-8 + legSwing, 0);
  ctx.moveTo(10, -8);
  ctx.lineTo(10 - legSwing, 0);
  ctx.stroke();
  // Feet.
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-8 + legSwing, 0);
  ctx.lineTo(-2 + legSwing, 0);
  ctx.moveTo(10 - legSwing, 0);
  ctx.lineTo(16 - legSwing, 0);
  ctx.stroke();

  // Neck and head, up front and high so the turkey reads at a glance.
  ctx.fillStyle = '#a5672f';
  ctx.beginPath();
  ctx.ellipse(24, -82, 9, 18, 0.25, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#d96a4a';
  ctx.beginPath();
  ctx.arc(30, -96, 15, 0, Math.PI * 2);
  ctx.fill();
  // Snood (the red drop over the beak).
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.ellipse(40, -88, 4, 9, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Beak.
  ctx.fillStyle = '#f5a623';
  ctx.beginPath();
  ctx.moveTo(42, -100);
  ctx.lineTo(58, -94);
  ctx.lineTo(42, -89);
  ctx.closePath();
  ctx.fill();
  // Wattle under the beak.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.ellipse(38, -82, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(33, -100, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.arc(35, -100, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawTailFan(ctx, scale) {
  const colors = ['#7a4a21', '#a5672f', '#c98f4e', '#a5672f', '#7a4a21'];
  ctx.save();
  ctx.scale(scale, scale);
  for (let i = 0; i < 5; i++) {
    const ang = -0.9 + i * 0.45;
    ctx.save();
    ctx.rotate(ang);
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.ellipse(0, -26, 9, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(245, 234, 210, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -46, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
