import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSpeciesObservations } from './api/ebird.js'
import { getHistoricalSpecies, getMeta, getSpeciesIndex } from './api/historical.js'
import { aggregateCells } from './lib/historical.js'
import MigrationMap from './components/MigrationMap.jsx'
import SpeciesSelect from './components/SpeciesSelect.jsx'
import Legend from './components/Legend.jsx'

const REGION = 'US'
const MAX_RESULTS = 10000

export default function App() {
  const [speciesCode, setSpeciesCode] = useState('')
  const [view, setView] = useState('recent')
  const [eraId, setEraId] = useState(null)

  const index = useQuery({ queryKey: ['species-index'], queryFn: getSpeciesIndex, staleTime: Infinity })
  const meta = useQuery({ queryKey: ['meta'], queryFn: getMeta, staleTime: Infinity })

  const showingHistory = view === 'historical'

  const sightings = useQuery({
    queryKey: ['species', REGION, speciesCode],
    queryFn: () => getSpeciesObservations(speciesCode, REGION),
    enabled: !showingHistory && Boolean(speciesCode),
  })

  const history = useQuery({
    queryKey: ['historical', speciesCode],
    queryFn: () => getHistoricalSpecies(speciesCode),
    enabled: showingHistory && Boolean(speciesCode),
    staleTime: Infinity,
  })

  const aggregated = useMemo(
    () => (history.data ? aggregateCells(history.data, eraId) : { cells: [], total: 0, cellSize: 0.5 }),
    [history.data, eraId],
  )

  const recentPoints = sightings.data ?? []
  const hasPoints = showingHistory ? aggregated.cells.length > 0 : recentPoints.length > 0

  return (
    <div className="app">
      <aside className="panel">
        <h1>Flyway</h1>
        <p>Bird migration, month by month.</p>

        <SpeciesSelect
          species={index.data ?? []}
          value={speciesCode}
          onChange={setSpeciesCode}
          disabled={index.isLoading || index.isError}
        />

        {speciesCode && (
          <button type="button" className="action" onClick={() => setView(showingHistory ? 'recent' : 'historical')}>
            {showingHistory ? 'Back to last 30 days' : 'Show historical data'}
          </button>
        )}

        {showingHistory && speciesCode && meta.data && (
          <div className="eras">
            {[{ id: null, label: 'All years' }, ...meta.data.eras].map((era) => (
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

        <div className="status">
          {index.isLoading && 'Loading species…'}
          {index.isError && <span className="error">{index.error.message}</span>}
          {index.data && `${index.data.length.toLocaleString()} species`}

          {!showingHistory && speciesCode && sightings.isFetching && <div>Loading sightings…</div>}
          {!showingHistory && sightings.isError && <div className="error">{sightings.error.message}</div>}
          {!showingHistory && sightings.data && (
            <div>
              {recentPoints.length >= MAX_RESULTS && '>'}
              {recentPoints.length.toLocaleString()} sightings in the US, last 30 days
            </div>
          )}

          {showingHistory && speciesCode && history.isFetching && <div>Loading historical data…</div>}
          {showingHistory && history.isError && <div className="error">{history.error.message}</div>}
          {showingHistory && history.data && (
            <div>
              {aggregated.cells.length.toLocaleString()} map cells · {aggregated.total.toLocaleString()} records
            </div>
          )}
        </div>

        {hasPoints && <Legend mode={view} />}

        {showingHistory && history.data && (
          <p className="note">
            eBird data (Cornell Lab of Ornithology, CC BY 4.0) via GBIF, through 2024. Counts reflect where people
            bird, not just where birds are.
          </p>
        )}
      </aside>
      <MigrationMap
        mode={view}
        sightings={recentPoints}
        cells={aggregated.cells}
        cellSize={aggregated.cellSize}
        fitKey={history.data}
      />
    </div>
  )
}
