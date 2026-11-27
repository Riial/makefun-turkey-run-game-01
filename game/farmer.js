// farmer.js — the chaser. The farmer runs behind the turkey and closes in
// whenever the turkey stumbles; a caught turkey ends the run. Hiding makes
// the farmer stop and search, then give up and fall back.

import { GROUND_Y, clamp } from './render.js';

export const CAUGHT_GAP = 36;
export const MAX_GAP = 480;

export function createFarmer() {
  return {
    gap: 300,
    state: 'chase', // 'chase' | 'search' | 'lost'
    searchT: 0,
    runPhase: 0,
    stepT: 0,
  };
}

// Returns events the main loop should act on: 'step', 'lost', 'caught'.
export function updateFarmer(F, W, dt) {
  const events = [];
  F.runPhase += W.speed * dt * 0.05;

  if (F.state === 'search') {
    F.searchT -= dt;
    if (F.searchT <= 0) {
      F.state = 'lost';
      F.gap = Math.min(MAX_GAP, F.gap + 160);
      events.push('lost');
      F.state = 'chase';
    }
    return events;
  }

  // The farmer is a little slower than a clean run, faster than a stumble:
  // every hit lets him close in, every dash lets the turkey pull away.
  const farmerSpeed = W.speed * 0.99 + 6 + W.stage * 16;
  F.gap += (W.speed - farmerSpeed) * dt;
  F.gap = clamp(F.gap, CAUGHT_GAP, MAX_GAP);

  if (F.gap <= CAUGHT_GAP + 0.5) {
    events.push('caught');
    return events;
  }

  // Heavy footsteps when he is close enough to hear.
  if (F.gap < 240) {
    F.stepT -= dt;
    if (F.stepT <= 0) {
      F.stepT = 0.42;
      events.push('step');
    }
  }
  return events;
}

export function startSearch(F) {
  F.state = 'search';
  F.searchT = 1.8;
}

export function drawFarmer(ctx, F, W) {
  const turkeyX = W.turkey.x;
  const x = turkeyX - F.gap;
  const y = GROUND_Y;
  const inKitchen = W.stage === 2;
  const close = F.gap < 150;

  ctx.save();
  ctx.translate(x, y);

  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(40, 2, 52, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  const legSwing = Math.sin(F.runPhase * 2) * 14;
  // Legs (dark trousers).
  ctx.strokeStyle = '#2c3e50';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(28, -58);
  ctx.lineTo(28 + legSwing, 0);
  ctx.moveTo(52, -58);
  ctx.lineTo(52 - legSwing, 0);
  ctx.stroke();

  // Overalls.
  ctx.fillStyle = '#3a5a8c';
  ctx.beginPath();
  ctx.moveTo(16, -118);
  ctx.lineTo(64, -118);
  ctx.lineTo(60, -56);
  ctx.lineTo(20, -56);
  ctx.closePath();
  ctx.fill();
  // Shirt sleeves and chest.
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(14, -116, 52, 26);
  ctx.fillRect(10, -112, 10, 40);
  ctx.fillRect(60, -112, 10, 40);
  // Overall straps.
  ctx.fillStyle = '#2f4a75';
  ctx.fillRect(24, -118, 7, 30);
  ctx.fillRect(49, -118, 7, 30);

  // Arms: one pumping, one holding the tool.
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(14, -104);
  ctx.lineTo(-2, -84 + Math.sin(F.runPhase * 2) * 8);
  ctx.stroke();

  // Tool: pitchfork on the farm, cleaver in the kitchen.
  ctx.save();
  ctx.translate(72, -96);
  ctx.rotate(0.35);
  if (inKitchen) {
    // Cleaver: wide steel blade with a hole, dark handle.
    ctx.fillStyle = '#5b3a1e';
    ctx.fillRect(-4, -26, 9, 26);
    ctx.fillStyle = '#cfd6dd';
    ctx.fillRect(-14, 0, 34, 30);
    ctx.fillStyle = '#8a97a3';
    ctx.fillRect(-14, 26, 34, 4);
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(12, 12, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Pitchfork: wooden shaft, three steel prongs.
    ctx.strokeStyle = '#7a4a21';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.lineTo(0, -34);
    ctx.stroke();
    ctx.strokeStyle = '#cfd6dd';
    ctx.lineWidth = 4;
    for (const px of [-10, 0, 10]) {
      ctx.beginPath();
      ctx.moveTo(px, -34);
      ctx.lineTo(px, -58);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Head: skin, angry brows, moustache.
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(40, -132, 17, 0, Math.PI * 2);
  ctx.fill();
  // Nose.
  ctx.fillStyle = '#d99a68';
  ctx.beginPath();
  ctx.arc(54, -130, 4, 0, Math.PI * 2);
  ctx.fill();
  // Angry eyebrows.
  ctx.strokeStyle = '#4a2c14';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(30, -142);
  ctx.lineTo(40, -138);
  ctx.moveTo(56, -138);
  ctx.lineTo(48, -142);
  ctx.stroke();
  // Eyes.
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.arc(35, -134, 2.5, 0, Math.PI * 2);
  ctx.arc(51, -134, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Moustache.
  ctx.fillStyle = '#4a2c14';
  ctx.beginPath();
  ctx.ellipse(46, -122, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hat: straw on the farm, tall chef hat in the kitchen.
  if (inKitchen) {
    ctx.fillStyle = '#f5f0e6';
    ctx.beginPath();
    ctx.ellipse(40, -150, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(40, -160, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8d2c2';
    ctx.fillRect(24, -152, 32, 5);
  } else {
    ctx.fillStyle = '#d9a441';
    ctx.beginPath();
    ctx.ellipse(40, -146, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(40, -152, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a67c2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(40, -150, 15, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Spotting mark: "!" when close, "?" while searching.
  if (F.state === 'search') {
    drawMark(ctx, 40, -196, '?', '#ffd94d');
  } else if (close) {
    drawMark(ctx, 40, -196, '!', '#ff3b30');
  }
  ctx.restore();
}

function drawMark(ctx, x, y, ch, color) {
  ctx.font = '900 44px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(43, 20, 8, 0.9)';
  ctx.strokeText(ch, x, y);
  ctx.fillStyle = color;
  ctx.fillText(ch, x, y);
}
