// hud.js — the in-game HUD: score, distance progress, lives, stage, dash
// meter and farmer proximity meter. Everything sits inside safe margins so
// nothing is ever clipped at the edges.

import { VIEW_W, outlineText, smallText, fillRoundRect, strokeRoundRect, clamp } from './render.js';
import { MAX_GAP } from './farmer.js';
import { ESCAPE_DISTANCE, stageName } from './stages.js';

const MARGIN = 24;

function drawHeart(ctx, x, y, s, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-13, -6, -7, -15, 0, -8);
  ctx.bezierCurveTo(7, -15, 13, -6, 0, 7);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(43, 20, 8, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawBar(ctx, x, y, w, h, frac, fill, empty) {
  fillRoundRect(ctx, x, y, w, h, h / 2, empty);
  if (frac > 0.01) {
    fillRoundRect(ctx, x, y, Math.max(h, w * clamp(frac, 0, 1)), h, h / 2, fill);
  }
  strokeRoundRect(ctx, x, y, w, h, h / 2, 'rgba(43, 20, 8, 0.85)', 2);
}

export function drawHUD(ctx, W, input) {
  const F = W.farmer;
  const T = W.turkey;

  // Top strip: a translucent dark band so the HUD reads over any stage.
  ctx.fillStyle = 'rgba(30, 14, 6, 0.45)';
  ctx.fillRect(0, 0, VIEW_W, 78);

  // Score, left.
  smallText(ctx, 'SCORE', MARGIN, 26, 15, '#ffd94d', 'left', 800);
  outlineText(ctx, String(Math.floor(W.score)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), MARGIN, 52, 30, '#fff3c4', 'left', 900);

  // Distance: progress bar to freedom, centre, with stage ticks.
  const barX = 440;
  const barW = 400;
  const barY = 24;
  const frac = clamp(W.distance / ESCAPE_DISTANCE, 0, 1);
  drawBar(ctx, barX, barY, barW, 16, frac, '#ffd94d', 'rgba(0,0,0,0.45)');
  for (const tick of [600, 1200]) {
    const tx = barX + (tick / ESCAPE_DISTANCE) * barW;
    ctx.fillStyle = 'rgba(255, 243, 196, 0.9)';
    ctx.fillRect(tx - 1, barY - 3, 2, 22);
  }
  const distText = `${Math.floor(W.distance)} / ${ESCAPE_DISTANCE} m`;
  outlineText(ctx, distText, barX + barW / 2, 62, 19, '#fff3c4', 'center', 800);
  smallText(ctx, `STAGE: ${stageName(W)}`, MARGIN, 66, 15, '#ffd9a0', 'left', 800);

  // Lives (hearts) and the sound / pause buttons, right.
  let hx = 1010;
  for (let i = 0; i < 3; i++) {
    drawHeart(ctx, hx + i * 36, 40, 1.35, i < W.lives ? '#ff5a4d' : 'rgba(60, 30, 20, 0.7)');
  }
  const soundRect = { x: 1130, y: 16, w: 44, h: 44 };
  const pauseRect = { x: 1186, y: 16, w: 44, h: 44 };
  W.ui.soundBtn = soundRect;
  W.ui.pauseBtn = pauseRect;
  drawIconButton(ctx, soundRect, input, W.audio.muted ? 'muted' : 'sound');
  drawIconButton(ctx, pauseRect, input, 'pause');

  // Dash meter, bottom left.
  smallText(ctx, 'DASH  [SHIFT]', MARGIN, 726, 15, '#ffd94d', 'left', 800);
  drawBar(ctx, MARGIN, 738, 200, 18, W.dash / 100, W.dash >= 25 ? '#7ec8ff' : '#5a7a9a', 'rgba(0,0,0,0.45)');
  if (W.dashing) {
    outlineText(ctx, 'DASH!', MARGIN + 220, 747, 20, '#7ec8ff', 'left', 900);
  }

  // Farmer proximity meter, bottom right: full means safe, empty means caught.
  const fBarX = 1032;
  const fBarW = 224;
  smallText(ctx, 'FARMER', VIEW_W - MARGIN, 726, 15, '#ffb3a0', 'right', 800);
  const gapFrac = clamp((F.gap - 36) / (MAX_GAP - 36), 0, 1);
  const farmerColor = gapFrac < 0.25 ? '#ff3b30' : gapFrac < 0.5 ? '#ff9f2a' : '#7ed67e';
  drawBar(ctx, fBarX, 738, fBarW, 18, gapFrac, farmerColor, 'rgba(0,0,0,0.45)');

  // Combo badge.
  if (W.combo >= 2) {
    const pulse = 1 + Math.sin(W.time * 8) * 0.06;
    ctx.save();
    ctx.translate(640, 104);
    ctx.scale(pulse, pulse);
    outlineText(ctx, `COMBO x${Math.min(W.combo, 5)}`, 0, 0, 30, '#ffd94d', 'center', 900);
    ctx.restore();
  }

  // "Farmer close!" warning, flashing red.
  if (F.gap < 150 && W.mode === 'play') {
    if (Math.floor(W.time * 4) % 2 === 0) {
      outlineText(ctx, 'Farmer close!', 640, 146, 30, '#ff5a4d', 'center', 900);
    }
  }

  // Hide hint when a cover is near.
  if (W.nearCover && !T.hidden && T.hideCooldown <= 0 && W.mode === 'play') {
    outlineText(ctx, 'Press DOWN to hide!', 640, 190, 22, '#bfe8ff', 'center', 800);
  }
}

function drawIconButton(ctx, rect, input, kind) {
  const hover =
    input.mouseX >= rect.x &&
    input.mouseX <= rect.x + rect.w &&
    input.mouseY >= rect.y &&
    input.mouseY <= rect.y + rect.h;
  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10, hover ? '#f5a623' : 'rgba(255, 243, 196, 0.9)');
  strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10, 'rgba(43, 20, 8, 0.85)', 2);
  ctx.fillStyle = '#2b1408';
  ctx.strokeStyle = '#2b1408';
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (kind === 'sound') {
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 4);
    ctx.lineTo(cx - 4, cy - 4);
    ctx.lineTo(cx + 2, cy - 11);
    ctx.lineTo(cx + 2, cy + 11);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.lineTo(cx - 10, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx + 4, cy, 8, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 4, cy, 13, -0.9, 0.9);
    ctx.stroke();
  } else if (kind === 'muted') {
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 4);
    ctx.lineTo(cx - 4, cy - 4);
    ctx.lineTo(cx + 2, cy - 11);
    ctx.lineTo(cx + 2, cy + 11);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.lineTo(cx - 10, cy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 7);
    ctx.lineTo(cx + 16, cy + 7);
    ctx.moveTo(cx + 16, cy - 7);
    ctx.lineTo(cx + 6, cy + 7);
    ctx.stroke();
  } else {
    // Pause: two bars.
    ctx.fillRect(cx - 8, cy - 10, 6, 20);
    ctx.fillRect(cx + 2, cy - 10, 6, 20);
  }
}
