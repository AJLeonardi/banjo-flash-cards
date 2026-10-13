import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../audio/engine';
import { DEFAULT_MATCH, judge } from '../audio/matcher';
import { buildPool, Sequencer } from '../game/sequencer';
import { Voicing } from '../music/library';
import { Settings } from '../settings';
import { keepAwake } from '../wakelock';
import { jumpFor } from './ChordPicker';
import { ChordCard } from './ChordCard';
import { DebugMeter } from './DebugMeter';
import { MicStatus } from './MicStatus';

type Flash = '' | 'good' | 'bad';

export function Practice({ engine, settings, update }: { engine: AudioEngine; settings: Settings; update: (p: Partial<Settings>) => void }) {
  const seq = useMemo(() => {
    const { maxJump, biasFar } = jumpFor(settings.jumpMode, settings.customJump);
    return new Sequencer(buildPool(settings.chords, settings.positions), maxJump, biasFar);
  }, [settings.chords, settings.positions, settings.jumpMode, settings.customJump]);

  const [current, setCurrent] = useState<Voicing>(() => seq.next());
  const [flash, setFlash] = useState<Flash>('');
  const [message, setMessage] = useState('Strum all the strings');
  const [stats, setStats] = useState({ tries: 0, right: 0, streak: 0, best: 0 });
  const cur = useRef(current);
  const busy = useRef(false);
  cur.current = current;

  useEffect(() => setCurrent(seq.next()), [seq]);

  useEffect(() => {
    void keepAwake(true);
    return () => void keepAwake(false);
  }, []);

  const result = (ok: boolean, msg: string) => {
    if (busy.current) return;
    setFlash(ok ? 'good' : 'bad');
    setMessage(msg);
    setStats((s) => {
      const streak = ok ? s.streak + 1 : 0;
      return { tries: s.tries + 1, right: s.right + (ok ? 1 : 0), streak, best: Math.max(s.best, streak) };
    });
    if (ok) {
      busy.current = true;
      setTimeout(() => {
        setCurrent(seq.next());
        setFlash('');
        setMessage('');
        busy.current = false;
      }, 450);
    } else {
      setTimeout(() => setFlash(''), 350);
    }
  };
  const resultRef = useRef(result);
  resultRef.current = result;

  useEffect(
    () =>
      engine.onStrum((ev) => {
        const target = cur.current;
        const j = judge(ev.analysis, target, { ...DEFAULT_MATCH, checkPosition: settings.checkPosition });
        if (j.verdict === 'unclear') return setMessage("Didn't catch that — strum again");
        if (j.verdict === 'correct') return resultRef.current(true, 'Nice!');
        if (j.verdict === 'partial') return resultRef.current(false, 'Only heard part of the chord — strum all the strings');
        if (j.verdict === 'wrongPosition')
          return resultRef.current(false, `Right chord, but that sounded like position ${j.heardPosition}`);
        resultRef.current(false, `That sounded like ${j.heard}`);
      }),
    [engine, settings.checkPosition],
  );

  useEffect(() => {
    if (!settings.debug) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'c') resultRef.current(true, 'Nice! (simulated)');
      if (e.key === 'x') resultRef.current(false, 'Wrong (simulated)');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings.debug]);

  const pct = stats.tries ? Math.round((100 * stats.right) / stats.tries) : 0;
  return (
    <>
      <MicStatus engine={engine} />
      <div className={`stage ${flash}`}>
        <ChordCard voicing={current} showDiagram={settings.showDiagram} />
        <div className="message">{message}</div>
      </div>
      <div className="stats">
        <div><b>{stats.streak}</b><span>Streak</span></div>
        <div><b>{stats.best}</b><span>Best</span></div>
        <div><b>{pct}%</b><span>Accuracy</span></div>
      </div>
      <div className="row">
        <button onClick={() => update({ showDiagram: !settings.showDiagram })}>
          {settings.showDiagram ? 'Hide' : 'Show'} diagram
        </button>
        <span className="spacer" />
        <button onClick={() => { setCurrent(seq.next()); setMessage(''); }}>Skip →</button>
      </div>
      {settings.debug && <DebugMeter engine={engine} target={current} />}
    </>
  );
}
