# Beat Labeling Studio

A localhost Next.js tool for labeling beat positions in Spotify tracks by tapping the spacebar along during playback. **Spotify Premium is a hard requirement** — both the developer-app owner and you, the listener, must have an active Premium subscription. The Spotify embed iframe falls back to a 30-second preview otherwise, and as of February 2026 the developer app itself stops working when the owner's Premium lapses.

This is a single-user tool intended to run on `localhost:3000`. There is no hosted deployment, no cloud sync, no auth.

## Setup

1. Create a Spotify Developer app at <https://developer.spotify.com/dashboard>. The app owner needs Spotify Premium.
2. Copy `.env.example` to `.env` and fill in `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. The `DATABASE_URL` line in the template is correct as written for local dev.
3. Install dependencies: `npm install`.
4. Initialize the SQLite database: `npx prisma migrate deploy` (or `npx prisma migrate dev` if you also want to apply pending dev migrations).
5. Start the dev server: `npm run dev`.

Open http://localhost:3000 (or whichever port Next.js picks). On the first load you'll be prompted to calibrate latency before any other UI is interactive.

## Usage

- Type in the search box (debounced 300 ms) and click a result Card to load the embed iframe.
- Press Play in the iframe (Spotify autoplay rules require the user gesture).
- Tap **Space** in time with the beats. Markers appear on the timeline below the iframe.
- Click a marker to select it. **←/→** nudges by 10 ms (1 ms with **Shift**), **Delete** removes, **Esc** clears the selection.
- Toggle the **Click track** switch to schedule a Web Audio click on each saved marker — the canonical "did the labels land on the beat" sanity check.
- **Snap to grid** previews the residual error from a constant-tempo least-squares fit and replaces marker times on apply.
- **Save** persists the active take. Each save creates a new immutable take row; switch between them in the Takes panel. **Merge N takes** clusters their timestamps and produces a snapped median grid.

## Keyboard

| Key | Action |
| --- | --- |
| Space | Record a beat at the current playback position |
| ←/→ | Nudge the selected marker ±10 ms |
| Shift + ←/→ | Nudge the selected marker ±1 ms |
| Delete / Backspace | Remove the selected marker |
| Esc | Clear marker selection |

Editable focus (Search input, etc.) suppresses Space, so you can type queries without recording taps.

## Architecture

Next.js 16 App Router + React 19 + Tailwind v4 + shadcn/ui.

```
app/
  api/
    spotify/search    → Client-Credentials proxy (Node runtime, in-memory token cache)
    labels/[trackId]  → GET takes + markers; POST a new take
    labels/[trackId]/merge → POST merge takes (median-snap to grid)
    labels/markers/[id]    → PATCH/DELETE one marker
    labels/takes/[id]      → DELETE one take (cascades to markers)
  layout.tsx          → mounts Sonner Toaster + Spotify iframe API <Script>
  page.tsx            → renders the StudioShell client component
components/studio/    → SearchBar, SearchResults, SpotifyPlayer, Timeline,
                        CalibrationDialog, ClickTrackControls, SnapToGridDialog,
                        TakeTabs, StudioShell
lib/
  spotify/{token,api} → Client-Credentials cache + searchTracks/getTrack
  playback/           → Anchor type, interpolate(), useSpotifyPlayback hook
  audio/              → Calibration metronome + click-track scheduler
  takes/              → activeTake store, ms↔seconds boundary
  tempo/              → Median-IOI BPM estimator + least-squares grid fit
  db/prisma.ts        → Prisma 7 singleton (better-sqlite3 adapter)
prisma/schema.prisma  → Track / Take / Marker
```

State lives in a single client component (`StudioShell`). Hot-path values (the playback anchor, the calibration offset, the active take) are stored in refs so the spacebar handler never waits on a re-render.

### Time interpolation

The Spotify iframe API only emits a `playback_update` event roughly once per second. We anchor the most recent update against `performance.now()`; reads in between are computed as `position + (performance.now() − wallClock)` while playing, frozen otherwise. A reported position that drifts more than 200 ms from the interpolated value is treated as a seek — the anchor re-anchors and any unsaved taps captured against the previous epoch are dropped with a toast.

### ms ↔ seconds

Everywhere in code and over the wire is **milliseconds**. The DB stores `Marker.timeSeconds` as a float, and the only conversion lives in `lib/takes/serialize.ts`. A round-trip test (`npx tsx lib/takes/serialize.test.ts`) guards the boundary.

## Limitations

- **Latency floor.** Spotify's iframe runs in a separate process with no audio buffer access. The interpolation is only as tight as the 1 Hz `playback_update` cadence allows. Expect **50–150 ms of irreducible jitter** on top of your calibrated reaction time. The click track is the verification of last resort: if the audible clicks land on the beat by ear, the labels are usable.
- **Spotify search limit dropped to 10.** As of February 2026 Spotify capped `GET /search?limit=` at 10 (was 50). Pagination via `offset` is not implemented.
- **Audio Features and Audio Analysis are deprecated** and intentionally unused — manual labeling is the entire point.
- **No mobile / touch support.** Modern desktop Chrome or Firefox.
- **No automatic beat detection.** The whole app is human labeling.

## Notes for future work

- Multi-tab calibration: offsets live in `sessionStorage`, so each new tab re-calibrates.
- Variable-tempo grid snapping is out of scope for v1 — only constant tempo.
- Export to JAMS / MIREX is not implemented; markers can be read directly from SQLite.
