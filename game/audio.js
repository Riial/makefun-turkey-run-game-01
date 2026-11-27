// audio.js — every sound is synthesized live with WebAudio. No audio files,
// no network: oscillators and filtered noise only. The context starts on the
// first user gesture (browsers block audio before that).

export function createAudio() {
  return {
    ctx: null,
    master: null,
    musicGain: null,
    muted: false,
    musicOn: false,
    step: 0,
    nextNoteTime: 0,
  };
}

export function ensureAudio(A) {
  if (A.ctx) {
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.5;
    A.master.connect(A.ctx.destination);
    A.musicGain = A.ctx.createGain();
    A.musicGain.gain.value = 0.16;
    A.musicGain.connect(A.master);
    A.nextNoteTime = A.ctx.currentTime + 0.1;
    return true;
  } catch {
    return false;
  }
}

export function setMuted(A, muted) {
  A.muted = muted;
  if (A.master) A.master.gain.value = muted ? 0 : 0.5;
}

function tone(A, freq, dur, type, vol, slideTo, when) {
  if (!A.ctx || A.muted) return;
  const t0 = when ?? A.ctx.currentTime;
  const osc = A.ctx.createOscillator();
  const gain = A.ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  gain.gain.setValueAtTime(vol || 0.2, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(A.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(A, dur, filterFreq, vol, when) {
  if (!A.ctx || A.muted) return;
  const t0 = when ?? A.ctx.currentTime;
  const len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
  const buffer = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = A.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = A.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq || 1200;
  filter.Q.value = 0.8;
  const gain = A.ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.25, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(A.master);
  src.start(t0);
}

export function playJump(A) {
  tone(A, 280, 0.16, 'square', 0.16, 640);
}

export function playLand(A) {
  noiseBurst(A, 0.08, 300, 0.12);
}

export function playPickup(A) {
  tone(A, 660, 0.09, 'sine', 0.22);
  tone(A, 990, 0.14, 'sine', 0.22, null, A.ctx ? A.ctx.currentTime + 0.08 : undefined);
}

export function playGolden(A) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  [523, 659, 784, 1047].forEach((f, i) => tone(A, f, 0.16, 'triangle', 0.22, null, t + i * 0.07));
}

export function playFeather(A) {
  tone(A, 880, 0.1, 'triangle', 0.18, 1320);
}

export function playNearMiss(A) {
  noiseBurst(A, 0.28, 2400, 0.3);
  tone(A, 1200, 0.12, 'sine', 0.12, 1800);
}

export function playHit(A) {
  tone(A, 160, 0.3, 'sawtooth', 0.3, 60);
  noiseBurst(A, 0.2, 400, 0.3);
}

export function playSlip(A) {
  tone(A, 500, 0.25, 'sine', 0.2, 140);
}

export function playGobble(A) {
  if (!A.ctx || A.muted) return;
  const t = A.ctx.currentTime;
  for (let i = 0; i < 4; i++) {
    tone(A, 340 - i * 30, 0.09, 'sawtooth', 0.16, 220, t + i * 0.09);
  }
}

export function playWin(A) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(A, f, 0.3, 'triangle', 0.24, null, t + i * 0.12));
}

export function playLose(A) {
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  [392, 370, 349, 311].forEach((f, i) => tone(A, f, 0.32, 'sawtooth', 0.16, null, t + i * 0.18));
}

export function playWhistle(A) {
  tone(A, 2200, 0.5, 'sine', 0.1, 900);
}

export function playStep(A) {
  noiseBurst(A, 0.06, 180, 0.14);
}

export function playDash(A) {
  noiseBurst(A, 0.22, 900, 0.2);
}

export function playClick(A) {
  tone(A, 700, 0.05, 'square', 0.14);
}

// Simple jaunty loop: a bass line and a pentatonic lead, 16 sixteenth steps.
const BASS = [131, 0, 131, 0, 165, 0, 131, 0, 196, 0, 165, 0, 147, 0, 165, 0];
const LEAD = [523, 0, 587, 659, 0, 659, 587, 0, 523, 0, 440, 494, 0, 587, 0, 0];
const STEP_SECONDS = 60 / 140 / 4;

export function updateMusic(A) {
  if (!A.ctx || A.muted || !A.musicOn) return;
  while (A.nextNoteTime < A.ctx.currentTime + 0.25) {
    const i = A.step % 16;
    const bass = BASS[i];
    const lead = LEAD[i];
    if (bass) {
      const osc = A.ctx.createOscillator();
      const gain = A.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = bass;
      gain.gain.setValueAtTime(0.5, A.nextNoteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, A.nextNoteTime + STEP_SECONDS * 0.95);
      osc.connect(gain);
      gain.connect(A.musicGain);
      osc.start(A.nextNoteTime);
      osc.stop(A.nextNoteTime + STEP_SECONDS);
    }
    if (lead) {
      const osc = A.ctx.createOscillator();
      const gain = A.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = lead;
      gain.gain.setValueAtTime(0.16, A.nextNoteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, A.nextNoteTime + STEP_SECONDS * 0.9);
      osc.connect(gain);
      gain.connect(A.musicGain);
      osc.start(A.nextNoteTime);
      osc.stop(A.nextNoteTime + STEP_SECONDS);
    }
    A.step += 1;
    A.nextNoteTime += STEP_SECONDS;
  }
}
