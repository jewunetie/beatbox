"use client";

import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { fitGrid } from "@/lib/tempo/snap";

type Props = {
  open: boolean;
  markers: { id: string; timeMs: number }[];
  onCancel: () => void;
  onApply: (snapped: { id: string; timeMs: number }[]) => void;
};

export function SnapToGridDialog({ open, markers, onCancel, onApply }: Props) {
  const [showAll, setShowAll] = useState(false);
  const fit = useMemo(() => fitGrid(markers.map((m) => m.timeMs)), [markers]);

  const apply = () => {
    if (!fit) return;
    const next = markers.map((m, i) => ({ id: m.id, timeMs: fit.snappedMs[i] }));
    onApply(next);
  };

  const visible = useMemo(() => {
    if (!fit) return [];
    const indexed = markers.map((m, i) => ({
      id: m.id,
      timeMs: m.timeMs,
      residual: fit.residualsMs[i],
    }));
    if (showAll) return indexed;
    return [...indexed]
      .sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual))
      .slice(0, 8);
  }, [fit, markers, showAll]);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Snap markers to a constant-tempo grid</AlertDialogTitle>
          <AlertDialogDescription>
            Replaces every marker time with its nearest grid time. This action
            is destructive — applying cannot be undone short of editing markers
            back by hand.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!fit ? (
          <p className="text-sm text-destructive">
            Need at least 4 markers with positive inter-onset intervals to fit a grid.
          </p>
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <Stat label="BPM" value={fit.bpm.toFixed(2)} />
              <Stat label="RMS error" value={`${fit.rmsResidualMs.toFixed(1)} ms`} />
              <Stat label="Max error" value={`${fit.maxResidualMs.toFixed(1)} ms`} />
            </dl>
            <div className="rounded border max-h-56 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-right">Original (ms)</th>
                    <th className="px-2 py-1 text-right">Residual (ms)</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {visible.map((m, idx) => (
                    <tr key={m.id} className="border-t">
                      <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-1 text-right">{m.timeMs.toFixed(1)}</td>
                      <td
                        className={`px-2 py-1 text-right ${
                          Math.abs(m.residual) > 30 ? "text-amber-600 dark:text-amber-400" : ""
                        }`}
                      >
                        {m.residual >= 0 ? "+" : ""}
                        {m.residual.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {markers.length > 8 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show worst 8 only" : `Show all ${markers.length} markers`}
              </Button>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!fit} onClick={apply}>
            Apply snap
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
