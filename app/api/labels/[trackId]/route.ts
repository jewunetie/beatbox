import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { takeFromDb } from "@/lib/takes/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ trackId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { trackId } = await ctx.params;
  if (!trackId) {
    return NextResponse.json({ error: "Missing trackId" }, { status: 400 });
  }
  const [track, takes] = await Promise.all([
    prisma.track.findUnique({ where: { spotifyId: trackId } }),
    prisma.take.findMany({
      where: { trackId },
      include: { markers: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return NextResponse.json({
    track: track
      ? {
          spotifyId: track.spotifyId,
          name: track.name,
          artist: track.artist,
          album: track.album,
          durationMs: track.durationMs,
        }
      : null,
    takes: takes.map(takeFromDb),
  });
}
