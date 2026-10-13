import { CHORD_BY_ID, fretLabel, fretPattern, Voicing } from '../music/library';
import { ChordDiagram } from './ChordDiagram';

/** Chord name and where to play it, big enough to read at a glance from the banjo. */
export function ChordCard({ voicing, showDiagram, diagramSize }: { voicing: Voicing; showDiagram: boolean; diagramSize?: number }) {
  const total = CHORD_BY_ID[voicing.chordId].voicings.length;
  return (
    <>
      <div className="chord-head">
        <span className="chord-name">{voicing.chordId}</span>
        <span className="chord-fret">{fretLabel(voicing)}</span>
      </div>
      <div className="shape-line">
        {voicing.shapeName} · <b>{fretPattern(voicing)}</b>
      </div>
      <div className="pos-dots" aria-label={`Voicing ${voicing.position} of ${total}, counting from the nut`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i + 1 === voicing.position ? 'on' : ''} />
        ))}
      </div>
      {showDiagram && <ChordDiagram voicing={voicing} size={diagramSize} />}
    </>
  );
}
