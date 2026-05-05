"use client";

import { formatMs } from "@/lib/utils/formatTime";
import { useFrameTicks, type Playback } from "@/lib/playback/useSpotifyPlayback";

type Props = {
  playback: Playback;
};

export function PlaybackCounter({ playback }: Props) {
  useFrameTicks(30);
  const ms = playback.getCurrentMs();
  const { isPlaying, durationMs, epoch } = playback.anchorRef.current;
  return (
    <div className="flex items-center gap-3 font-mono text-sm">
      <span className="tabular-nums">
        {formatMs(ms)}
        {durationMs > 0 ? ` / ${formatMs(durationMs)}` : ""}
      </span>
      <span
        className={`rounded px-2 py-0.5 text-xs ${
          isPlaying ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
        }`}
      >
        {isPlaying ? "playing" : "paused"}
      </span>
      <span className="text-xs text-muted-foreground">epoch {epoch}</span>
    </div>
  );
}
