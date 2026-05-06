import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { estimateTempo } from "@/lib/tempo/estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type LibraryEntry = {
  spotifyId: string;
  name: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  durationMs: number;
  markerCount: number;
  estimatedBpm: number | null;
  lastSavedAt: string;
};

export async function GET() {
  const tracks = await prisma.track.findMany({
    where: { takes: { some: {} } },
    include: {
      takes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { markers: true },
      },
    },
    orderBy: { firstSeenAt: "desc" },
  });

  const entries: LibraryEntry[] = tracks.map((track) => {
    const latestTake = track.takes[0];
    const markerTimesMs = latestTake
      ? latestTake.markers.map((m) => Math.round(m.timeSeconds * 1000))
      : [];
    const tempo = estimateTempo(markerTimesMs);
    return {
      spotifyId: track.spotifyId,
      name: track.name,
      artist: track.artist,
      album: track.album ?? null,
      coverUrl: track.coverUrl ?? null,
      durationMs: track.durationMs,
      markerCount: markerTimesMs.length,
      estimatedBpm: tempo ? parseFloat(tempo.bpm.toFixed(1)) : null,
      lastSavedAt: latestTake?.createdAt.toISOString() ?? new Date(0).toISOString(),
    };
  });

  return NextResponse.json({ tracks: entries });
}
