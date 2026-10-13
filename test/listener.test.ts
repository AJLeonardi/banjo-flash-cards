import { describe, expect, it } from 'vitest';
import { ListenerCore, StrumEvent } from '../src/audio/listener';
import { judge } from '../src/audio/matcher';
import { CHORD_BY_ID, Voicing } from '../src/music/library';
import { SR, strum } from './synth';

interface Gesture {
  onsetTime: number;
  events: StrumEvent[];
}

/**
 * Simulate the live loop: every 10 ms, hand the listener the latest 0.4 s of audio.
 * Like the app, stop listening to a gesture once it's judged correct for `targets[i]`.
 */
function listen(buf: Float32Array, targets: Voicing[] = []): Gesture[] {
  const core = new ListenerCore(SR, { sensitivity: 0.6 });
  const gestures: Gesture[] = [];
  const hop = SR / 100;
  for (let end = hop; end <= buf.length; end += hop) {
    const ev = core.feed(buf.subarray(Math.max(0, end - SR * 0.4), end), end / SR);
    if (!ev) continue;
    let g = gestures[gestures.length - 1];
    if (!g || g.onsetTime !== ev.onsetTime) gestures.push((g = { onsetTime: ev.onsetTime, events: [] }));
    g.events.push(ev);
    const target = targets[gestures.length - 1];
    if (target && judge(ev.analysis, target).verdict === 'correct') core.endGesture(end / SR, 0.5);
  }
  return gestures;
}

/** What the app shows for a gesture: green on the first correct check, else the final verdict. */
function outcome(g: Gesture, target: Voicing) {
  for (const ev of g.events) {
    const v = judge(ev.analysis, target).verdict;
    if (v === 'correct') return 'correct';
    if (ev.final) return v;
  }
  return 'pending';
}

const G = CHORD_BY_ID['G'].voicings[0];
const C = CHORD_BY_ID['C'].voicings[0];
const D2 = CHORD_BY_ID['D'].voicings[1];

describe('listener', () => {
  it('finds one strum, times it, and identifies it', () => {
    const gs = listen(strum(G.midi, { at: 0.5, dur: 1.4 }), [G]);
    expect(gs).toHaveLength(1);
    expect(Math.abs(gs[0].onsetTime - 0.5)).toBeLessThan(0.02);
    expect(outcome(gs[0], G)).toBe('correct');
  });

  it('a slow strum is one gesture: no verdict until the chord is complete', () => {
    for (const gap of [0.06, 0.12, 0.2]) {
      const gs = listen(strum(D2.midi, { at: 0.3, dur: 2.5, gap }), [D2]);
      expect(gs, `gap ${gap}`).toHaveLength(1);
      expect(outcome(gs[0], D2), `gap ${gap}`).toBe('correct');
    }
  });

  it('a lone plucked string ends as partial, never correct', () => {
    const gs = listen(strum([D2.midi[0]], { at: 0.3, dur: 2, drone: false }), [D2]);
    expect(gs).toHaveLength(1);
    expect(outcome(gs[0], D2)).toBe('partial');
  });

  it('separates a chord change while the old chord still rings', () => {
    const buf = strum(G.midi, { at: 0.3, dur: 3 });
    strum(C.midi, { at: 1.2, into: buf, seed: 5 });
    strum(D2.midi, { at: 2.1, into: buf, seed: 9 });
    const gs = listen(buf, [G, C, D2]);
    expect(gs.map((g) => g.onsetTime.toFixed(1))).toEqual(['0.3', '1.2', '2.1']);
    expect([outcome(gs[0], G), outcome(gs[1], C), outcome(gs[2], D2)]).toEqual(['correct', 'correct', 'correct']);
  });

  it('ignores quiet background noise', () => {
    const noise = new Float32Array(SR * 2).map(() => (Math.random() - 0.5) * 0.003);
    expect(listen(noise)).toHaveLength(0);
  });

  it('ignores a 3 kHz metronome click', () => {
    const buf = new Float32Array(SR * 2);
    for (const t of [0.5, 1.0, 1.5]) {
      const s = Math.round(t * SR);
      for (let i = 0; i < SR * 0.03; i++) buf[s + i] += 0.5 * Math.sin((2 * Math.PI * 3136 * i) / SR) * Math.sin((Math.PI * i) / (SR * 0.03));
    }
    expect(listen(buf)).toHaveLength(0);
  });
});
