"use client";

import { formatMs } from "@/lib/utils/formatTime";
import type { NormalizedTrack } from "@/types/domain";

type Props = {
  track: NormalizedTrack;
};

export function TrackHero({ track }: Props) {
  return (
    <div className="flex items-center gap-4">
      {track.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.coverUrl}
          alt=""
          className="w-16 h-16 rounded object-cover shrink-0"
          style={{
            border: "1px solid var(--studio-border)",
            boxShadow: "0 0 24px var(--studio-amber-glow)",
          }}
        />
      ) : (
        <div
          className="w-16 h-16 rounded shrink-0 flex items-center justify-center text-lg"
          style={{
            background: "var(--studio-surface)",
            border: "1px solid var(--studio-border)",
            color: "var(--studio-dim-text)",
          }}
          aria-hidden
        >
          ♪
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div
          className="text-lg leading-tight truncate font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--studio-warm-text)" }}
        >
          {track.name}
        </div>
        <div className="text-sm truncate mt-0.5" style={{ color: "var(--studio-muted-text)" }}>
          {track.artist}
        </div>
        {track.album && (
          <div className="text-xs truncate" style={{ color: "var(--studio-dim-text)" }}>
            {track.album}
          </div>
        )}
      </div>
      <div
        className="shrink-0 text-xs tabular-nums"
        style={{ fontFamily: "var(--font-mono)", color: "var(--studio-amber)" }}
      >
        {formatMs(track.durationMs)}
      </div>
    </div>
  );
}
