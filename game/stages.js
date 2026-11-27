// stages.js — the three places the run passes through: the farmyard, the
// barn and the kitchen. Each stage has its own palette, parallax scenery
// and ground, and the run gets faster and busier as it goes on.

import { VIEW_W, VIEW_H, GROUND_Y, vGradient, clamp } from './render.js';

export const STAGES = [
  { name: 'FARMYARD', from: 0, speedBonus: 0, spawnGap: 1.15 },
  { name: 'BARN', from: 600, speedBonus: 55, spawnGap: 0.98 },
  { name: 'KITCHEN', from: 1200, speedBonus: 110, spawnGap: 0.82 },
];

export const ESCAPE_DISTANCE = 2000;
export const PX_PER_METER = 24;

export function stageFor(distance) {
  if (distance >= STAGES[2].from) return 2;
  if (distance >= STAGES[1].from) return 1;
  return 0;
}

export function stageName(W) {
  return STAGES[W.stage].name;
}

// Repeat a scenery element across the screen from a parallax offset.
function repeatAt(offset, spacing, width, fn) {
  const start = -((offset % spacing) + spacing) % spacing;
  for (let x = start - spacing; x < width + spacing; x += spacing) {
    fn(x);
  }
}

export function drawBackground(ctx, W) {
  if (W.stage === 0) drawFarmyard(ctx, W);
  else if (W.stage === 1) drawBarn(ctx, W);
  else drawKitchen(ctx, W);
}

