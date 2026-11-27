// obstacles.js — everything the turkey must dodge, jump, slide past or hide
// behind: fences, hay bales, puddles, rolling pumpkins, falling and hanging
// carving knives, flaming ovens, and the covers the turkey hides behind.
// Each obstacle knows how to move, how to draw itself and how it hurts.

import { GROUND_Y, clamp } from './render.js';

// Spawn weights per stage: farmyard, barn, kitchen.
const TABLES = [
  { fence: 0.24, haybale: 0.2, puddle: 0.15, pumpkin: 0.15, fallingKnife: 0.11, cover: 0.15 },
  { haybale: 0.2, puddle: 0.14, pumpkin: 0.15, fallingKnife: 0.16, hangingKnife: 0.15, cover: 0.1, fence: 0.1 },
  { oven: 0.3, fallingKnife: 0.2, hangingKnife: 0.2, pumpkin: 0.1, puddle: 0.1, cover: 0.1 },
];

export function pickObstacleType(W) {
  const table = TABLES[W.stage];
  let roll = W.rng();
  for (const [type, weight] of Object.entries(table)) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return 'fence';
}

export function makeObstacle(type, x, W) {
  const base = { type, x, passed: false, hit: false, t: 0 };
  switch (type) {
    case 'fence':
      return { ...base, y: GROUND_Y - 72, w: 26, h: 72 };
    case 'haybale':
      return { ...base, y: GROUND_Y - 62, w: 96, h: 62 };
    case 'puddle':
      return { ...base, y: GROUND_Y - 14, w: 112, h: 14 };
    case 'pumpkin':
      return { ...base, y: GROUND_Y - 68, w: 68, h: 68, rot: 0 };
    case 'fallingKnife':
      // Telegraph first: the shadow and "!" warn where it will land.
      return { ...base, y: -140, w: 30, h: 130, state: 'warn', warnT: 0.7, vy: 0, targetX: x };
    case 'hangingKnife':
      return { ...base, y: 0, w: 46, h: 600, phase: W.rng() * Math.PI * 2 };
    case 'oven':
      return { ...base, y: GROUND_Y - 118, w: 132, h: 118, flame: W.rng() * 10 };
    case 'cover':
      // Hide spots: haystack on the farm, crate in the barn, pot stack in the kitchen.
      if (W.stage === 0) return { ...base, kind: 'haystack', y: GROUND_Y - 112, w: 122, h: 112 };
      if (W.stage === 1) return { ...base, kind: 'crate', y: GROUND_Y - 92, w: 100, h: 92 };
      return { ...base, kind: 'pots', y: GROUND_Y - 104, w: 108, h: 104 };
    default:
      return { ...base, y: GROUND_Y - 72, w: 26, h: 72 };
  }
}

export function updateObstacles(W, dt) {
  for (const ob of W.obstacles) {
    ob.t += dt;
    const extra = ob.type === 'pumpkin' ? 150 : 0;
    ob.x -= (W.speed + extra) * dt;
    if (ob.type === 'pumpkin') ob.rot += ((W.speed + extra) * dt) / 34;
    if (ob.type === 'fallingKnife') {
      if (ob.state === 'warn') {
        ob.warnT -= dt;
        if (ob.warnT <= 0) {
          ob.state = 'falling';
          ob.vy = 0;
        }
      } else if (ob.state === 'falling') {
        ob.vy += 5200 * dt;
        ob.y += ob.vy * dt;
        if (ob.y + ob.h >= GROUND_Y + 6) {
          ob.y = GROUND_Y + 6 - ob.h;
          ob.state = 'stuck';
          ob.t = 0;
        }
      }
    }
    if (ob.type === 'hangingKnife') ob.phase += dt * 2.1;
  }
  W.obstacles = W.obstacles.filter((ob) => {
    if (ob.type === 'fallingKnife' && ob.state === 'stuck' && ob.t > 0.9) return false;
    return ob.x + ob.w > -120;
  });
}

// The knife blade's box while it falls or sticks in the ground.
function knifeBox(ob) {
  return { x: ob.targetX - 12, y: ob.y + 30, w: 26, h: ob.h - 30 };
}

