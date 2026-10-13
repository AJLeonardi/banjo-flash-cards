import { useEffect, useState } from 'react';
import { AudioEngine } from '../audio/engine';
import { rankChords } from '../audio/matcher';
import { LOW_MIDI } from '../audio/analyzer';
import { midiName } from '../music/notes';

/** Live input level plus what the detector heard on the last strum. Toggle in Settings. */
export function DebugMeter({ engine }: { engine: AudioEngine }) {
  const [level, setLevel] = useState(0);
  const [last, setLast] = useState<string>('strum to see what the detector hears');

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setLevel(engine.level);
      raf = requestAnimationFrame(loop);
    };
    loop();
    const off = engine.onStrum(({ analysis, onsetTime }) => {
      const top = rankChords(analysis, 3).map((c) => `${c.name} ${c.score.toFixed(2)}`).join('  ');
      const notes = [...analysis.semis]
        .map((v, i) => [v, i] as const)
        .filter(([v]) => v > 0.5)
        .map(([, i]) => midiName(i + LOW_MIDI))
        .join(' ');
      setLast(`t=${onsetTime.toFixed(2)}  ${top}\nnotes: ${notes}`);
    });
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, [engine]);

  return (
    <div className="card debug stack">
      <div className="meter">
        <div style={{ width: `${Math.min(100, Math.sqrt(level / 0.1) * 100)}%` }} />
      </div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{last}</div>
    </div>
  );
}
