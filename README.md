# Banjo Chord Trainer

A phone-friendly web app (installable PWA) for drilling bluegrass 5-string banjo chords (open G, gDGBD) up and down the neck. It shows a chord **in a specific neck position**, listens through the mic, flashes green and moves on when you play it, and flashes red and stays when you don't.

- **Chord library:** 12 roots × Major, minor, 7, m7, 6, °7. Each chord has 3–5 positions, numbered from the nut up (`D · Position 2 of 5 · frets 2–4`). Turn the diagram with fret numbers on or off.
- **Practice mode:** pick chords (`G C D`, presets, or the full grid) and which positions to use, and set a **max fret jump** (Easy ≤3, Medium ≤7, Hard = anywhere, or Custom).
- **Tempo game:** a 2-minute run with a metronome. Strum each new chord on its downbeat: on time and correct = +1, missed = −1. Top-10 high scores per difficulty and chord set.
- **Timing calibration:** strum along with clicks once, so phone/Bluetooth audio delay doesn't cost you points.

## How detection works
Everything runs in the browser; no audio leaves the device.
1. A strum is detected as a burst of new energy between 80 Hz and 2 kHz. The metronome clicks above 3 kHz so it never counts as a strum.
2. About 0.22 s after the strum, the app takes the spectrum and compares it, note by note, with a template of every voicing in the library: the 4 fretted notes, the open 5th string, and their overtones.
3. The best-matching chord decides right or wrong. Then the best-matching voicing **of that chord** decides the position. Positions differ in which octave each note is in, which is what lets the app tell them apart. This is best-effort, so if it's too strict for your room or mic, turn off **Settings → Check neck position**.

On synthesized strums, chord ID is right about 98% of the time and position about 96%. Settings → **debug panel** shows what the detector hears, for tuning on a real banjo.

## Develop
```sh
npm install
npm test            # library, detector (synthesized banjo strums), scoring tests
npm run dev         # http://localhost:5173
npm run dev:https   # https://<your-LAN-IP>:5173 — phones only allow the mic over https (accept the self-signed cert)
npm run build
```

## Deploy
Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes to GitHub Pages at `https://ajleonardi.github.io/banjo-flash-cards/`. One-time setup: in the repo go to **Settings → Pages → Source: GitHub Actions**.
