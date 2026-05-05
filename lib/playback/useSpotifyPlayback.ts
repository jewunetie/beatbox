"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
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
};

export function useSpotifyPlayback(
  controller: SpotifyController | null
): Playback {
  const anchorRef = useRef<PlaybackAnchor>(makeInitialAnchor());
  const seekListenersRef = useRef<Set<SeekListener>>(new Set());

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
      const seekDetected =
        prev.epoch > 0 && prev.isPlaying && drift > SEEK_DRIFT_THRESHOLD_MS;
      const nextEpoch = seekDetected || prev.epoch === 0 ? prev.epoch + 1 : prev.epoch;
      anchorRef.current = {
        positionMs: position,
        wallClockMs,
        isPlaying: !isPaused && !isBuffering,
        durationMs: duration,
        epoch: nextEpoch,
      };
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

  return { anchorRef, getCurrentMs, getEpoch, onSeek };
}

export function useFrameValue<T>(read: () => T, fps = 60): T {
  const subscribe = useCallback(
    (cb: () => void) => {
      let raf = 0;
      const interval = 1000 / fps;
      let last = 0;
      const tick = (t: number) => {
        if (t - last >= interval) {
          last = t;
          cb();
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    },
    [fps]
  );
  return useSyncExternalStore(subscribe, read, read);
}
