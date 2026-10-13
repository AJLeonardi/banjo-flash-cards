import { Voicing } from '../music/library';

const STRING_NAMES = ['g', 'D', 'G', 'B', 'D']; // 5th..1st, left to right

/** Vertical chord box: 5 strings (5th on the left), fret numbers under each string. */
export function ChordDiagram({ voicing, size = 200 }: { voicing: Voicing; size?: number }) {
  const frets = [0, ...voicing.frets]; // 5th string always open
  const fretted = voicing.frets.filter((f) => f > 0);
  const nut = voicing.maxFret <= 5;
  const first = nut ? 1 : Math.min(...fretted);
  const rows = Math.max(4, voicing.maxFret - first + 1);
  const w = size, h = size * 1.15;
  const left = 34, right = w - 14, top = 30, bottom = h - 40;
  const dx = (right - left) / 4;
  const dy = (bottom - top) / rows;
  const x = (s: number) => left + s * dx;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Frets ${voicing.frets.join(' ')}`}>
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={i} x1={left} x2={right} y1={top + i * dy} y2={top + i * dy} stroke="var(--fret)" strokeWidth={i === 0 && nut ? 6 : 1.5} />
      ))}
      {frets.map((_, s) => (
        <line key={s} x1={x(s)} x2={x(s)} y1={top} y2={bottom} stroke="var(--fret)" strokeWidth={1.5} />
      ))}
      {!nut && (
        <text x={left - 8} y={top + dy / 2 + 5} textAnchor="end" fontSize={14} fill="var(--muted)">
          {first}
        </text>
      )}
      {frets.map((f, s) =>
        f === 0 ? (
          <circle key={s} cx={x(s)} cy={top - 13} r={6} fill="none" stroke="var(--text)" strokeWidth={2} />
        ) : (
          <g key={s}>
            <circle cx={x(s)} cy={top + (f - first + 0.5) * dy} r={Math.min(dx, dy) * 0.36} fill="var(--dot)" />
            <text x={x(s)} y={top + (f - first + 0.5) * dy + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--dot-ink)">
              {f}
            </text>
          </g>
        ),
      )}
      {frets.map((f, s) => (
        <g key={s}>
          <text x={x(s)} y={bottom + 18} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--text)">
            {f}
          </text>
          <text x={x(s)} y={bottom + 34} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {STRING_NAMES[s]}
          </text>
        </g>
      ))}
    </svg>
  );
}
