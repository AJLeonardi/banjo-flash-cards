import { allScores } from '../game/highscores';

export function HighScores() {
  const table = allScores();
  const keys = Object.keys(table).sort();
  if (!keys.length) return <div className="card muted">No games played yet.</div>;
  return (
    <div className="stack">
      {keys.map((k) => {
        const [diff, chords] = k.split('|');
        return (
          <div key={k} className="card">
            <h2>
              {diff} · {chords}
            </h2>
            <table>
              <thead>
                <tr><th>#</th><th>Score</th><th>Hits</th><th>BPM</th><th>Date</th></tr>
              </thead>
              <tbody>
                {table[k].map((e, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><b>{e.score}</b></td>
                    <td>{e.hits}/{e.total}</td>
                    <td>{e.bpm}</td>
                    <td className="muted">{new Date(e.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
