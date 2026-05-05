export type GridFit = {
  bpm: number;
  phaseMs: number;
  periodMs: number;
  /** snapped time per input (same order as input). */
  snappedMs: number[];
  /** original − snapped, in ms. */
  residualsMs: number[];
  rmsResidualMs: number;
  maxResidualMs: number;
};

/**
 * Fit a constant-tempo grid to markers via least squares.
 * Free parameters: phase (offset of beat 0) and period (= 60s / BPM).
 */
export function fitGrid(markerTimesMs: readonly number[]): GridFit | null {
  if (markerTimesMs.length < 4) return null;
  const sorted = [...markerTimesMs].sort((a, b) => a - b);
  const iois: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d > 0) iois.push(d);
  }
  if (iois.length === 0) return null;
  const ioiSorted = [...iois].sort((a, b) => a - b);
  const mid = Math.floor(ioiSorted.length / 2);
  const periodSeed =
    ioiSorted.length % 2 === 0
      ? (ioiSorted[mid - 1] + ioiSorted[mid]) / 2
      : ioiSorted[mid];
  const phaseSeed = sorted[0];
  const indices = sorted.map((t) => Math.round((t - phaseSeed) / periodSeed));

  // Solve [phase, period] from t_i = phase + period * n_i.
  const N = sorted.length;
  const sumT = sum(sorted);
  const sumN = sum(indices);
  const sumTN = sumProduct(sorted, indices);
  const sumNN = sumProduct(indices, indices);
  const det = N * sumNN - sumN * sumN;
  if (det === 0) return null;
  const phaseMs = (sumT * sumNN - sumN * sumTN) / det;
  const periodMs = (N * sumTN - sumN * sumT) / det;
  if (!Number.isFinite(phaseMs) || !Number.isFinite(periodMs) || periodMs <= 0) {
    return null;
  }

  // Map back to the *original* input order so the caller can correlate with
  // their marker IDs.
  const inputToSorted = new Map<number, number>();
  const sortedIdx = [...markerTimesMs.keys()].sort(
    (a, b) => markerTimesMs[a] - markerTimesMs[b]
  );
  sortedIdx.forEach((origIdx, i) => inputToSorted.set(origIdx, i));

  const snappedSorted = indices.map((n) => phaseMs + periodMs * n);
  const snappedMs = markerTimesMs.map((_, origIdx) => {
    const i = inputToSorted.get(origIdx)!;
    return snappedSorted[i];
  });
  const residualsMs = markerTimesMs.map((t, i) => t - snappedMs[i]);
  const rmsResidualMs = Math.sqrt(
    residualsMs.reduce((s, r) => s + r * r, 0) / residualsMs.length
  );
  const maxResidualMs = residualsMs.reduce(
    (m, r) => Math.max(m, Math.abs(r)),
    0
  );

  return {
    bpm: 60_000 / periodMs,
    phaseMs,
    periodMs,
    snappedMs,
    residualsMs,
    rmsResidualMs,
    maxResidualMs,
  };
}

function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

function sumProduct(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}
