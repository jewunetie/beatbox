export type CalibrationResult = {
  offsetMs: number;
  sd: number;
  samples: number;
  recordedAt: number;
};

export type CalibrationStats = {
  offsetMs: number;
  sd: number;
  samples: number;
  rawOffsets: number[];
};

export type RunOptions = {
  beats: number;
  bpm: number;
  leadSec?: number;
  gain?: number;
  onTickPerf?: (beatIndex: number, perfMs: number) => void;
};

export type RunResult = {
  clickTimesPerfMs: number[];
  tapTimesPerfMs: number[];
};

export async function runMetronome(
  audioCtx: AudioContext,
  options: RunOptions,
  signal?: AbortSignal
): Promise<RunResult> {
  const { beats, bpm, leadSec = 0.2, gain = 0.4, onTickPerf } = options;
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  const beatPeriodSec = 60 / bpm;

  // Anchor to align audioCtx.currentTime with performance.now()
  const epochPerfMs = performance.now();
  const epochAudio = audioCtx.currentTime;
  const toPerfMs = (audioTime: number) =>
    epochPerfMs + (audioTime - epochAudio) * 1000;

  const startAudio = audioCtx.currentTime + leadSec;
  const clickTimesPerfMs: number[] = [];

  for (let i = 0; i < beats; i++) {
    const tAudio = startAudio + i * beatPeriodSec;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.frequency.value = 1000;
    osc.type = "sine";
    env.gain.setValueAtTime(0, tAudio);
    env.gain.linearRampToValueAtTime(gain, tAudio + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, tAudio + 0.04);
    osc.connect(env);
    env.connect(audioCtx.destination);
    osc.start(tAudio);
    osc.stop(tAudio + 0.05);

    const tPerf = toPerfMs(tAudio);
    clickTimesPerfMs.push(tPerf);
    if (onTickPerf) {
      const delayMs = Math.max(0, tPerf - performance.now());
      setTimeout(() => onTickPerf(i, tPerf), delayMs);
    }
  }

  const tapTimesPerfMs: number[] = [];
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== "Space") return;
    if (e.repeat) return;
    e.preventDefault();
    tapTimesPerfMs.push(performance.now());
  };
  document.addEventListener("keydown", onKey, { capture: true });

  const tailSec = 0.4;
  const endPerfMs = toPerfMs(startAudio + beats * beatPeriodSec) + tailSec * 1000;

  await waitUntil(endPerfMs - performance.now(), signal);
  document.removeEventListener("keydown", onKey, { capture: true });

  return { clickTimesPerfMs, tapTimesPerfMs };
}

function waitUntil(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms <= 0) return resolve();
    const id = setTimeout(() => resolve(), ms);
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(id);
        reject(new DOMException("aborted", "AbortError"));
      });
    }
  });
}

export function computeStats(
  clickTimes: number[],
  tapTimes: number[],
  warmupTaps = 2
): CalibrationStats | null {
  const taps = tapTimes.slice(warmupTaps);
  if (taps.length < 6) return null;
  const offsets = taps.map((tap) => nearestOffset(tap, clickTimes));
  const offsetMs = median(offsets);
  const sd = stdDev(offsets);
  return { offsetMs, sd, samples: offsets.length, rawOffsets: offsets };
}

function nearestOffset(tap: number, clicks: number[]): number {
  let best = clicks[0] !== undefined ? tap - clicks[0] : 0;
  for (let i = 1; i < clicks.length; i++) {
    const diff = tap - clicks[i];
    if (Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
