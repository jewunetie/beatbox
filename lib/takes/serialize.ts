import type { Marker as DbMarker, Take as DbTake } from "@/lib/db/prisma";

export type MarkerKindWire = "tap" | "snapped" | "manual_edit";
export type SourceWire = "tap" | "merged";
export type GranularityWire = "all_beats" | "downbeats" | "onsets";

export type WireMarker = {
  id: number;
  takeId: number;
  timeMs: number;
  kind: MarkerKindWire;
  confidence: number | null;
};

export type WireTake = {
  id: number;
  trackId: string;
  granularity: GranularityWire;
  source: SourceWire;
  calibrationOffsetMs: number | null;
  notes: string | null;
  createdAt: string;
  markers: WireMarker[];
};

export function markerToDbInput(m: {
  timeMs: number;
  kind: MarkerKindWire;
  confidence?: number | null;
}): { timeSeconds: number; kind: string; confidence: number | null } {
  return {
    timeSeconds: m.timeMs / 1000,
    kind: m.kind,
    confidence: m.confidence ?? null,
  };
}

export function markerFromDb(m: DbMarker): WireMarker {
  return {
    id: m.id,
    takeId: m.takeId,
    timeMs: Math.round(m.timeSeconds * 1000),
    kind: m.kind as MarkerKindWire,
    confidence: m.confidence,
  };
}

export function takeFromDb(
  t: DbTake & { markers: DbMarker[] }
): WireTake {
  return {
    id: t.id,
    trackId: t.trackId,
    granularity: t.granularity as GranularityWire,
    source: t.source as SourceWire,
    calibrationOffsetMs: t.calibrationOffsetMs,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    markers: [...t.markers]
      .sort((a, b) => a.timeSeconds - b.timeSeconds)
      .map(markerFromDb),
  };
}
