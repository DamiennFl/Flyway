import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRecentObservations, getSpeciesObservations } from './api/ebird.js'
import MigrationMap from './components/MigrationMap.jsx'
import SpeciesSelect from './components/SpeciesSelect.jsx'
import AgeLegend from './components/AgeLegend.jsx'

const REGION = 'US'
const MAX_RESULTS = 10000

export default function App() {
  const [speciesCode, setSpeciesCode] = useState('')

  const recent = useQuery({
    queryKey: ['recent', REGION],
    queryFn: () => getRecentObservations(REGION),
  })

  const species = useMemo(() => {
    const byCode = new Map()
    for (const obs of recent.data ?? []) {
      if (!byCode.has(obs.speciesCode)) byCode.set(obs.speciesCode, obs)
    }
    return [...byCode.values()].sort((a, b) => a.comName.localeCompare(b.comName))
  }, [recent.data])

  const sightings = useQuery({
    queryKey: ['species', REGION, speciesCode],
    queryFn: () => getSpeciesObservations(speciesCode, REGION),
    enabled: Boolean(speciesCode),
  })

  const points = sightings.data ?? []

  return (
    <div className="app">
      <aside className="panel">
        <h1>Flyway</h1>
        <p>Bird migration, month by month.</p>

        <SpeciesSelect
          species={species}
          value={speciesCode}
          onChange={setSpeciesCode}
          disabled={recent.isLoading || recent.isError}
        />

        <div className="status">
          {recent.isLoading && 'Loading species…'}
          {recent.isError && <span className="error">{recent.error.message}</span>}
          {recent.data && `${species.length} species in the last 30 days`}
          {speciesCode && sightings.isFetching && <div>Loading sightings…</div>}
          {sightings.isError && <div className="error">{sightings.error.message}</div>}
          {sightings.data && (
            <div>
              {points.length.toLocaleString()} sightings
              {points.length >= MAX_RESULTS && ' (hit the 10,000 cap)'}
            </div>
          )}
        </div>

        {points.length > 0 && <AgeLegend />}
      </aside>
      <MigrationMap sightings={points} />
    </div>
  )
}
