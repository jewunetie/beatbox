"use client";

import { ClickTrackControls } from "@/components/studio/ClickTrackControls";
import type { Playback } from "@/lib/playback/useSpotifyPlayback";
import type { ActiveTakeApi } from "@/lib/takes/activeTake";

type Props = {
  playback: Playback;
  activeTake: ActiveTakeApi;
  markerCount: number;
  saving: boolean;
  onSnap: () => void;
  onClear: () => void;
  onSave: () => void;
};

const ghostBtn = {
  background: "transparent",
  border: "1px solid var(--studio-border)",
  color: "var(--studio-muted-text)",
  borderRadius: "var(--radius)",
  padding: "5px 12px",
  fontSize: "12px",
  cursor: "pointer",
  transition: "border-color 150ms, color 150ms",
} as const;

const primaryBtn = {
  background: "var(--studio-amber)",
  border: "1px solid transparent",
  color: "var(--studio-void)",
  borderRadius: "var(--radius)",
  padding: "5px 16px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 150ms",
} as const;

export function ControlsBar({ playback, activeTake, markerCount, saving, onSnap, onClear, onSave }: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <ClickTrackControls playback={playback} activeTake={activeTake} />

      <div
        className="shrink-0 self-stretch w-px"
        style={{ background: "var(--studio-border)", margin: "2px 4px" }}
      />

      {markerCount >= 4 && (
        <button
          style={ghostBtn}
          onClick={onSnap}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,160,32,0.4)";
            (e.currentTarget as HTMLElement).style.color = "var(--studio-warm-text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--studio-border)";
            (e.currentTarget as HTMLElement).style.color = "var(--studio-muted-text)";
          }}
        >
          Snap to grid
        </button>
      )}

      {markerCount > 0 && (
        <button
          style={ghostBtn}
          onClick={onClear}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,160,32,0.4)";
            (e.currentTarget as HTMLElement).style.color = "var(--studio-warm-text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--studio-border)";
            (e.currentTarget as HTMLElement).style.color = "var(--studio-muted-text)";
          }}
        >
          Clear
        </button>
      )}

      <button
        style={{
          ...primaryBtn,
          opacity: saving || markerCount === 0 ? 0.35 : 1,
          cursor: saving || markerCount === 0 ? "not-allowed" : "pointer",
          marginLeft: "auto",
        }}
        disabled={saving || markerCount === 0}
        onClick={onSave}
        onMouseEnter={(e) => {
          if (!saving && markerCount > 0) {
            (e.currentTarget as HTMLElement).style.opacity = "0.85";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = saving || markerCount === 0 ? "0.35" : "1";
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
