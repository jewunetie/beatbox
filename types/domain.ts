export type NormalizedTrack = {
  spotifyId: string;
  name: string;
  artist: string;
  album: string;
  durationMs: number;
  coverUrl: string | null;
};

export type SpotifySearchResponse = {
  tracks: NormalizedTrack[];
};

export type ApiError = {
  error: string;
  retryAfterMs?: number;
};
