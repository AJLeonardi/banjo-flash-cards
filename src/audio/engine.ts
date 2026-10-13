// Browser side: mic → AnalyserNode, polled every 10 ms into ListenerCore.
// One shared AudioContext (created on a tap, as iOS requires) also drives the metronome.
//
// Browsers pause audio in several ways that would otherwise leave the app silently
// deaf: hidden tabs/covered windows get their timers throttled, the AudioContext can
// be suspended (phone lock, audio interruptions), and the mic track can end (device
// unplugged, permission revoked). Each tick checks for these, repairs what it can,
// and reports a `status` the UI shows next to the level meter.
//
// The mic is only held while it's needed: hiding the page (switching apps, locking
// the phone) releases it, and showing the page again reopens it. The browser
// remembers the permission, so reopening doesn't prompt.

import { ListenerCore, StrumEvent } from './listener';

export type StrumHandler = (ev: StrumEvent) => void;

export type EngineStatus = 'listening' | 'hidden' | 'suspended' | 'no-signal' | 'mic-lost';

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
};

let ctx: AudioContext | null = null;

export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state !== 'running') void ctx.resume();
  return ctx;
}

export class AudioEngine {
  private core: ListenerCore;
  private buf: Float32Array;
  private timer = 0;
  private handlers = new Set<StrumHandler>();
  private source: MediaStreamAudioSourceNode;
  private lastTick = 0;
  private silentSince = 0;
  private restarting = false;
  private stopped = false;
  private sensitivityValue: number;
  /** In-band input level, for a meter. */
  level = 0;
  status: EngineStatus = 'listening';

  private constructor(
    readonly ctx: AudioContext,
    private stream: MediaStream,
    private analyser: AnalyserNode,
    sensitivity: number,
  ) {
    this.sensitivityValue = sensitivity;
    this.core = new ListenerCore(ctx.sampleRate, { sensitivity });
    this.buf = new Float32Array(analyser.fftSize);
    this.source = ctx.createMediaStreamSource(stream);
    this.source.connect(analyser);
    this.timer = window.setInterval(() => this.tick(), 10);
    // A tap is the one thing that's always allowed to resume audio.
    window.addEventListener('pointerdown', this.resume);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
  }

  static async start(sensitivity: number): Promise<AudioEngine> {
    const ctx = audioContext();
    const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    await ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 16384;
    analyser.smoothingTimeConstant = 0;
    return new AudioEngine(ctx, stream, analyser, sensitivity);
  }

  set sensitivity(s: number) {
    this.sensitivityValue = s;
    this.core.onsets.opts.sensitivity = s;
  }

  onStrum(h: StrumHandler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  private resume = () => {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  };

  private onVisibility = () => {
    if (document.hidden) {
      // Stopping the tracks turns off the OS mic indicator; tick() reopens on return.
      this.stream.getTracks().forEach((t) => t.stop());
      void this.ctx.suspend();
    } else {
      this.resume();
    }
  };

  private onPageHide = () => this.stop();

  private async restartMic() {
    if (this.restarting) return;
    this.restarting = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      if (this.stopped || document.hidden) {
        // Left (or hid) the page while the mic was opening — don't keep it.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.source.disconnect();
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = stream;
      this.source = this.ctx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      this.silentSince = 0;
    } catch {
      await new Promise((r) => setTimeout(r, 1000)); // stays 'mic-lost'; retry shortly
    } finally {
      this.restarting = false;
    }
  }

  private tick() {
    const wall = performance.now();
    const gap = wall - this.lastTick;
    this.lastTick = wall;

    if (document.hidden) {
      this.status = 'hidden';
      return;
    }
    if (this.ctx.state !== 'running') {
      this.status = 'suspended';
      this.resume();
      return;
    }
    const track = this.stream.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') {
      this.status = 'mic-lost';
      void this.restartMic();
      return;
    }
    // After a stall (throttled timers, a frozen tab) the detector's view of "just now"
    // is stale; start it fresh rather than analyze a jumbled window.
    if (gap > 150) this.core = new ListenerCore(this.ctx.sampleRate, { sensitivity: this.sensitivityValue });

    this.analyser.getFloatTimeDomainData(this.buf);
    const ev = this.core.feed(this.buf, this.ctx.currentTime);
    const rms = this.core.onsets.lastBandRms;
    this.level = this.level * 0.8 + 0.2 * rms;

    // A live mic is never exactly silent; all zeros for 2 s means no audio is arriving.
    if (rms === 0) this.silentSince ||= wall;
    else this.silentSince = 0;
    this.status = this.silentSince && wall - this.silentSince > 2000 ? 'no-signal' : 'listening';

    if (ev) this.handlers.forEach((h) => h(ev));
  }

  /** Release the mic for good (leaving a listening screen, or the page closing). */
  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    window.removeEventListener('pointerdown', this.resume);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    this.source.disconnect();
    this.stream.getTracks().forEach((t) => t.stop());
    this.handlers.clear();
  }
}
