"use client";

import { formatMs } from "@/lib/utils/formatTime";
import { useFrameTicks, type Playback } from "@/lib/playback/useSpotifyPlayback";

type Props = {
  playback: Playback;
};

export function PlaybackCounter({ playback }: Props) {
  useFrameTicks(30);
  const ms = playback.getCurrentMs();
  const { isPlaying, durationMs } = playback.anchorRef.current;
  return (
    <div className="flex items-center gap-3">
      <span
        className="tabular-nums text-sm"
        style={{ fontFamily: "var(--font-mono)", color: "var(--studio-warm-text)" }}
      >
        {formatMs(ms)}
        {durationMs > 0 ? (
          <span style={{ color: "var(--studio-muted-text)" }}> / {formatMs(durationMs)}</span>
        ) : null}
      </span>
      <span
        className="rounded px-2 py-0.5 text-[10px] font-medium tracking-wide"
        style={
          isPlaying
            ? {
                fontFamily: "var(--font-mono)",
                background: "var(--studio-amber-glow)",
                color: "var(--studio-amber)",
                border: "1px solid var(--studio-border)",
              }
            : {
                fontFamily: "var(--font-mono)",
                background: "var(--studio-surface)",
                color: "var(--studio-muted-text)",
                border: "1px solid var(--studio-border-subtle)",
              }
        }
      >
        {isPlaying ? "● PLAYING" : "PAUSED"}
      </span>
    </div>
  );
}
