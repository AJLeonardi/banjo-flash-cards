// Real strums saved from the debug panel (phone mic), as regression cases.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audio/analyzer';
import { judge } from '../src/audio/matcher';
import { CHORD_BY_ID } from '../src/music/library';

function readWav(name: string) {
  const b = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
  const n = b.readUInt32LE(40) / 2;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = b.readInt16LE(44 + 2 * i) / 0x7fff;
  return analyze(samples, b.readUInt32LE(24));
}

describe('real recordings', () => {
  // The open 4th string's D3 is faint on a phone mic; these read as positions 3 and 2.
  for (const [file, chord] of [['D-pos1_open-d.wav', 'D'], ['G-pos1_open-g.wav', 'G']] as const) {
    it(`${file} is ${chord} position 1, and no other position`, () => {
      const a = readWav(file);
      const [first, ...rest] = CHORD_BY_ID[chord].voicings;
      expect(judge(a, first).verdict).toBe('correct');
      for (const v of rest) expect(judge(a, v).verdict, v.id).not.toBe('correct');
    });
  }
});
