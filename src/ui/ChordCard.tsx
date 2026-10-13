import { CHORD_BY_ID, fretRangeLabel, Voicing } from '../music/library';
import { ChordDiagram } from './ChordDiagram';

export function ChordCard({ voicing, showDiagram, diagramSize }: { voicing: Voicing; showDiagram: boolean; diagramSize?: number }) {
  const total = CHORD_BY_ID[voicing.chordId].voicings.length;
  return (
    <>
      <div className="chord-name">{voicing.chordId}</div>
      <div className="pos-dots" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i + 1 === voicing.position ? 'on' : ''} />
        ))}
      </div>
      <div className="pos-line">
        Position {voicing.position} of {total} · {fretRangeLabel(voicing)}
      </div>
      {showDiagram && <ChordDiagram voicing={voicing} size={diagramSize} />}
    </>
  );
}
