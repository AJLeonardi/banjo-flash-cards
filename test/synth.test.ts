import { expect, it } from 'vitest';
import { magnitudeSpectrum } from '../src/audio/fft';
import { freqToMidi, midiToFreq } from '../src/music/notes';
import { pluck, SR } from './synth';

it('test synth plucks are in tune across the neck', () => {
  const size = 65536;
  for (const midi of [50, 62, 74, 79]) {
    const out = new Float32Array(SR);
    pluck(out, 0, midi, 1, 1);
    const mag = magnitudeSpectrum(out, out.length, size);
    // strongest bin within a semitone of the fundamental
    const lo = Math.floor((midiToFreq(midi - 1) * size) / SR);
    const hi = Math.ceil((midiToFreq(midi + 1) * size) / SR);
    let peak = lo;
    for (let i = lo; i <= hi; i++) if (mag[i] > mag[peak]) peak = i;
    expect(Math.abs(freqToMidi((peak * SR) / size) - midi), `midi ${midi}`).toBeLessThan(0.1);
  }
});
