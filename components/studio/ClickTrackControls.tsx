"use client";

import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { createClickScheduler } from "@/lib/audio/clickScheduler";
import type { Playback } from "@/lib/playback/useSpotifyPlayback";
import type { ActiveTakeApi } from "@/lib/takes/activeTake";

type Props = {
  playback: Playback;
  activeTake: ActiveTakeApi;
};

export function ClickTrackControls({ playback, activeTake }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useSessionStorage<number>("beatbox.clickVolume", 0.4);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof createClickScheduler> | null>(null);

  // Refs for scheduler getters — they read live state on each tick.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  // Initialize scheduler on first enable.
  useEffect(() => {
    if (!enabled) {
      schedulerRef.current?.stop();
      return;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = audioCtxRef.current ?? new Ctx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const scheduler = createClickScheduler({
      audioCtx: ctx,
      getCurrentMs: playback.getCurrentMs,
      getMarkers: () => activeTake.takeRef.current.markers,
      getVolume: () => volumeRef.current,
      getEnabled: () => enabledRef.current,
    });
    schedulerRef.current = scheduler;
    scheduler.start();
    return () => {
      scheduler.stop();
      schedulerRef.current = null;
    };
  }, [enabled, playback.getCurrentMs, activeTake.takeRef]);

  // Reset on seek
  useEffect(() => {
    return playback.onSeek(() => {
      schedulerRef.current?.reset();
    });
  }, [playback]);

  // Reset on pause→play transitions and on visibility return.
  useEffect(() => {
    let lastIsPlaying = false;
    const id = setInterval(() => {
      const nowPlaying = playback.anchorRef.current.isPlaying;
      if (nowPlaying && !lastIsPlaying) schedulerRef.current?.reset();
      lastIsPlaying = nowPlaying;
    }, 100);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        schedulerRef.current?.reset();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [playback]);

  // Close audio context on unmount.
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Switch
          id="click-track"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor="click-track" className="text-sm">
          Click track
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="click-volume" className="text-xs text-muted-foreground">
          Volume
        </Label>
        <Slider
          id="click-volume"
          className="w-32"
          min={0}
          max={1}
          step={0.05}
          value={[volume]}
          onValueChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v;
            setVolume(next ?? 0.4);
          }}
          disabled={!enabled}
        />
        <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}
