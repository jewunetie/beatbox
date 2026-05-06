import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { markerToDbInput, takeFromDb } from "@/lib/takes/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const markerInput = z.object({
  timeMs: z.number().finite().nonnegative(),
  kind: z.enum(["tap", "snapped", "manual_edit"]),
  confidence: z.number().finite().nullable().optional(),
});

const trackInput = z.object({
  name: z.string().min(1).max(500),
  artist: z.string().min(1).max(500),
  album: z.string().max(500).nullable().optional(),
  durationMs: z.number().int().positive(),
  coverUrl: z.string().url().nullable().optional(),
});

const bodySchema = z.object({
  granularity: z.enum(["all_beats", "downbeats", "onsets"]),
  source: z.enum(["tap", "merged"]),
  calibrationOffsetMs: z.number().finite().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  markers: z.array(markerInput).max(10_000),
  track: trackInput,
});

type Ctx = { params: Promise<{ trackId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { trackId } = await ctx.params;
  if (!trackId) {
    return NextResponse.json({ error: "Missing trackId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  await prisma.track.upsert({
    where: { spotifyId: trackId },
    create: {
      spotifyId: trackId,
      name: data.track.name,
      artist: data.track.artist,
      album: data.track.album ?? null,
      durationMs: data.track.durationMs,
      coverUrl: data.track.coverUrl ?? null,
    },
    update: {
      name: data.track.name,
      artist: data.track.artist,
      album: data.track.album ?? null,
      durationMs: data.track.durationMs,
      coverUrl: data.track.coverUrl ?? null,
    },
  });

  const created = await prisma.take.create({
    data: {
      trackId,
      granularity: data.granularity,
      source: data.source,
      calibrationOffsetMs: data.calibrationOffsetMs ?? null,
      notes: data.notes ?? null,
      markers: {
        create: data.markers.map(markerToDbInput),
      },
    },
    include: { markers: true },
  });

  return NextResponse.json({ take: takeFromDb(created) }, { status: 201 });
}
