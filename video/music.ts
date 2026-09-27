/**
 * A quiet, original underscore for the film, synthesised from scratch (no
 * samples, nothing licensed): a slow pad on D major, a soft low root, and a
 * few music-box notes, through a small stereo reverb. Deterministic.
 *
 *   node video/music.ts --seconds 152 --out shots/video/work/music.wav
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback;
};
const SECONDS = Number(arg('seconds', '150'));
const OUT = resolve(arg('out', 'shots/video/work/music.wav'));
const SR = 48000;
const N = Math.ceil(SECONDS * SR);

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// Deterministic PRNG so every render gets the same music.
let seed = 0x2f8db1ec;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

/** Chords as MIDI notes (pad voicing, then bass root). One chord every BAR seconds. */
const BAR = 7.5;
const CHORDS: { pad: number[]; bass: number }[] = [
  { pad: [62, 66, 69, 73, 76], bass: 38 }, // Dmaj9
  { pad: [59, 62, 66, 69, 74], bass: 35 }, // Bm7(add11)
  { pad: [55, 59, 62, 66, 71], bass: 43 }, // Gmaj7
  { pad: [57, 61, 64, 66, 69], bass: 45 }, // A6
];
/** Music-box notes: D major pentatonic, upper register. */
const BELLS = [74, 76, 78, 81, 83, 86, 88];

const L = new Float32Array(N);
const R = new Float32Array(N);

// ---- pad ----
const bars = Math.ceil(SECONDS / BAR) + 1;
for (let b = 0; b < bars; b++) {
  // End on the tonic: the last chord that sounds is D.
  const last = (b + 1) * BAR >= SECONDS - 4;
  const chord = last ? CHORDS[0]! : CHORDS[b % CHORDS.length]!;
  const t0 = b * BAR;
  const len = last ? SECONDS - t0 : BAR + 3.5; // overlap into the next bar
  const i0 = Math.floor(t0 * SR);
  const n = Math.min(N - i0, Math.floor(len * SR));
  if (n <= 0) break;
  const voices = chord.pad.map((m, k) => ({ f: hz(m), pan: -0.6 + (1.2 * k) / (chord.pad.length - 1), ph: rand() * 6.28 }));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // Slow swell in, long release: pads breathe rather than switch.
    const env = Math.min(1, t / 2.2) * Math.min(1, (len - t) / 3.2) ** 1.5;
    if (env <= 0) continue;
    let l = 0;
    let r = 0;
    for (const v of voices) {
      const x = t0 + t;
      // Two slightly detuned partials for a soft chorus; a little 2nd harmonic for warmth.
      const s =
        Math.sin(2 * Math.PI * v.f * x + v.ph) +
        0.7 * Math.sin(2 * Math.PI * v.f * 1.0035 * x + v.ph * 1.7) +
        0.12 * Math.sin(4 * Math.PI * v.f * x + v.ph);
      const trem = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.11 * x + v.ph);
      l += s * trem * (1 - v.pan) * 0.5;
      r += s * trem * (1 + v.pan) * 0.5;
    }
    const bass = Math.sin(2 * Math.PI * hz(chord.bass) * (t0 + t)) * 0.9;
    L[i0 + i]! += (l * 0.055 + bass * 0.07) * env;
    R[i0 + i]! += (r * 0.055 + bass * 0.07) * env;
  }
}

// ---- music box ----
let tb = 5 + rand() * 2;
while (tb < SECONDS - 6) {
  const m = BELLS[Math.floor(rand() * BELLS.length)]!;
  const f = hz(m);
  const pan = rand() * 1.2 - 0.6;
  const vel = 0.05 + rand() * 0.035;
  const i0 = Math.floor(tb * SR);
  const n = Math.min(N - i0, SR * 4);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 1.6);
    const s = Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 3 * t) * Math.exp(-t * 4) + 0.1 * Math.sin(2 * Math.PI * f * 4.2 * t) * Math.exp(-t * 6);
    L[i0 + i]! += s * env * vel * (1 - pan) * 0.5;
    R[i0 + i]! += s * env * vel * (1 + pan) * 0.5;
  }
  // Sparse: a note every 2–5 s, sometimes a pair.
  tb += rand() < 0.25 ? 0.45 : 2 + rand() * 3;
}

// ---- gentle low-pass ----
function lowpass(x: Float32Array, cutoff: number) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y += a * (x[i]! - y);
}
lowpass(L, 5200);
lowpass(R, 5200);

// ---- reverb (Freeverb-style: parallel combs, series allpasses) ----
function reverb(x: Float32Array, offset: number): Float32Array {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round(((d + offset) * SR) / 44100));
  const alls = [556, 441, 341, 225].map((d) => Math.round(((d + offset) * SR) / 44100));
  const out = new Float32Array(x.length);
  const fb = 0.86;
  const damp = 0.3;
  for (const d of combs) {
    const buf = new Float32Array(d);
    let p = 0;
    let store = 0;
    for (let i = 0; i < x.length; i++) {
      const y = buf[p]!;
      store = y * (1 - damp) + store * damp;
      buf[p] = x[i]! + store * fb;
      out[i]! += y;
      p = (p + 1) % d;
    }
  }
  for (const d of alls) {
    const buf = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < out.length; i++) {
      const b = buf[p]!;
      const y = -out[i]! + b;
      buf[p] = out[i]! + b * 0.5;
      out[i] = y;
      p = (p + 1) % d;
    }
  }
  return out;
}
const wetL = reverb(L, 0);
const wetR = reverb(R, 23);
for (let i = 0; i < N; i++) {
  L[i] = L[i]! * 0.7 + wetL[i]! * 0.045;
  R[i] = R[i]! * 0.7 + wetR[i]! * 0.045;
}

// ---- fades and normalise to -3 dBFS ----
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = Math.min(1, t / 2.5) * Math.min(1, (SECONDS - t) / 5);
  L[i]! *= g;
  R[i]! *= g;
  peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!));
}
const gain = 0.708 / (peak || 1);

// ---- 16-bit stereo WAV ----
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i]! * gain)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i]! * gain)) * 32767), i * 4 + 2);
}
const head = Buffer.alloc(44);
head.write('RIFF', 0);
head.writeUInt32LE(36 + data.length, 4);
head.write('WAVE', 8);
head.write('fmt ', 12);
head.writeUInt32LE(16, 16);
head.writeUInt16LE(1, 20);
head.writeUInt16LE(2, 22);
head.writeUInt32LE(SR, 24);
head.writeUInt32LE(SR * 4, 28);
head.writeUInt16LE(4, 32);
head.writeUInt16LE(16, 34);
head.write('data', 36);
head.writeUInt32LE(data.length, 40);
writeFileSync(OUT, Buffer.concat([head, data]));
console.log(`music ${SECONDS.toFixed(1)} s → ${OUT}`);
