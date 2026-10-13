// Keep the screen on during a session (best effort; not all browsers support it).
let lock: { release(): Promise<void> } | null = null;

export async function keepAwake(on: boolean) {
  try {
    if (on && !lock && 'wakeLock' in navigator) {
      lock = await (navigator as unknown as { wakeLock: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock.request('screen');
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}
