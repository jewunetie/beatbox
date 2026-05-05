import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { fitGrid } from "@/lib/tempo/snap";
import { takeFromDb } from "@/lib/takes/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  takeIds: z.array(z.number().int().positive()).min(1),
  granularity: z.enum(["all_beats", "downbeats", "onsets"]).default("all_beats"),
  notes: z.string().max(2000).nullable().optional(),
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

  const sourceTakes = await prisma.take.findMany({
    where: { id: { in: data.takeIds }, trackId },
    include: { markers: true },
  });
  if (sourceTakes.length !== data.takeIds.length) {
    return NextResponse.json(
      { error: "One or more take IDs are not on this track" },
      { status: 400 }
    );
  }

  const allTimesMs: number[] = [];
  for (const t of sourceTakes) {
    for (const m of t.markers) {
      allTimesMs.push(Math.round(m.timeSeconds * 1000));
    }
  }
  if (allTimesMs.length < 4) {
    return NextResponse.json(
      { error: "Need at least 4 markers across the selected takes to merge" },
      { status: 400 }
    );
  }

  // Cluster timestamps that fall within the same likely beat. The threshold
  // adapts to the input spread but stays bounded — too tight and noisy taps
  // refuse to merge, too loose and adjacent beats collapse together.
  const sorted = [...allTimesMs].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1] - sorted[0];
  const clusterThresholdMs = Math.max(40, Math.min(120, span / sorted.length / 4));
  const clusters: number[][] = [];
  let current: number[] = [];
  for (const t of sorted) {
    if (current.length === 0 || t - current[current.length - 1] <= clusterThresholdMs) {
      current.push(t);
    } else {
      clusters.push(current);
      current = [t];
    }
  }
  if (current.length > 0) clusters.push(current);

  const clusterMedians = clusters.map((c) => {
    const s = [...c].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  });

  if (clusterMedians.length < 4) {
    return NextResponse.json(
      { error: "After clustering there are too few distinct beats to fit a grid" },
      { status: 400 }
    );
  }

  const fit = fitGrid(clusterMedians);
  if (!fit) {
    return NextResponse.json(
      { error: "Could not fit a constant-tempo grid to the merged markers" },
      { status: 422 }
    );
  }
  const mergedTimesMs = fit.snappedMs;

  const created = await prisma.take.create({
    data: {
      trackId,
      granularity: data.granularity,
      source: "merged",
      calibrationOffsetMs: null,
      notes:
        data.notes ?? `Merged from takes [${data.takeIds.join(", ")}] @ ${fit.bpm.toFixed(2)} BPM`,
      markers: {
        create: mergedTimesMs.map((t) => ({
          timeSeconds: t / 1000,
          kind: "snapped",
          confidence: null,
        })),
      },
    },
    include: { markers: true },
  });

  return NextResponse.json({ take: takeFromDb(created), bpm: fit.bpm }, { status: 201 });
}
