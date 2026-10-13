// Turns a chunk of audio into a semitone spectrum and scores it against every
// voicing in the library.
//
// Each voicing gets a template: its four notes (plus the open 5th string) with
// decaying harmonics, laid out on semitone bins, and is scored by cosine
// similarity with the observed semitone spectrum. A chord's score is its best
// voicing's score, so the same comparison picks both the chord and the position.
// (Comparing octave-specific spectra beat folding to 12-note chroma on
// synthesized strums: chroma can't tell harmonics from chord tones.)

import { ALL_VOICINGS, CHORD_BY_ID, Voicing } from '../music/library';
import { FIFTH_STRING, midiToFreq } from '../music/notes';
import { magnitudeSpectrum } from './fft';

export const LOW_MIDI = 48; // C3
export const HIGH_MIDI = 96; // C7 — stays below the metronome click
const BINS = HIGH_MIDI - LOW_MIDI + 1;
const HARMONICS = [1, 0.75, 0.55, 0.45, 0.35, 0.28, 0.22, 0.18];
const DRONE_WEIGHT = 0.5;
/** Slight preference for triads, so a ringing harmonic doesn't turn G into G7. */
const FOUR_NOTE_PENALTY = 0.01;

export interface Analysis {
  rms: number;
  semis: Float32Array;
  chroma: Float32Array;
  /** Best voicing score per pitch-class set (chord identity). Em7 and G6 share a key. */
  pcKeyScores: Map<string, number>;
  /** Score per voicing id (position). */
  voicingScores: Map<string, number>;
}

function addNote(t: Float32Array, midi: number, gain: number) {
  HARMONICS.forEach((w, h) => {
    const m = Math.round(midi + 12 * Math.log2(h + 1)) - LOW_MIDI;
    if (m >= 0 && m < BINS) t[m] += gain * w;
  });
}

function fold(semis: Float32Array): Float32Array {
  const c = new Float32Array(12);
  for (let i = 0; i < semis.length; i++) c[(i + LOW_MIDI) % 12] += semis[i];
  return c;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

interface Template {
  voicing: Voicing;
  pcKey: string;
  penalty: number;
  semis: Float32Array;
}

const TEMPLATES: Template[] = ALL_VOICINGS.map((v) => {
  const semis = new Float32Array(BINS);
  for (const m of v.midi) addNote(semis, m, 1);
  addNote(semis, FIFTH_STRING, DRONE_WEIGHT);
  const pcKey = CHORD_BY_ID[v.chordId].pcKey;
  return { voicing: v, pcKey, penalty: pcKey.split(',').length > 3 ? FOUR_NOTE_PENALTY : 0, semis };
});

/** Semitone bins LOW_MIDI..HIGH_MIDI: peak magnitude within ±40 cents, compressed. */
export function semitoneSpectrum(samples: Float32Array, sampleRate: number): Float32Array {
  const frame = Math.min(samples.length, Math.round(sampleRate * 0.17));
  const size = 16384;
  const mag = magnitudeSpectrum(samples, frame, size);
  const hz = sampleRate / size;
  const out = new Float32Array(BINS);
  for (let i = 0; i < BINS; i++) {
    const f = midiToFreq(LOW_MIDI + i);
    const lo = Math.floor((f * Math.pow(2, -0.4 / 12)) / hz);
    const hi = Math.ceil((f * Math.pow(2, 0.4 / 12)) / hz);
    let peak = 0;
    for (let b = lo; b <= hi && b < mag.length; b++) peak = Math.max(peak, mag[b]);
    out[i] = peak;
  }
  // Normalize, square-root compress, and drop the noise floor.
  const max = Math.max(...out) || 1;
  for (let i = 0; i < BINS; i++) {
    const v = Math.sqrt(out[i] / max);
    out[i] = v > 0.15 ? v : 0;
  }
  return out;
}

export function rmsOf(samples: Float32Array, n = samples.length): number {
  let s = 0;
  const start = samples.length - n;
  for (let i = start; i < samples.length; i++) s += samples[i] * samples[i];
  return Math.sqrt(s / n);
}

export function analyze(samples: Float32Array, sampleRate: number): Analysis {
  const semis = semitoneSpectrum(samples, sampleRate);
  const chroma = fold(semis);
  const pcKeyScores = new Map<string, number>();
  const voicingScores = new Map<string, number>();
  for (const t of TEMPLATES) {
    const s = cosine(semis, t.semis);
    voicingScores.set(t.voicing.id, s);
    if (s - t.penalty > (pcKeyScores.get(t.pcKey) ?? -1)) pcKeyScores.set(t.pcKey, s - t.penalty);
  }
  return { rms: rmsOf(samples), semis, chroma, pcKeyScores, voicingScores };
}
