import { useEffect, useState } from 'react';
import { AudioEngine, EngineStatus } from '../audio/engine';

const MESSAGES: Record<EngineStatus, string> = {
  listening: '',
  hidden: 'Listening is paused while this page is hidden.',
  suspended: 'Audio is paused by the browser — tap anywhere to resume.',
  'no-signal': "No sound is reaching the app. Check the mic input device (and on a Mac, Control Center → Mic Mode → Standard).",
  'mic-lost': 'Connecting to the microphone…',
};

/** Always-on mic level meter plus a plain-language reason when listening has stopped. */
export function MicStatus({ engine }: { engine: AudioEngine }) {
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState<EngineStatus>('listening');
  const [note, setNote] = useState('');

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setLevel(engine.level);
      setStatus(engine.status);
      raf = requestAnimationFrame(loop);
    };
    loop();
    let timer = 0;
    const onVis = () => {
      if (document.hidden) return;
      setNote('Listening paused while this page was hidden or covered (the mic was released) — it’s back on.');
      clearTimeout(timer);
      timer = window.setTimeout(() => setNote(''), 5000);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [engine]);

  const msg = MESSAGES[status] || note;
  return (
    <div className="micstatus">
      <span className={`dot ${status === 'listening' ? 'live' : ''}`} aria-hidden />
      <div className="meter" title="Mic level">
        <div style={{ width: `${Math.min(100, Math.sqrt(level / 0.1) * 100)}%` }} />
      </div>
      {msg && <div className="micmsg">{msg}</div>}
    </div>
  );
}
