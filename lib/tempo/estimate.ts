export type TempoEstimate = {
  bpm: number;
  bpmSd: number | null;
  ioiMedianMs: number;
  samples: number;
};

export function estimateTempo(markerTimesMs: readonly number[]): TempoEstimate | null {
  if (markerTimesMs.length < 8) return null;
  const sorted = [...markerTimesMs].sort((a, b) => a - b);
  const iois: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d > 0) iois.push(d);
  }
  if (iois.length === 0) return null;
  const med = median(iois);
  const bpm = 60_000 / med;
  let bpmSd: number | null = null;
  if (markerTimesMs.length >= 16) {
    const bpms = iois.map((ms) => 60_000 / ms);
    bpmSd = stdDev(bpms);
  }
  return { bpm, bpmSd, ioiMedianMs: med, samples: markerTimesMs.length };
}

function median(values: number[]): number {
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
