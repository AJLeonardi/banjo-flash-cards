// Chord types and the standard bluegrass banjo shapes for each.
//
// A shape is written as a concrete voicing for a reference root, with frets for
// strings [4, 3, 2, 1]. library.ts slides each shape up and down the neck to
// produce every root. `period` is how often the shape repeats (12 frets, or 3
// for the symmetric diminished 7th).

export type ChordType = 'maj' | 'min' | '7' | 'm7' | '6' | 'dim';

export interface ChordTypeInfo {
  id: ChordType;
  label: string;
  suffix: string;
  intervals: number[];
}

export const CHORD_TYPES: ChordTypeInfo[] = [
  { id: 'maj', label: 'Major', suffix: '', intervals: [0, 4, 7] },
  { id: 'min', label: 'Minor', suffix: 'm', intervals: [0, 3, 7] },
  { id: '7', label: '7th', suffix: '7', intervals: [0, 4, 7, 10] },
  { id: 'm7', label: 'Minor 7th', suffix: 'm7', intervals: [0, 3, 7, 10] },
  { id: '6', label: '6th', suffix: '6', intervals: [0, 4, 7, 9] },
  { id: 'dim', label: 'Diminished 7th', suffix: '°7', intervals: [0, 3, 6, 9] },
];

export const CHORD_TYPE_BY_ID = Object.fromEntries(CHORD_TYPES.map((t) => [t.id, t])) as Record<
  ChordType,
  ChordTypeInfo
>;

export interface Shape {
  name: string;
  refRoot: number;
  frets: [number, number, number, number];
  period: 12 | 3;
}

const G = 7, A = 9, Bb = 10, C = 0, D = 2, Eb = 3;

export const SHAPES: Record<ChordType, Shape[]> = {
  maj: [
    { name: 'Barre', refRoot: G, frets: [0, 0, 0, 0], period: 12 },
    { name: 'F shape', refRoot: G, frets: [5, 4, 3, 5], period: 12 },
    { name: 'D shape', refRoot: G, frets: [9, 7, 8, 9], period: 12 },
  ],
  min: [
    { name: 'Barre minor', refRoot: A, frets: [2, 2, 1, 2], period: 12 },
    { name: 'F shape minor', refRoot: G, frets: [5, 3, 3, 5], period: 12 },
    { name: 'D shape minor', refRoot: G, frets: [8, 7, 8, 8], period: 12 },
  ],
  '7': [
    { name: '7th (4th string up 3)', refRoot: G, frets: [3, 0, 0, 0], period: 12 },
    { name: '7th (F shape)', refRoot: G, frets: [3, 4, 3, 5], period: 12 },
    { name: '7th (1st string flat 7)', refRoot: G, frets: [5, 4, 3, 3], period: 12 },
  ],
  m7: [
    { name: 'm7 (4th string up 3)', refRoot: A, frets: [5, 2, 1, 2], period: 12 },
    { name: 'm7 (F shape)', refRoot: G, frets: [3, 3, 3, 5], period: 12 },
    { name: 'm7 (1st string flat 7)', refRoot: G, frets: [5, 3, 3, 3], period: 12 },
  ],
  // A 6th chord shares its notes with the relative minor 7th, so the shapes are the m7
  // shapes renamed three frets up (Am7 = C6, Gm7 = Bb6).
  '6': [
    { name: '6th (barre-ish)', refRoot: C, frets: [5, 2, 1, 2], period: 12 },
    { name: '6th (F shape)', refRoot: Bb, frets: [3, 3, 3, 5], period: 12 },
    { name: '6th (1st string)', refRoot: Bb, frets: [5, 3, 3, 3], period: 12 },
  ],
  dim: [{ name: 'Diminished', refRoot: Eb, frets: [1, 2, 1, 4], period: 3 }],
};

/** Common open voicings that aren't a slid movable shape. Keyed by "root:type". */
export const OPEN_EXTRAS: { root: number; type: ChordType; frets: [number, number, number, number] }[] = [
  { root: D, type: 'maj', frets: [0, 2, 3, 4] },
  { root: D, type: 'min', frets: [0, 2, 3, 3] },
  { root: D, type: '7', frets: [0, 2, 1, 4] },
  { root: D, type: 'm7', frets: [0, 2, 1, 3] },
  { root: D, type: '6', frets: [0, 2, 0, 4] },
];
