// render.js — small canvas drawing helpers shared by every game module.
// No game logic here: only shapes, text and deterministic random numbers.

// The game plays on a fixed 1280x800 stage; the ground line sits at y=640.
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const GROUND_Y = 640;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Deterministic PRNG (mulberry32) so screenshot scenes are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rounded-rectangle path (does not fill or stroke by itself).
export function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeRoundRect(ctx, x, y, w, h, r, stroke, width) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width || 2;
  ctx.stroke();
}

// Big readable text with a dark outline, for HUD and screen titles.
export function outlineText(ctx, text, x, y, size, fill, align, weight) {
  ctx.font = `${weight || 800} ${size}px "Trebuchet MS", "Segoe UI", sans-serif`;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.strokeStyle = 'rgba(43, 20, 8, 0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export function smallText(ctx, text, x, y, size, fill, align, weight) {
  ctx.font = `${weight || 700} ${size}px "Trebuchet MS", "Segoe UI", sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

// Vertical gradient helper.
export function vGradient(ctx, x0, y0, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x0, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}
