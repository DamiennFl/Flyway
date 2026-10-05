# Learning Progress

## Trends panel feature

### Introduced
- How React Query caches by `queryKey`, and that two queries pointed at the same
  endpoint with different keys both fetch independently.
- Where historical species data actually lives: `history` (lens `all`/`compare`)
  reads `range-fine/{code}.json.gz` (era/lat/lng/n, no weeks); `weekly` (lens
  `week`/`wave`) reads `species/{code}.json.gz`, which also carries `years` and
  `countries` — the fields the trend chart needs.

### Demonstrated understanding / reasoning
- Chose a dedicated fetch for the new panel instead of broadening the existing
  `weekly` query's `enabled` condition, reasoning that the panel isn't guaranteed
  to be open — correctly identifying this decouples the panel's data lifecycle
  from the week/wave lens UI state.
- Accepted the tradeoff that this means a second request to the same
  `species/{code}.json.gz` endpoint (different `queryKey`) if both the panel and
  week/wave lens are used for the same species in one session, in exchange for
  not coupling the two features.
- Chose to share `speciesCode` between the sidebar and the new panel (rather than
  an independent selection), reasoning that if picking a species is going to
  update the map anyway, it may as well update the sidebar too — flagged as
  possibly worth splitting later, not a final decision.
- Decided any `speciesCode` change resets `view` to `'recent'`, reasoning that
  reaching historical view already requires an explicit extra click today, so
  this doesn't remove a step, just avoids an unwanted historical load by default.
- Resolved where species selection happens if the sidebar is hidden: put a second
  `SpeciesSelect` instance inside the trends overlay, bound to the same shared
  `speciesCode`, so either picker updates the map/sidebar/panel consistently.

### Implemented
- `src/components/TopBar.jsx`, `src/components/TrendsPanel.jsx` (new), wired into
  `App.jsx` with `sidebarOpen`/`trendsOpen` state and a `speciesCode` effect that
  resets `view` to `'recent'`. Styled in `index.css` matching existing conventions
  (no new dependencies: drag via plain pointer events, chart via inline SVG like
  `SeasonPanel`).
- Verified in a real browser (Playwright, dev server on :5183): topbar toggles work
  independently, trends overlay shows shared-state species select, yearly bar
  chart, first/last recorded, country list; header drag works; picking a species
  in the overlay updates the sidebar and resets to the recent view. No console
  errors. (Map tiles render blank in this headless run — confirmed pre-existing,
  unrelated to this change, present before any interaction too; rendered fine on
  a later run, likely just load timing.)

### Bug fixes (same session)
- Overlap: default panel position was the same corner as the sidebar; moved to
  sit to its right.
- No graph: root cause was a fixed-width SVG viewBox combined with a
  dynamically-sized bar width — for species with many recorded years (166 for
  American Robin, 1802-2024) this overflowed the viewBox and got clipped by
  SVG's default `overflow: hidden`, leaving only tiny, low-value bars visible.
  Fixed by switching to `SeasonPanel`'s proven pattern: fixed bar width, dynamic
  viewBox sized to the data, scaled by CSS. Flagged as still visually dense for
  long-history species (166 columns in a ~250px panel) — not re-raised as a new
  design question yet, just noted.
- Close button not clickable: the button sits inside the draggable header, whose
  `onPointerDown` captures the pointer before the click could reach the button.
  Fixed with `stopPropagation` on the button's own `onPointerDown`.
- Verified all three fixes in a real browser (Playwright): no overlap, 22 of 166
  bars render above minimum height (max height 56, matching the chart's full
  scale), and the close button now actually closes the panel.
