import { Difficulty } from './difficulty';
import { load, save } from '../storage';

export interface ScoreEntry {
  score: number;
  hits: number;
  total: number;
  bpm: number;
  maxJump: number;
  chords: string;
  date: string;
}

const KEY = 'bfc.highscores.v1';
const MAX = 10;

type Table = Record<string, ScoreEntry[]>;

export const tableKey = (difficulty: Difficulty | 'custom', chords: string[]) =>
  `${difficulty}|${[...chords].sort().join(' ')}`;

export function allScores(): Table {
  return load<{ t: Table }>(KEY, { t: {} }).t;
}

/** Adds an entry; returns its rank (1-based) or null if it didn't make the top 10. */
export function addScore(key: string, entry: ScoreEntry): number | null {
  const t = allScores();
  const list = [...(t[key] ?? []), entry].sort((a, b) => b.score - a.score || b.hits - a.hits).slice(0, MAX);
  const rank = list.indexOf(entry);
  t[key] = list;
  save(KEY, { t });
  return rank >= 0 ? rank + 1 : null;
}

export function clearScores(): void {
  save(KEY, { t: {} });
}
