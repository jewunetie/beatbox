"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  computeStats,
  runMetronome,
  type CalibrationResult,
  type CalibrationStats,
} from "@/lib/audio/metronome";

type Props = {
  open: boolean;
  onSave: (result: CalibrationResult) => void;
  onCancel?: () => void;
};

type Phase = "ready" | "running" | "review";

const BPM = 100;
const BEATS = 16;
const TOTAL_DURATION_MS = (BEATS * 60_000) / BPM;

export function CalibrationDialog({ open, onSave, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [stats, setStats] = useState<CalibrationStats | null>(null);
  const [activeBeat, setActiveBeat] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      audioCtxRef.current?.close();
    };
  }, []);

  const reset = () => {
    setPhase("ready");
    setStats(null);
    setActiveBeat(-1);
    setError(null);
  };

  const start = async () => {
    setError(null);
    setActiveBeat(-1);
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setPhase("running");

      const result = await runMetronome(
        ctx,
        {
          beats: BEATS,
          bpm: BPM,
          onTickPerf: (i) => setActiveBeat(i),
        },
        ctrl.signal
      );
      const computed = computeStats(result.clickTimesPerfMs, result.tapTimesPerfMs);
      if (!computed) {
        setError(
          `Need at least 6 taps after the first 2 warm-ups; got ${Math.max(
            0,
            result.tapTimesPerfMs.length - 2
          )}.`
        );
        setPhase("ready");
        return;
      }
      setStats(computed);
      setPhase("review");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message);
      setPhase("ready");
    } finally {
      abortRef.current = null;
    }
  };

  const save = () => {
    if (!stats) return;
    onSave({
      offsetMs: stats.offsetMs,
      sd: stats.sd,
      samples: stats.samples,
      recordedAt: Date.now(),
    });
  };

  const warning =
    stats &&
    (stats.sd > 80 || Math.abs(stats.offsetMs) > 350)
      ? "Result is unusually noisy or far off — consider redoing."
      : null;

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (phase === "running") return;
    if (onCancel) onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} disablePointerDismissal>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Calibrate tap latency</DialogTitle>
          <DialogDescription>
            Click Start, then tap{" "}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">
              Space
            </kbd>{" "}
            in time with the {BEATS} clicks at {BPM} BPM. The first 2 taps are
            discarded as warm-up.
          </DialogDescription>
        </DialogHeader>

        <BeatGrid total={BEATS} active={activeBeat} />

        {phase === "ready" && (
          <div className="flex items-center justify-end gap-2">
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={start}>Start ({(TOTAL_DURATION_MS / 1000).toFixed(1)}s)</Button>
          </div>
        )}

        {phase === "running" && (
          <p className="text-sm text-muted-foreground">
            Tap along with the clicks…
          </p>
        )}

        {phase === "review" && stats && (
          <div className="space-y-3">
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <Stat label="Offset" value={`${stats.offsetMs.toFixed(1)} ms`} />
              <Stat label="SD" value={`${stats.sd.toFixed(1)} ms`} />
              <Stat label="Samples" value={String(stats.samples)} />
            </dl>
            {warning && (
              <p className="text-sm text-amber-600 dark:text-amber-400">{warning}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button variant="outline" onClick={reset}>
                Redo
              </Button>
              <Button onClick={save}>
                {warning ? "Save anyway" : "Save offset"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

function BeatGrid({ total, active }: { total: number; active: number }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-3 rounded ${
            i === active
              ? "bg-primary"
              : i < active
              ? "bg-muted-foreground/40"
              : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}
