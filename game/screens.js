// screens.js — title, caught, escaped and paused screens. Each screen draws
// itself on top of the game and registers its buttons in W.ui so main.js can
// answer clicks. The title shows the turkey BIG and the farmer angry, not
// a bare menu: the first thing a player sees is the chase.

import { VIEW_W, VIEW_H, GROUND_Y, outlineText, smallText, fillRoundRect, strokeRoundRect } from './render.js';
import { drawBackground, drawGround } from './stages.js';
import { drawTurkey, createTurkey } from './turkey.js';
import { drawFarmer, createFarmer } from './farmer.js';

export function drawButton(ctx, rect, label, hover) {
  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14, hover ? '#f5a623' : '#e8862a');
  strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14, 'rgba(43, 20, 8, 0.9)', 3);
  outlineText(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, 30, '#2b1408', 'center', 900);
}

function hovered(input, rect) {
  return (
    input.mouseX >= rect.x &&
    input.mouseX <= rect.x + rect.w &&
    input.mouseY >= rect.y &&
    input.mouseY <= rect.y + rect.h
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function drawTitle(ctx, W, input) {
  // The farmyard behind the title, slowly scrolling.
  drawBackground(ctx, W);
  drawGround(ctx, W);

  // The turkey, BIG, mid-stride on the left; the farmer, angry, on the right.
  const titleTurkey = createTurkey();
  titleTurkey.x = 300;
  titleTurkey.runPhase = 1.2;
  ctx.save();
  ctx.translate(150, GROUND_Y);
  ctx.scale(1.9, 1.9);
  ctx.translate(-300, -GROUND_Y);
  drawTurkey(ctx, titleTurkey, W);
  ctx.restore();

  const titleFarmer = createFarmer();
  titleFarmer.gap = 180;
  const fakeW = { ...W, turkey: { x: 1150 }, stage: 0 };
  ctx.save();
  ctx.translate(1010, GROUND_Y);
  ctx.scale(1.5, 1.5);
  ctx.translate(-970, -GROUND_Y);
  drawFarmer(ctx, titleFarmer, fakeW);
  ctx.restore();

  // Title block.
  ctx.fillStyle = 'rgba(30, 14, 6, 0.42)';
  ctx.fillRect(0, 60, VIEW_W, 190);
  outlineText(ctx, 'FOWL PLAY', 640, 138, 104, '#ffd94d', 'center', 900);
  outlineText(ctx, 'A turkey escape game — run 2,000 m or become dinner.', 640, 208, 26, '#fff3c4', 'center', 700);

  // Controls panel: nearly opaque, so the barn silhouette behind it cannot
  // bleed through the last line.
  fillRoundRect(ctx, 380, 300, 520, 190, 16, 'rgba(30, 14, 6, 0.92)');
  strokeRoundRect(ctx, 380, 300, 520, 190, 16, 'rgba(255, 217, 77, 0.7)', 2);
  const lines = [
    ['JUMP', 'Space / ↑ / W / click'],
    ['SLIDE', '↓ / S — duck, slip puddles'],
    ['DASH', 'Shift — spend the dash meter'],
    ['HIDE', '↓ by a haystack, crate or pots'],
    ['PAUSE', 'P / Esc — M mute, R restart'],
  ];
  lines.forEach(([key, desc], i) => {
    const y = 332 + i * 32;
    smallText(ctx, key, 404, y, 19, '#ffd94d', 'left', 900);
    smallText(ctx, desc, 600, y, 19, '#fff3c4', 'left', 700);
  });

  if (W.best > 0) {
    outlineText(ctx, `BEST SCORE  ${Math.floor(W.best).toLocaleString('en-US')}`, 640, 528, 24, '#ffd94d', 'center', 800);
  }

  const startBtn = { x: 490, y: 560, w: 300, h: 72 };
  W.ui.startBtn = startBtn;
  drawButton(ctx, startBtn, 'START  ▶', hovered(input, startBtn));
  smallText(ctx, 'or press Space', 640, 660, 18, '#fff3c4', 'center', 700);
}

function scoreLine(W) {
  return `Score ${Math.floor(W.score).toLocaleString('en-US')}  ·  ${Math.floor(W.distance)} m  ·  Best ${Math.floor(W.best).toLocaleString('en-US')}`;
}

export function drawCaught(ctx, W, input) {
  ctx.fillStyle = 'rgba(40, 8, 8, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  outlineText(ctx, 'CAUGHT!', 640, 250, 104, '#ff5a4d', 'center', 900);
  outlineText(ctx, 'Caught for dinner…', 640, 330, 30, '#fff3c4', 'center', 700);
  outlineText(ctx, scoreLine(W), 640, 396, 26, '#ffd94d', 'center', 800);
  const restartBtn = { x: 490, y: 450, w: 300, h: 72 };
  W.ui.restartBtn = restartBtn;
  drawButton(ctx, restartBtn, 'RESTART', hovered(input, restartBtn));
  smallText(ctx, 'or press R', 640, 556, 18, '#fff3c4', 'center', 700);
}

export function drawEscaped(ctx, W, input) {
  ctx.fillStyle = 'rgba(24, 44, 10, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Golden rays behind the pardon.
  ctx.save();
  ctx.translate(640, 250);
  ctx.fillStyle = 'rgba(255, 217, 77, 0.16)';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(500, -40);
    ctx.lineTo(500, 40);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  outlineText(ctx, 'PARDONED!', 640, 250, 104, '#ffd94d', 'center', 900);
  outlineText(ctx, 'You escaped the Thanksgiving table!', 640, 330, 30, '#fff3c4', 'center', 700);
  outlineText(ctx, `${scoreLine(W)}  ·  ${formatTime(W.runTime)}`, 640, 396, 26, '#ffd94d', 'center', 800);
  const restartBtn = { x: 490, y: 450, w: 300, h: 72 };
  W.ui.restartBtn = restartBtn;
  drawButton(ctx, restartBtn, 'RUN AGAIN', hovered(input, restartBtn));
  smallText(ctx, 'or press R', 640, 556, 18, '#fff3c4', 'center', 700);
}

export function drawPaused(ctx, W, input) {
  ctx.fillStyle = 'rgba(10, 10, 10, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  outlineText(ctx, 'PAUSED', 640, 300, 84, '#fff3c4', 'center', 900);
  smallText(ctx, 'P / Esc to resume  ·  R to restart', 640, 380, 22, '#ffd94d', 'center', 700);
  const resumeBtn = { x: 490, y: 420, w: 300, h: 64 };
  W.ui.resumeBtn = resumeBtn;
  drawButton(ctx, resumeBtn, 'RESUME  ▶', hovered(input, resumeBtn));
}
