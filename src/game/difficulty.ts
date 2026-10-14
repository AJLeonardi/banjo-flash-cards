export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyInfo {
  label: string;
  /** Max change in hand position (frets) between consecutive chords. */
  maxJump: number;
  /** Hard mode prefers big moves rather than merely allowing them. */
  biasFar: boolean;
  bpm: number;
  beatsPerChord: number;
  windowMs: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyInfo> = {
  easy: { label: 'Easy', maxJump: 3, biasFar: false, bpm: 70, beatsPerChord: 4, windowMs: 150 },
  medium: { label: 'Medium', maxJump: 7, biasFar: false, bpm: 90, beatsPerChord: 4, windowMs: 110 },
  hard: { label: 'Hard', maxJump: 17, biasFar: true, bpm: 110, beatsPerChord: 2, windowMs: 80 },
};

export const GAME_SECONDS = 120;

/**
 * The game follows the Home screen's max fret jump: Easy, Medium or Hard also set the
 * suggested tempo, beats per chord and timing window. A custom jump uses the level
 * whose jump it's closest to.
 */
export function gameLevel(jumpMode: Difficulty | 'custom', customJump: number): Difficulty {
  if (jumpMode !== 'custom') return jumpMode;
  return customJump <= DIFFICULTIES.easy.maxJump ? 'easy' : customJump <= DIFFICULTIES.medium.maxJump ? 'medium' : 'hard';
}
