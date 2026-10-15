import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CHORD_BY_ID, Voicing } from '../music/library';
import { ChordDiagram } from './ChordDiagram';

/**
 * Chord name and where to play it, big enough to read at a glance from the banjo.
 * `children` (status, beats) go under the name. In portrait the diagram stacks below;
 * in landscape it sits to the right (see .chord-card in styles.css).
 *
 * `prev` and `next` sit small on either side of the name: the next chord is there to
 * get your hand moving early. `step` counts chords played; when it goes up, each chord
 * slides one slot left and grows or shrinks into its new size.
 */
export function ChordCard({ voicing, prev, next, step, showDiagram, children }: {
  voicing: Voicing;
  prev?: Voicing;
  next?: Voicing;
  step: number;
  showDiagram: boolean;
  children?: ReactNode;
}) {
  const total = CHORD_BY_ID[voicing.chordId].voicings.length;
  return (
    <div className="chord-card">
      <div className="chord-info">
        <Carousel prev={prev} current={voicing} next={next} step={step} />
        <div className="pos-dots" aria-label={`Voicing ${voicing.position} of ${total}, counting from the nut`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i + 1 === voicing.position ? 'on' : ''} />
          ))}
        </div>
        {children}
      </div>
      {showDiagram && (
        <div className="chord-diagram">
          <ChordDiagram voicing={voicing} />
        </div>
      )}
    </div>
  );
}

/** Slot offsets from the current chord: -2 has just left, +2 is about to arrive. */
type Slot = -2 | -1 | 0 | 1 | 2;
const SIDE_SCALE = 0.34;
/** Must match the side-chord .chord-fret scale in styles.css. */
const SIDE_PILL_SCALE = 1.7;
const GAP = 14;
const OPACITY: Record<Slot, number> = { [-2]: 0, [-1]: 0.35, 0: 1, 1: 0.9, 2: 0 };
/** How long a chord that has slid off the left stays rendered (the CSS transition time). */
const LEAVE_MS = 450;

interface Item {
  key: number;
  voicing: Voicing;
  slot: Slot;
}

/**
 * Every chord is one element, keyed by its place in the sequence, laid on top of the
 * others in a single grid cell (so the row is as tall as the current chord). Its slot
 * sets a transform: the current chord full size in the middle, the others scaled down
 * to either side. Changing a transform is all it takes for CSS to animate the move.
 */
function Carousel({ prev, current, next, step }: { prev?: Voicing; current: Voicing; next?: Voicing; step: number }) {
  const box = useRef<HTMLDivElement>(null);
  const placed = useRef(new Set<number>());
  // When the sequence moves on by one, the old previous chord stays a moment to slide
  // out. (Worked out during render, so its element is never dropped in between.)
  const seen = useRef<{ step: number; prev?: Voicing; leaving: Item | null }>({ step, prev, leaving: null });
  if (seen.current.step !== step) {
    const last = seen.current;
    seen.current = { step, prev, leaving: step === last.step + 1 && last.prev ? { key: last.step - 1, voicing: last.prev, slot: -2 } : null };
  }
  seen.current.prev = prev;
  const leaving = seen.current.leaving;
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!seen.current.leaving) return;
    const t = setTimeout(() => {
      seen.current.leaving = null;
      rerender((n) => n + 1);
    }, LEAVE_MS);
    return () => clearTimeout(t);
  }, [step]);

  const items: Item[] = [];
  if (leaving) items.push(leaving);
  if (prev) items.push({ key: step - 1, voicing: prev, slot: -1 });
  items.push({ key: step, voicing: current, slot: 0 });
  if (next) items.push({ key: step + 1, voicing: next, slot: 1 });

  const ids = items.map((i) => `${i.key}:${i.voicing.id}`).join(' ');
  const layout = () => {
    const el = box.current;
    if (!el) return;
    const els = new Map([...el.children].map((c) => [Number((c as HTMLElement).dataset.key), c as HTMLElement]));
    const width = (k: number) => els.get(k)?.offsetWidth ?? 0; // layout size: transforms don't change it
    const half = el.clientWidth / 2;
    // A side chord's fret pill is drawn bigger than the rest of it (see styles.css).
    const pill = (k: number) => (els.get(k)?.querySelector<HTMLElement>('.chord-fret')?.offsetWidth ?? 0) * SIDE_PILL_SCALE;
    const side = (k: number) => (Math.max(width(k), pill(k)) * SIDE_SCALE) / 2;
    // The current chord is centred, so it gets twice the room left by the wider side
    // chord. A long name (Bb°7) shrinks to fit.
    const sideRoom = Math.max(prev ? GAP + 2 * side(step - 1) : 0, next ? GAP + 2 * side(step + 1) : 0);
    const curScale = Math.min(1, (2 * (half - sideRoom)) / (width(step) || 1));
    const curHalf = (width(step) * curScale) / 2;
    // Side chords sit just clear of the current one, but never past the card's edge.
    const nextX = Math.min(curHalf + GAP + side(step + 1), half - side(step + 1));
    const prevX = -Math.min(curHalf + GAP + side(step - 1), half - side(step - 1));
    const x: Record<Slot, number> = { [-2]: prevX - half / 2, [-1]: prevX, 0: 0, 1: nextX, 2: nextX + half / 2 };
    const place = (e: HTMLElement, slot: Slot) => {
      e.style.transform = `translateX(${x[slot]}px) scale(${slot === 0 ? curScale : SIDE_SCALE})`;
      e.style.opacity = String(OPACITY[slot]);
    };
    for (const it of items) {
      const e = els.get(it.key);
      if (!e) continue;
      if (!placed.current.has(it.key)) {
        // New arrivals start where they'd come from, with no transition, then move.
        e.style.transition = 'none';
        place(e, it.slot === 1 && placed.current.size ? 2 : it.slot);
        void e.offsetWidth;
        e.style.transition = '';
      }
      place(e, it.slot);
    }
    placed.current = new Set(items.map((i) => i.key));
  };
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useLayoutEffect(() => layoutRef.current(), [ids]);
  useEffect(() => {
    const ro = new ResizeObserver(() => layoutRef.current());
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="carousel" ref={box}>
      {items.map((it) => (
        <div key={it.key} data-key={it.key} className={`chord-head slot${it.slot}`} aria-hidden={it.slot !== 0}>
          {it.slot === 1 && <small className="next-label">Next</small>}
          <span className="chord-name">{it.voicing.chordId}</span>
          {/* Named by its lowest fret (the chart "5fr" marker); open-string voicings say "Open". */}
          <span className="chord-fret">
            {it.voicing.hasOpen ? (
              <b>Open</b>
            ) : (
              <>
                <small>Fret</small>
                <b>{it.voicing.minFret}</b>
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
