// input.js — keyboard and mouse state for the game.
// Keys are edge-triggered through pressed(): a press counts once until the
// game consumes it. The canvas reports mouse clicks in game coordinates.

export function createInput(canvas) {
  const input = {
    down: new Set(),
    queued: new Set(),
    mouseX: -1,
    mouseY: -1,
    clicked: false,
    clickX: 0,
    clickY: 0,
  };

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.queued.add(e.code);
    input.down.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.down.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.down.clear();
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    input.mouseX = x;
    input.mouseY = y;
    input.clicked = true;
    input.clickX = x;
    input.clickY = y;
  });
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
  });

  return input;
}

export function isDown(input, ...codes) {
  return codes.some((c) => input.down.has(c));
}

// True once per physical press; the game must call this every frame it cares.
export function pressed(input, ...codes) {
  for (const c of codes) {
    if (input.queued.has(c)) {
      input.queued.delete(c);
      return true;
    }
  }
  return false;
}

export function consumeClick(input) {
  const was = input.clicked;
  input.clicked = false;
  return was;
}

export function clickIn(input, rect) {
  if (!rect) return false;
  return (
    input.clicked &&
    input.clickX >= rect.x &&
    input.clickX <= rect.x + rect.w &&
    input.clickY >= rect.y &&
    input.clickY <= rect.y + rect.h
  );
}
