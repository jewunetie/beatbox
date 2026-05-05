"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SearchBar } from "@/components/studio/SearchBar";
import { SearchResults } from "@/components/studio/SearchResults";
import type { NormalizedTrack } from "@/types/domain";

export function StudioShell() {
  const [query, setQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<NormalizedTrack | null>(null);

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
        <Button variant="outline" size="sm">
          Calibrate
        </Button>
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
        <CardContent className="text-sm text-muted-foreground">
          Iframe + playback hook lands here in steps 4–5.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            Tap markers and the moving playhead.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Canvas timeline + tap recording lands here in step 6.
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
    </main>
  );
}
