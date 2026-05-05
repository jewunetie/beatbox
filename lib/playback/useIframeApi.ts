"use client";

import { useEffect, useState } from "react";
import type { SpotifyIFrameAPI } from "@/types/spotify-iframe-api";

export function useIframeApi(): SpotifyIFrameAPI | null {
  const [api, setApi] = useState<SpotifyIFrameAPI | null>(null);

  useEffect(() => {
    let cancelled = false;
    const promise = window.__spotifyIframeApiPromise;
    if (!promise) {
      console.error(
        "Spotify iframe bootstrap script missing — check app/layout.tsx"
      );
      return;
    }
    promise.then((resolved) => {
      if (!cancelled) setApi(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return api;
}
