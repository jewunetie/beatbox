"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatMs } from "@/lib/utils/formatTime";
import type { NormalizedTrack } from "@/types/domain";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  selectedTrack: NormalizedTrack | null;
  onPick: (track: NormalizedTrack) => void;
  onChangeTrack: () => void;
};

type Status = "idle" | "loading" | "ready" | "error";

export function SearchPanel({ query, onQueryChange, selectedTrack, onPick, onChangeTrack }: Props) {
  const debounced = useDebouncedValue(query, 300);
  const [tracks, setTracks] = useState<NormalizedTrack[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = debounced.trim();
    abortRef.current?.abort();

    if (q.length < 2) {
      setTracks([]);
      setStatus("idle");
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");

    fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=10`, { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 429) {
          const data = (await res.json().catch(() => ({}))) as { retryAfterMs?: number };
          const wait = Math.ceil((data.retryAfterMs ?? 1000) / 1000);
          toast.warning(`Spotify rate limited — try again in ${wait}s`);
          throw new Error("rate_limited");
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        return (await res.json()) as { tracks: NormalizedTrack[] };
      })
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setTracks(data.tracks);
        setStatus("ready");
      })
      .catch((err) => {
        if (ctrl.signal.aborted || err.name === "AbortError") return;
        setStatus("error");
        if (err.message !== "rate_limited") toast.error(`Search failed: ${err.message}`);
      });

    return () => ctrl.abort();
  }, [debounced]);

  if (selectedTrack) {
    return (
      <div className="flex items-center justify-between py-1">
        <span
          className="text-[10px] tracking-[0.15em] uppercase font-mono"
          style={{ color: "var(--studio-amber)" }}
        >
          Now labeling
        </span>
        <button
          onClick={onChangeTrack}
          className="text-xs transition-colors"
          style={{ color: "var(--studio-muted-text)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--studio-amber)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--studio-muted-text)")}
        >
          ← change track
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="search"
        placeholder="Search Spotify…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        autoComplete="off"
        autoFocus
        className="w-full rounded px-3 py-2.5 text-sm outline-none transition-all"
        style={{
          background: "var(--studio-surface)",
          border: "1px solid var(--studio-border)",
          color: "var(--studio-warm-text)",
          fontFamily: "var(--font-sans)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--studio-amber)";
          e.currentTarget.style.boxShadow = "0 0 0 2px var(--studio-amber-glow)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--studio-border)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      {status === "idle" && tracks.length === 0 && (
        <p className="text-xs px-1" style={{ color: "var(--studio-dim-text)" }}>
          Type at least two characters to search.
        </p>
      )}

      {status === "loading" && tracks.length === 0 && (
        <p className="text-xs px-1" style={{ color: "var(--studio-muted-text)" }}>
          Searching…
        </p>
      )}

      {status === "ready" && tracks.length === 0 && (
        <p className="text-xs px-1" style={{ color: "var(--studio-muted-text)" }}>
          No matches found.
        </p>
      )}

      {tracks.length > 0 && (
        <ul className="space-y-1.5">
          {tracks.map((track) => (
            <li key={track.spotifyId}>
              <button
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded transition-all group"
                style={{
                  background: "var(--studio-surface)",
                  border: "1px solid var(--studio-border-subtle)",
                }}
                onClick={() => onPick(track)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--studio-border)";
                  (e.currentTarget as HTMLElement).style.background = "var(--studio-surface-raised)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--studio-border-subtle)";
                  (e.currentTarget as HTMLElement).style.background = "var(--studio-surface)";
                }}
              >
                {track.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.coverUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                ) : (
                  <div
                    className="h-10 w-10 rounded shrink-0 flex items-center justify-center text-xs"
                    style={{ background: "var(--studio-surface-raised)", color: "var(--studio-dim-text)" }}
                  >
                    ♪
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium leading-tight" style={{ color: "var(--studio-warm-text)" }}>
                    {track.name}
                  </div>
                  <div className="truncate text-xs mt-0.5" style={{ color: "var(--studio-muted-text)" }}>
                    {track.artist}
                    {track.album ? ` — ${track.album}` : ""}
                  </div>
                </div>
                <span
                  className="shrink-0 text-[10px] tabular-nums"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--studio-amber)" }}
                >
                  {formatMs(track.durationMs)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
