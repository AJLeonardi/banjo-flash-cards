import { describe, expect, it } from 'vitest';
import { ListenerCore, StrumEvent } from '../src/audio/listener';
import { judge } from '../src/audio/matcher';
import { CHORD_BY_ID } from '../src/music/library';
import { SR, strum } from './synth';

/** Simulate the live loop: every 10 ms, hand the listener the latest 0.4 s of audio. */
function listen(buf: Float32Array, sensitivity = 0.6): StrumEvent[] {
  const core = new ListenerCore(SR, { sensitivity });
  const events: StrumEvent[] = [];
  const hop = SR / 100;
  for (let end = hop; end <= buf.length; end += hop) {
    const ev = core.feed(buf.subarray(Math.max(0, end - SR * 0.4), end), end / SR);
    if (ev) events.push(ev);
  }
  return events;
}

const G = CHORD_BY_ID['G'].voicings[0];
const C = CHORD_BY_ID['C'].voicings[0];
const D2 = CHORD_BY_ID['D'].voicings[1];

describe('listener', () => {
  it('finds one strum, times it, and identifies it', () => {
    const ev = listen(strum(G.midi, { at: 0.5, dur: 1.2 }));
    expect(ev).toHaveLength(1);
    expect(Math.abs(ev[0].onsetTime - 0.5)).toBeLessThan(0.02);
    expect(judge(ev[0].analysis, G).verdict).toBe('correct');
  });

  it('separates a chord change while the old chord still rings', () => {
    const buf = strum(G.midi, { at: 0.3, dur: 2 });
    strum(C.midi, { at: 1.0, into: buf, seed: 5 });
    strum(D2.midi, { at: 1.6, into: buf, seed: 9 });
    const ev = listen(buf);
    expect(ev.map((e) => e.onsetTime.toFixed(1))).toEqual(['0.3', '1.0', '1.6']);
    expect(judge(ev[0].analysis, G).verdict).toBe('correct');
    expect(judge(ev[1].analysis, C).verdict).toBe('correct');
    expect(judge(ev[2].analysis, D2).verdict).toBe('correct');
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
