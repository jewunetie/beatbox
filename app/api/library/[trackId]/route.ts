import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ trackId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { trackId } = await ctx.params;
  if (!trackId) {
    return NextResponse.json({ error: "Missing trackId" }, { status: 400 });
  }
  await prisma.take.deleteMany({ where: { trackId } });
  return NextResponse.json({ ok: true });
}
