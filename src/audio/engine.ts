// Browser side: mic → AnalyserNode, polled every 10 ms into ListenerCore.
// One shared AudioContext (created on a tap, as iOS requires) also drives the metronome.

import { ListenerCore, StrumEvent } from './listener';

export type StrumHandler = (ev: StrumEvent) => void;

let ctx: AudioContext | null = null;

export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export class AudioEngine {
  private core: ListenerCore;
  private buf: Float32Array;
  private timer = 0;
  private handlers = new Set<StrumHandler>();
  /** In-band input level, for a meter. */
  level = 0;

  private constructor(
    readonly ctx: AudioContext,
    private stream: MediaStream,
    private analyser: AnalyserNode,
    sensitivity: number,
  ) {
    this.core = new ListenerCore(ctx.sampleRate, { sensitivity });
    this.buf = new Float32Array(analyser.fftSize);
    this.timer = window.setInterval(() => this.tick(), 10);
  }

  static async start(sensitivity: number): Promise<AudioEngine> {
    const ctx = audioContext();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 16384;
    analyser.smoothingTimeConstant = 0;
    src.connect(analyser);
    return new AudioEngine(ctx, stream, analyser, sensitivity);
  }

  set sensitivity(s: number) {
    this.core.onsets.opts.sensitivity = s;
  }

  onStrum(h: StrumHandler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  private tick() {
    this.analyser.getFloatTimeDomainData(this.buf);
    const ev = this.core.feed(this.buf, this.ctx.currentTime);
    this.level = this.level * 0.8 + 0.2 * this.core.onsets.lastBandRms;
    if (ev) this.handlers.forEach((h) => h(ev));
  }

  stop() {
    clearInterval(this.timer);
    this.stream.getTracks().forEach((t) => t.stop());
    this.handlers.clear();
  }
}
