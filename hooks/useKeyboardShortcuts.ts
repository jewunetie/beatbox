"use client";

import { useEffect } from "react";
import type { Playback } from "@/lib/playback/useSpotifyPlayback";
import type { ActiveTakeApi } from "@/lib/takes/activeTake";
import { isEditableElement } from "@/lib/utils/keyboard";

type Args = {
  playback: Playback;
  activeTake: ActiveTakeApi;
  calibrationOffsetMsRef: React.RefObject<number>;
  selectedMarkerIdRef: React.RefObject<string | null>;
  setSelectedMarkerId: (id: string | null) => void;
};

export function useKeyboardShortcuts({
  playback,
  activeTake,
  calibrationOffsetMsRef,
  selectedMarkerIdRef,
  setSelectedMarkerId,
}: Args) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tWall = performance.now();

      if (e.code === "Space") {
        if (e.repeat) return;
        if (isEditableElement(document.activeElement)) return;
        const anchor = playback.anchorRef.current;
        if (!anchor.isPlaying) return;
        e.preventDefault();
        const interpolated = anchor.positionMs + (tWall - anchor.wallClockMs);
        const corrected = interpolated - (calibrationOffsetMsRef.current ?? 0);
        activeTake.pushMarker({
          timeMs: Math.max(0, corrected),
          epoch: anchor.epoch,
          kind: "tap",
        });
        return;
      }

      const selectedId = selectedMarkerIdRef.current;
      if (!selectedId) return;
      if (isEditableElement(document.activeElement)) return;

      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        const sign = e.code === "ArrowLeft" ? -1 : 1;
        const step = e.shiftKey ? 1 : 10;
        e.preventDefault();
        activeTake.updateMarker(selectedId, sign * step);
        return;
      }
      if (e.code === "Delete" || e.code === "Backspace") {
        e.preventDefault();
        activeTake.removeMarker(selectedId);
        setSelectedMarkerId(null);
        return;
      }
      if (e.code === "Escape") {
        setSelectedMarkerId(null);
        return;
      }
    };

    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, [playback, activeTake, calibrationOffsetMsRef, selectedMarkerIdRef, setSelectedMarkerId]);
}
