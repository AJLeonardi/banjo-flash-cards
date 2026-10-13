import { describe, expect, it } from 'vitest';
import { CHORDS, CHORD_BY_ID, fretRangeLabel, parseChordList } from '../src/music/library';
import { pc } from '../src/music/notes';

describe('chord library', () => {
  it('has 72 chords, each with at least 3 positions', () => {
    expect(CHORDS).toHaveLength(72);
    for (const c of CHORDS) expect(c.voicings.length, c.id).toBeGreaterThanOrEqual(3);
  });

  it('every voicing contains exactly the chord tones', () => {
    for (const c of CHORDS) {
      const want = c.pcKey;
      for (const v of c.voicings) {
        const got = [...new Set(v.midi.map(pc))].sort((a, b) => a - b).join(',');
        expect(got, `${v.id} ${v.frets}`).toBe(want);
      }
    }
  });

  it('numbers positions from the nut upward', () => {
    for (const c of CHORDS) {
      const anchors = c.voicings.map((v) => v.anchor);
      expect([...anchors].sort((a, b) => a - b)).toEqual(anchors);
    }
  });

  it('includes the familiar D and G voicings', () => {
    const d = CHORD_BY_ID['D'].voicings.map((v) => v.frets.join('-'));
    expect(d).toContain('0-2-3-4');
    expect(d).toContain('4-2-3-4');
    expect(d).toContain('12-11-10-12');
    expect(d).toContain('7-7-7-7');
    const g = CHORD_BY_ID['G'].voicings.map((v) => v.frets.join('-'));
    expect(g).toEqual(expect.arrayContaining(['0-0-0-0', '5-4-3-5', '9-7-8-9', '12-12-12-12']));
    expect(CHORD_BY_ID['C'].voicings.map((v) => v.frets.join('-'))).toContain('2-0-1-2');
  });

  it('parses chord lists', () => {
    expect(parseChordList('G, C, D7 Em bbm7 F#dim')).toEqual({ ids: ['G', 'C', 'D7', 'Em', 'Bbm7', 'F#°7'], bad: [] });
    expect(parseChordList('G, H, Cx').bad).toEqual(['H', 'Cx']);
  });
});

it('prints a few chords (for eyeballing)', () => {
  for (const id of ['D', 'G', 'Am', 'E7', 'C6', 'D°7']) {
    console.log(id, CHORD_BY_ID[id].voicings.map((v) => `P${v.position}[${v.frets.join('-')}](${fretRangeLabel(v)})`).join('  '));
  }
});
