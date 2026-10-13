// Judges an Analysis against the chord/position the player was asked for.

import { CHORDS, CHORD_BY_ID, Voicing } from '../music/library';
import { Analysis } from './analyzer';

export type Verdict = 'correct' | 'wrongChord' | 'wrongPosition' | 'unclear';

export interface Judgement {
  verdict: Verdict;
  /** Best-matching chord name (first chord with the winning pitch set). */
  heard: string | null;
  /** Position number the detector thinks was played, for the target chord. */
  heardPosition: number | null;
  score: number;
}

export interface MatchOptions {
  checkPosition: boolean;
  /** Minimum spectrum similarity to count as a chord at all. */
  minScore: number;
  /** How close a non-best position may score and still pass. */
  positionTolerance: number;
}

export const DEFAULT_MATCH: MatchOptions = { checkPosition: true, minScore: 0.6, positionTolerance: 0.015 };

const CHORD_FOR_PCKEY = new Map<string, string>();
for (const c of CHORDS) if (!CHORD_FOR_PCKEY.has(c.pcKey)) CHORD_FOR_PCKEY.set(c.pcKey, c.id);

export function judge(a: Analysis, target: Voicing, opts: MatchOptions = DEFAULT_MATCH): Judgement {
  let bestKey = '';
  let best = -1;
  for (const [k, s] of a.pcKeyScores) if (s > best) [best, bestKey] = [s, k];
  const chord = CHORD_BY_ID[target.chordId];
  const heard = best >= opts.minScore ? (bestKey === chord.pcKey ? chord.id : CHORD_FOR_PCKEY.get(bestKey)!) : null;
  if (!heard) return { verdict: 'unclear', heard: null, heardPosition: null, score: best };
  if (bestKey !== chord.pcKey) return { verdict: 'wrongChord', heard, heardPosition: null, score: best };

  let bestPos = target.position;
  let bestPosScore = -1;
  for (const v of chord.voicings) {
    const s = a.voicingScores.get(v.id) ?? 0;
    if (s > bestPosScore) [bestPosScore, bestPos] = [s, v.position];
  }
  const targetScore = a.voicingScores.get(target.id) ?? 0;
  const positionOk = !opts.checkPosition || targetScore >= bestPosScore - opts.positionTolerance;
  return {
    verdict: positionOk ? 'correct' : 'wrongPosition',
    heard,
    heardPosition: bestPos,
    score: best,
  };
}

/** Top-n chords by score, for the debug meter. */
export function rankChords(a: Analysis, n = 3): { name: string; score: number }[] {
  return [...a.pcKeyScores.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([k, score]) => ({ name: CHORD_FOR_PCKEY.get(k)!, score }));
}
