// Small in-place radix-2 FFT. Kept in JS (not AnalyserNode) so the whole detection
// pipeline is pure and can be tested on synthesized audio.

const windows = new Map<number, Float32Array>();

export function hann(n: number): Float32Array {
  let w = windows.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    windows.set(n, w);
  }
  return w;
}

/** Magnitude spectrum (length size/2) of `samples` (last `frame` samples, Hann-windowed, zero-padded to `size`). */
export function magnitudeSpectrum(samples: Float32Array, frame: number, size: number): Float32Array {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const start = Math.max(0, samples.length - frame);
  const n = samples.length - start;
  const w = hann(n);
  for (let i = 0; i < n; i++) re[i] = samples[start + i] * w[i];
  fft(re, im);
  const out = new Float32Array(size / 2);
  for (let i = 0; i < size / 2; i++) out[i] = Math.hypot(re[i], im[i]);
  return out;
}

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}
