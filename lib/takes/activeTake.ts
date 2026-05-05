"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MarkerKind = "tap" | "snapped" | "manual_edit";
export type Granularity = "all_beats" | "downbeats" | "onsets";

export type Marker = {
  id: string;
  timeMs: number;
  epoch: number;
  kind: MarkerKind;
  saved: boolean;
  dirty: boolean;
  serverId: number | null;
};

export type ActiveTake = {
  trackId: string | null;
  granularity: Granularity;
  markers: Marker[];
  calibrationOffsetMs: number;
  serverTakeId: number | null;
};

const initialTake: ActiveTake = {
  trackId: null,
  granularity: "all_beats",
  markers: [],
  calibrationOffsetMs: 0,
  serverTakeId: null,
};

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export type ActiveTakeApi = {
  take: ActiveTake;
  takeRef: React.RefObject<ActiveTake>;
  setTrack: (trackId: string | null) => void;
  setGranularity: (g: Granularity) => void;
  setCalibrationOffsetMs: (ms: number) => void;
  pushMarker: (input: { timeMs: number; epoch: number; kind?: MarkerKind }) => void;
  removeMarker: (id: string) => void;
  updateMarker: (id: string, deltaMs: number) => void;
  replaceMarkers: (markers: Marker[]) => void;
  clearMarkers: () => void;
  discardMarkersInEpoch: (epoch: number) => number;
};

export function useActiveTake(): ActiveTakeApi {
  const [take, setTake] = useState<ActiveTake>(initialTake);
  const takeRef = useRef<ActiveTake>(take);
  takeRef.current = take;
  const rafRef = useRef<number | null>(null);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setTake(takeRef.current);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const setTrack = useCallback(
    (trackId: string | null) => {
      takeRef.current = { ...initialTake, trackId };
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const setGranularity = useCallback(
    (granularity: Granularity) => {
      takeRef.current = { ...takeRef.current, granularity };
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const setCalibrationOffsetMs = useCallback(
    (calibrationOffsetMs: number) => {
      takeRef.current = { ...takeRef.current, calibrationOffsetMs };
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const pushMarker = useCallback(
    ({
      timeMs,
      epoch,
      kind = "tap",
    }: {
      timeMs: number;
      epoch: number;
      kind?: MarkerKind;
    }) => {
      const next: Marker = {
        id: makeId(),
        timeMs,
        epoch,
        kind,
        saved: false,
        dirty: false,
        serverId: null,
      };
      const t = takeRef.current;
      takeRef.current = { ...t, markers: [...t.markers, next] };
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const removeMarker = useCallback(
    (id: string) => {
      const t = takeRef.current;
      takeRef.current = {
        ...t,
        markers: t.markers.filter((m) => m.id !== id),
      };
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const updateMarker = useCallback(
    (id: string, deltaMs: number) => {
      const t = takeRef.current;
      takeRef.current = {
        ...t,
        markers: t.markers.map((m) =>
          m.id === id ? { ...m, timeMs: m.timeMs + deltaMs, dirty: true, kind: "manual_edit" } : m
        ),
      };
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const replaceMarkers = useCallback(
    (markers: Marker[]) => {
      takeRef.current = { ...takeRef.current, markers };
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const clearMarkers = useCallback(() => {
    takeRef.current = { ...takeRef.current, markers: [] };
    scheduleFlush();
  }, [scheduleFlush]);

  const discardMarkersInEpoch = useCallback(
    (epoch: number): number => {
      const t = takeRef.current;
      const before = t.markers.length;
      const next = t.markers.filter((m) => m.saved || m.epoch !== epoch);
      const dropped = before - next.length;
      if (dropped > 0) {
        takeRef.current = { ...t, markers: next };
        scheduleFlush();
      }
      return dropped;
    },
    [scheduleFlush]
  );

  return {
    take,
    takeRef,
    setTrack,
    setGranularity,
    setCalibrationOffsetMs,
    pushMarker,
    removeMarker,
    updateMarker,
    replaceMarkers,
    clearMarkers,
    discardMarkersInEpoch,
  };
}
