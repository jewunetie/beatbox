import { markerFromDb, markerToDbInput } from "./serialize";
import type { Marker as DbMarker } from "@/lib/db/prisma";

const cases: Array<{ timeMs: number; expectSeconds: number }> = [
  { timeMs: 0, expectSeconds: 0 },
  { timeMs: 1, expectSeconds: 0.001 },
  { timeMs: 1234, expectSeconds: 1.234 },
  { timeMs: 60_000, expectSeconds: 60 },
  { timeMs: 354_320, expectSeconds: 354.32 },
];

let failed = 0;

for (const c of cases) {
  const db = markerToDbInput({ timeMs: c.timeMs, kind: "tap" });
  if (Math.abs(db.timeSeconds - c.expectSeconds) > 1e-9) {
    console.error(`FAIL toDb: ${c.timeMs} -> ${db.timeSeconds} (expected ${c.expectSeconds})`);
    failed++;
    continue;
  }
  const fakeRow = {
    id: 1,
    takeId: 1,
    timeSeconds: db.timeSeconds,
    kind: db.kind,
    confidence: db.confidence,
  } as DbMarker;
  const back = markerFromDb(fakeRow);
  if (back.timeMs !== c.timeMs) {
    console.error(`FAIL fromDb: ${c.timeMs} -> ${db.timeSeconds} -> ${back.timeMs}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`serialize.test: ${failed} failures`);
  process.exit(1);
}
console.log(`serialize.test: ${cases.length} cases passed`);
