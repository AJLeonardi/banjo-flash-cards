import { useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/engine';
import { FIRST_EVAL } from '../audio/listener';
import { DEFAULT_MATCH, judge } from '../audio/matcher';
import { Metronome } from '../audio/metronome';
import { Difficulty, DIFFICULTIES, GAME_SECONDS, gameLevel } from '../game/difficulty';
import { addScore, tableKey } from '../game/highscores';
import { GameScorer, targetTimes } from '../game/scoring';
import { buildPool, Sequencer } from '../game/sequencer';
import { CHORD_BY_ID, fretLabel, VOICING_BY_ID } from '../music/library';
import { Settings } from '../settings';
import { keepAwake } from '../wakelock';
import { ChordCard } from './ChordCard';
import { jumpFor } from './ChordPicker';
import { DebugMeter } from './DebugMeter';
import { MicStatus } from './MicStatus';

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
  // Chords, positions and max fret jump come from the Home screen, same as Practice.
  const level = gameLevel(settings.jumpMode, settings.customJump);
  const d = DIFFICULTIES[level];
  const bpm = settings.bpm ?? d.bpm;
  const { maxJump, biasFar } = jumpFor(settings.jumpMode, settings.customJump);
  const custom = bpm !== d.bpm || settings.jumpMode === 'custom';

  if (phase === 'playing')
    return (
      <Playing
        engine={engine}
        settings={settings}
        level={level}
        bpm={bpm}
        maxJump={maxJump}
        biasFar={biasFar}
        onDone={(scorer) => {
          const hits = scorer.targets.filter((t) => t.result === 'hit');
          const missCount = new Map<string, number>();
          for (const t of scorer.targets) if (t.result === 'miss') missCount.set(t.voicingId, (missCount.get(t.voicingId) ?? 0) + 1);
          const rank = addScore(tableKey(custom ? 'custom' : level, settings.chords), {
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
        <div className="small">
          <b>{settings.chords.join(' ') || 'No chords selected'}</b> · {positionsLabel(settings.positions)} ·{' '}
          {settings.jumpMode === 'custom' ? `max jump ${maxJump} frets` : `${d.label} (max jump ${maxJump >= 17 ? 'anywhere' : `${maxJump} frets`})`}
          <div className="muted">Chords, positions and fret jump are set on the Home screen.</div>
        </div>
        <label className="stack">
          <span className="small">
            Tempo: <b>{bpm} BPM</b>{' '}
            {bpm === d.bpm ? (
              <span className="muted">(suggested)</span>
            ) : (
              <button className="small" onClick={() => update({ bpm: null })}>reset to {d.bpm}</button>
            )}
          </span>
          <input type="range" min={40} max={160} value={bpm} onChange={(e) => update({ bpm: +e.target.value })} />
        </label>
        <div className="muted small">
          {d.beatsPerChord} beats per chord · ±{d.windowMs} ms timing window · {GAME_SECONDS / 60} minute game
        </div>
        {custom && <div className="muted small">A custom tempo or fret jump is scored on a separate high-score table.</div>}
      </div>
      <div className="card small muted">
        Strum on the first beat of each chord: on time and correct = +1, missed = −1.
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

function positionsLabel(positions: number[]) {
  if (!positions.length) return 'all positions';
  return `position${positions.length > 1 ? 's' : ''} ${positions.map((p) => (p === 5 ? '5+' : p)).join(', ')}`;
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
          Most missed: {r.missed.map(([id, n]) => `${VOICING_BY_ID[id].chordId} ${fretLabel(VOICING_BY_ID[id]).toLowerCase()} (${n})`).join(', ')}
        </div>
      )}
    </div>
  );
}

function Playing({ engine, settings, level, bpm, maxJump, biasFar, onDone, onQuit }: {
  engine: AudioEngine;
  settings: Settings;
  level: Difficulty;
  bpm: number;
  maxJump: number;
  biasFar: boolean;
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
    const d = DIFFICULTIES[level];
    const ctx = engine.ctx;
    const start = ctx.currentTime + 0.6;
    const beat = 60 / bpm;
    const times = targetTimes(start, bpm, d.beatsPerChord, GAME_SECONDS);
    const seq = new Sequencer(buildPool(settings.chords, settings.positions), maxJump, biasFar);
    const ids = times.map(() => seq.next().id);
    const end = times[times.length - 1] + d.beatsPerChord * beat;
    run.current = { scorer: new GameScorer(times, ids, d.windowMs / 1000), start, beat, beatsPerChord: d.beatsPerChord, window: d.windowMs / 1000, end };
    const metro = new Metronome(ctx, settings.clickVolume);
    metro.start(start, bpm, d.beatsPerChord === 2 ? 2 : 4, end);
    void keepAwake(true);

    const latency = settings.latencyMs / 1000;
    const strum = (t: number, judgeFn: (id: string) => { ok: boolean; heard: string | null }, final = true) => {
      const r = run.current!;
      const pending = r.scorer.targets.filter((x) => x.result === 'pending');
      if (!pending.length) return;
      const near = pending.reduce((a, b) => (Math.abs(b.time - t) < Math.abs(a.time - t) ? b : a));
      if (Math.abs(near.time - t) > r.window) {
        // Off-beat strums don't score. But if it was the right chord, say how far off it
        // was, rather than leaving a good strum with no response at all.
        const closest = r.scorer.targets.reduce((a, b) => (Math.abs(b.time - t) < Math.abs(a.time - t) ? b : a));
        const off = t - closest.time;
        if (Math.abs(off) > r.window && Math.abs(off) < r.beat / 2 && closest.result !== 'hit' && judgeFn(closest.voicingId).ok)
          setMessage(`Right chord, but ${Math.round(Math.abs(off) * 1000)} ms ${off < 0 ? 'early' : 'late'}`);
        return;
      }
      const { ok, heard } = judgeFn(near.voicingId);
      if (ok) engine.endGesture(0.3);
      if (r.scorer.strum(t, near.voicingId, ok)) {
        flashFor('good');
        setMessage('');
      } else if (final && heard) setMessage(`Heard ${heard}`);
    };

    const offStrum = engine.onStrum((ev) =>
      strum(ev.onsetTime - latency, (id) => {
        const j = judge(ev.analysis, VOICING_BY_ID[id], { ...DEFAULT_MATCH, checkPosition: settings.checkPosition });
        const heard =
          j.verdict === 'wrongPosition' ? `the ${fretLabel(CHORD_BY_ID[VOICING_BY_ID[id].chordId].voicings[j.heardPosition! - 1]).toLowerCase()} one` : j.verdict === 'partial' ? 'part of the chord' : j.heard;
        return { ok: j.verdict === 'correct', heard };
      }, ev.final),
    );
    const onKey = (e: KeyboardEvent) => {
      if (settings.debug && e.key === 'c') strum(ctx.currentTime, () => ({ ok: true, heard: null }));
    };
    window.addEventListener('keydown', onKey);

    let raf = 0;
    const loop = () => {
      const r = run.current!;
      const now = ctx.currentTime;
      // Allow time for the strum to be heard (a relaxed strum takes a few hundred ms).
      if (r.scorer.expire(now, FIRST_EVAL + 0.4).length) flashFor('bad');
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
  const curIdx = idx === -1 ? targets.length - 1 : idx;
  const cur = targets[curIdx];
  const prev = targets[curIdx - 1];
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
      <MicStatus engine={engine} />
      <div className={`stage ${flash}`}>
        {countIn !== null && <div className="countin overlay">{countIn}</div>}
        <ChordCard
          voicing={VOICING_BY_ID[cur.voicingId]}
          prev={prev && VOICING_BY_ID[prev.voicingId]}
          next={next && VOICING_BY_ID[next.voicingId]}
          step={curIdx}
          bpm={bpm}
          showDiagram={settings.showDiagram}
        >
          <div className="beats">
            {Array.from({ length: r.beatsPerChord }, (_, i) => (
              <span key={i} className={i === beatInChord ? 'on' : ''} />
            ))}
          </div>
          <div className="message">{message}</div>
        </ChordCard>
      </div>
      {settings.debug && <DebugMeter engine={engine} target={VOICING_BY_ID[cur.voicingId]} />}
    </>
  );
}
