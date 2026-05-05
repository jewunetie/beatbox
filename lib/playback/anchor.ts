export type PlaybackAnchor = {
  positionMs: number;
  wallClockMs: number;
  isPlaying: boolean;
  durationMs: number;
  epoch: number;
};

export const SEEK_DRIFT_THRESHOLD_MS = 200;

export function interpolate(anchor: PlaybackAnchor, nowMs: number): number {
  if (!anchor.isPlaying) return anchor.positionMs;
  const elapsed = nowMs - anchor.wallClockMs;
  const projected = anchor.positionMs + Math.max(0, elapsed);
  if (anchor.durationMs > 0) {
    return Math.min(projected, anchor.durationMs);
  }
  return projected;
}

export function makeInitialAnchor(): PlaybackAnchor {
  return {
    positionMs: 0,
    wallClockMs: typeof performance !== "undefined" ? performance.now() : 0,
    isPlaying: false,
    durationMs: 0,
    epoch: 0,
  };
}
