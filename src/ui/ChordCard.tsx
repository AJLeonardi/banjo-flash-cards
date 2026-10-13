import { ReactNode } from 'react';
import { CHORD_BY_ID, Voicing } from '../music/library';
import { ChordDiagram } from './ChordDiagram';

/**
 * Chord name and where to play it, big enough to read at a glance from the banjo.
 * `children` (status, beats, next chord) go under the name. In portrait the diagram
 * stacks below; in landscape it sits to the right (see .chord-card in styles.css).
 */
export function ChordCard({ voicing, showDiagram, children }: { voicing: Voicing; showDiagram: boolean; children?: ReactNode }) {
  const total = CHORD_BY_ID[voicing.chordId].voicings.length;
  return (
    <div className="chord-card">
      <div className="chord-info">
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
