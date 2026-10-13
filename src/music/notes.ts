// Pitch helpers and the open-G banjo tuning (gDGBD).

export const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Open-string MIDI notes for strings 4, 3, 2, 1 (D3 G3 B3 D4). */
export const OPEN_STRINGS = [50, 55, 59, 62] as const;

/** The short 5th string, always played open (g4). */
export const FIFTH_STRING = 67;

export const MAX_FRET = 17;

export const pc = (midi: number) => ((midi % 12) + 12) % 12;

export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export const freqToMidi = (freq: number) => 69 + 12 * Math.log2(freq / 440);

export function midiName(midi: number): string {
  return NOTE_NAMES[pc(midi)] + (Math.floor(midi / 12) - 1);
}

/** Parse a root name like "C#", "Db", "bb" into a pitch class, or null. */
export function parseRoot(s: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]?)$/.exec(s.trim());
  if (!m) return null;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let p = base[m[1].toUpperCase()];
  if (m[2] === '#' || m[2] === '♯') p += 1;
  if (m[2] === 'b' || m[2] === '♭') p -= 1;
  return pc(p);
}
