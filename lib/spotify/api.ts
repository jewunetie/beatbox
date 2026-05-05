import { getAccessToken } from "./token";
import type { NormalizedTrack } from "@/types/domain";

const SEARCH_URL = "https://api.spotify.com/v1/search";
const TRACK_URL = "https://api.spotify.com/v1/tracks";

export class SpotifyRateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Spotify rate limited; retry after ${retryAfterMs}ms`);
    this.name = "SpotifyRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class SpotifyApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SpotifyApiError";
    this.status = status;
  }
}

type RawArtist = { name: string };
type RawImage = { url: string; width: number; height: number };
type RawAlbum = { name: string; images: RawImage[] };
type RawTrack = {
  id: string;
  name: string;
  artists: RawArtist[];
  album: RawAlbum;
  duration_ms: number;
};

function normalize(track: RawTrack): NormalizedTrack {
  const cover =
    [...track.album.images].sort((a, b) => a.width - b.width).find((i) => i.width >= 200) ??
    track.album.images[0] ??
    null;
  return {
    spotifyId: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    durationMs: track.duration_ms,
    coverUrl: cover?.url ?? null,
  };
}

async function spotifyFetch(url: string): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "1");
    throw new SpotifyRateLimitError(retryAfter * 1000);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SpotifyApiError(
      `Spotify request failed: ${res.status} ${body.slice(0, 200)}`,
      res.status
    );
  }
  return res;
}

export async function searchTracks(q: string, limit = 10): Promise<NormalizedTrack[]> {
  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&type=track&limit=${safeLimit}`;
  const res = await spotifyFetch(url);
  const data = (await res.json()) as { tracks: { items: RawTrack[] } };
  return data.tracks.items.map(normalize);
}

export async function getTrack(spotifyId: string): Promise<NormalizedTrack> {
  const url = `${TRACK_URL}/${encodeURIComponent(spotifyId)}`;
  const res = await spotifyFetch(url);
  const data = (await res.json()) as RawTrack;
  return normalize(data);
}
