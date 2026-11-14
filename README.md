# Spotify Mapped

A local app for reading your own Spotify data export — the complete play log plus
the summaries that are actually worth looking at.

Built around one idea: **the all-time history is the product.** Spotify shows you
Wrapped once a year and 50 recently-played items. This shows you every single play,
searchable, from the day the account was created.

## Running it

```bash
npm install && npm run dev
```

`npm run dev` is just a shortcut for `vite` — it starts a local dev server that
live-reloads while you edit. Open the URL it prints, then **drop your Spotify export
onto the page**: the zip exactly as Spotify emails it, the folder you unpacked it to,
or loose JSON files. That's the whole setup.

For everyday use, build it once instead:

```bash
npm run build   # -> dist/, three files, ~220 KB
npx serve dist  # then open the URL it prints
```

`dist/` is a plain static site you can host anywhere. It does need to be *served* over
http rather than opened straight off disk — the bundle is an ES module, and browsers
refuse to load those over `file://`, so double-clicking `dist/index.html` shows a
blank page.

## Dependencies

Eight direct packages, 41 in total. `react` and `react-dom` render the UI; `vite`,
`typescript` and the type packages are build tooling that never ships. The only
runtime library doing real work is **fflate**, which unzips your export in the
browser.

There is deliberately no chart library, component kit, CSS framework or virtualisation
library — the SVG charts, the windowed history list, the export parser and the styles
are all written for this project. The app makes **no network requests of any kind**:
no analytics, no CDN, no backend.

## Getting your data from Spotify

1. Go to `spotify.com/account/privacy` while signed in.
2. Tick **Extended streaming history**. The default "Account data" option only covers
   about the last year — the extended one goes back to the day you joined. Ticking
   both is fine.
3. Confirm the email Spotify sends. Account data arrives in a few days; extended
   history can take up to 30.
4. Drop the zip they email you onto the page.

The app reads these if it finds them, and ignores everything else in the export
(the technical log folder is tens of megabytes of telemetry nobody needs):

- `Spotify Extended Streaming History/Streaming_History_*.json` — the play log
- `Spotify Account Data/` — profile, library, playlists, searches

If only the basic `StreamingHistory_*.json` files are present, it falls back to those
and tells you what you're missing.

### Where the data lives

Parsing happens in the browser tab. The result is stored in IndexedDB on your own
machine, so you import once and it's there on every later visit. Nothing is uploaded
— the app has no backend to upload it to. **Import new export** re-reads a fresh
download; **Forget** wipes it from the device. Both are in the sidebar footer.

### What the importer does

- **Deduplicates.** The export ships overlapping year files — the 2025 file contains
  2024 rows — so some plays appear twice. Identity is timestamp + item + duration.
- **Interns strings.** Track, artist and show names are stored once and referenced by
  index, which takes a ~4.5 MB export down to about 550 KB.
- **Packs flags into bits.** Skipped / shuffle / offline / incognito become one integer.

## The five views

| View | What it answers |
|---|---|
| **Overview** | How much, since when, what kind, who — plus first play, biggest day, longest session and longest streak |
| **All-time history** | Every play, newest first, each with its own full date and time. Search by track, episode, artist, show or album; filter by type, year, length, and skipped |
| **Top charts** | Artists, tracks, albums, shows and episodes ranked by time listened, all-time or per year |
| **Habits** | Weekday × hour heatmap, hour-of-day, device, how plays start and end, connection country |
| **By year** | Your own Wrapped, for every year at once |

Clicking any artist or show opens a drill-down: their share of your listening, first
and last play, and their ranked tracks or episodes.

## Notes on the numbers

- **Times are local.** Timestamps in the export are UTC; every hour, day and heatmap
  cell is converted to your machine's timezone, which is what makes "peak hour" mean
  anything.
- **Ranking is by time listened**, not play count, except where a heading says
  "most played" — a 40-minute episode and a 30-second skip are not the same event.
- **Skip rate counts Spotify's own `skipped` flag**, which fires whenever a track is
  left before the end — including 40 minutes into a podcast — so it runs high. **Hide
  skipped** in the history view drops those rows; **Only skips** inverts it.
- **Podcasts are first-class** — for many people they are most of their listening — so podcasts and shows
  are first-class throughout rather than a tab bolted onto a music app.

## Design

Chart colours are the validated categorical palette (blue / orange / aqua), checked for
colour-vision separation against both the light and dark surfaces the app renders on.
Light and dark are separately chosen sets, not an automatic inversion; the toggle lives
at the bottom of the sidebar and persists. Every ranked list is a table with visible
values, so nothing depends on colour alone.

## Layout

```
src/lib/ingest.ts        export files -> packed dataset (zip, folder or loose json)
src/lib/store.ts         IndexedDB persistence
src/lib/data.ts          decode the packed dataset into play objects
src/lib/stats.ts         all aggregation (pure, memoised)
src/lib/format.ts        durations, dates, labels
src/components/          charts, virtualised history list, drawer
src/views/               the import screen and the five views
```

The history list renders only the visible slice of rows, so tens of thousands of plays — or ten times
that — scroll without lag.
