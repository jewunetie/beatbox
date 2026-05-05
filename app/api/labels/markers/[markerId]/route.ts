import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { markerFromDb } from "@/lib/takes/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  timeMs: z.number().finite().nonnegative().optional(),
  kind: z.enum(["tap", "snapped", "manual_edit"]).optional(),
  confidence: z.number().finite().nullable().optional(),
});

type Ctx = { params: Promise<{ markerId: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { markerId } = await ctx.params;
  const id = parseId(markerId);
  if (id == null) {
    return NextResponse.json({ error: "Invalid markerId" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const update: Record<string, number | string | null> = {};
  if (parsed.data.timeMs != null) update.timeSeconds = parsed.data.timeMs / 1000;
  if (parsed.data.kind != null) update.kind = parsed.data.kind;
  if (parsed.data.confidence !== undefined) update.confidence = parsed.data.confidence;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  try {
    const updated = await prisma.marker.update({ where: { id }, data: update });
    return NextResponse.json({ marker: markerFromDb(updated) });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 404 }
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { markerId } = await ctx.params;
  const id = parseId(markerId);
  if (id == null) {
    return NextResponse.json({ error: "Invalid markerId" }, { status: 400 });
  }
  try {
    await prisma.marker.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 404 }
    );
  }
}
