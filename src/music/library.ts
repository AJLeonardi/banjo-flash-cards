// Generates every chord voicing on the neck and numbers positions low-to-high.

import { MAX_FRET, NOTE_NAMES, OPEN_STRINGS, parseRoot, pc } from './notes';
import { CHORD_TYPES, CHORD_TYPE_BY_ID, ChordType, OPEN_EXTRAS, SHAPES } from './shapes';

export type Frets = [number, number, number, number];

export interface Chord {
  id: string; // e.g. "D", "Em7", "Bb°7"
  root: number;
  type: ChordType;
  name: string;
  /** Sorted pitch classes — equal keys mean the same notes (Em7 = G6). */
  pcKey: string;
  voicings: Voicing[];
}

export interface Voicing {
  id: string; // e.g. "D@2" (chord D, position 2)
  chordId: string;
  position: number; // 1-based, ordered by where the hand sits on the neck
  frets: Frets;
  midi: number[];
  /** Where the hand sits: the lowest fretted fret (0 for all-open). */
  anchor: number;
  minFret: number;
  maxFret: number;
  hasOpen: boolean;
  shapeName: string;
}

export const chordName = (root: number, type: ChordType) => NOTE_NAMES[root] + CHORD_TYPE_BY_ID[type].suffix;

const pcKeyOf = (pcs: number[]) => [...new Set(pcs.map(pc))].sort((a, b) => a - b).join(',');

function isPlayable(f: Frets): boolean {
  if (f.some((x) => x < 0 || x > MAX_FRET)) return false;
  const fretted = f.filter((x) => x > 0);
  // Open strings only make sense near the nut.
  if (fretted.length < 4 && Math.max(...f) > 5) return false;
  return true;
}

function buildLibrary(): Chord[] {
  const chords: Chord[] = [];
  for (const t of CHORD_TYPES) {
    for (let root = 0; root < 12; root++) {
      const id = chordName(root, t.id);
      const found = new Map<string, { frets: Frets; shapeName: string }>();
      for (const s of SHAPES[t.id]) {
        for (let shift = -24; shift <= 24; shift++) {
          if ((((shift - (root - s.refRoot)) % s.period) + s.period) % s.period !== 0) continue;
          const frets = s.frets.map((x) => x + shift) as Frets;
          if (!isPlayable(frets)) continue;
          const key = frets.join('-');
          if (!found.has(key)) found.set(key, { frets, shapeName: s.name });
        }
      }
      for (const e of OPEN_EXTRAS) {
        if (e.root === root && e.type === t.id) found.set(e.frets.join('-'), { frets: e.frets, shapeName: 'Open' });
      }
      const voicings = [...found.values()]
        .map(({ frets, shapeName }) => {
          const fretted = frets.filter((x) => x > 0);
          return {
            frets,
            shapeName,
            midi: frets.map((f, i) => OPEN_STRINGS[i] + f),
            anchor: fretted.length ? Math.min(...fretted) : 0,
            minFret: Math.min(...frets),
            maxFret: Math.max(...frets),
            hasOpen: frets.some((x) => x === 0),
          };
        })
        .sort((a, b) => a.anchor - b.anchor || Number(b.hasOpen) - Number(a.hasOpen) || a.maxFret - b.maxFret)
        .map((v, i) => ({ ...v, id: `${id}@${i + 1}`, chordId: id, position: i + 1 }));
      chords.push({
        id,
        root,
        type: t.id,
        name: id,
        pcKey: pcKeyOf(t.intervals.map((x) => x + root)),
        voicings,
      });
    }
  }
  return chords;
}

export const CHORDS: Chord[] = buildLibrary();
export const CHORD_BY_ID: Record<string, Chord> = Object.fromEntries(CHORDS.map((c) => [c.id, c]));
export const ALL_VOICINGS: Voicing[] = CHORDS.flatMap((c) => c.voicings);
export const VOICING_BY_ID: Record<string, Voicing> = Object.fromEntries(ALL_VOICINGS.map((v) => [v.id, v]));

/**
 * Where the chord sits, named by its lowest fret: the index-finger fret, which is the
 * "5fr" / Roman-numeral marker on chord charts. Chords using open strings are "Open".
 */
export function fretLabel(v: Voicing): string {
  return v.hasOpen ? 'Open' : `Fret ${v.minFret}`;
}

/** Fret numbers for strings 4→1, e.g. "5-4-3-3". */
export const fretPattern = (v: Voicing) => v.frets.join('-');

/** "open" for chords near the nut with open strings, else "frets 4–7". */
export function fretRangeLabel(v: Voicing): string {
  if (v.maxFret === 0) return 'open';
  if (v.hasOpen) return `open, frets ${v.anchor}–${v.maxFret}`;
  return v.minFret === v.maxFret ? `fret ${v.minFret}` : `frets ${v.minFret}–${v.maxFret}`;
}

const SUFFIX_ALIASES: Record<string, ChordType> = {
  '': 'maj', maj: 'maj', M: 'maj',
  m: 'min', min: 'min', '-': 'min',
  '7': '7', dom7: '7',
  m7: 'm7', min7: 'm7', '-7': 'm7',
  '6': '6',
  dim: 'dim', dim7: 'dim', '°': 'dim', '°7': 'dim', o: 'dim', o7: 'dim',
};

/** Parse "G, C, D7, Em" into chord ids. Returns ids and any tokens it couldn't read. */
export function parseChordList(text: string): { ids: string[]; bad: string[] } {
  const ids: string[] = [];
  const bad: string[] = [];
  for (const tok of text.split(/[\s,]+/).filter(Boolean)) {
    const m = /^([A-Ga-g][#b♯♭]?)(.*)$/.exec(tok);
    const root = m ? parseRoot(m[1]) : null;
    const type = m ? SUFFIX_ALIASES[m[2]] : undefined;
    if (root === null || !type) {
      bad.push(tok);
      continue;
    }
    const id = chordName(root, type);
    if (!ids.includes(id)) ids.push(id);
  }
  return { ids, bad };
}
