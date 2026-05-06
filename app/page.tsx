import { StudioShell } from "@/components/studio/StudioShell";

function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1" style={{ color: "var(--studio-dim-text)", fontSize: 10 }}>
      {keys.map((k) => (
        <kbd
          key={k}
          className="px-1 py-0.5 rounded"
          style={{
            border: "1px solid var(--studio-border)",
            color: "var(--studio-amber)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
          }}
        >
          {k}
        </kbd>
      ))}
      <span className="ml-0.5">{label}</span>
    </span>
  );
}

export default function Home() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--studio-void)" }}
    >
      {/* Top bar */}
      <header
        className="h-11 flex items-center px-6 shrink-0"
        style={{ borderBottom: "1px solid var(--studio-border)" }}
      >
        <span
          className="tracking-[0.3em] text-xs font-medium"
          style={{ fontFamily: "var(--font-mono)", color: "var(--studio-amber)" }}
        >
          BEAT LAB
        </span>
      </header>

      {/* Main two-column area */}
      <div className="flex flex-1 overflow-hidden">
        <StudioShell />
      </div>

      {/* Keyboard shortcuts footer */}
      <footer
        className="h-8 flex items-center gap-5 px-6 shrink-0 overflow-hidden"
        style={{ borderTop: "1px solid var(--studio-border)" }}
      >
        <KeyHint keys={["Space"]} label="tap beat" />
        <KeyHint keys={["←", "→"]} label="nudge ±10ms" />
        <KeyHint keys={["Shift", "←", "→"]} label="nudge ±1ms" />
        <KeyHint keys={["Del"]} label="remove" />
        <KeyHint keys={["Esc"]} label="deselect" />
      </footer>
    </div>
  );
}
