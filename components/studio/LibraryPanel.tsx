"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatMs } from "@/lib/utils/formatTime";
import type { LibraryEntry } from "@/app/api/library/route";

type Props = {
  refreshKey: number;
  activeTrackId: string | null;
  onLoadTrack: (entry: LibraryEntry) => void;
  onDeleteTrack: (trackId: string) => void;
};

export function LibraryPanel({ refreshKey, activeTrackId, onLoadTrack, onDeleteTrack }: Props) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/library")
      .then((r) => r.json())
      .then((data: { tracks: LibraryEntry[] }) => {
        if (!cancelled) {
          setEntries(data.tracks);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--studio-panel)" }}>
      {/* Header */}
      <div
        className="px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--studio-border)" }}
      >
        <div
          className="text-[10px] tracking-[0.2em] uppercase font-mono"
          style={{ color: "var(--studio-amber)" }}
        >
          Collection
        </div>
        <div
          className="text-xs mt-0.5"
          style={{ color: "var(--studio-dim-text)", fontFamily: "var(--font-mono)" }}
        >
          {loading ? "…" : `${entries.length} track${entries.length === 1 ? "" : "s"} labeled`}
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading && <LoadingSkeleton />}

        {!loading && entries.length === 0 && <EmptyState />}

        {!loading && entries.map((entry) => (
          <LibraryCard
            key={entry.spotifyId}
            entry={entry}
            isActive={entry.spotifyId === activeTrackId}
            onLoad={() => onLoadTrack(entry)}
            onDelete={() => onDeleteTrack(entry.spotifyId)}
          />
        ))}
      </div>
    </div>
  );
}

function LibraryCard({
  entry,
  isActive,
  onLoad,
  onDelete,
}: {
  entry: LibraryEntry;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer group transition-all"
      style={{
        background: isActive ? "var(--studio-amber-glow)" : "var(--studio-surface)",
        border: `1px solid ${isActive ? "var(--studio-amber)" : "var(--studio-border-subtle)"}`,
      }}
      role="button"
      tabIndex={0}
      onClick={onLoad}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onLoad(); }
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--studio-border)";
          (e.currentTarget as HTMLElement).style.background = "var(--studio-surface-raised)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--studio-border-subtle)";
          (e.currentTarget as HTMLElement).style.background = "var(--studio-surface)";
        }
      }}
    >
      {/* Cover art */}
      {entry.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.coverUrl}
          alt=""
          className="w-11 h-11 rounded object-cover shrink-0"
          style={{ border: "1px solid var(--studio-border-subtle)" }}
        />
      ) : (
        <div
          className="w-11 h-11 rounded shrink-0 flex items-center justify-center"
          style={{ background: "var(--studio-surface-raised)", color: "var(--studio-dim-text)", fontSize: 16 }}
          aria-hidden
        >
          ♩
        </div>
      )}

      {/* Metadata */}
      <div className="flex-1 min-w-0">
        <div
          className="text-sm truncate font-medium leading-tight"
          style={{ color: "var(--studio-warm-text)" }}
        >
          {entry.name}
        </div>
        <div
          className="text-xs truncate mt-0.5"
          style={{ color: "var(--studio-muted-text)" }}
        >
          {entry.artist}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {entry.estimatedBpm !== null && (
            <span
              className="text-[10px] tabular-nums px-1.5 py-0.5 rounded"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--studio-amber)",
                border: "1px solid var(--studio-border)",
                background: "var(--studio-amber-glow)",
              }}
            >
              {entry.estimatedBpm} BPM
            </span>
          )}
          <span
            className="text-[10px] tabular-nums"
            style={{ fontFamily: "var(--font-mono)", color: "var(--studio-dim-text)" }}
          >
            {entry.markerCount} beats · {formatMs(entry.durationMs)}
          </span>
        </div>
      </div>

      {/* Delete button */}
      <button
        className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--studio-dim-text)" }}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Remove from collection"
        aria-label="Remove from collection"
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--studio-dim-text)"; }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2.5 rounded animate-pulse"
          style={{ background: "var(--studio-surface)", border: "1px solid var(--studio-border-subtle)" }}
        >
          <div className="w-11 h-11 rounded shrink-0" style={{ background: "var(--studio-surface-raised)" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded" style={{ background: "var(--studio-surface-raised)", width: "70%" }} />
            <div className="h-2.5 rounded" style={{ background: "var(--studio-surface-raised)", width: "45%" }} />
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3 select-none">
      <div className="text-5xl" style={{ color: "var(--studio-border)", lineHeight: 1 }} aria-hidden>♩</div>
      <div
        className="text-[10px] tracking-[0.2em] uppercase font-mono mt-2"
        style={{ color: "var(--studio-amber)" }}
      >
        No labeled tracks yet
      </div>
      <div className="text-xs max-w-[180px]" style={{ color: "var(--studio-dim-text)" }}>
        Search for a track, tap beats, and save to build your collection.
      </div>
    </div>
  );
}
