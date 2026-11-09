/**
 * S2C sound family. Everything is synthesised live with Web Audio: one metallic FM bell voice
 * (struck gold), one soft noise body, one low thud. No sample files.
 */
export type Cue = 'place' | 'fill' | 'tp' | 'sl' | 'warn' | 'violation' | 'funded' | 'payout' | 'bar' | 'print' | 'cancel';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.6;
let barTick = false;

export function configureSound(o: { enabled: boolean; volume: number; barTick: boolean }) {
  enabled = o.enabled;
  volume = o.volume;
  barTick = o.barTick;
  if (master) master.gain.value = volume;
}

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Struck-metal bell: sine carrier with an inharmonic FM modulator that decays faster than the body. */
function bell(t: number, freq: number, dur: number, gain: number, bright = 1) {
  const c = ac();
  const car = c.createOscillator();
  const mod = c.createOscillator();
  const modGain = c.createGain();
  const amp = c.createGain();
  car.frequency.value = freq;
  mod.frequency.value = freq * 3.47;
  modGain.gain.setValueAtTime(freq * 1.6 * bright, t);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.02, t + dur * 0.5);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  mod.connect(modGain).connect(car.frequency);
  car.connect(amp).connect(master!);
  car.start(t);
  mod.start(t);
  car.stop(t + dur + 0.05);
  mod.stop(t + dur + 0.05);
}

function noise(t: number, dur: number, gain: number, from: number, to: number, q = 1.2) {
  const c = ac();
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(amp).connect(master!);
  src.start(t);
  src.stop(t + dur);
}

function thud(t: number, from: number, to: number, dur: number, gain: number) {
  const c = ac();
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(amp).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function play(cue: Cue) {
  if (!enabled) return;
  if (cue === 'bar' && !barTick) return;
  let t: number;
  try {
    t = ac().currentTime + 0.01;
  } catch {
    return;
  }
  switch (cue) {
    case 'bar':
      bell(t, 2350, 0.05, 0.05, 0.4);
      break;
    case 'place':
      bell(t, 1046, 0.09, 0.12, 0.6);
      bell(t + 0.055, 1568, 0.12, 0.09, 0.6);
      break;
    case 'cancel':
      bell(t, 1318, 0.08, 0.08, 0.5);
      bell(t + 0.05, 987, 0.12, 0.07, 0.5);
      break;
    case 'fill':
      bell(t, 659, 0.55, 0.22, 1);
      bell(t, 1318, 0.3, 0.06, 0.7);
      noise(t, 0.08, 0.04, 6000, 3000, 2);
      break;
    case 'tp':
      bell(t, 784, 0.7, 0.2, 1.1);
      bell(t + 0.09, 1175, 0.9, 0.18, 1.1);
      bell(t + 0.18, 1568, 1.1, 0.12, 0.9);
      noise(t + 0.05, 0.6, 0.03, 9000, 5000, 3);
      break;
    case 'sl':
      thud(t, 180, 58, 0.32, 0.5);
      noise(t, 0.16, 0.06, 900, 250, 0.8);
      break;
    case 'warn':
      bell(t, 523, 0.14, 0.14, 0.4);
      bell(t + 0.16, 523, 0.14, 0.14, 0.4);
      break;
    case 'violation':
      thud(t, 160, 40, 0.9, 0.6);
      bell(t + 0.05, 311, 1.2, 0.14, 1.4);
      bell(t + 0.32, 233, 1.6, 0.12, 1.4);
      noise(t, 1.2, 0.05, 2000, 120, 0.7);
      break;
    case 'funded':
      [523, 659, 784, 1046, 1318].forEach((f, i) => bell(t + i * 0.11, f, 1.6 - i * 0.1, 0.16, 1));
      bell(t + 0.62, 2093, 2.2, 0.07, 0.8);
      noise(t + 0.55, 1.6, 0.025, 11000, 6000, 4);
      break;
    case 'payout':
      for (let i = 0; i < 4; i++) bell(t + i * 0.07, 1760 + i * 140, 0.35, 0.1, 1.3);
      thud(t + 0.3, 300, 120, 0.25, 0.25);
      break;
    case 'print':
      for (let i = 0; i < 10; i++) noise(t + i * 0.055, 0.035, 0.05, 3200, 2400, 3);
      break;
  }
}
