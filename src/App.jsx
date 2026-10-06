import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSpeciesObservations, speciesUrl } from './api/ebird.js'
import {
  getEffort,
  getEffortFine,
  getHistoricalSpecies,
  getMeta,
  getSpeciesIndex,
  getWeeklySpecies,
} from './api/historical.js'
import { aggregateCells, filterByCountry } from './lib/historical.js'
import { buildEffortIndex, buildSpeciesSeason, effortCellsForWeek, regionSeries, weekLabel, WEEKS } from './lib/season.js'
import { buildInterpolation, waveCellsFine, weekCellsFine } from './lib/fineField.js'
import { buildEraCounts, compareEras } from './lib/compare.js'
import { buildWave } from './lib/wave.js'
import MigrationMap from './components/MigrationMap.jsx'
import SpeciesSelect from './components/SpeciesSelect.jsx'
import SeasonPanel from './components/SeasonPanel.jsx'
import Legend from './components/Legend.jsx'
import TopBar from './components/TopBar.jsx'
import TrendsPanel from './components/TrendsPanel.jsx'
import { countryName } from './lib/countries.js'

const DEFAULT_REGION = 'US'
const MAX_RESULTS = 10000
const PLAY_INTERVAL_MS = 350

const LENSES = [
  ['all', 'All year'],
  ['week', 'Weekly'],
  ['compare', 'Compare'],
  ['wave', 'Migration'],
]

const SMOOTHING_NOTE =
  'Squares show where the species has been reported (0.1°); their colors are smoothed from 0.5° weekly data. '

const NOTES = {
  all: 'Counts reflect where people bird, not just where birds are. ',
  week:
    SMOOTHING_NOTE +
    'Share of reports is this species’ records divided by all species’ records in the same cell and week, which corrects for where and when people bird. ',
  compare:
    'Each cell compares the species’ share of all reports in two periods. Cells without enough data in both periods are left blank. ',
  wave:
    SMOOTHING_NOTE +
    'Colors show the first (arrival) or last (departure) week when the species’ share of reports is at least half its yearly peak. ',
}

const EFFORT_NOTE =
  'This is where and when people go birding, not where birds actually are. Every species view on this ' +
  'map divides by this same baseline to correct for it. '

