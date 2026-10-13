import { useEffect, useRef, useState } from 'react';
import { LOW_MIDI } from '../audio/analyzer';
import { AudioEngine } from '../audio/engine';
import { StrumEvent } from '../audio/listener';
import { judge, rankChords } from '../audio/matcher';
import { encodeWav } from '../audio/wav';
import { Voicing } from '../music/library';
import { midiName } from '../music/notes';

/** What the detector heard on the last strum, plus a way to save it. Toggle in Settings. */
export function DebugMeter({ engine, target }: { engine: AudioEngine; target?: Voicing }) {
  const [text, setText] = useState('strum to see what the detector hears');
  const last = useRef<{ ev: StrumEvent; target?: Voicing } | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(
    () =>
      engine.onStrum((ev) => {
        const t = targetRef.current;
        last.current = { ev, target: t };
        const a = ev.analysis;
        const top = rankChords(a, 3).map((c) => `${c.name} ${c.score.toFixed(2)}`).join('  ');
        const notes = [...a.semis]
          .map((v, i) => [v, i] as const)
          .filter(([v]) => v > 0)
          .sort((x, y) => y[0] - x[0])
          .slice(0, 10)
          .map(([v, i]) => `${midiName(i + LOW_MIDI)}:${v.toFixed(2)}`)
          .join(' ');
        const verdict = t ? `${t.id} → ${judge(a, t).verdict}` : '';
        setText(`${verdict}\ntop: ${top}\nloudest notes: ${notes}`);
      }),
    [engine],
  );

  const save = () => {
    if (!last.current) return;
    const { ev, target: t } = last.current;
    const url = URL.createObjectURL(encodeWav(ev.samples, ev.sampleRate));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t ? `${t.id.replace('@', '-pos')}_${t.frets.join('-')}` : 'strum'}_${Date.now()}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="card debug stack">
      <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
      <button onClick={save}>Save last strum (.wav)</button>
    </div>
  );
}
