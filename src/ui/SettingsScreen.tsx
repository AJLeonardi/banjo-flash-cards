import { clearScores } from '../game/highscores';
import { Settings } from '../settings';

export function SettingsScreen({ settings, update, onCalibrate }: { settings: Settings; update: (p: Partial<Settings>) => void; onCalibrate: () => void }) {
  return (
    <div className="stack">
      <div className="card stack">
        <label className="toggle">
          <input type="checkbox" checked={settings.showDiagram} onChange={(e) => update({ showDiagram: e.target.checked })} />
          Show chord diagram and fret numbers
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.checkPosition} onChange={(e) => update({ checkPosition: e.target.checked })} />
          <span>
            Check neck position <br />
            <span className="muted small">Off = any voicing of the right chord counts</span>
          </span>
        </label>
      </div>
      <div className="card stack">
        <label className="stack">
          <span>Mic sensitivity: {Math.round(settings.sensitivity * 10)}</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.sensitivity} onChange={(e) => update({ sensitivity: +e.target.value })} />
          <span className="muted small">Raise it if strums aren't noticed; lower it if noise triggers it.</span>
        </label>
        <label className="stack">
          <span>Metronome volume</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.clickVolume} onChange={(e) => update({ clickVolume: +e.target.value })} />
        </label>
        <div className="row">
          <span>Timing correction: {settings.latencyMs} ms</span>
          <span className="spacer" />
          <button onClick={onCalibrate}>Calibrate</button>
        </div>
      </div>
      <div className="card stack">
        <label className="toggle">
          <input type="checkbox" checked={settings.debug} onChange={(e) => update({ debug: e.target.checked })} />
          <span>
            Show detector debug panel <br />
            <span className="muted small">Live level + what was heard. Keyboard: c = correct, x = wrong.</span>
          </span>
        </label>
        <button onClick={() => confirmClear()}>Clear high scores</button>
      </div>
    </div>
  );
}

function confirmClear() {
  // Two taps instead of a blocking confirm() dialog.
  const b = document.activeElement as HTMLButtonElement | null;
  if (b?.dataset.armed) {
    clearScores();
    b.textContent = 'High scores cleared';
    delete b.dataset.armed;
  } else if (b) {
    b.dataset.armed = '1';
    b.textContent = 'Tap again to clear all high scores';
  }
}
