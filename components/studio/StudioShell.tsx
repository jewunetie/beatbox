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
import { useSpotifyPlayback } from "@/lib/playback/useSpotifyPlayback";
import { useActiveTake } from "@/lib/takes/activeTake";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import type { SpotifyController } from "@/types/spotify-iframe-api";
import type { NormalizedTrack } from "@/types/domain";
import type { CalibrationResult } from "@/lib/audio/metronome";

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

  // Reset markers + selection when the selected track changes.
  useEffect(() => {
    activeTake.setTrack(selectedTrack?.spotifyId ?? null);
    setSelectedMarkerId(null);
  }, [selectedTrack?.spotifyId, activeTake.setTrack]);

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
              </span>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedTrack ? (
            <Timeline
              durationMs={durationMs}
              takeRef={activeTake.takeRef}
              playback={playback}
              selectedMarkerId={selectedMarkerId}
              onSelectMarker={setSelectedMarkerId}
            />
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
          <CardDescription>One tab per labeling pass.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Multi-take support lands here in step 12.
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
    </main>
  );
}
