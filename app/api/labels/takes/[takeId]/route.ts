import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ takeId: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { takeId } = await ctx.params;
  const id = parseId(takeId);
  if (id == null) {
    return NextResponse.json({ error: "Invalid takeId" }, { status: 400 });
  }
  try {
    await prisma.take.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 404 }
    );
  }
}
