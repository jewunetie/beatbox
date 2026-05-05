"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  SpotifyController,
  SpotifyPlaybackUpdate,
} from "@/types/spotify-iframe-api";
import {
  interpolate,
  makeInitialAnchor,
  SEEK_DRIFT_THRESHOLD_MS,
  type PlaybackAnchor,
} from "./anchor";

type SeekListener = (discardedEpoch: number) => void;

export type Playback = {
  anchorRef: React.RefObject<PlaybackAnchor>;
  getCurrentMs: () => number;
  getEpoch: () => number;
  onSeek: (cb: SeekListener) => () => void;
  /**
   * Deliberate seek: skip the next playback_update's seek-detection so unsaved
   * taps captured against the current epoch survive (e.g. the Restart button).
   * Pair with controller.seek(positionMs).
   */
  expectSeek: () => void;
};

export function useSpotifyPlayback(
  controller: SpotifyController | null
): Playback {
  const anchorRef = useRef<PlaybackAnchor>(makeInitialAnchor());
  const seekListenersRef = useRef<Set<SeekListener>>(new Set());
  const expectedSeekRef = useRef<boolean>(false);

  useEffect(() => {
    if (!controller) {
      anchorRef.current = makeInitialAnchor();
      return;
    }
    const onUpdate = (e: SpotifyPlaybackUpdate) => {
      const { position, duration, isPaused, isBuffering } = e.data;
      const wallClockMs = performance.now();
      const prev = anchorRef.current;
      const interpolated = interpolate(prev, wallClockMs);
      const drift = Math.abs(position - interpolated);
      const expected = expectedSeekRef.current;
      const seekDetected =
        !expected &&
        prev.epoch > 0 &&
        prev.isPlaying &&
        drift > SEEK_DRIFT_THRESHOLD_MS;
      const epochBumps = seekDetected || prev.epoch === 0 || expected;
      const nextEpoch = epochBumps ? prev.epoch + 1 : prev.epoch;
      anchorRef.current = {
        positionMs: position,
        wallClockMs,
        isPlaying: !isPaused && !isBuffering,
        durationMs: duration,
        epoch: nextEpoch,
      };
      expectedSeekRef.current = false;
      if (seekDetected) {
        const discardedEpoch = prev.epoch;
        for (const cb of seekListenersRef.current) cb(discardedEpoch);
      }
    };
    controller.addListener("playback_update", onUpdate);
    return () => controller.removeListener("playback_update", onUpdate);
  }, [controller]);

  const getCurrentMs = useCallback(
    () => interpolate(anchorRef.current, performance.now()),
    []
  );
  const getEpoch = useCallback(() => anchorRef.current.epoch, []);
  const onSeek = useCallback((cb: SeekListener) => {
    seekListenersRef.current.add(cb);
    return () => seekListenersRef.current.delete(cb);
  }, []);
  const expectSeek = useCallback(() => {
    expectedSeekRef.current = true;
  }, []);

  return { anchorRef, getCurrentMs, getEpoch, onSeek, expectSeek };
}

/**
 * Forces a re-render on every animation frame (or fps-throttled).
 * Use when you want a component to read time-varying ref values fresh on each
 * frame without writing them through React state. The return value (a frame
 * counter) is intentionally unused — call playback.getCurrentMs() etc.
 * directly inside the render to get the freshest value.
 *
 * Note: do NOT use useSyncExternalStore for this — its snapshot must be stable
 * between subscribe events, and `() => performance.now()`-style reads aren't.
 */
export function useFrameTicks(fps = 30): number {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let raf = 0;
    const interval = 1000 / fps;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= interval) {
        last = t;
        bump();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return tick;
}