function drawFarmyard(ctx, W) {
  // Warm sunset sky, full of colour — no empty sky in this game.
  ctx.fillStyle = vGradient(ctx, 0, 0, GROUND_Y, [
    [0, '#ffcf7d'],
    [0.45, '#f7a45c'],
    [0.8, '#e07a5f'],
    [1, '#c96a52'],
  ]);
  ctx.fillRect(0, 0, VIEW_W, GROUND_Y);

  // Low autumn sun with a soft halo.
  const sunX = 1050 - W.bgFar * 0.05;
  const sunGlow = ctx.createRadialGradient(sunX, 150, 10, sunX, 150, 190);
  sunGlow.addColorStop(0, 'rgba(255, 240, 180, 0.9)');
  sunGlow.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - 200, -50, 400, 400);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, 150, 52, 0, Math.PI * 2);
  ctx.fill();

  // Clouds: one path each, for the same reason as the kitchen stars.
  ctx.fillStyle = 'rgba(255, 235, 205, 0.85)';
  for (const [cx, cy, s] of [[220, 110, 1], [560, 70, 0.7], [880, 190, 0.85]]) {
    const x = ((cx - W.bgFar * 0.12) % (VIEW_W + 320) + VIEW_W + 320) % (VIEW_W + 320) - 160;
    ctx.beginPath();
    ctx.ellipse(x, cy, 70 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 40 * s, cy + 6 * s, 50 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far layer: barn silhouette and trees on the horizon.
  ctx.fillStyle = '#8a4a2a';
  repeatAt(W.bgFar, 760, VIEW_W, (x) => {
    // Barn: a big silhouette with a gambrel roof.
    ctx.fillRect(x + 40, 430, 180, 210);
    ctx.beginPath();
    ctx.moveTo(x + 20, 432);
    ctx.lineTo(x + 130, 360);
    ctx.lineTo(x + 240, 432);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = '#6e3a1e';
  repeatAt(W.bgFar * 1.3, 300, VIEW_W, (x) => {
    ctx.beginPath();
    ctx.arc(x, 560, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 6, 560, 12, 84);
  });

  // Mid layer: a fence line and scattered haystacks and pumpkins.
  ctx.fillStyle = '#7a4a21';
  repeatAt(W.bgMid, 170, VIEW_W, (x) => {
    ctx.fillRect(x, 560, 10, 80);
  });
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(0, 584, VIEW_W, 8);
  ctx.fillRect(0, 612, VIEW_W, 8);
  ctx.fillStyle = '#d9a441';
  repeatAt(W.bgMid * 1.2, 520, VIEW_W, (x) => {
    ctx.beginPath();
    ctx.moveTo(x, 640);
    ctx.quadraticCurveTo(x + 40, 566, x + 90, 640);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = '#e8862a';
  repeatAt(W.bgMid * 1.4, 640, VIEW_W, (x) => {
    ctx.beginPath();
    ctx.arc(x + 30, 622, 16, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBarn(ctx, W) {
  // Dark wooden interior, lit by hanging lanterns.
  ctx.fillStyle = '#5b3418';
  ctx.fillRect(0, 0, VIEW_W, GROUND_Y);
  ctx.fillStyle = '#6b3f22';
  for (let x = 0; x < VIEW_W; x += 90) {
    ctx.fillRect(x, 0, 4, GROUND_Y);
  }
  ctx.fillStyle = '#4a2a12';
  ctx.fillRect(0, 180, VIEW_W, 22);
  ctx.fillRect(0, 380, VIEW_W, 22);

  // A high window with a shaft of dusty light.
  ctx.fillStyle = '#ffd9a0';
  ctx.fillRect(180, 60, 150, 110);
  ctx.strokeStyle = '#4a2a12';
  ctx.lineWidth = 8;
  ctx.strokeRect(180, 60, 150, 110);
  ctx.beginPath();
  ctx.moveTo(255, 60);
  ctx.lineTo(255, 170);
  ctx.moveTo(180, 115);
  ctx.lineTo(330, 115);
  ctx.stroke();
  const shaft = ctx.createLinearGradient(0, 170, 0, GROUND_Y);
  shaft.addColorStop(0, 'rgba(255, 217, 160, 0.28)');
  shaft.addColorStop(1, 'rgba(255, 217, 160, 0)');
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(200, 170);
  ctx.lineTo(320, 170);
  ctx.lineTo(460, GROUND_Y);
  ctx.lineTo(120, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // Hanging lanterns, swaying gently.
  for (const lx of [620, 960]) {
    const sway = Math.sin(W.time * 0.9 + lx) * 5;
    ctx.strokeStyle = '#2b1a12';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx + sway, 120);
    ctx.stroke();
    const glow = ctx.createRadialGradient(lx + sway, 140, 4, lx + sway, 140, 70);
    glow.addColorStop(0, 'rgba(255, 200, 90, 0.75)');
    glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lx + sway - 70, 70, 140, 140);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(lx + sway - 14, 122, 28, 36);
    ctx.fillStyle = '#ffcf5c';
    ctx.fillRect(lx + sway - 9, 128, 18, 24);
  }

  // Hay piles along the back wall.
  ctx.fillStyle = '#c98f2e';
  repeatAt(W.bgMid, 460, VIEW_W, (x) => {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.quadraticCurveTo(x + 55, 560, x + 120, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  });
  // Tools on the wall: a rake and a coiled rope.
  ctx.strokeStyle = '#7a4a21';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(1120, 240);
  ctx.lineTo(1120, 420);
  ctx.stroke();
  ctx.strokeStyle = '#cfd6dd';
  ctx.lineWidth = 3;
  for (const ty of [420, 432]) {
    ctx.beginPath();
    ctx.moveTo(1104, ty);
    ctx.lineTo(1136, ty);
    ctx.stroke();
  }
}

function drawKitchen(ctx, W) {
  // A dark red kitchen: tiled walls, hanging pots, a window, warm oven glow.
  ctx.fillStyle = '#7a2a20';
  ctx.fillRect(0, 0, VIEW_W, GROUND_Y);
  // Tile grid on the lower wall.
  ctx.fillStyle = '#8a352a';
  for (let y = 300; y < GROUND_Y; y += 56) {
    for (let x = (y % 112 === 0 ? 0 : 28); x < VIEW_W; x += 56) {
      ctx.fillRect(x, y, 52, 52);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let y = 300; y < GROUND_Y; y += 56) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_W, y);
    ctx.stroke();
  }

  // A window showing the night farm outside.
  ctx.fillStyle = '#1c2a4a';
  ctx.fillRect(120, 70, 170, 130);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(240, 110, 18, 0, Math.PI * 2);
  ctx.fill();
  // Stars: one path each — several arcs in a single filled path get joined
  // by straight lines and would draw a triangle across the window.
  ctx.fillStyle = '#e8e0c8';
  for (const [sx, sy, sr] of [[160, 160, 3], [200, 90, 2.5], [270, 170, 3]]) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#4a2a12';
  ctx.lineWidth = 8;
  ctx.strokeRect(120, 70, 170, 130);

  // Hanging pots and pans along the top.
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 4;
  for (const px of [520, 640, 760, 880, 1000]) {
    const sway = Math.sin(W.time * 0.7 + px) * 3;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px + sway, 60);
    ctx.stroke();
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.arc(px + sway, 84, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(px + sway, 84, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small ovens glowing along the back wall.
  for (const ox of [1080, 1200]) {
    const flick = Math.sin(W.time * 8 + ox) * 3;
    ctx.fillStyle = '#232323';
    ctx.fillRect(ox, 470, 90, 170);
    ctx.fillStyle = '#ff7a2a';
    ctx.fillRect(ox + 14, 500, 62, 40 + flick * 0.4);
    ctx.fillStyle = '#ffcf5c';
    ctx.fillRect(ox + 22, 508, 46, 24);
  }

  // A counter ledge across the back.
  ctx.fillStyle = '#5b3418';
  ctx.fillRect(0, 560, VIEW_W, 80);
  ctx.fillStyle = '#7a4a21';
  ctx.fillRect(0, 560, VIEW_W, 10);
  // A pumpkin pie and a gravy boat on the counter, waiting.
  ctx.fillStyle = '#e8a33d';
  ctx.beginPath();
  ctx.ellipse(430, 552, 42, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b85c14';
  ctx.beginPath();
  ctx.ellipse(430, 548, 42, 10, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGround(ctx, W) {
  if (W.stage === 0) {
    // Dirt path with a grass strip on top.
    ctx.fillStyle = '#a06a35';
    ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);
    ctx.fillStyle = '#7a9e4b';
    ctx.fillRect(0, GROUND_Y, VIEW_W, 16);
    ctx.fillStyle = '#6b8f3e';
    repeatAt(W.bgMid * 1.6, 130, VIEW_W, (x) => {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 2);
      ctx.lineTo(x + 6, GROUND_Y - 8);
      ctx.lineTo(x + 12, GROUND_Y + 2);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    repeatAt(W.bgMid, 240, VIEW_W, (x) => {
      ctx.beginPath();
      ctx.ellipse(x + 40, GROUND_Y + 90, 46, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (W.stage === 1) {
    // Barn floor: wooden planks.
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);
    ctx.strokeStyle = '#6e451f';
    ctx.lineWidth = 3;
    for (let y = GROUND_Y + 34; y < VIEW_H; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_W, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    repeatAt(W.bgMid, 300, VIEW_W, (x) => {
      ctx.beginPath();
      ctx.ellipse(x + 60, GROUND_Y + 120, 52, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // Kitchen floor: checker tiles.
    const tile = 64;
    for (let y = GROUND_Y; y < VIEW_H; y += tile) {
      for (let x = 0; x < VIEW_W; x += tile) {
        const odd = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0;
        ctx.fillStyle = odd ? '#e8ddc8' : '#c9b896';
        ctx.fillRect(x, y, tile, tile);
      }
    }
    ctx.fillStyle = 'rgba(255, 122, 42, 0.12)';
    ctx.fillRect(0, GROUND_Y, VIEW_W, 26);
  }
}
