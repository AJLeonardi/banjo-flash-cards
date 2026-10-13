import { useState } from 'react';
import { DIFFICULTIES } from '../game/difficulty';
import { buildPool } from '../game/sequencer';
import { chordName, parseChordList } from '../music/library';
import { NOTE_NAMES } from '../music/notes';
import { CHORD_TYPES } from '../music/shapes';
import { JumpMode, Settings } from '../settings';

const PRESETS = ['G C D', 'G C D7', 'G C D Em', 'A D E', 'C F G Am', 'D G A Bm', 'E A B7'];

export function ChordPicker({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  const [text, setText] = useState(settings.chords.join(' '));
  const [bad, setBad] = useState<string[]>([]);
  const selected = new Set(settings.chords);
  const voicings = buildPool(settings.chords, settings.positions).length;

  const setChords = (ids: string[]) => {
    update({ chords: ids });
    setText(ids.join(' '));
    setBad([]);
  };
  const toggle = (id: string) => setChords(selected.has(id) ? settings.chords.filter((c) => c !== id) : [...settings.chords, id]);
  const togglePos = (p: number) => {
    const cur = new Set(settings.positions);
    if (cur.has(p)) cur.delete(p);
    else cur.add(p);
    update({ positions: [...cur].sort() });
  };

  return (
    <div className="stack">
      <div className="card stack">
        <h2>Chords</h2>
        <input
          type="text"
          value={text}
          placeholder="e.g. G, C, D7, Em"
          autoCapitalize="characters"
          onChange={(e) => {
            setText(e.target.value);
            const r = parseChordList(e.target.value);
            setBad(r.bad);
            if (!r.bad.length) update({ chords: r.ids });
          }}
        />
        {bad.length > 0 && <div className="error">Didn't recognise: {bad.join(', ')}</div>}
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setChords(parseChordList(p).ids)}>
              {p}
            </button>
          ))}
        </div>
        <details>
          <summary className="muted small">Pick from the full chord grid</summary>
          <div className="grid" style={{ marginTop: 8 }}>
            <span />
            {CHORD_TYPES.map((t) => (
              <span key={t.id} className="hdr">
                {t.suffix || 'maj'}
              </span>
            ))}
            {NOTE_NAMES.map((n, root) => (
              <Row key={n} name={n} root={root} selected={selected} toggle={toggle} />
            ))}
          </div>
        </details>
      </div>

      <div className="card stack">
        <h2>Positions on the neck</h2>
        <div className="chips">
          <button className={settings.positions.length === 0 ? 'on' : ''} onClick={() => update({ positions: [] })}>
            All
          </button>
          {[1, 2, 3, 4, 5].map((p) => (
            <button key={p} className={settings.positions.includes(p) ? 'on' : ''} onClick={() => togglePos(p)}>
              {p === 5 ? '5+' : p}
            </button>
          ))}
        </div>
        <div className="muted small">Each chord's voicings counted from the nut: 1 is the lowest. {voicings} chord shapes selected.</div>
      </div>

      <JumpPicker
        mode={settings.jumpMode}
        custom={settings.customJump}
        onChange={(jumpMode, customJump) => update({ jumpMode, customJump })}
      />
    </div>
  );
}

function Row({ name, root, selected, toggle }: { name: string; root: number; selected: Set<string>; toggle: (id: string) => void }) {
  return (
    <>
      <span className="root">{name}</span>
      {CHORD_TYPES.map((t) => {
        const id = chordName(root, t.id);
        return (
          <button key={id} className={selected.has(id) ? 'on' : ''} onClick={() => toggle(id)} aria-label={id}>
            {id}
          </button>
        );
      })}
    </>
  );
}

export function JumpPicker({ mode, custom, onChange }: { mode: JumpMode; custom: number; onChange: (m: JumpMode, c: number) => void }) {
  return (
    <div className="card stack">
      <h2>Max fret jump between chords</h2>
      <div className="seg">
        {(['easy', 'medium', 'hard', 'custom'] as JumpMode[]).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => onChange(m, custom)}>
            {m === 'custom' ? 'Custom' : DIFFICULTIES[m].label}
          </button>
        ))}
      </div>
      {mode === 'custom' ? (
        <label className="stack">
          <span className="small">Up to {custom} frets</span>
          <input type="range" min={1} max={15} value={custom} onChange={(e) => onChange('custom', +e.target.value)} />
        </label>
      ) : (
        <div className="muted small">
          {mode === 'hard' ? 'Anywhere on the neck, favouring big moves.' : `Hand moves at most ${DIFFICULTIES[mode].maxJump} frets.`}
        </div>
      )}
    </div>
  );
}

export function jumpFor(mode: JumpMode, custom: number) {
  return mode === 'custom' ? { maxJump: custom, biasFar: false } : { maxJump: DIFFICULTIES[mode].maxJump, biasFar: DIFFICULTIES[mode].biasFar };
}
