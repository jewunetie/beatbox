"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { SearchBar } from "@/components/studio/SearchBar";
import { SearchResults } from "@/components/studio/SearchResults";
import { SpotifyPlayer } from "@/components/studio/SpotifyPlayer";
import { PlaybackCounter } from "@/components/studio/PlaybackCounter";
import { Timeline } from "@/components/studio/Timeline";
import { CalibrationDialog } from "@/components/studio/CalibrationDialog";
import { ClickTrackControls } from "@/components/studio/ClickTrackControls";
import { SnapToGridDialog } from "@/components/studio/SnapToGridDialog";
import { TakeTabs } from "@/components/studio/TakeTabs";
import { estimateTempo } from "@/lib/tempo/estimate";
import { useSpotifyPlayback } from "@/lib/playback/useSpotifyPlayback";
import { useActiveTake } from "@/lib/takes/activeTake";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import type { SpotifyController } from "@/types/spotify-iframe-api";
import type { NormalizedTrack } from "@/types/domain";
import type { CalibrationResult } from "@/lib/audio/metronome";
import type { WireTake } from "@/lib/takes/serialize";

export function StudioShell() {
  const [query, setQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<NormalizedTrack | null>(null);
  const [controller, setController] = useState<SpotifyController | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [calibration, setCalibration] = useSessionStorage<CalibrationResult | null>(
    "beatbox.calibration",
    null
  );
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);
  const [snapDialogOpen, setSnapDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState(false);
  const [loadedTakes, setLoadedTakes] = useState<WireTake[]>([]);
  const [activeTakeServerId, setActiveTakeServerId] = useState<number | null>(null);
  const playback = useSpotifyPlayback(controller);
  const activeTake = useActiveTake();

  const calibrationOffsetMsRef = useRef<number>(calibration?.offsetMs ?? 0);
  calibrationOffsetMsRef.current = calibration?.offsetMs ?? 0;
  const selectedMarkerIdRef = useRef<string | null>(null);
  selectedMarkerIdRef.current = selectedMarkerId;

  const needsCalibration = calibration == null;
  const calibrationOpen = needsCalibration || calibrationDialogOpen;

  useKeyboardShortcuts({
    playback,
    activeTake,
    calibrationOffsetMsRef,
    selectedMarkerIdRef,
    setSelectedMarkerId,
  });

  // Reset markers + selection when the selected track changes, then load any
  // existing labels for it from the server.
  useEffect(() => {
    const trackId = selectedTrack?.spotifyId ?? null;
    activeTake.setTrack(trackId);
    setSelectedMarkerId(null);
    setLoadedTakes([]);
    setActiveTakeServerId(null);
    if (!trackId) return;
    let cancelled = false;
    fetch(`/api/labels/${trackId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { takes: WireTake[] };
      })
      .then((data) => {
        if (cancelled) return;
        setLoadedTakes(data.takes);
        if (data.takes.length === 0) return;
        const latest = data.takes[data.takes.length - 1];
        activeTake.loadServerTake({
          id: latest.id,
          trackId: latest.trackId,
          granularity: latest.granularity,
          markers: latest.markers.map((m) => ({
            id: m.id,
            timeMs: m.timeMs,
            kind: m.kind,
          })),
        });
        setActiveTakeServerId(latest.id);
        toast.success(`Loaded ${latest.markers.length} markers from take #${latest.id}`);
      })
      .catch((err) => {
        if (!cancelled) toast.error(`Load failed: ${err.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTrack?.spotifyId, activeTake.setTrack, activeTake.loadServerTake]);

  // Discard taps captured against the pre-seek epoch.
  useEffect(() => {
    return playback.onSeek((discardedEpoch) => {
      const dropped = activeTake.discardMarkersInEpoch(discardedEpoch);
      if (dropped > 0) {
        toast.warning(`Discarded ${dropped} tap${dropped === 1 ? "" : "s"} near seek`);
      }
    });
  }, [playback, activeTake.discardMarkersInEpoch]);

  const durationMs = playback.anchorRef.current.durationMs || selectedTrack?.durationMs || 0;
  const markerCount = activeTake.take.markers.length;
  const dirtyCount = activeTake.take.markers.filter((m) => !m.saved || m.dirty).length;
  const tempo = estimateTempo(activeTake.take.markers.map((m) => m.timeMs));

  const refreshTakes = async (trackId: string): Promise<WireTake[]> => {
    const r = await fetch(`/api/labels/${trackId}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = (await r.json()) as { takes: WireTake[] };
    setLoadedTakes(data.takes);
    return data.takes;
  };

  const save = async () => {
    if (!selectedTrack) return;
    const take = activeTake.takeRef.current;
    if (take.markers.length === 0) {
      toast.warning("No markers to save");
      return;
    }
    setSaving(true);
    try {
      const resp = await fetch(`/api/labels/${selectedTrack.spotifyId}/takes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          granularity: take.granularity,
          source: "tap",
          calibrationOffsetMs: calibration?.offsetMs ?? null,
          markers: take.markers.map((m) => ({
            timeMs: m.timeMs,
            kind: m.kind === "manual_edit" ? "manual_edit" : m.kind,
            confidence: null,
          })),
          track: {
            name: selectedTrack.name,
            artist: selectedTrack.artist,
            album: selectedTrack.album,
            durationMs: selectedTrack.durationMs,
          },
        }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as { take: WireTake };
      activeTake.markAllSaved({
        id: data.take.id,
        trackId: data.take.trackId,
        granularity: data.take.granularity,
        markers: data.take.markers.map((m) => ({
          id: m.id,
          timeMs: m.timeMs,
          kind: m.kind,
        })),
      });
      setActiveTakeServerId(data.take.id);
      await refreshTakes(selectedTrack.spotifyId);
      toast.success(`Saved take #${data.take.id} (${take.markers.length} marker${take.markers.length === 1 ? "" : "s"})`);
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const switchTake = (takeId: number | null) => {
    setSelectedMarkerId(null);
    if (takeId == null) {
      activeTake.clearMarkers();
      setActiveTakeServerId(null);
      return;
    }
    const target = loadedTakes.find((t) => t.id === takeId);
    if (!target) return;
    activeTake.loadServerTake({
      id: target.id,
      trackId: target.trackId,
      granularity: target.granularity,
      markers: target.markers.map((m) => ({
        id: m.id,
        timeMs: m.timeMs,
        kind: m.kind,
      })),
    });
    setActiveTakeServerId(target.id);
  };

  const deleteTake = async (takeId: number) => {
    if (!selectedTrack) return;
    try {
      const r = await fetch(`/api/labels/takes/${takeId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const remaining = await refreshTakes(selectedTrack.spotifyId);
      if (activeTakeServerId === takeId) {
        const fallback = remaining[remaining.length - 1];
        if (fallback) {
          switchTake(fallback.id);
        } else {
          switchTake(null);
        }
      }
      toast.success(`Deleted take #${takeId}`);
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const mergeTakes = async () => {
    if (!selectedTrack || loadedTakes.length < 2) return;
    setMerging(true);
    try {
      const r = await fetch(`/api/labels/${selectedTrack.spotifyId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          takeIds: loadedTakes.map((t) => t.id),
          granularity: "all_beats",
        }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { take: WireTake; bpm: number };
      const refreshed = await refreshTakes(selectedTrack.spotifyId);
      const created = refreshed.find((t) => t.id === data.take.id) ?? data.take;
      switchTake(created.id);
      toast.success(`Merged into take #${created.id} @ ${data.bpm.toFixed(1)} BPM`);
    } catch (err) {
      toast.error(`Merge failed: ${(err as Error).message}`);
    } finally {
      setMerging(false);
    }
  };

  return (
    <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Beat Labeling Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Tap along to a Spotify track and save the beat positions.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCalibrationDialogOpen(true)}
          >
            Calibrate
          </Button>
          {calibration && (
            <span className="text-xs text-muted-foreground tabular-nums">
              offset {calibration.offsetMs.toFixed(1)} ms · sd{" "}
              {calibration.sd.toFixed(1)} ms
            </span>
          )}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>Search Spotify for a track to label.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchBar value={query} onChange={setQuery} />
          <SearchResults
            query={query}
            onPick={setSelectedTrack}
            selectedId={selectedTrack?.spotifyId ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Player</CardTitle>
          <CardDescription>
            {selectedTrack
              ? `${selectedTrack.name} — ${selectedTrack.artist}`
              : "Pick a track from the search results."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedTrack ? (
            <>
              <SpotifyPlayer
                trackId={selectedTrack.spotifyId}
                onController={setController}
              />
              <PlaybackCounter playback={playback} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a track from the search results above.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                Press{" "}
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">
                  Space
                </kbd>{" "}
                to record a beat. Click a marker to select; arrows nudge ±10 ms (±1 ms with shift); delete removes.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {markerCount} marker{markerCount === 1 ? "" : "s"}
                {dirtyCount > 0 ? ` · ${dirtyCount} unsaved` : ""}
                {tempo
                  ? ` · ${tempo.bpm.toFixed(1)} BPM${
                      tempo.bpmSd != null ? ` ±${tempo.bpmSd.toFixed(1)}` : ""
                    }`
                  : ""}
              </span>
              {markerCount >= 4 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSnapDialogOpen(true)}
                >
                  Snap to grid
                </Button>
              ) : null}
              {markerCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    activeTake.clearMarkers();
                    setSelectedMarkerId(null);
                  }}
                >
                  Clear
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={saving || markerCount === 0 || !selectedTrack}
                onClick={save}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedTrack ? (
            <>
              <Timeline
                durationMs={durationMs}
                takeRef={activeTake.takeRef}
                playback={playback}
                selectedMarkerId={selectedMarkerId}
                onSelectMarker={setSelectedMarkerId}
              />
              <ClickTrackControls playback={playback} activeTake={activeTake} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Load a track to start labeling.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Takes</CardTitle>
          <CardDescription>
            One row per labeling pass. Switching loads a take's markers into
            the editor; saving always creates a new take.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedTrack ? (
            loadedTakes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved takes yet — tap some beats and Save.
                {merging ? " Merging…" : ""}
              </p>
            ) : (
              <TakeTabs
                takes={loadedTakes}
                activeServerId={activeTakeServerId}
                isNew={activeTakeServerId == null}
                onSelect={switchTake}
                onDelete={deleteTake}
                onMerge={mergeTakes}
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a track to see its takes.
            </p>
          )}
        </CardContent>
      </Card>

      <CalibrationDialog
        open={calibrationOpen}
        onSave={(result) => {
          setCalibration(result);
          setCalibrationDialogOpen(false);
        }}
        onCancel={
          calibration
            ? () => setCalibrationDialogOpen(false)
            : undefined
        }
      />

      <SnapToGridDialog
        open={snapDialogOpen}
        markers={activeTake.take.markers.map((m) => ({ id: m.id, timeMs: m.timeMs }))}
        onCancel={() => setSnapDialogOpen(false)}
        onApply={(snapped) => {
          activeTake.snapMarkers(snapped);
          setSnapDialogOpen(false);
        }}
      />
    </main>
  );
}
