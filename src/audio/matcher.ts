// Judges an Analysis against the chord/position the player was asked for.

import { CHORDS, CHORD_BY_ID, Voicing } from '../music/library';
import { pc } from '../music/notes';
import { Analysis, LOW_MIDI } from './analyzer';

/** `partial` = right notes, but not enough strings rang (e.g. a single plucked string). */
export type Verdict = 'correct' | 'wrongChord' | 'wrongPosition' | 'partial' | 'unclear';

/** A note counts as sounding if its bin is above the analyzer's noise floor (0.15 of max). */
const NOTE_PRESENT = 0.16;
/** Distinct notes (and note names) of the voicing that must be heard at their exact octave. */
const MIN_STRINGS = 3;
/** Fretted notes span D3 (open 4th string) to G5 (1st string, fret 17). */
const FRETBOARD = [50, 79];

const level = (a: Analysis, midi: number) => a.semis[midi - LOW_MIDI] ?? 0;

const sounding = (a: Analysis, m: number) => level(a, m) >= NOTE_PRESENT;
/**
 * Could this bin just be the 2nd/3rd/4th harmonic of a lower sounding note? Only if that
 * note is reasonably loud: a fading note from the previous chord shouldn't hide a new one.
 */
const overtone = (a: Analysis, m: number) =>
  [12, 19, 24].some((d) => sounding(a, m - d) && level(a, m - d) >= 0.5 * level(a, m));

/**
 * How many of the voicing's fretted notes are clearly sounding, i.e. present and not
 * explainable as an overtone of a lower note. Also returns how many distinct note names
 * those cover. A lone D3 also shows D4 and A4 (its overtones), but counts as one note
 * (and one note name, which is what keeps a single string from passing).
 */
export function stringsHeard(a: Analysis, v: Voicing): { notes: number; names: number } {
  const notes = new Set(v.midi);
  // If the voicing itself has the octave below (G4 and G5 in a fret-15 G), the upper
  // note can't be told from that note's overtone, so give it the benefit of the doubt.
  const heard = [...notes].filter((m) => sounding(a, m) && (notes.has(m - 12) || !overtone(a, m)));
  return { notes: heard.length, names: new Set(heard.map(pc)).size };
}

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

/** Best pitch set, but demote a 7th/6th to its triad when the extra note isn't really there. */
function bestPcKey(a: Analysis): [string, number] {
  let bestKey = '';
  let best = -1;
  for (const [k, s] of a.pcKeyScores) if (s > best) [best, bestKey] = [s, k];
  const pcs = bestKey.split(',').map(Number);
  if (pcs.length !== 4) return [bestKey, best];
  // Which triads does this chord contain? (G7 contains G and Bdim; G6 contains G and Em.)
  for (const drop of pcs) {
    const triadKey = pcs.filter((p) => p !== drop).join(',');
    const triadScore = a.pcKeyScores.get(triadKey);
    if (triadScore === undefined) continue;
    // The extra note must be played on a string — not just the 7th harmonic of the root
    // (which lands above the fretboard's range, around F6 for a G).
    let played = false;
    for (let m = FRETBOARD[0]; m <= FRETBOARD[1]; m++) if (pc(m) === drop && sounding(a, m) && !overtone(a, m)) played = true;
    if (!played) return [triadKey, triadScore];
  }
  return [bestKey, best];
}

/** Distinct note names clearly ringing anywhere on the fretboard (overtones excluded). */
function namesRinging(a: Analysis): number {
  const names = new Set<number>();
  for (let m = FRETBOARD[0]; m <= FRETBOARD[1]; m++) if (sounding(a, m) && !overtone(a, m)) names.add(pc(m));
  return names.size;
}

export function judge(a: Analysis, target: Voicing, opts: MatchOptions = DEFAULT_MATCH): Judgement {
  const [bestKey, best] = bestPcKey(a);
  const chord = CHORD_BY_ID[target.chordId];
  const heard = best >= opts.minScore ? (bestKey === chord.pcKey ? chord.id : CHORD_FOR_PCKEY.get(bestKey)!) : null;
  if (!heard) return { verdict: 'unclear', heard: null, heardPosition: null, score: best };
  // One or two strings (plus maybe the 5th) aren't a chord yet, whatever they resemble.
  if (namesRinging(a) < MIN_STRINGS) return { verdict: 'partial', heard: null, heardPosition: null, score: best };
  if (bestKey !== chord.pcKey) return { verdict: 'wrongChord', heard, heardPosition: null, score: best };

  // Position: prefer the voicing whose own notes ring at their own octave; spectrum
  // similarity breaks ties. Similarity alone confuses positions an octave apart (G at
  // fret 3 vs fret 15): one's notes are the other's 2nd harmonics.
  const heardBy = new Map(chord.voicings.map((v) => [v.id, stringsHeard(a, v)]));
  const rank = (v: Voicing) => heardBy.get(v.id)!.notes + (a.voicingScores.get(v.id) ?? 0);
  const bestVoicing = chord.voicings.reduce((x, y) => (rank(y) > rank(x) ? y : x));

  // Whatever was played must actually ring as a chord: rules out a few strings whose
  // overtones happen to resemble it.
  const complete = (v: Voicing) => heardBy.get(v.id)!.notes >= MIN_STRINGS && heardBy.get(v.id)!.names >= MIN_STRINGS;
  if (!complete(bestVoicing)) return { verdict: 'partial', heard, heardPosition: null, score: best };

  const positionOk =
    !opts.checkPosition || (complete(target) && rank(target) >= rank(bestVoicing) - opts.positionTolerance);
  return {
    verdict: positionOk ? 'correct' : 'wrongPosition',
    heard,
    heardPosition: bestVoicing.position,
    score: best,
  };
}

/** Top-n chords by score, for the debug meter. */
export function rankChords(a: Analysis, n = 3): { name: string; score: number }[] {
  // (raw template scores, before the triad/partial rules in judge())
  return [...a.pcKeyScores.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, n)
    .map(([k, score]) => ({ name: CHORD_FOR_PCKEY.get(k)!, score }));
}
