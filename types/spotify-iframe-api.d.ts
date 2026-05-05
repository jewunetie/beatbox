export type SpotifyPlaybackUpdate = {
  data: {
    position: number;
    duration: number;
    isPaused: boolean;
    isBuffering: boolean;
  };
};

export type SpotifyControllerOptions = {
  width?: number | string;
  height?: number | string;
  uri: string;
  theme?: "dark" | "light";
};

export type SpotifyEventName = "playback_update" | "ready" | "error";

export type SpotifyEventListener<T = unknown> = (event: T) => void;

export interface SpotifyController {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(positionMs: number): void;
  loadUri(uri: string): void;
  setVolume(volume: number): void;
  destroy(): void;
  addListener(name: "playback_update", cb: SpotifyEventListener<SpotifyPlaybackUpdate>): void;
  addListener(name: "ready", cb: SpotifyEventListener): void;
  addListener(name: "error", cb: SpotifyEventListener): void;
  removeListener(name: SpotifyEventName, cb: SpotifyEventListener): void;
}

export interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: SpotifyControllerOptions,
    callback: (controller: SpotifyController) => void
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
    __spotifyIframeApiPromise?: Promise<SpotifyIFrameAPI>;
  }
}
