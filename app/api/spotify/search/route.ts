import { NextResponse } from "next/server";
import {
  searchTracks,
  SpotifyApiError,
  SpotifyRateLimitError,
} from "@/lib/spotify/api";
import { SpotifyAuthError } from "@/lib/spotify/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const limitRaw = searchParams.get("limit");

  if (!q) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }

  const limit = limitRaw ? Number(limitRaw) : 10;
  if (!Number.isFinite(limit) || limit < 1 || limit > 10) {
    return NextResponse.json(
      { error: "limit must be an integer between 1 and 10" },
      { status: 400 }
    );
  }

  try {
    const tracks = await searchTracks(q, limit);
    return NextResponse.json({ tracks });
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterMs: err.retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(err.retryAfterMs / 1000)) } }
      );
    }
    if (err instanceof SpotifyAuthError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof SpotifyApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
