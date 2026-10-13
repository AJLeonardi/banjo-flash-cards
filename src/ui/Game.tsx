import { useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/engine';
import { EVAL_DELAY } from '../audio/listener';
import { DEFAULT_MATCH, judge } from '../audio/matcher';
import { Metronome } from '../audio/metronome';
import { Difficulty, DIFFICULTIES, GAME_SECONDS } from '../game/difficulty';
import { addScore, tableKey } from '../game/highscores';
import { GameScorer, targetTimes } from '../game/scoring';
import { buildPool, Sequencer } from '../game/sequencer';
import { VOICING_BY_ID } from '../music/library';
import { Settings } from '../settings';
import { keepAwake } from '../wakelock';
import { ChordCard } from './ChordCard';
import { DebugMeter } from './DebugMeter';

interface Run {
  scorer: GameScorer;
  start: number;
  beat: number;
  beatsPerChord: number;
  window: number;
  end: number;
}

interface Results {
  score: number;
  hits: number;
  total: number;
  rank: number | null;
  avgOffsetMs: number | null;
  missed: [string, number][];
}

export function Game({ engine, settings, update, onCalibrate }: { engine: AudioEngine; settings: Settings; update: (p: Partial<Settings>) => void; onCalibrate: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'playing' | 'results'>('setup');
  const [results, setResults] = useState<Results | null>(null);
  const d = DIFFICULTIES[settings.difficulty];
  const bpm = settings.bpm ?? d.bpm;
  const maxJump = settings.gameJump ?? d.maxJump;
  const custom = settings.bpm !== null || settings.gameJump !== null;

  if (phase === 'playing')
    return (
      <Playing
        engine={engine}
        settings={settings}
        bpm={bpm}
        maxJump={maxJump}
        onDone={(scorer) => {
          const hits = scorer.targets.filter((t) => t.result === 'hit');
          const missCount = new Map<string, number>();
          for (const t of scorer.targets) if (t.result === 'miss') missCount.set(t.voicingId, (missCount.get(t.voicingId) ?? 0) + 1);
          const rank = addScore(tableKey(custom ? 'custom' : settings.difficulty, settings.chords), {
            score: scorer.score,
            hits: scorer.hits,
            total: scorer.targets.length,
            bpm,
            maxJump,
            chords: settings.chords.join(' '),
            date: new Date().toISOString(),
          });
          setResults({
            score: scorer.score,
            hits: scorer.hits,
            total: scorer.targets.length,
            rank,
            avgOffsetMs: hits.length ? Math.round((1000 * hits.reduce((a, t) => a + (t.offset ?? 0), 0)) / hits.length) : null,
            missed: [...missCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
          });
          setPhase('results');
        }}
        onQuit={() => setPhase('setup')}
      />
    );

  return (
    <div className="stack">
      {phase === 'results' && results && <ResultsCard r={results} />}
      <div className="card stack">
        <h2>Difficulty</h2>
        <div className="seg">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((k) => (
            <button key={k} className={settings.difficulty === k ? 'on' : ''} onClick={() => update({ difficulty: k, bpm: null, gameJump: null })}>
              {DIFFICULTIES[k].label}
            </button>
          ))}
        </div>
        <div className="muted small">
          {d.beatsPerChord} beats per chord · ±{d.windowMs} ms timing window · {GAME_SECONDS / 60} minute game
        </div>
        <label className="stack">
          <span className="small">Tempo: {bpm} BPM {settings.bpm !== null && <button className="small" onClick={() => update({ bpm: null })}>reset</button>}</span>
          <input type="range" min={40} max={160} value={bpm} onChange={(e) => update({ bpm: +e.target.value })} />
        </label>
        <label className="stack">
          <span className="small">
            Max fret jump: {maxJump >= 17 ? 'anywhere' : `${maxJump} frets`}{' '}
            {settings.gameJump !== null && <button className="small" onClick={() => update({ gameJump: null })}>reset</button>}
          </span>
          <input type="range" min={1} max={17} value={maxJump} onChange={(e) => update({ gameJump: +e.target.value })} />
        </label>
        {custom && <div className="muted small">Custom settings are scored on a separate high-score table.</div>}
      </div>
      <div className="card small muted">
        Chords: <b>{settings.chords.join(' ') || 'none selected'}</b>. Strum on the first beat of each chord: on time and correct = +1, missed = −1.
        Wired headphones keep the click out of the mic.
        {settings.latencyMs === 0 && (
          <> <button onClick={onCalibrate}>Calibrate timing first</button></>
        )}
      </div>
      <button className="primary big" disabled={!settings.chords.length} onClick={() => setPhase('playing')}>
        {phase === 'results' ? 'Play again' : 'Start'}
      </button>
    </div>
  );
}

function ResultsCard({ r }: { r: Results }) {
  return (
    <div className="card stack">
      {r.rank === 1 && <div className="banner">New high score!</div>}
      {r.rank !== null && r.rank > 1 && <div className="banner">#{r.rank} on the leaderboard</div>}
      <div className="stats">
        <div><b>{r.score}</b><span>Score</span></div>
        <div><b>{r.hits}/{r.total}</b><span>Hits</span></div>
        <div><b>{r.total ? Math.round((100 * r.hits) / r.total) : 0}%</b><span>Accuracy</span></div>
      </div>
      {r.avgOffsetMs !== null && Math.abs(r.avgOffsetMs) > 25 && (
        <div className="muted small">On average you were {Math.abs(r.avgOffsetMs)} ms {r.avgOffsetMs > 0 ? 'late' : 'early'}.</div>
      )}
      {r.missed.length > 0 && (
        <div className="small">
          Most missed: {r.missed.map(([id, n]) => `${id.replace('@', ' pos ')} (${n})`).join(', ')}
        </div>
      )}
    </div>
  );
}

function Playing({ engine, settings, bpm, maxJump, onDone, onQuit }: {
  engine: AudioEngine;
  settings: Settings;
  bpm: number;
  maxJump: number;
  onDone: (s: GameScorer) => void;
  onQuit: () => void;
}) {
  const run = useRef<Run | null>(null);
  const [, setFrame] = useState(0);
  const [flash, setFlash] = useState<'' | 'good' | 'bad'>('');
  const [message, setMessage] = useState('');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const flashFor = (f: 'good' | 'bad') => {
    setFlash(f);
    setTimeout(() => setFlash(''), 250);
  };

  useEffect(() => {
    const d = DIFFICULTIES[settings.difficulty];
    const ctx = engine.ctx;
    const start = ctx.currentTime + 0.6;
    const beat = 60 / bpm;
    const times = targetTimes(start, bpm, d.beatsPerChord, GAME_SECONDS);
    const seq = new Sequencer(buildPool(settings.chords, settings.positions), maxJump, d.biasFar && settings.gameJump === null);
    const ids = times.map(() => seq.next().id);
    const end = times[times.length - 1] + d.beatsPerChord * beat;
    run.current = { scorer: new GameScorer(times, ids, d.windowMs / 1000), start, beat, beatsPerChord: d.beatsPerChord, window: d.windowMs / 1000, end };
    const metro = new Metronome(ctx, settings.clickVolume);
    metro.start(start, bpm, d.beatsPerChord === 2 ? 2 : 4, end);
    void keepAwake(true);

    const latency = settings.latencyMs / 1000;
    const strum = (t: number, judgeFn: (id: string) => { ok: boolean; heard: string | null }) => {
      const r = run.current!;
      const pending = r.scorer.targets.filter((x) => x.result === 'pending');
      if (!pending.length) return;
      const near = pending.reduce((a, b) => (Math.abs(b.time - t) < Math.abs(a.time - t) ? b : a));
      if (Math.abs(near.time - t) > r.window) return; // off-beat strum: ignored
      const { ok, heard } = judgeFn(near.voicingId);
      if (r.scorer.strum(t, near.voicingId, ok)) {
        flashFor('good');
        setMessage('');
      } else if (heard) setMessage(`Heard ${heard}`);
    };

    const offStrum = engine.onStrum((ev) =>
      strum(ev.onsetTime - latency, (id) => {
        const j = judge(ev.analysis, VOICING_BY_ID[id], { ...DEFAULT_MATCH, checkPosition: settings.checkPosition });
        return { ok: j.verdict === 'correct', heard: j.verdict === 'wrongPosition' ? `position ${j.heardPosition}` : j.heard };
      }),
    );
    const onKey = (e: KeyboardEvent) => {
      if (settings.debug && e.key === 'c') strum(ctx.currentTime, () => ({ ok: true, heard: null }));
    };
    window.addEventListener('keydown', onKey);

    let raf = 0;
    const loop = () => {
      const r = run.current!;
      const now = ctx.currentTime;
      if (r.scorer.expire(now, EVAL_DELAY + 0.08).length) flashFor('bad');
      setFrame((f) => f + 1);
      if (r.scorer.done && now > r.end) return doneRef.current(r.scorer);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      metro.stop();
      offStrum();
      window.removeEventListener('keydown', onKey);
      void keepAwake(false);
    };
    // A game runs with the settings it started with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = run.current;
  if (!r) return null;
  const now = engine.ctx.currentTime;
  const targets = r.scorer.targets;
  const idx = targets.findIndex((t) => t.time + r.window > now);
  const cur = targets[idx === -1 ? targets.length - 1 : idx];
  const next = idx >= 0 ? targets[idx + 1] : undefined;
  const beatNo = Math.floor((now - r.start) / r.beat + 0.001);
  const countIn = beatNo < 4 ? 4 - Math.max(0, beatNo) : null;
  const beatInChord = countIn === null ? (beatNo - 4) % r.beatsPerChord : -1;
  const progress = Math.min(1, Math.max(0, (now - targets[0].time) / (r.end - targets[0].time)));

  return (
    <>
      <div className="row">
        <div className="stats" style={{ flex: 1 }}>
          <div><b>{r.scorer.score}</b><span>Score</span></div>
          <div><b>{r.scorer.hits}</b><span>Hits</span></div>
          <div><b>{r.scorer.misses}</b><span>Misses</span></div>
        </div>
        <button onClick={onQuit}>Quit</button>
      </div>
      <div className="progress"><div style={{ width: `${progress * 100}%` }} /></div>
      <div className={`stage ${flash}`}>
        {countIn !== null && <div className="countin">{countIn}</div>}
        <ChordCard voicing={VOICING_BY_ID[cur.voicingId]} showDiagram={settings.showDiagram} diagramSize={170} />
        <div className="beats">
          {Array.from({ length: r.beatsPerChord }, (_, i) => (
            <span key={i} className={i === beatInChord ? 'on' : ''} />
          ))}
        </div>
        {next && (
          <div className="next">
            next <b>{VOICING_BY_ID[next.voicingId].chordId}</b> pos {VOICING_BY_ID[next.voicingId].position}
          </div>
        )}
        <div className="message">{message}</div>
      </div>
      {settings.debug && <DebugMeter engine={engine} />}
    </>
  );
}