// The hanging cleaver's box, swinging from the ceiling.
function hangingBox(ob) {
  const swing = Math.sin(ob.phase) * 34;
  const x = ob.x + swing;
  return { x: x - 20, y: 470, w: 44, h: 130 };
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Returns 'hit' (lose a life), 'slip' (stumble, no life lost) or null.
export function obstacleHit(W, ob, box) {
  if (ob.hit || ob.type === 'cover') return null;
  if (ob.type === 'puddle') {
    if (box.y + box.h >= GROUND_Y - 4 && boxesOverlap(box, ob)) {
      return W.turkey.sliding ? null : 'slip';
    }
    return null;
  }
  if (ob.type === 'fallingKnife') {
    if (ob.state === 'falling' || ob.state === 'stuck') {
      return boxesOverlap(box, knifeBox(ob)) ? 'hit' : null;
    }
    return null;
  }
  if (ob.type === 'hangingKnife') {
    // A sliding turkey ducks under the blade; a standing one is caught.
    if (W.turkey.sliding) return null;
    return boxesOverlap(box, hangingBox(ob)) ? 'hit' : null;
  }
  return boxesOverlap(box, ob) ? 'hit' : null;
}

// Called once an obstacle has gone past the turkey: a tight dodge is a
// near miss and feeds the combo. Returns true when it was a near miss.
export function checkPassed(W, ob, box) {
  if (ob.passed || ob.type === 'cover' || ob.type === 'puddle') return false;
  const past = ob.type === 'fallingKnife' ? ob.targetX + 20 < W.turkey.x : ob.x + ob.w < W.turkey.x;
  if (!past) return false;
  ob.passed = true;
  if (ob.hit) return false;
  if (ob.type === 'fallingKnife') {
    return Math.abs(ob.targetX - W.turkey.x) < 190;
  }
  if (ob.type === 'hangingKnife') {
    return W.turkey.sliding;
  }
  // Jumpables: a near miss needs the turkey in the air, close above the top.
  return !W.turkey.onGround && box.y + box.h < ob.y + 46;
}

// The nearest cover the turkey could hide behind right now, if any.
export function nearCover(W) {
  for (const ob of W.obstacles) {
    if (ob.type !== 'cover') continue;
    const cx = ob.x + ob.w / 2;
    if (Math.abs(cx - (W.turkey.x + W.turkey.w / 2)) < 130) return ob;
  }
  return null;
}

export function drawObstacles(ctx, W) {
  for (const ob of W.obstacles) {
    if (ob.type === 'cover') continue; // covers draw after the turkey
    switch (ob.type) {
      case 'fence': drawFence(ctx, ob); break;
      case 'haybale': drawHaybale(ctx, ob); break;
      case 'puddle': drawPuddle(ctx, ob); break;
      case 'pumpkin': drawPumpkin(ctx, ob); break;
      case 'fallingKnife': drawFallingKnife(ctx, ob, W); break;
      case 'hangingKnife': drawHangingKnife(ctx, ob); break;
      case 'oven': drawOven(ctx, ob, W); break;
      default: break;
    }
  }
}

export function drawCovers(ctx, W) {
  for (const ob of W.obstacles) {
    if (ob.type !== 'cover') continue;
    if (ob.kind === 'haystack') drawHaystack(ctx, ob);
    else if (ob.kind === 'crate') drawCrate(ctx, ob);
    else drawPotStack(ctx, ob);
  }
}

function drawFence(ctx, ob) {
  ctx.fillStyle = '#7a4a21';
  ctx.fillRect(ob.x, ob.y, 8, ob.h);
  ctx.fillRect(ob.x + ob.w - 8, ob.y, 8, ob.h);
  ctx.fillStyle = '#9c6a35';
  ctx.fillRect(ob.x - 8, ob.y + 12, ob.w + 16, 10);
  ctx.fillRect(ob.x - 8, ob.y + 40, ob.w + 16, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(ob.x - 8, ob.y + 12, ob.w + 16, 3);
  ctx.fillRect(ob.x - 8, ob.y + 40, ob.w + 16, 3);
}

function drawHaybale(ctx, ob) {
  ctx.fillStyle = '#c98f2e';
  ctx.beginPath();
  ctx.ellipse(ob.x + ob.w / 2, ob.y + ob.h / 2, ob.w / 2, ob.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0b45c';
  ctx.beginPath();
  ctx.ellipse(ob.x + ob.w / 2, ob.y + ob.h / 2, ob.w / 2 - 10, ob.h / 2 - 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a5f1a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(ob.x + ob.w / 2, ob.y + ob.h / 2, ob.w / 2 - 22, ob.h / 2 - 16, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPuddle(ctx, ob) {
  ctx.fillStyle = '#5a7a9a';
  ctx.beginPath();
  ctx.ellipse(ob.x + ob.w / 2, ob.y + ob.h / 2, ob.w / 2, ob.h / 2 + 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(ob.x + ob.w / 2 - 14, ob.y + ob.h / 2 - 2, 26, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(ob.x + ob.w / 2 + 18, ob.y + ob.h / 2 + 1, 16, 3, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPumpkin(ctx, ob) {
  ctx.save();
  ctx.translate(ob.x + ob.w / 2, ob.y + ob.h / 2);
  ctx.rotate(ob.rot || 0);
  ctx.fillStyle = '#e8862a';
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b85c14';
  ctx.lineWidth = 3;
  for (const dx of [-16, 0, 16]) {
    ctx.beginPath();
    ctx.ellipse(dx, 0, 8, 30, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // A grinning jack-o'-lantern face, so the rolling pumpkin reads as a threat.
  ctx.fillStyle = '#2b1a12';
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.lineTo(-6, -8);
  ctx.lineTo(-10, -1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, -8);
  ctx.lineTo(14, -8);
  ctx.lineTo(10, -1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-14, 10);
  ctx.lineTo(14, 10);
  ctx.lineTo(8, 18);
  ctx.lineTo(0, 12);
  ctx.lineTo(-8, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a7a2a';
  ctx.fillRect(-3, -38, 6, 10);
  ctx.restore();
}

function drawFallingKnife(ctx, ob, W) {
  if (ob.state === 'warn') {
    // Telegraph: a pulsing shadow on the ground and a red "!" above it.
    const pulse = 0.5 + 0.5 * Math.sin(ob.t * 22);
    ctx.fillStyle = `rgba(180, 30, 30, ${0.25 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(ob.targetX, GROUND_Y + 4, 34, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 40px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(43, 20, 8, 0.9)';
    ctx.strokeText('!', ob.targetX, GROUND_Y - 170);
    ctx.fillStyle = '#ff3b30';
    ctx.fillText('!', ob.targetX, GROUND_Y - 170);
    // A faint dotted line from the sky to the target.
    ctx.strokeStyle = 'rgba(255, 59, 48, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(ob.targetX, 40);
    ctx.lineTo(ob.targetX, GROUND_Y - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  // The knife itself: a real carving knife, silver blade and dark handle.
  const x = ob.targetX;
  const y = ob.y;
  const tilt = ob.state === 'stuck' ? 0.22 : 0;
  ctx.save();
  ctx.translate(x, y + ob.h / 2);
  ctx.rotate(tilt);
  ctx.fillStyle = '#cfd6dd';
  ctx.beginPath();
  ctx.moveTo(-8, -60);
  ctx.lineTo(10, -60);
  ctx.lineTo(14, 18);
  ctx.lineTo(-2, 34);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a97a3';
  ctx.beginPath();
  ctx.moveTo(-8, -60);
  ctx.lineTo(10, -60);
  ctx.lineTo(11, -40);
  ctx.lineTo(-7, -40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a2c14';
  ctx.fillRect(-9, 34, 20, 26);
  ctx.fillStyle = '#2b1a12';
  ctx.beginPath();
  ctx.arc(1, 44, 2.5, 0, Math.PI * 2);
  ctx.arc(1, 52, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHangingKnife(ctx, ob) {
  const swing = Math.sin(ob.phase) * 34;
  const pivotX = ob.x;
  const bladeX = pivotX + swing;
  // Rope from the ceiling.
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pivotX, 0);
  ctx.lineTo(bladeX, 470);
  ctx.stroke();
  // The cleaver: a wide steel blade that swings across the turkey's path.
  ctx.save();
  ctx.translate(bladeX, 520);
  ctx.rotate(Math.sin(ob.phase) * 0.35);
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(-7, -52, 14, 22);
  ctx.fillStyle = '#cfd6dd';
  ctx.beginPath();
  ctx.moveTo(-22, -30);
  ctx.lineTo(22, -30);
  ctx.lineTo(22, 52);
  ctx.lineTo(-22, 52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a97a3';
  ctx.fillRect(-22, 44, 44, 8);
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(10, 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOven(ctx, ob, W) {
  const flick = Math.sin(W.time * 9 + ob.flame) * 4;
  // Heat glow behind the oven.
  const glow = ctx.createRadialGradient(
    ob.x + ob.w / 2, ob.y + ob.h / 2, 10,
    ob.x + ob.w / 2, ob.y + ob.h / 2, 130,
  );
  glow.addColorStop(0, 'rgba(255, 122, 42, 0.35)');
  glow.addColorStop(1, 'rgba(255, 122, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(ob.x - 70, ob.y - 70, ob.w + 140, ob.h + 140);

  // Body: a black oven with a glowing door window.
  ctx.fillStyle = '#232323';
  ctx.beginPath();
  ctx.roundRect(ob.x, ob.y, ob.w, ob.h, 8);
  ctx.fill();
  ctx.strokeStyle = '#4a4a4a';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Control knobs on top.
  ctx.fillStyle = '#cfd6dd';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(ob.x + 26 + i * 28, ob.y + 12, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Door window: orange fire inside.
  const winY = ob.y + 34;
  ctx.fillStyle = '#ff7a2a';
  ctx.fillRect(ob.x + 14, winY, ob.w - 28, 46);
  ctx.fillStyle = '#ffcf5c';
  ctx.fillRect(ob.x + 22, winY + 8, ob.w - 44, 30);
  // Flames licking out of the door.
  ctx.fillStyle = '#ff5a1a';
  for (let i = 0; i < 3; i++) {
    const fx = ob.x + 30 + i * 34;
    const fh = 18 + ((i + Math.floor(W.time * 6 + ob.flame)) % 3) * 5 + flick * 0.4;
    ctx.beginPath();
    ctx.moveTo(fx - 9, winY + 40);
    ctx.quadraticCurveTo(fx, winY + 40 - fh, fx + 9, winY + 40);
    ctx.closePath();
    ctx.fill();
  }
  // The label: ROAST or OVEN, big and readable from across the screen.
  ctx.font = '900 26px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  const label = ob.flame > 5 ? 'ROAST' : 'OVEN';
  ctx.strokeText(label, ob.x + ob.w / 2, ob.y + ob.h - 16);
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(label, ob.x + ob.w / 2, ob.y + ob.h - 16);
  // Flames on top of the oven.
  ctx.fillStyle = '#ff7a2a';
  for (let i = 0; i < 2; i++) {
    const fx = ob.x + 40 + i * 52;
    const fh = 16 + Math.sin(W.time * 8 + ob.flame + i * 2) * 5;
    ctx.beginPath();
    ctx.moveTo(fx - 10, ob.y);
    ctx.quadraticCurveTo(fx, ob.y - fh, fx + 10, ob.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHaystack(ctx, ob) {
  ctx.fillStyle = '#d9a441';
  ctx.beginPath();
  ctx.moveTo(ob.x, ob.y + ob.h);
  ctx.quadraticCurveTo(ob.x + ob.w / 2, ob.y - 18, ob.x + ob.w, ob.y + ob.h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#a67c2e';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 5; i++) {
    const t = 0.2 + i * 0.15;
    ctx.beginPath();
    ctx.moveTo(ob.x + ob.w * t, ob.y + ob.h * 0.9);
    ctx.quadraticCurveTo(ob.x + ob.w * (t + 0.05), ob.y + ob.h * 0.4, ob.x + ob.w * (t - 0.03), ob.y + ob.h * 0.12);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a5f1a';
  ctx.fillRect(ob.x + ob.w / 2 - 26, ob.y + ob.h * 0.42, 52, 5);
}

function drawCrate(ctx, ob) {
  ctx.fillStyle = '#9c6a35';
  ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
  ctx.strokeStyle = '#6e451f';
  ctx.lineWidth = 4;
  ctx.strokeRect(ob.x + 2, ob.y + 2, ob.w - 4, ob.h - 4);
  ctx.beginPath();
  ctx.moveTo(ob.x, ob.y);
  ctx.lineTo(ob.x + ob.w, ob.y + ob.h);
  ctx.moveTo(ob.x + ob.w, ob.y);
  ctx.lineTo(ob.x, ob.y + ob.h);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(ob.x, ob.y, ob.w, 8);
}

function drawPotStack(ctx, ob) {
  // Three dark pots stacked: the kitchen's hiding spot.
  const pots = [
    { w: 92, h: 34, y: ob.y + ob.h - 34 },
    { w: 76, h: 32, y: ob.y + ob.h - 66 },
    { w: 58, h: 30, y: ob.y + ob.h - 96 },
  ];
  for (const p of pots) {
    const px = ob.x + (ob.w - p.w) / 2;
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    ctx.roundRect(px, p.y, p.w, p.h, 6);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.fillRect(px, p.y, p.w, 6);
    ctx.fillStyle = '#222';
    ctx.fillRect(px - 6, p.y + 8, 8, 5);
    ctx.fillRect(px + p.w - 2, p.y + 8, 8, 5);
  }
}
