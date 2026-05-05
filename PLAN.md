# Beat Labeling Studio: Build Spec (Next.js + Spotify Iframe)

## Goal

Build a localhost Next.js app for labeling beat positions in Spotify tracks by tapping along during playback. The user searches for a song on Spotify, the app embeds the Spotify player iframe, and the user taps the spacebar to record beats. Labels persist per Spotify track ID and are restored when the same track is loaded again.

## Spotify constraints to know up front

This app uses the Spotify embed iframe for playback and the Spotify Web API for search and track lookup. As of February-March 2026, Spotify changed Development Mode rules. These constraints affect what the app can do:

1. The Spotify Developer app must be owned by an account with an active Spotify Premium subscription. If Premium lapses, the app stops working.
2. Full-length playback in the iframe requires the listening user to be logged into Spotify Premium in the same browser. Non-Premium users get a 30-second preview only. The README must surface this.
3. Development Mode allows up to 5 authorized users per app. Fine for a personal tool.
4. The `GET /search` endpoint's `limit` parameter now maxes at 10 (was 50), default 5 (was 20). Paginate via `offset` if the user wants more results.
5. The Audio Features and Audio Analysis endpoints are deprecated for new apps. The app does not use them. Manual labeling is the entire point of this tool.

## Stack

- Next.js 14+ App Router with TypeScript
- shadcn/ui for components (Button, Input, Card, Dialog, Slider, Tabs, Switch, Toast, AlertDialog, Sheet)
- Tailwind CSS
- Spotify Web API via server-side API routes using the Client Credentials flow
- Spotify iFrame API for embedded playback (`https://open.spotify.com/embed/iframe-api/v1`)
- Web Audio API for the calibration metronome and the click-track overlay
- Prisma + SQLite for storage
- Run target: `localhost:3000`, single user, modern Chrome or Firefox

## Setup

The user must do these manually before the app works:

1. Create a Spotify Developer app at <https://developer.spotify.com/dashboard>. The owner must have Spotify Premium.
2. Copy the Client ID and Client Secret into `.env.local`:

   ```
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   ```

3. Initialize the SQLite database: `npx prisma migrate dev --name init`.
4. Run `npm run dev`.

## Core User Flow

1. App loads. If a calibration offset is not in `sessionStorage`, the calibration dialog opens immediately and blocks all other UI.
2. User completes calibration (see Latency Calibration).
3. User types in the search box. Debounced 300 ms, the app calls `/api/spotify/search?q=...&limit=10` and shows results as a list of Cards (cover art, track name, artist, album, duration).
4. User clicks a track. The app loads the Spotify iframe with that track URI and queries `/api/labels/{trackId}` to load any existing markers.
5. User picks beat granularity for the active take: "all beats", "downbeats", or "onsets". This is take metadata, not enforced by the UI.
6. User presses Play in the iframe (Spotify autoplay restrictions require user gesture). Playback begins.
7. While playing, every spacebar press records the current interpolated playback position (latency-corrected) into the active take.
8. Markers render as ticks on a timeline strip below the iframe. The current playback position renders as a moving caret.
9. User can record additional takes against the same track. Takes can be merged via median-snap to a tempo grid.
10. Click any tick to select. Selected ticks can be nudged with arrow keys (10 ms per press, 1 ms with shift held) or deleted with the delete key.
11. The "click track" toggle plays a Web Audio API click at every marker during playback, scheduled using the interpolated playback position. This is the primary verification mechanism: if the clicks land on the beats by ear, the labels are good.
12. Save persists the active take to SQLite keyed by Spotify track ID. The save action is explicit, not automatic.

## Time Interpolation

This is the most important section. Get it right and everything else works. Get it wrong and beat positions drift unrecoverably.

The Spotify iFrame API exposes a `playback_update` event roughly once per second with `position` (ms), `duration` (ms), `isPaused` (bool), and `isBuffering` (bool). One-second resolution is too coarse to record beat timestamps directly. The app interpolates between events using local wall-clock time.

State to maintain:

```ts
type PlaybackAnchor = {
  positionMs: number;       // from the most recent playback_update
  wallClockMs: number;      // performance.now() at the time of that update
  isPlaying: boolean;       // true when not paused and not buffering
  durationMs: number;
};
```

On every `playback_update`, replace the anchor:

```
positionMs   = e.data.position
wallClockMs  = performance.now()
isPlaying    = !e.data.isPaused && !e.data.isBuffering
durationMs   = e.data.duration
```

To compute the current playback position at any moment:

```
if (!isPlaying) return positionMs
return positionMs + (performance.now() - wallClockMs)
```

To record a beat tap:

1. In the spacebar `keydown` handler, capture `performance.now()` on the first line of the handler.
2. Compute `interpolatedMs = positionMs + (capturedTime - wallClockMs)`.
3. Subtract `calibrationOffsetMs`.
4. Convert to seconds and push onto the active take.
5. Re-render, network calls, anything else, all happen after step 4.

