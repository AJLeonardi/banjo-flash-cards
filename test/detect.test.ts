import { describe, expect, it } from 'vitest';
import { analyze } from '../src/audio/analyzer';
import { judge } from '../src/audio/matcher';
import { ALL_VOICINGS, CHORD_BY_ID } from '../src/music/library';
import { SR, strum, windowAfter } from './synth';

const run = (midis: number[], seed = 1, drone = true) => analyze(windowAfter(strum(midis, { seed, drone }), 0.1), SR);

describe('detector on synthesized strums', () => {
  it('identifies the chord for every voicing in the library', () => {
    const misses: string[] = [];
    for (const v of ALL_VOICINGS) {
      const j = judge(run(v.midi, v.position), v, { checkPosition: false, minScore: 0.6, positionTolerance: 0.015 });
      if (j.verdict !== 'correct') misses.push(`${v.id} [${v.frets}] heard ${j.heard} (${j.score.toFixed(2)})`);
    }
    console.log(`chord misses: ${misses.length}/${ALL_VOICINGS.length}`, misses.slice(0, 20));
    expect(misses.length / ALL_VOICINGS.length).toBeLessThan(0.03);
  });

  it('usually identifies the position', () => {
    const misses: string[] = [];
    for (const v of ALL_VOICINGS) {
      const j = judge(run(v.midi, v.position + 7), v);
      if (j.verdict !== 'correct') misses.push(`${v.id} [${v.frets}] → pos ${j.heardPosition} (${j.verdict})`);
    }
    console.log(`position misses: ${misses.length}/${ALL_VOICINGS.length}`, misses.slice(0, 20));
    expect(misses.length / ALL_VOICINGS.length).toBeLessThan(0.1);
  });

  it('works without the 5th string', () => {
    let ok = 0;
    for (const v of ALL_VOICINGS) if (judge(run(v.midi, 3, false), v, { checkPosition: false, minScore: 0.6, positionTolerance: 0.015 }).verdict === 'correct') ok++;
    expect(ok / ALL_VOICINGS.length).toBeGreaterThan(0.95);
  });

  it('rejects the wrong chord and the wrong position', () => {
    const g1 = CHORD_BY_ID['G'].voicings[0];
    const c1 = CHORD_BY_ID['C'].voicings[0];
    expect(judge(run(c1.midi), g1).verdict).toBe('wrongChord');
    const d = CHORD_BY_ID['D'].voicings;
    const j = judge(run(d.find((v) => v.frets.join() === '12,11,10,12')!.midi), d.find((v) => v.frets.join() === '7,7,7,7')!);
    expect(j.verdict).toBe('wrongPosition');
  });

  it('does not pass a single plucked string, with or without position checking', () => {
    const passes: string[] = [];
    for (const v of ALL_VOICINGS) {
      v.midi.forEach((m, s) => {
        for (const checkPosition of [true, false]) {
          const j = judge(run([m], v.position + s, false), v, { checkPosition, minScore: 0.6, positionTolerance: 0.015 });
          if (j.verdict === 'correct') passes.push(`${v.id} string ${4 - s} (pos check ${checkPosition})`);
        }
      });
    }
    expect(passes).toEqual([]);
  });

  // (With the 5th string, two strings can genuinely make a 3-note chord, so leave it out.)
  it('does not pass two plucked strings', () => {
    let passes = 0, total = 0;
    for (const v of ALL_VOICINGS) {
      for (const pair of [[0, 1], [1, 2], [2, 3], [0, 3]]) {
        total++;
        if (judge(run(pair.map((i) => v.midi[i]), v.position, false), v).verdict === 'correct') passes++;
      }
    }
    expect(passes / total).toBeLessThan(0.02);
  });

  it('still passes a strum that misses one (doubled) string', () => {
    let ok = 0, total = 0;
    for (const v of ALL_VOICINGS) {
      for (let skip = 0; skip < 4; skip++) {
        const rest = v.midi.filter((_, i) => i !== skip);
        if (new Set(rest.map((m) => m % 12)).size < new Set(v.midi.map((m) => m % 12)).size) continue; // lost a chord tone
        total++;
        const j = judge(run(rest, v.position), v, { checkPosition: false, minScore: 0.6, positionTolerance: 0.015 });
        if (j.verdict === 'correct') ok++;
      }
    }
    expect(ok / total).toBeGreaterThan(0.8);
  });

  it('a bright open G (strong 7th harmonics) is G, not G7', () => {
    const G = CHORD_BY_ID['G'].voicings[0];
    const buf = strum(G.midi, { seed: 4 });
    // Add a loud 7th harmonic to every string, decaying like the string.
    for (const m of [67, ...G.midi]) {
      const f = 7 * 440 * 2 ** ((m - 69) / 12);
      for (let i = Math.round(SR * 0.1); i < buf.length; i++) {
        const t = i / SR - 0.1;
        buf[i] += 0.08 * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3);
      }
    }
    const a = analyze(windowAfter(buf, 0.1), SR);
    expect(judge(a, G).verdict).toBe('correct');
    expect(judge(a, CHORD_BY_ID['G7'].voicings[0]).verdict).toBe('wrongChord');
    // ...while a real G7 still reads as G7.
    const g7 = CHORD_BY_ID['G7'].voicings[0];
    expect(judge(run(g7.midi), g7).verdict).toBe('correct');
  });

  it('calls silence unclear', () => {
    const silence = new Float32Array(SR * 0.4).map(() => (Math.random() - 0.5) * 0.001);
    expect(judge(analyze(silence, SR), CHORD_BY_ID['G'].voicings[0]).verdict).not.toBe('correct');
  });
});
