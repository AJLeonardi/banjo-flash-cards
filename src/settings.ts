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
  /** Game tempo; null = the one suggested for the max fret jump. */
  bpm: number | null;
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
  bpm: null,
  debug: false,
};

const KEY = 'bfc.settings.v1';
export const loadSettings = () => load<Settings>(KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => save(KEY, s);
