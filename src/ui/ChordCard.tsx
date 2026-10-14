import { ReactNode } from 'react';
import { CHORD_BY_ID, fretLabel, Voicing } from '../music/library';
import { ChordDiagram } from './ChordDiagram';

/**
 * Chord name and where to play it, big enough to read at a glance from the banjo.
 * `children` (status, beats) go under the name. In portrait the diagram stacks below;
 * in landscape it sits to the right (see .chord-card in styles.css).
 *
 * `prev` and `next` sit small on either side of the name, and the row slides left when
 * the chord changes: the next chord is there to get your hand moving early.
 */
export function ChordCard({ voicing, prev, next, showDiagram, children }: {
  voicing: Voicing;
  prev?: Voicing;
  next?: Voicing;
  showDiagram: boolean;
  children?: ReactNode;
}) {
  const total = CHORD_BY_ID[voicing.chordId].voicings.length;
  return (
    <div className="chord-card">
      <div className="chord-info">
        {/* Keyed by the chord, so each change replays the slide-in. */}
        <div className="carousel" key={`${prev?.id}|${voicing.id}`}>
          <Peek voicing={prev} side="prev" />
          <div className="chord-head">
            <span className="chord-name">{voicing.chordId}</span>
            {/* Named by its lowest fret (the chart "5fr" marker); open-string voicings say "Open". */}
            <span className="chord-fret">
              {voicing.hasOpen ? (
                <b>Open</b>
              ) : (
                <>
                  <small>Fret</small>
                  <b>{voicing.minFret}</b>
                </>
              )}
            </span>
          </div>
          <Peek voicing={next} side="next" />
        </div>
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

function Peek({ voicing, side }: { voicing?: Voicing; side: 'prev' | 'next' }) {
  return (
    <div className={`peek ${side}`} aria-hidden={side === 'prev'}>
      {voicing && (
        <>
          {side === 'next' && <small>Next</small>}
          <b>{voicing.chordId}</b>
          <span>{fretLabel(voicing)}</span>
        </>
      )}
    </div>
  );
}
