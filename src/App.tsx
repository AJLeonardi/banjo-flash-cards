import { useCallback, useEffect, useState } from 'react';
import { AudioEngine } from './audio/engine';
import { loadSettings, saveSettings, Settings } from './settings';
import { Calibrate } from './ui/Calibrate';
import { buildPool } from './game/sequencer';
import { ChordPicker, JumpPicker } from './ui/ChordPicker';
import { Game } from './ui/Game';
import { HighScores } from './ui/HighScores';
import { Practice } from './ui/Practice';
import { SettingsScreen } from './ui/SettingsScreen';
import { BackIcon, GearIcon, TrophyIcon } from './ui/Icons';

type Screen = 'home' | 'practice' | 'game' | 'scores' | 'settings' | 'calibrate';

const TITLES: Record<Screen, string> = {
  home: 'Banjo Chord Trainer',
  practice: 'Practice',
  game: 'Tempo Game',
  scores: 'High Scores',
  settings: 'Settings',
  calibrate: 'Calibrate',
};

const NEEDS_MIC: Screen[] = ['practice', 'game', 'calibrate'];

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>('home');
  const [back, setBack] = useState<Screen>('home');
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [micError, setMicError] = useState('');

  const update = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...p };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (engine) engine.sensitivity = settings.sensitivity;
  }, [engine, settings.sensitivity]);

  // Only hold the mic on screens that listen; leaving them turns the mic off.
  useEffect(() => {
    if (engine && !NEEDS_MIC.includes(screen)) {
      engine.stop();
      setEngine(null);
    }
  }, [engine, screen]);

  // Must run inside a tap: iOS only allows audio + mic from a user gesture.
  const go = async (s: Screen) => {
    setBack(screen === 'calibrate' ? back : screen);
    if (NEEDS_MIC.includes(s) && !engine) {
      try {
        setEngine(await AudioEngine.start(settings.sensitivity));
        setMicError('');
      } catch (e) {
        setMicError(
          location.protocol !== 'https:' && location.hostname !== 'localhost'
            ? 'The microphone needs an https:// address.'
            : `Couldn't open the microphone (${(e as Error).message}). Check the browser's mic permission.`,
        );
        return;
      }
    }
    setScreen(s);
  };

  return (
    <div className={`app screen-${screen}`}>
      <div className="topbar">
        {screen !== 'home' && (
          <button className="icon" aria-label="Back" onClick={() => setScreen(screen === 'calibrate' ? back : 'home')}>
            <BackIcon />
          </button>
        )}
        <h1>{TITLES[screen]}</h1>
        {screen === 'home' && (
          <>
            <button className="icon" onClick={() => go('scores')} aria-label="High scores"><TrophyIcon /></button>
            <button className="icon" onClick={() => go('settings')} aria-label="Settings"><GearIcon /></button>
          </>
        )}
      </div>

      {micError && <div className="card error">{micError}</div>}

      {screen === 'home' && (
        // Settings on the left, actions on the right (landscape); in portrait the
        // Practice/Game buttons are pinned to the bottom of the screen.
        <div className="home">
          <div className="home-settings">
            <ChordPicker settings={settings} update={update} />
          </div>
          <div className="home-actions">
            <JumpPicker
              mode={settings.jumpMode}
              custom={settings.customJump}
              onChange={(jumpMode, customJump) => update({ jumpMode, customJump })}
            />
            <div className="cta">
              <div className="cta-summary">
                {settings.chords.length ? (
                  <>
                    <b>{settings.chords.join(' ')}</b> · {buildPool(settings.chords, settings.positions).length} shapes
                  </>
                ) : (
                  'Pick some chords to start'
                )}
              </div>
              <div className="cta-buttons">
                <button className="primary big" disabled={!settings.chords.length} onClick={() => go('practice')}>
                  Practice
                </button>
                <button className="primary big" disabled={!settings.chords.length} onClick={() => go('game')}>
                  Game
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {screen === 'practice' && engine && <Practice engine={engine} settings={settings} update={update} />}
      {screen === 'game' && engine && <Game engine={engine} settings={settings} update={update} onCalibrate={() => go('calibrate')} />}
      {screen === 'calibrate' && engine && (
        <Calibrate engine={engine} settings={settings} update={update} onDone={() => setScreen(back)} />
      )}
      {screen === 'scores' && <HighScores />}
      {screen === 'settings' && <SettingsScreen settings={settings} update={update} onCalibrate={() => go('calibrate')} />}
      <div className="version">{__APP_VERSION__}</div>
    </div>
  );
}
