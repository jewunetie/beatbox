type Marker = { id: string; timeMs: number };

export type ClickSchedulerOptions = {
  audioCtx: AudioContext;
  getCurrentMs: () => number;
  getMarkers: () => readonly Marker[];
  getVolume: () => number;
  getEnabled: () => boolean;
  intervalMs?: number;
  horizonMs?: number;
  toleranceMs?: number;
  frequencyHz?: number;
};

export type ClickScheduler = {
  start: () => void;
  stop: () => void;
  reset: () => void;
  isRunning: () => boolean;
};

export function createClickScheduler(opts: ClickSchedulerOptions): ClickScheduler {
  const {
    audioCtx,
    getCurrentMs,
    getMarkers,
    getVolume,
    getEnabled,
    intervalMs = 25,
    horizonMs = 100,
    toleranceMs = 30,
    frequencyHz = 1000,
  } = opts;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  const scheduled = new Set<string>();

  const tick = () => {
    if (!getEnabled()) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    const nowMs = getCurrentMs();
    const horizon = nowMs + horizonMs;
    const audioNow = audioCtx.currentTime;
    for (const m of getMarkers()) {
      if (scheduled.has(m.id)) continue;
      if (m.timeMs > horizon) continue;
      if (m.timeMs < nowMs - toleranceMs) {
        scheduled.add(m.id);
        continue;
      }
      const leadSec = Math.max(0, (m.timeMs - nowMs) / 1000);
      const tStart = audioNow + leadSec;
      const osc = audioCtx.createOscillator();
      const env = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequencyHz;
      const gain = Math.max(0, Math.min(1, getVolume()));
      env.gain.setValueAtTime(0, tStart);
      env.gain.linearRampToValueAtTime(gain, tStart + 0.003);
      env.gain.exponentialRampToValueAtTime(0.001, tStart + 0.04);
      osc.connect(env);
      env.connect(audioCtx.destination);
      osc.start(tStart);
      osc.stop(tStart + 0.05);
      scheduled.add(m.id);
    }
  };

  const reset = () => {
    scheduled.clear();
    const nowMs = getCurrentMs();
    for (const m of getMarkers()) {
      if (m.timeMs < nowMs) scheduled.add(m.id);
    }
  };

  const start = () => {
    if (intervalId != null) return;
    reset();
    intervalId = setInterval(tick, intervalMs);
  };

  const stop = () => {
    if (intervalId == null) return;
    clearInterval(intervalId);
    intervalId = null;
  };

  return {
    start,
    stop,
    reset,
    isRunning: () => intervalId != null,
  };
}