export default function App() {
  const [speciesCode, setSpeciesCode] = useState('')
  const [view, setView] = useState('recent')
  const [lens, setLens] = useState('all')
  const [eraId, setEraId] = useState(null)
  const [fromEra, setFromEra] = useState(1)
  const [toEra, setToEra] = useState(4)
  const [waveKind, setWaveKind] = useState('arrival')
  const [week, setWeek] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [bounds, setBounds] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [trendsOpen, setTrendsOpen] = useState(false)
  const [countryFilter, setCountryFilter] = useState(null)

  const index = useQuery({ queryKey: ['species-index'], queryFn: getSpeciesIndex, staleTime: Infinity })
  const meta = useQuery({ queryKey: ['meta'], queryFn: getMeta, staleTime: Infinity })

  useEffect(() => {
    setView('recent')
  }, [speciesCode])

  const showingHistory = view === 'historical'
  const showingEffort = view === 'effort'
  const showingRecent = view === 'recent'
  const needsWeekly = showingHistory && (lens === 'week' || lens === 'wave') && Boolean(speciesCode)
  const needsFine = showingHistory && lens === 'compare' && Boolean(speciesCode)
  const slider = lens === 'week' || lens === 'wave'
  const showSlider = (showingHistory && speciesCode && slider) || showingEffort
  const region = countryFilter ?? DEFAULT_REGION

  const sightings = useQuery({
    queryKey: ['species', region, speciesCode],
    queryFn: () => getSpeciesObservations(speciesCode, region),
    enabled: showingRecent && Boolean(speciesCode),
  })

  const history = useQuery({
    queryKey: ['historical', speciesCode],
    queryFn: () => getHistoricalSpecies(speciesCode),
    enabled: showingHistory && Boolean(speciesCode),
    staleTime: Infinity,
  })

  const weekly = useQuery({
    queryKey: ['weekly', speciesCode],
    queryFn: () => getWeeklySpecies(speciesCode),
    enabled: needsWeekly,
    staleTime: Infinity,
  })

  const effort = useQuery({
    queryKey: ['effort'],
    queryFn: getEffort,
    enabled: needsWeekly || showingEffort,
    staleTime: Infinity,
  })
  const effortFine = useQuery({ queryKey: ['effort-fine'], queryFn: getEffortFine, enabled: needsFine, staleTime: Infinity })

  const historyData = useMemo(() => filterByCountry(history.data, countryFilter), [history.data, countryFilter])
  const weeklyData = useMemo(() => filterByCountry(weekly.data, countryFilter), [weekly.data, countryFilter])

  const aggregated = useMemo(
    () => (historyData ? aggregateCells(historyData, eraId) : { cells: [], total: 0, cellSize: 0.1 }),
    [historyData, eraId],
  )
  const fineAll = useMemo(() => (historyData ? aggregateCells(historyData, null) : null), [historyData])

  const effortCells = useMemo(
    () => (showingEffort && effort.data ? effortCellsForWeek(effort.data, week) : null),
    [showingEffort, effort.data, week],
  )
  const effortIndex = useMemo(() => (effort.data ? buildEffortIndex(effort.data) : null), [effort.data])
  const fineIndex = useMemo(() => (effortFine.data ? buildEffortIndex(effortFine.data) : null), [effortFine.data])
  const interp = useMemo(
    () => (fineAll && effortIndex ? buildInterpolation(fineAll.cells, effortIndex) : null),
    [fineAll, effortIndex],
  )
  const ready = needsWeekly && Boolean(weeklyData && effortIndex && interp)
  const compareReady = needsFine && Boolean(historyData && fineIndex)

  const season = useMemo(
    () => (weeklyData && effortIndex ? buildSpeciesSeason(weeklyData, effortIndex) : null),
    [weeklyData, effortIndex],
  )
  const eraCounts = useMemo(
    () => (compareReady ? buildEraCounts(historyData, fineIndex) : null),
    [compareReady, historyData, fineIndex],
  )
  const wave = useMemo(() => (lens === 'wave' && season ? buildWave(season, effortIndex) : null), [lens, season, effortIndex])

  const weekCellList = useMemo(
    () => (lens === 'week' && season && interp ? weekCellsFine(season, effortIndex, interp, fineAll.cells, week) : []),
    [lens, season, effortIndex, interp, fineAll, week],
  )
  const comparison = useMemo(
    () => (eraCounts && fromEra !== toEra ? compareEras(eraCounts, fineIndex, fromEra, toEra) : null),
    [eraCounts, fineIndex, fromEra, toEra],
  )
  const waveCellList = useMemo(
    () => (wave && interp ? waveCellsFine(wave, interp, fineAll.cells, week, waveKind) : []),
    [wave, interp, fineAll, week, waveKind],
  )
  const series = useMemo(
    () => (slider && season && bounds ? regionSeries(season, effortIndex, bounds) : null),
    [slider, season, effortIndex, bounds],
  )

  useEffect(() => {
    if (!playing || !showSlider || (!showingEffort && !season)) return
    const id = setInterval(() => setWeek((w) => (w % WEEKS) + 1), PLAY_INTERVAL_MS)
    return () => clearInterval(id)
  }, [playing, showSlider, showingEffort, season])

  let displayCells = aggregated.cells
  let displayCellSize = aggregated.cellSize
  let palette = 'density'
  let legendMode = 'historical'
  if (ready) {
    displayCellSize = fineAll.cellSize
    if (lens === 'week') [displayCells, legendMode] = [weekCellList, 'season']
    if (lens === 'wave') [displayCells, palette, legendMode] = [waveCellList, 'wave', 'wave']
  }
  if (compareReady) [displayCells, displayCellSize, palette, legendMode] = [comparison?.cells ?? [], fineIndex.cell, 'diverging', 'compare']
  if (showingRecent) legendMode = 'recent'
  if (showingEffort) [displayCells, displayCellSize, palette, legendMode] = [effortCells?.cells ?? [], effortCells?.cellSize ?? 0.5, 'density', 'effort']

  const recentPoints = sightings.data ?? []
  const hasPoints = showingRecent ? recentPoints.length > 0 : displayCells.length > 0
  const eras = meta.data?.eras ?? []
  const eraLabel = (id) => eras.find((e) => e.id === id)?.label
  const loadError = weekly.error ?? effort.error ?? effortFine.error

  function chooseLens(next) {
    setLens(next)
    setPlaying(false)
  }

  return (
    <div className="app">
      <TopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        trendsOpen={trendsOpen}
        onToggleTrends={() => setTrendsOpen((o) => !o)}
      />
      {sidebarOpen && (
      <aside className="panel">
        <h1>Flyway</h1>
        {<p>Bird historical data and migration patterns.</p>}

        <button type="button" className="action" onClick={() => setView(showingEffort ? 'recent' : 'effort')}>
          {showingEffort ? 'Back to species view' : 'Show birding effort'}
        </button>

        <SpeciesSelect
          species={index.data ?? []}
          value={speciesCode}
          onChange={setSpeciesCode}
          disabled={index.isLoading || index.isError}
          countryFilter={countryFilter}
          onCountryFilterChange={setCountryFilter}
        />

        {speciesCode && (
          <a className="ebird-link" href={speciesUrl(speciesCode)} target="_blank" rel="noopener noreferrer">
            View on eBird ↗
          </a>
        )}

        {speciesCode && !showingEffort && (
          <button type="button" className="action" onClick={() => setView(showingHistory ? 'recent' : 'historical')}>
            {showingHistory ? 'Back to last 30 days' : 'Show historical data'}
          </button>
        )}

        {showingHistory && speciesCode && (
          <div className="segmented">
            {LENSES.map(([id, label]) => (
              <button key={id} type="button" className={lens === id ? 'active' : ''} onClick={() => chooseLens(id)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {showingHistory && speciesCode && lens === 'all' && meta.data && (
          <div className="eras">
            {[{ id: null, label: 'All years' }, ...eras].map((era) => (
              <button
                key={era.label}
                type="button"
                className={`era${eraId === era.id ? ' active' : ''}`}
                onClick={() => setEraId(era.id)}
              >
                {era.label}
              </button>
            ))}
          </div>
        )}

        {showingHistory && speciesCode && lens === 'compare' && (
          <div className="compare">
            <label>
              From
              <select value={fromEra} onChange={(e) => setFromEra(Number(e.target.value))}>
                {eras.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To
              <select value={toEra} onChange={(e) => setToEra(Number(e.target.value))}>
                {eras.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {showingHistory && speciesCode && lens === 'wave' && (
          <div className="segmented small">
            {['arrival', 'departure'].map((kind) => (
              <button key={kind} type="button" className={waveKind === kind ? 'active' : ''} onClick={() => setWaveKind(kind)}>
                {kind === 'arrival' ? 'Arrival' : 'Departure'}
              </button>
            ))}
          </div>
        )}

        {showSlider && (
          <SeasonPanel
            week={week}
            onWeek={setWeek}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            series={showingEffort ? null : series}
            loading={showingEffort ? effort.isLoading : !season}
          />
        )}

        <div className="status">
          {index.isLoading && 'Loading species…'}
          {index.isError && <span className="error">{index.error.message}</span>}
          {index.data && `${index.data.length.toLocaleString()} species`}

          {showingRecent && speciesCode && sightings.isFetching && <div>Loading sightings…</div>}
          {showingRecent && sightings.isError && <div className="error">{sightings.error.message}</div>}
          {showingRecent && sightings.data && (
            <div>
              {recentPoints.length >= MAX_RESULTS && '>'}
              {recentPoints.length.toLocaleString()} sightings in {countryName(region)}, last 30 days
            </div>
          )}

          {showingEffort && effort.isLoading && <div>Loading birding activity…</div>}
          {showingEffort && effort.isError && <div className="error">{effort.error.message}</div>}
          {showingEffort && effortCells && (
            <div>
              {effortCells.cells.length.toLocaleString()} cells with birding activity, {weekLabel(week)}
            </div>
          )}

          {showingHistory && speciesCode && lens === 'all' && history.isFetching && <div>Loading historical data…</div>}
          {showingHistory && history.isError && <div className="error">{history.error.message}</div>}
          {showingHistory && lens === 'all' && history.data && (
            <div>
              {aggregated.cells.length.toLocaleString()} map cells from {aggregated.total.toLocaleString()} records
            </div>
          )}

          {(needsWeekly || needsFine) && !(ready || compareReady) && !loadError && <div>Loading comparison data…</div>}
          {(needsWeekly || needsFine) && loadError && <div className="error">{loadError.message}</div>}
          {ready && lens === 'week' && (
            <div>
              {weekCellList.length.toLocaleString()} cells with reports, {weekLabel(week)}
            </div>
          )}
          {compareReady && fromEra === toEra && <div>Pick two different periods to compare.</div>}
          {compareReady && comparison && (
            <div>
              {comparison.cells.length.toLocaleString()} cells compared, {eraLabel(fromEra)} to {eraLabel(toEra)}
              <div>
                {comparison.more.toLocaleString()} more common, {comparison.less.toLocaleString()} less common
              </div>
            </div>
          )}
          {ready && lens === 'wave' && (
            <div>
              {waveCellList.length.toLocaleString()} cells {waveKind === 'arrival' ? 'reached by' : 'still occupied in'}{' '}
              {weekLabel(week)}
            </div>
          )}
        </div>

        {hasPoints && <Legend mode={legendMode} />}
        
        {showingRecent && sightings.data && (
          <p className="note">{NOTES.all}eBird data (Cornell Lab of Ornithology, CC BY 4.0) via GBIF, last 30 days.</p>
        )}

        {showingHistory && history.data && (
          <p className="note">{NOTES[lens]}eBird data (Cornell Lab of Ornithology, CC BY 4.0) via GBIF, through 2024.</p>
        )}

        {showingEffort && effortCells && (
          <p className="note">{EFFORT_NOTE}eBird data (Cornell Lab of Ornithology, CC BY 4.0) via GBIF, through 2024.</p>
        )}
      </aside>
      )}
      <TrendsPanel
        open={trendsOpen}
        onClose={() => setTrendsOpen(false)}
        species={index.data ?? []}
        speciesCode={speciesCode}
        onSpeciesChange={setSpeciesCode}
        speciesDisabled={index.isLoading || index.isError}
        countryFilter={countryFilter}
        onCountryFilterChange={setCountryFilter}
      />
      <MigrationMap
        mode={view}
        sightings={recentPoints}
        cells={displayCells}
        stableCount={ready && slider ? fineAll.cells.length : displayCells.length}
        cellSize={displayCellSize}
        palette={palette}
        fitCells={aggregated.cells}
        fitKey={historyData}
        onBoundsChange={setBounds}
      />
    </div>
  )
}
