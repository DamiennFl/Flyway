# Project Map

## Purpose
Flyway shows bird migration patterns over time and space, built on historical eBird
observation data (via GBIF). Users pick a species and explore recent sightings or
historical patterns (seasonal share of reports, arrival/departure waves, era-to-era
comparison).

## Requirements
[Not yet discussed with the learner — inferred from code only, not confirmed as
product requirements.]

## Components
- `src/App.jsx` — top-level state and view orchestration (species selection, view
  mode, "lens" — all/week/compare/wave, era selection, play/pause).
- `src/api/ebird.js` — fetches recent (last 30 days) sightings from the live eBird API.
- `src/api/historical.js` — fetches pre-built historical JSON (species index, meta,
  per-species historical data, weekly data, effort data, fine-grained effort data).
- `src/lib/historical.js`, `season.js`, `fineField.js`, `compare.js`, `wave.js` —
  pure data transforms: cell aggregation, effort-normalized seasonal share,
  interpolation to a finer grid, era comparison, arrival/departure wave detection.
- `src/lib/ageScale.js`, `densityScale.js`, `palettes.js` — color/legend scales.
- `src/components/MigrationMap.jsx` — MapLibre map rendering sightings/cells.
- `src/components/SpeciesSelect.jsx`, `SeasonPanel.jsx`, `Legend.jsx` — UI controls.
- `src/components/TopBar.jsx` — top-right bar with two independent toggles:
  sidebar visibility and the Trends overlay.
- `src/components/TrendsPanel.jsx` — draggable overlay showing one species'
  yearly report trend, first/last recorded year, and top reporting countries.
  Has its own `SpeciesSelect` bound to the same top-level `speciesCode` as the
  sidebar, and its own React Query call (`['trends', speciesCode]`) fetching
  `species/{code}.json.gz` independently of the `weekly` query.
- `vite.config.js` — dev server; serves `data-build/publish` at `/data` locally,
  mimicking production static-file headers (gzip JSON).
- `pipeline/build_tables.py`, `build_range.py`, `build_effort.py`,
  `build_effort_fine.py` — DuckDB-based aggregation steps producing parquet tables
  in `data-build/full` from raw eBird/GBIF data (not yet inspected in detail).
- `pipeline/build_publish.py` — reads the aggregated parquet tables, matches eBird
  names to current eBird taxonomy, and writes the static files the app loads:
  `index.json.gz` (species list), `meta.json` (eras, format, source/license),
  `species/{code}.json.gz` (one gzipped JSON per species: era/week/lat/lng/n arrays
  plus yearly totals and top countries).
- `data-build/` — pipeline working data: `sample/` and `full/` (parquet + DuckDB
  files), `publish/` (built static output consumed by the frontend), gitignored.

## Main Flow
Raw eBird/GBIF data → DuckDB aggregation (`pipeline/build_tables.py` and related,
unverified in detail) → parquet tables in `data-build/full` → `build_publish.py`
→ gzipped static JSON in `data-build/publish/` (index, meta, per-species files)
→ served at `/data` (locally via Vite middleware; in production presumably a static
host — not yet verified) → `src/api/historical.js` fetches these → `src/lib/*`
transforms → `App.jsx` state → `MigrationMap.jsx` renders on MapLibre.
Separately: recent (last 30 days) view bypasses the pipeline entirely, calling the
live eBird API directly via `src/api/ebird.js`.

## Data and Trust Boundaries
- Live eBird API: called client-side using `VITE_EBIRD_API_KEY` from `.env` — this
  key is bundled into the client build and thus public; not a server-side secret.
- Historical static data: pre-built, gzipped JSON files, no auth, read-only.
- Data pipeline: Python/DuckDB, run offline/locally (not run in CI as far as
  verified — no CI config found in the repo).
- Production hosting/deployment: unknown — a comment in `vite.config.js` mentions
  "Azure" headers, but no deployment config (e.g. GitHub Actions, Azure Static Web
  Apps config) was found in the repo.

## Build and Deployment
- `npm run dev` — Vite dev server (serves `data-build/publish` at `/data`).
- `npm run build` / `npm run preview` — production build / preview (from
  `package.json`).
- `python pipeline/build_publish.py --data data-build/full --out data-build/publish`
  — regenerates the static data the frontend consumes.
- Deployment target/process: unknown (see Unknowns).

## Unknowns
- Exact logic of `build_tables.py`, `build_range.py`, `build_effort.py`,
  `build_effort_fine.py` (how raw data becomes the aggregated parquet tables).
- Production deployment target/process (Azure mentioned in a comment, unconfirmed).
- Product-level requirements/goals beyond what's inferable from the UI code.
