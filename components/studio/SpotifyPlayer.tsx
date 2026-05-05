"use client";

import { useEffect, useRef } from "react";
import { useIframeApi } from "@/lib/playback/useIframeApi";
import type { SpotifyController } from "@/types/spotify-iframe-api";

type Props = {
  trackId: string;
  onController?: (controller: SpotifyController | null) => void;
};

export function SpotifyPlayer({ trackId, onController }: Props) {
  const api = useIframeApi();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyController | null>(null);
  const onControllerRef = useRef(onController);
  onControllerRef.current = onController;

  useEffect(() => {
    if (!api || !mountRef.current) return;
    let destroyed = false;

    api.createController(
      mountRef.current,
      { uri: `spotify:track:${trackId}`, width: "100%", height: 232 },
      (controller) => {
        if (destroyed) {
          controller.destroy();
          return;
        }
        controllerRef.current = controller;
        onControllerRef.current?.(controller);
      }
    );

    return () => {
      destroyed = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
      onControllerRef.current?.(null);
    };
  }, [api]);

  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.loadUri(`spotify:track:${trackId}`);
    }
  }, [trackId]);

  return (
    <div className="overflow-hidden rounded-lg">
      <div ref={mountRef} />
    </div>
  );
}
