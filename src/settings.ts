import { Difficulty } from './game/difficulty';
import { load, save } from './storage';

export type JumpMode = Difficulty | 'custom';

export interface Settings {
  chords: string[];
  /** Position numbers to include (5 = "5 and up"); empty = all. */
  positions: number[];
  jumpMode: JumpMode;
  customJump: number;
  showDiagram: boolean;
  checkPosition: boolean;
  /** 0..1 */
  sensitivity: number;
  latencyMs: number;
  clickVolume: number;
  difficulty: Difficulty;
  /** Game overrides; null = use the difficulty's default. */
  bpm: number | null;
  gameJump: number | null;
  debug: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  chords: ['G', 'C', 'D'],
  positions: [],
  jumpMode: 'easy',
  customJump: 5,
  showDiagram: true,
  checkPosition: true,
  sensitivity: 0.6,
  latencyMs: 0,
  clickVolume: 0.7,
  difficulty: 'easy',
  bpm: null,
  gameJump: null,
  debug: false,
};

const KEY = 'bfc.settings.v1';
export const loadSettings = () => load<Settings>(KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => save(KEY, s);
