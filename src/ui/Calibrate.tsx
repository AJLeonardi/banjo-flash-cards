import { useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/engine';
import { Metronome } from '../audio/metronome';
import { Settings } from '../settings';

const BPM = 80;
const LEAD = 4;
const COUNT = 12;

/** Strum along with clicks; the median offset becomes the latency correction. */
export function Calibrate({ engine, settings, update, onDone }: { engine: AudioEngine; settings: Settings; update: (p: Partial<Settings>) => void; onDone: () => void }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'failed'>('idle');
  const [heard, setHeard] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => () => cleanup.current(), []);

  const start = () => {
    const ctx = engine.ctx;
    const t0 = ctx.currentTime + 0.5;
    const beat = 60 / BPM;
    const clicks = Array.from({ length: LEAD + COUNT }, (_, i) => t0 + i * beat);
    const metro = new Metronome(ctx, Math.max(settings.clickVolume, 0.5));
    metro.start(t0, BPM, 4, clicks[clicks.length - 1]);
    const offsets: number[] = [];
    const off = engine.onStrum((ev) => {
      const near = clicks.slice(LEAD).reduce((a, b) => (Math.abs(b - ev.onsetTime) < Math.abs(a - ev.onsetTime) ? b : a));
      const d = ev.onsetTime - near;
      if (Math.abs(d) < 0.35) {
        offsets.push(d);
        setHeard(offsets.length);
      }
    });
    const timer = window.setTimeout(() => {
      off();
      if (offsets.length < 5) return setState('failed');
      const sorted = [...offsets].sort((a, b) => a - b);
      const ms = Math.round(sorted[Math.floor(sorted.length / 2)] * 1000);
      setResult(ms);
      update({ latencyMs: ms });
      setState('done');
    }, (clicks[clicks.length - 1] - ctx.currentTime + 0.6) * 1000);
    cleanup.current = () => {
      metro.stop();
      off();
      clearTimeout(timer);
    };
    setHeard(0);
    setState('running');
  };

  return (
    <div className="card stack">
      <h2>Timing calibration</h2>
      <p className="small">
        Phones and Bluetooth headphones add delay between the click and what the mic hears. After 4 count-in clicks, strum any chord exactly on each of the next {COUNT} clicks.
        Use the same headphones/speaker you'll play games with.
      </p>
      {state === 'running' && <div className="countin" style={{ textAlign: 'center' }}>{heard}/{COUNT}</div>}
      {state === 'done' && <div className="banner">Latency set to {result} ms</div>}
      {state === 'failed' && <div className="error">Only heard {heard} strums — try again, a bit louder or closer to the mic.</div>}
      <div className="muted small">Current correction: {settings.latencyMs} ms</div>
      <div className="row">
        <button className="primary" disabled={state === 'running'} onClick={start}>
          {state === 'idle' ? 'Start' : 'Run again'}
        </button>
        <button onClick={onDone}>Done</button>
      </div>
    </div>
  );
}
