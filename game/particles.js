// particles.js — feathers, leaves, embers, dust and floating score popups.
// Everything here is cosmetic: it never changes the game state.

export function createParticles() {
  return { bits: [], popups: [] };
}

function pushBit(P, bit) {
  if (P.bits.length > 220) P.bits.shift();
  P.bits.push(bit);
}

export function spawnFeathers(P, x, y, n, rng) {
  for (let i = 0; i < n; i++) {
    pushBit(P, {
      kind: 'feather',
      x: x + (rng() - 0.5) * 40,
      y: y + (rng() - 0.5) * 30,
      vx: (rng() - 0.5) * 160,
      vy: -40 - rng() * 160,
      rot: rng() * Math.PI * 2,
      vr: (rng() - 0.5) * 6,
      life: 0.9 + rng() * 0.7,
      age: 0,
      size: 7 + rng() * 7,
      color: rng() < 0.5 ? '#f5ead2' : '#c98f4e',
    });
  }
}

export function spawnDust(P, x, y, n, rng) {
  for (let i = 0; i < n; i++) {
    pushBit(P, {
      kind: 'dust',
      x: x + (rng() - 0.5) * 30,
      y: y - rng() * 6,
      vx: (rng() - 0.5) * 90,
      vy: -20 - rng() * 50,
      rot: 0,
      vr: 0,
      life: 0.4 + rng() * 0.3,
      age: 0,
      size: 4 + rng() * 6,
      color: 'rgba(210, 180, 140, 0.7)',
    });
  }
}

export function spawnLeaf(P, x, y, rng) {
  pushBit(P, {
    kind: 'leaf',
    x,
    y,
    vx: -30 - rng() * 60,
    vy: 20 + rng() * 40,
    rot: rng() * Math.PI * 2,
    vr: (rng() - 0.5) * 4,
    life: 2.5 + rng(),
    age: 0,
    size: 8 + rng() * 6,
    color: ['#d97b29', '#e8a33d', '#b85c38'][Math.floor(rng() * 3)],
  });
}

export function spawnEmber(P, x, y, rng) {
  pushBit(P, {
    kind: 'ember',
    x: x + (rng() - 0.5) * 60,
    y,
    vx: (rng() - 0.5) * 24,
    vy: -50 - rng() * 80,
    rot: 0,
    vr: 0,
    life: 0.7 + rng() * 0.6,
    age: 0,
    size: 2 + rng() * 4,
    color: rng() < 0.5 ? '#ffcf5c' : '#ff7a2a',
  });
}

export function spawnPopup(P, text, x, y, color, size) {
  P.popups.push({ text, x, y, color: color || '#fff3c4', size: size || 30, age: 0, life: 1.25 });
  if (P.popups.length > 8) P.popups.shift();
}

export function updateParticles(P, dt) {
  for (const b of P.bits) {
    b.age += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.vr * dt;
    if (b.kind === 'feather') {
      b.vy += 260 * dt; // feathers flutter down, slowed by drag
      b.vx *= 1 - 1.6 * dt;
      b.vy = Math.min(b.vy, 90);
    } else if (b.kind === 'leaf') {
      b.vy += 30 * dt;
      b.x += Math.sin(b.age * 6) * 22 * dt;
    } else if (b.kind === 'ember') {
      b.vy -= 40 * dt;
    } else {
      b.vy += 120 * dt;
    }
  }
  P.bits = P.bits.filter((b) => b.age < b.life);
  for (const p of P.popups) {
    p.age += dt;
    p.y -= 46 * dt;
  }
  P.popups = P.popups.filter((p) => p.age < p.life);
}

export function drawParticles(ctx, P) {
  for (const b of P.bits) {
    const fade = 1 - b.age / b.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    if (b.kind === 'feather') {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.size, b.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 70, 20, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-b.size, 0);
      ctx.lineTo(b.size, 0);
      ctx.stroke();
    } else if (b.kind === 'leaf') {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.size, b.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'ember') {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.size * fade, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawPopups(ctx, P) {
  for (const p of P.popups) {
    const fade = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fade * 1.6));
    ctx.font = `800 ${p.size}px "Trebuchet MS", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(43, 20, 8, 0.9)';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
}
