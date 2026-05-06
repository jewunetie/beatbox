"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Settings } from "lucide-react";
import { SearchPanel } from "@/components/studio/SearchPanel";
import { TrackHero } from "@/components/studio/TrackHero";
import { SpotifyPlayer } from "@/components/studio/SpotifyPlayer";
import { PlaybackCounter } from "@/components/studio/PlaybackCounter";
import { Timeline } from "@/components/studio/Timeline";
import { CalibrationDialog } from "@/components/studio/CalibrationDialog";
import { SnapToGridDialog } from "@/components/studio/SnapToGridDialog";
import { ControlsBar } from "@/components/studio/ControlsBar";
import { LibraryPanel } from "@/components/studio/LibraryPanel";
import { estimateTempo } from "@/lib/tempo/estimate";
import { useSpotifyPlayback } from "@/lib/playback/useSpotifyPlayback";
import { useActiveTake } from "@/lib/takes/activeTake";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import type { SpotifyController } from "@/types/spotify-iframe-api";
import type { NormalizedTrack } from "@/types/domain";
import type { CalibrationResult } from "@/lib/audio/metronome";
import type { WireTake } from "@/lib/takes/serialize";
import type { LibraryEntry } from "@/app/api/library/route";

export function StudioShell() {
  const [query, setQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<NormalizedTrack | null>(null);
  const [controller, setController] = useState<SpotifyController | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [calibration, setCalibration, , calibrationReady] = useSessionStorage<CalibrationResult | null>(
    "beatbox.calibration",
    null
  );
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);
  const [snapDialogOpen, setSnapDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  const playback = useSpotifyPlayback(controller);
  const activeTake = useActiveTake();

  const calibrationOffsetMsRef = useRef<number>(calibration?.offsetMs ?? 0);
  calibrationOffsetMsRef.current = calibration?.offsetMs ?? 0;
  const selectedMarkerIdRef = useRef<string | null>(null);
  selectedMarkerIdRef.current = selectedMarkerId;

  const needsCalibration = calibrationReady && calibration == null;
  const calibrationOpen = needsCalibration || calibrationDialogOpen;

  useKeyboardShortcuts({
    playback,
    activeTake,
    calibrationOffsetMsRef,
    selectedMarkerIdRef,
    setSelectedMarkerId,
  });

  // Reset markers + selection when track changes, load latest saved take.
  useEffect(() => {
    const trackId = selectedTrack?.spotifyId ?? null;
    activeTake.setTrack(trackId);
    setSelectedMarkerId(null);
    if (!trackId) return;
    let cancelled = false;
    fetch(`/api/labels/${trackId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { takes: WireTake[] };
      })
      .then((data) => {
        if (cancelled) return;
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
        toast.success(`Loaded ${latest.markers.length} markers`);
      })
      .catch((err) => {
        if (!cancelled) toast.error(`Load failed: ${err.message}`);
      });
    return () => { cancelled = true; };
  }, [selectedTrack?.spotifyId, activeTake.setTrack, activeTake.loadServerTake]);

  // Discard taps captured against pre-seek epoch.
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
            coverUrl: selectedTrack.coverUrl,
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
      setLibraryRefreshKey((k) => k + 1);
      toast.success(`Saved ${take.markers.length} marker${take.markers.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadLibraryTrack = (entry: LibraryEntry) => {
    setSelectedTrack({
      spotifyId: entry.spotifyId,
      name: entry.name,
      artist: entry.artist,
      album: entry.album ?? "",
      durationMs: entry.durationMs,
      coverUrl: entry.coverUrl,
    });
  };

  const handleDeleteLibraryTrack = async (trackId: string) => {
    try {
      const r = await fetch(`/api/library/${trackId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (selectedTrack?.spotifyId === trackId) setSelectedTrack(null);
      setLibraryRefreshKey((k) => k + 1);
      toast.success("Removed from collection");
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex flex-1 w-full overflow-hidden">
      {/* ── LEFT: Studio panel (55%) ── */}
      <div
        className="flex flex-col w-[55%] overflow-y-auto p-6 gap-5"
        style={{ borderRight: "1px solid var(--studio-border)" }}
      >
        {/* Calibration row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {needsCalibration && (
              <span
                className="text-[10px] tracking-[0.15em] uppercase font-mono"
                style={{ color: "oklch(0.704 0.191 22.216)" }}
              >
                calibration needed
              </span>
            )}
            {calibration && (
              <span
                className="text-xs tabular-nums"
                style={{ fontFamily: "var(--font-mono)", color: "var(--studio-muted-text)" }}
              >
                offset {calibration.offsetMs.toFixed(1)} ms · sd {calibration.sd.toFixed(1)} ms
              </span>
            )}
          </div>
          <button
            onClick={() => setCalibrationDialogOpen(true)}
            className="p-1.5 rounded transition-all"
            style={{ color: "var(--studio-muted-text)", border: "1px solid transparent" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--studio-amber)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--studio-border)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--studio-muted-text)";
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
            }}
            title="Calibrate tap latency"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* Unified search / "now labeling" indicator */}
        <SearchPanel
          query={query}
          onQueryChange={setQuery}
          selectedTrack={selectedTrack}
          onPick={setSelectedTrack}
          onChangeTrack={() => setSelectedTrack(null)}
        />

        {selectedTrack && (
          <>
            {/* Track hero */}
            <TrackHero track={selectedTrack} />

            {/* Spotify player embed */}
            <SpotifyPlayer
              trackId={selectedTrack.spotifyId}
              onController={setController}
            />

            {/* Playback status + restart */}
            <div className="flex items-center justify-between">
              <PlaybackCounter playback={playback} />
              <button
                disabled={!controller}
                onClick={() => {
                  if (!controller) return;
                  playback.expectSeek();
                  controller.restart();
                }}
                className="text-xs px-3 py-1.5 rounded transition-all disabled:opacity-30"
                style={{
                  border: "1px solid var(--studio-border)",
                  color: "var(--studio-muted-text)",
                  fontFamily: "var(--font-sans)",
                }}
                onMouseEnter={(e) => {
                  if (controller) {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,160,32,0.4)";
                    (e.currentTarget as HTMLElement).style.color = "var(--studio-warm-text)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--studio-border)";
                  (e.currentTarget as HTMLElement).style.color = "var(--studio-muted-text)";
                }}
                title="Restart the track from 0:00; markers are kept"
              >
                Restart
              </button>
            </div>

            {/* Timeline + label */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="text-[10px] tracking-[0.15em] uppercase font-mono"
                    style={{ color: "var(--studio-amber)" }}
                  >
                    Timeline
                  </div>
                  <div
                    className="text-xs mt-0.5 tabular-nums"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--studio-muted-text)" }}
                  >
                    {markerCount} marker{markerCount === 1 ? "" : "s"}
                    {dirtyCount > 0 ? ` · ${dirtyCount} unsaved` : ""}
                    {tempo
                      ? ` · ${tempo.bpm.toFixed(1)} BPM${tempo.bpmSd != null ? ` ±${tempo.bpmSd.toFixed(1)}` : ""}`
                      : ""}
                  </div>
                </div>
              </div>
              <Timeline
                durationMs={durationMs}
                takeRef={activeTake.takeRef}
                playback={playback}
                selectedMarkerId={selectedMarkerId}
                onSelectMarker={setSelectedMarkerId}
              />
            </div>

            {/* Controls row */}
            <ControlsBar
              playback={playback}
              activeTake={activeTake}
              markerCount={markerCount}
              saving={saving}
              onSnap={() => setSnapDialogOpen(true)}
              onClear={() => {
                activeTake.clearMarkers();
                setSelectedMarkerId(null);
              }}
              onSave={save}
            />
          </>
        )}
      </div>

      {/* ── RIGHT: Library panel (45%) ── */}
      <div className="flex flex-col w-[45%] overflow-hidden">
        <LibraryPanel
          refreshKey={libraryRefreshKey}
          activeTrackId={selectedTrack?.spotifyId ?? null}
          onLoadTrack={handleLoadLibraryTrack}
          onDeleteTrack={handleDeleteLibraryTrack}
        />
      </div>

      {/* Dialogs */}
      <CalibrationDialog
        open={calibrationOpen}
        onSave={(result) => {
          setCalibration(result);
          setCalibrationDialogOpen(false);
        }}
        onCancel={calibration ? () => setCalibrationDialogOpen(false) : undefined}
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
    </div>
  );
}
