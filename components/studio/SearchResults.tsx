"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatMs } from "@/lib/utils/formatTime";
import type { NormalizedTrack } from "@/types/domain";

type Props = {
  query: string;
  onPick: (track: NormalizedTrack) => void;
  selectedId: string | null;
};

type Status = "idle" | "loading" | "ready" | "error";

export function SearchResults({ query, onPick, selectedId }: Props) {
  const debounced = useDebouncedValue(query, 300);
  const [tracks, setTracks] = useState<NormalizedTrack[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);

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

    fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=10`, {
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (res.status === 429) {
          const data = (await res.json().catch(() => ({}))) as {
            retryAfterMs?: number;
          };
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
        if (ctrl.signal.aborted) return;
        if (err.name === "AbortError") return;
        setStatus("error");
        if (err.message !== "rate_limited") {
          toast.error(`Search failed: ${err.message}`);
        }
      });

    return () => ctrl.abort();
  }, [debounced]);

  if (status === "idle" && tracks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Type at least two characters to search.
      </p>
    );
  }

  if (status === "loading" && tracks.length === 0) {
    return <p className="text-sm text-muted-foreground">Searching…</p>;
  }

  if (status === "ready" && tracks.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches.</p>;
  }

  return (
    <ul className="space-y-2">
      {tracks.map((track) => {
        const isSelected = track.spotifyId === selectedId;
        return (
          <li key={track.spotifyId}>
            <Card
              role="button"
              tabIndex={0}
              onClick={() => onPick(track)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(track);
                }
              }}
              className={`flex items-center gap-3 p-3 transition cursor-pointer hover:bg-accent/50 ${
                isSelected ? "ring-2 ring-primary" : ""
              }`}
            >
              {track.coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={track.coverUrl}
                  alt=""
                  className="h-12 w-12 rounded object-cover shrink-0"
                />
              ) : (
                <div className="h-12 w-12 rounded bg-muted shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium leading-tight">
                  {track.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {track.artist} — {track.album}
                </div>
              </div>
              <Badge variant="secondary">{formatMs(track.durationMs)}</Badge>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
