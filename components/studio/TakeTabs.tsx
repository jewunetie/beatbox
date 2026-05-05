"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WireTake } from "@/lib/takes/serialize";

type Props = {
  takes: WireTake[];
  activeServerId: number | null;
  isNew: boolean;
  onSelect: (takeId: number | null) => void;
  onDelete: (takeId: number) => void;
  onMerge: () => void;
};

function timestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}:${d
    .getSeconds()
    .toString()
    .padStart(2, "0")}`;
}

export function TakeTabs({
  takes,
  activeServerId,
  isNew,
  onSelect,
  onDelete,
  onMerge,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {takes.map((t) => {
          const active = !isNew && t.id === activeServerId;
          return (
            <div
              key={t.id}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent"
              }`}
            >
              <button
                type="button"
                className="font-mono tabular-nums"
                onClick={() => onSelect(t.id)}
              >
                #{t.id}
              </button>
              <Badge
                variant={active ? "secondary" : "outline"}
                className="text-[10px]"
              >
                {t.markers.length}
              </Badge>
              {t.source === "merged" && (
                <Badge variant="outline" className="text-[10px]">
                  merged
                </Badge>
              )}
              <span
                className={`text-[10px] ${
                  active ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                {timestamp(t.createdAt)}
              </span>
              <button
                type="button"
                title="Delete take"
                aria-label="Delete take"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete take #${t.id} (${t.markers.length} markers)?`)) {
                    onDelete(t.id);
                  }
                }}
                className={`ml-1 -mr-1 rounded-full px-1.5 text-xs leading-none ${
                  active ? "hover:bg-primary-foreground/20" : "hover:bg-muted-foreground/10"
                }`}
              >
                ×
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`rounded-full border border-dashed px-3 py-1 text-xs ${
            isNew ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
          }`}
        >
          + New take
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={takes.length < 2}
          onClick={onMerge}
        >
          Merge {takes.length} take{takes.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}