Edge cases the implementation must handle:

- User scrubs the iframe. The next `playback_update` will give a discontinuous position. Treat as a re-anchor; do not reconcile with the previous interpolation. Any tap that occurred between the seek and the next anchor must be discarded with a warning toast, because there is no way to know which side of the seek the tap belongs to.
- Buffering. `isBuffering` true means position is not advancing. Treat as paused for interpolation.
- Tab loses focus. `performance.now()` continues, but `requestAnimationFrame` pauses. Tap recording on `keydown` still works. The click-track scheduler may stall; restart it on focus.

## Latency Calibration

Calibration measures human reaction time, which is independent of the playback source. The metronome is generated by Web Audio API for sample-accurate clicks.

1. Play a Web Audio metronome at exactly 100 BPM for 16 beats. Visual pulse synchronized for accessibility.
2. User taps the spacebar along with the clicks.
3. Discard the first 2 taps as warm-up. If fewer than 6 taps remain, prompt to redo.
4. For each remaining tap, find the nearest expected click time and compute the offset.
5. Compute the median offset and the standard deviation.
6. If SD > 80 ms or median > 350 ms, warn and prompt to redo.
7. Persist the offset in `sessionStorage`. Display it in the UI as a number with one decimal place in milliseconds.

Every recorded beat tap subtracts this offset before storage. Store the offset on each take record so future analysis can recover the raw taps.

## Tempo Inference and Grid Snapping

Once a take has at least 8 markers, compute estimated BPM from the median inter-onset interval and display it. After 16 markers, also display the standard deviation.

Provide a "snap to grid" action that:

1. Fits the best constant-tempo grid through the markers using least squares (free parameters: BPM and phase offset).
2. Shows residual offsets per marker before committing.
3. On accept, replaces marker times with snapped times. On reject, no change.

Snap is opt-in and destructive. The user must confirm via `AlertDialog`.

## Storage Schema (Prisma)

```prisma
model Track {
  spotifyId   String   @id
  name        String
  artist      String
  album       String?
  durationMs  Int
  firstSeenAt DateTime @default(now())
  takes       Take[]
}

model Take {
  id                  Int      @id @default(autoincrement())
  trackId             String
  track               Track    @relation(fields: [trackId], references: [spotifyId])
  granularity         String   // 'all_beats' | 'downbeats' | 'onsets'
  source              String   // 'tap' | 'merged'
  calibrationOffsetMs Float?
  notes               String?
  createdAt           DateTime @default(now())
  markers             Marker[]
}

model Marker {
  id          Int    @id @default(autoincrement())
  takeId      Int
  take        Take   @relation(fields: [takeId], references: [id], onDelete: Cascade)
  timeSeconds Float
  kind        String // 'tap' | 'snapped' | 'manual_edit'
  confidence  Float?
}
```

A track can have many takes. A take has many markers. Deleting a take cascades to its markers. The "active" or "canonical" take per track is the most recent take with `source = 'merged'`, falling back to the most recent take of any source.

There is no `auto` source value because no automatic beat detection runs.

## API Routes

- `GET /api/spotify/search?q=...&limit=10` - Server-side proxy to Spotify Search. Caches the Client Credentials token in memory until expiry. Returns a normalized track list.
- `GET /api/spotify/track/{id}` - Server-side proxy to Get Track. Used to populate the Track row when a user picks a search result.
- `GET /api/labels/{spotifyTrackId}` - Returns all takes and markers for the track.
- `POST /api/labels/{spotifyTrackId}/takes` - Creates a new take with markers.
- `DELETE /api/labels/takes/{takeId}` - Deletes a take and cascades to its markers.
- `PATCH /api/labels/markers/{markerId}` - Updates a marker's time.
- `DELETE /api/labels/markers/{markerId}` - Deletes a marker.
- `POST /api/labels/{spotifyTrackId}/merge` - Server-side merge of multiple takes into a `merged` take. Inputs: list of take IDs and an optional target BPM. Output: new take ID.

## UI Component Map (shadcn)

- Search input: `Input` with a debounce hook
- Search results: stack of `Card`, each with cover art and a `Badge` for duration
- Calibration dialog: `Dialog` (modal, blocking)
- Track player section: `Card` containing the iframe and a custom timeline strip
- Granularity picker: `Tabs`
- Click track toggle: `Switch` plus `Slider` for click volume
- Take list: `Tabs` with one tab per take
- Keyboard shortcuts panel: `Sheet`
- Snap-to-grid and merge confirmation: `AlertDialog`
- Save and delete feedback: `Toast`

## Out of Scope for v1

- Local audio file upload. Spotify only.
- Audio analysis of any kind. No automatic beat detection, no waveform display.
- Multi-user features, accounts, cloud sync.
- Hosted deployment. Localhost only.
- Mobile or touch support.
- Variable-tempo grid snapping (constant tempo only).
- Export to common annotation formats (JAMS, MIREX, etc.). Add later if needed.

