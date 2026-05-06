"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveTake, Marker } from "@/lib/takes/activeTake";
import type { Playback } from "@/lib/playback/useSpotifyPlayback";

type Props = {
  durationMs: number;
  takeRef: React.RefObject<ActiveTake>;
  playback: Playback;
  selectedMarkerId: string | null;
  onSelectMarker: (id: string | null) => void;
};

const HEIGHT = 140;
const HIT_TOLERANCE_PX = 6;

function drawStaticLayer(
  canvas: HTMLCanvasElement,
  width: number,
  durationMs: number,
  dpr: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, HEIGHT);
  // Background — dark gradient
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#0a0805");
  bg.addColorStop(1, "#050505");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, HEIGHT);
  // Border — amber tint
  ctx.strokeStyle = "rgba(240,160,32,0.15)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, HEIGHT - 1);
  if (durationMs <= 0) {
    ctx.restore();
    return;
  }
  // Tick marks
  const seconds = durationMs / 1000;
  const minorEvery = seconds <= 60 ? 1 : seconds <= 300 ? 2 : 5;
  const majorEvery = seconds <= 60 ? 5 : seconds <= 300 ? 30 : 60;
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(240,160,32,0.6)";
  for (let s = 0; s <= seconds; s += minorEvery) {
    const x = (s / seconds) * width;
    const isMajor = s % majorEvery === 0;
    ctx.strokeStyle = isMajor ? "rgba(240,160,32,0.35)" : "rgba(240,160,32,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, isMajor ? 0 : HEIGHT - 14);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
    if (isMajor && x > 4 && x < width - 36) {
      const minutes = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      ctx.fillText(`${minutes}:${secs.toString().padStart(2, "0")}`, x + 3, 4);
    }
  }
  ctx.restore();
}

function drawOverlayLayer(
  canvas: HTMLCanvasElement,
  width: number,
  durationMs: number,
  markers: Marker[],
  playheadMs: number,
  selectedId: string | null,
  dpr: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, HEIGHT);
  if (durationMs <= 0) {
    ctx.restore();
    return;
  }
  // Markers — amber oscilloscope spikes
  for (const m of markers) {
    const x = (m.timeMs / durationMs) * width;
    const isSelected = m.id === selectedId;
    const color = isSelected ? "#fff8f0" : m.dirty ? "#f0c050" : "#f0a020";

    // Selected: soft highlight fill
    if (isSelected) {
      ctx.fillStyle = "rgba(255,248,240,0.06)";
      ctx.fillRect(x - 6, 8, 12, HEIGHT - 16);
    }

    // Glow halo — wide, dim
    ctx.strokeStyle = isSelected ? "rgba(255,248,240,0.10)" : "rgba(240,160,32,0.08)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x, HEIGHT - 10);
    ctx.stroke();

    // Sharp spike
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, HEIGHT - 8);
    ctx.stroke();
  }

  // Playhead — dashed red
  const px = Math.min(width, Math.max(0, (playheadMs / durationMs) * width));
  ctx.strokeStyle = "#e03030";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  // Playhead caret
  ctx.fillStyle = "#e03030";
  ctx.beginPath();
  ctx.moveTo(px - 5, 0);
  ctx.lineTo(px + 5, 0);
  ctx.lineTo(px, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function Timeline({
  durationMs,
  takeRef,
  playback,
  selectedMarkerId,
  onSelectMarker,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const selectedRef = useRef<string | null>(selectedMarkerId);
  selectedRef.current = selectedMarkerId;

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Static redraw when track or width changes
  useEffect(() => {
    const canvas = staticCanvasRef.current;
    if (!canvas || width === 0) return;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${HEIGHT}px`;
    drawStaticLayer(canvas, width, durationMs, dpr);
  }, [durationMs, width, dpr]);

  // Overlay rAF loop
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || width === 0) return;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${HEIGHT}px`;
    let raf = 0;
    const tick = () => {
      const playheadMs = playback.getCurrentMs();
      drawOverlayLayer(
        canvas,
        width,
        durationMs,
        takeRef.current.markers,
        playheadMs,
        selectedRef.current,
        dpr
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, width, dpr, takeRef, playback]);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (durationMs <= 0 || width === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const markers = takeRef.current.markers;
      let closest: { id: string; dx: number } | null = null;
      for (const m of markers) {
        const mx = (m.timeMs / durationMs) * width;
        const dx = Math.abs(mx - x);
        if (closest == null || dx < closest.dx) closest = { id: m.id, dx };
      }
      if (closest && closest.dx <= HIT_TOLERANCE_PX) {
        onSelectMarker(closest.id);
      } else {
        onSelectMarker(null);
      }
    },
    [durationMs, width, takeRef, onSelectMarker]
  );

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className="relative w-full cursor-crosshair select-none"
      style={{ height: HEIGHT }}
    >
      <canvas ref={staticCanvasRef} className="absolute inset-0 rounded" />
      <canvas ref={overlayCanvasRef} className="absolute inset-0 rounded" />
    </div>
  );
}
