# Flyway
## Bird and Migration Data Visualization

<img width="1916" height="942" alt="image" src="https://github.com/user-attachments/assets/b1ad3517-b10c-44ae-98f6-42cf525c63e6" />


## Scope

Flyway is an interactive map for exploring where birds are and how that has changed over time, for more than 10,000 species. For any species you can see its sightings from the last 30 days, its historical range, how its presence shifts week by week, when it arrives and departs, and how its distribution has changed between eras from before 2000 to 2020-2024. A separate view maps birding effort itself, meaning where and when people go birding at all.

## Data

The historical data is the [eBird Observation Dataset](https://doi.org/10.15468/aomfnb) from the Cornell Lab of Ornithology (CC BY 4.0), read from the GBIF open-data snapshot on AWS S3 (snapshot 2026-09-01, covering through 2024). It holds about 1.69 billion records across 10,761 species. The snapshot is queried in place with DuckDB, 200 Parquet files at a time, with each batch committed separately so an interrupted run resumes where it stopped. Records with invalid coordinates or dates, or with GBIF's coordinate-quality flags, are dropped. The rest are keyed by eBird's own scientific name (GBIF's taxonomy lumps some eBird species together), matched to eBird's current taxonomy, and aggregated by species, era, week of year, map cell and country. The last 30 days of sightings are not in this dataset. They come live from the eBird API.

**Important Note about the data:** The data reflects where people birdwatch, not where birds are. eBird records come from volunteers, so coverage is dense in North America and Europe, around cities, roads, parks and well-known hotspots, and thin in remote areas, the open ocean, and much of Africa, Central Asia and the tropics. A blank square on the map usually means nobody looked, not that the species is absent. Coverage is also uneven in time. Participation has grown enormously, so recent eras have far more records than older ones. Birders also go out more in spring migration and on weekends, and they report conspicuous, easily identified species more often than secretive ones. Each count is a record (a species on a checklist), not an individual bird. To reduce these biases, the app divides a species' records by all species' records in the same cell and week, so it shows share of reports instead of raw counts. It also leaves out cells and weeks that have too little data to trust. This only corrects for bias. It cannot recover data where there was none.

## Pipeline algorithms

The scripts in `pipeline/` run offline and write the static files the app loads.

- `build_tables.py` streams the GBIF snapshot from S3, filters it, rounds each record to a 0.5° cell, week of year and era, and aggregates it into Parquet tables.
- `build_publish.py` matches eBird names to the current eBird taxonomy and writes one gzipped weekly file per species (era, week, cell and country counts), plus the species index and metadata.
- `build_range.py` re-reads the snapshot to build per-species range files with no weeks, at 0.25° or 0.1° cells depending on `--scale`. The app uses the 0.1° layer for its detailed maps.
- `build_effort.py` sums all-species records per 0.5° cell by week and by era to make the baseline that species counts are divided by.
- `build_effort_fine.py` makes the same all-species baseline at 0.1° per era, for the compare view.
- `build_country_effort.py` assigns each cell to its dominant country and totals all-species records by country and week, so countries can be compared fairly.
- `build_countries.py` inverts the species-by-country table into one file per country, so species can be filtered by country.

## Backend

The only live endpoint is `/api/flyway/recent/<region>/<species>/`, a small Django view on damienf.com that calls the eBird API with a server-side key and returns the last 30 days of sightings. In development, the Vite dev server answers the same address by calling eBird with the key from `.env`, and it serves the local data files with the same gzip headers they need in production. Otherwise, all data files are stored in Azure blob storage and queried directly by Javascript functions in `src/lib/`.

## Frontend

The frontend is a React 19 app built with Vite. It draws a MapLibre basemap through `react-map-gl` and fetches and caches data with TanStack Query. A species can be shown as recent sightings (dots colored by age), as all-year density, as a weekly animation with a play button, as era-to-era change, or as an arrival and departure migration wave. A trends panel adds yearly counts, a country breakdown, a flyway chart and a best-time-and-place suggestion. The calculations (effort correction, interpolation from 0.5° to 0.1° cells, wave detection, era comparison) are plain functions in `src/lib/`, each with Vitest tests.

## Deployment

Flyway is built with `npm run build` into a static bundle and hosted on damienf.com, with the Django view providing the recent-sightings endpoint. The data files are uploaded separately to Azure with a local script (not tracked in git). They are served as `application/json` with `Content-Encoding: gzip`, and the app finds them through `VITE_DATA_BASE_URL`. That variable defaults to `/data` for local development. MapLibre's worker is bundled with the app so the production build can start the map. It is possible to run this locally, I won't make a writeup to explain how though :).