## Acceptance Criteria

The app is done when all of these pass:

1. Searching "Bohemian Rhapsody" returns results within 1 second and shows track name, artist, album art, and duration.
2. Clicking a result loads the Spotify iframe and any existing labels render on the timeline within 1 second.
3. After calibration, tapping along to the first verse on the spacebar records markers visible on the timeline as the song plays.
4. Closing the browser, reopening, searching the same song, and clicking it restores all my previous markers.
5. With the click track enabled, the audible clicks land on the beats I labeled, confirmed by ear, on at least three different songs.
6. I can click a single marker, nudge it 30 ms forward with the arrow key, save, reload, and the change persists.
7. After tapping at least 8 beats, the displayed BPM is within 5 percent of the true tempo for songs in the 80 to 180 BPM range. (The 5 percent tolerance is more lenient than what local-audio playback could achieve, because the iframe's 1 Hz position update adds noise.)
8. Calibration runs in under 30 seconds and reports a numeric offset in milliseconds.
9. The README states the Premium-account requirement in its first paragraph.

## Build Order

Build in this order. Do not start step N until step N minus one works end to end and is committed.

1. Next.js + Tailwind + shadcn/ui scaffold. Single page with placeholder sections.
2. `.env.local` setup and `/api/spotify/search` route using Client Credentials. Verify search results return correctly.
3. Search UI with debounced input and results list using `Card`.
4. Spotify iFrame API loaded via the Next.js `Script` component. Click a result, iframe plays.
5. `useSpotifyPlayback` hook that maintains the playback anchor and returns the current interpolated position. Verify by displaying it as a counter that updates smoothly during playback.
6. Spacebar tap recording into an in-memory active take. No latency correction yet. Markers render as ticks on a custom timeline strip.
7. Calibration dialog with Web Audio metronome. Persist the offset to `sessionStorage` and apply it to subsequent taps.
8. Prisma schema and migration. `/api/labels/*` routes. Save and load takes through the API.
9. Per-marker click-to-select, arrow-key nudge, delete-key removal. Persist edits.
10. Click track using the Web Audio scheduler pattern (25 ms lookahead loop), driven by the interpolated playback position.
11. Tempo inference display. Constant-tempo grid snap with preview-then-commit.
12. Multi-take support: list takes per track, switch active take, merge with median-snap to grid.
13. README with setup steps, Premium requirement up front, and architecture overview.

## Implementation Notes

These are non-negotiable timing details. Get them wrong and the rest of the app feels broken.

- In the spacebar `keydown` handler, capture `performance.now()` on the first line, before any other code runs. Compute the interpolated position next, then push to the take. Anything else (rendering, network calls) goes on a `requestAnimationFrame` or microtask after the timestamp is locked.
- For the click track, use the Web Audio scheduling pattern: a `setInterval` running every 25 ms that schedules every click whose interpolated position falls within the next 100 ms via `oscillator.start(audioContext.currentTime + leadSeconds)`, where `leadSeconds = (clickPositionMs - currentInterpolatedMs) / 1000`. Reference Chris Wilson's "A Tale of Two Clocks" article for the pattern.
- The Spotify iframe runs in a separate process with no audio buffer access. Click track alignment is only as good as the interpolation. Tell the user to expect 50 to 150 ms of irreducible jitter on top of their calibrated reaction time.
- Render the timeline once per track load. On marker changes, only redraw the marker overlay and the playhead caret. Do not redraw the full timeline on every animation frame.
- Cache the Client Credentials token on the server and refresh on expiry (token TTL is 3600 seconds). Do not request a new token on every search call.
- The Spotify search endpoint may rate-limit. On 429, show a toast and back off with exponential delay. Do not retry silently in a tight loop.
- Spotify track IDs are the canonical key. Do not invent your own IDs.
- Units: Spotify and `performance.now()` use milliseconds. Prisma stores `timeSeconds` as a float. Convert at exactly one boundary, on write to and read from the database.

## Anti-Goals

Things to actively not do:

- Do not auto-snap markers to a grid. The user opts in.
- Do not silently drop "outlier" taps. Show them and let the user decide.
- Do not use a JavaScript animation loop or `setInterval` to record tap times. Capture in the keydown handler directly.
- Do not store the Spotify Client Secret in the frontend bundle. It belongs in API routes only, read from `process.env`.
- Do not attempt to bypass the 30-second preview limit for non-Premium users. There is no clean way and Spotify will revoke the app.
- Do not attempt to read or analyze the iframe's audio output. The iframe is sandboxed, and any approach that gets around that is fragile and likely violates Spotify's terms.
- Do not add user accounts, sharing, or any networked feature. This is a personal labeling tool.
- Do not include automatic beat detection. The whole point of this app is human labeling.
