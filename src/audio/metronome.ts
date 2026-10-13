// Look-ahead metronome on the AudioContext clock. Clicks are short sine blips
// above 3 kHz so the strum detector (80 Hz–2 kHz) ignores them.

export class Metronome {
  private timer = 0;
  private nextBeat = 0;
  private beat = 0;

  constructor(
    private ctx: AudioContext,
    private volume: number,
  ) {}

  /** Start clicking at `start` (ctx time). Beat 0 of every `beatsPerBar` is accented. */
  start(start: number, bpm: number, beatsPerBar = 4, until = Infinity) {
    this.stop();
    const period = 60 / bpm;
    this.nextBeat = start;
    this.beat = 0;
    const schedule = () => {
      while (this.nextBeat < this.ctx.currentTime + 0.15 && this.nextBeat <= until) {
        this.click(this.nextBeat, this.beat % beatsPerBar === 0);
        this.nextBeat += period;
        this.beat++;
      }
    };
    schedule();
    this.timer = window.setInterval(schedule, 25);
  }

  private click(at: number, accent: boolean) {
    if (this.volume <= 0) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = accent ? 3520 : 3136;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(this.volume * (accent ? 0.6 : 0.4), at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(at);
    osc.stop(at + 0.05);
  }

  stop() {
    clearInterval(this.timer);
  }
}
