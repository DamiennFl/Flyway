import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWeeklySpecies } from '../api/historical.js'
import SpeciesSelect from './SpeciesSelect.jsx'

const CHART_HEIGHT = 90
const BAR = 12
const RECENT_START = 2000

export default function TrendsPanel({ open, onClose, species, speciesCode, onSpeciesChange, speciesDisabled }) {
  const [pos, setPos] = useState({ x: 312, y: 16 })
  const [fullHistory, setFullHistory] = useState(false)
  const dragRef = useRef(null)

  const trends = useQuery({
    queryKey: ['trends', speciesCode],
    queryFn: () => getWeeklySpecies(speciesCode),
    enabled: open && Boolean(speciesCode),
    staleTime: Infinity,
  })

  if (!open) return null

  function startDrag(e) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: pos }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onDrag(e) {
    if (!dragRef.current) return
    const { startX, startY, origin } = dragRef.current
    setPos({ x: origin.x + (e.clientX - startX), y: origin.y + (e.clientY - startY) })
  }

  function endDrag() {
    dragRef.current = null
  }

  const data = trends.data
  const years = data?.years
  const countries = data?.countries ?? []
  const firstYear = years?.year[0]
  const lastYear = years?.year[years.year.length - 1]
  const hasOlderData = years && firstYear < RECENT_START
  const chartYears = years
    ? years.year.map((yr, i) => ({ yr, n: years.n[i] })).filter((d) => fullHistory || d.yr >= RECENT_START)
    : []
  const maxN = chartYears.length ? Math.max(...chartYears.map((d) => d.n)) : 0
  const tickEvery = fullHistory ? 20 : 5

  return (
    <div className="trends" style={{ left: pos.x, top: pos.y }}>
      <div className="trends-head" onPointerDown={startDrag} onPointerMove={onDrag} onPointerUp={endDrag}>
        <span className="trends-title">
          {data ? data.name : 'Species trends'}
          {data && <i className="trends-sci">{data.sci}</i>}
        </span>
        <button
          type="button"
          className="trends-close"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="trends-body">
        <SpeciesSelect species={species} value={speciesCode} onChange={onSpeciesChange} disabled={speciesDisabled} />

        {!speciesCode && <p className="trends-note">Pick a species to see its trend.</p>}
        {speciesCode && trends.isLoading && <p className="trends-note">Loading…</p>}
        {speciesCode && trends.isError && <p className="trends-note error">{trends.error.message}</p>}

        {years && (
          <>
            <div className="trends-stats">
              <div className="trends-stat">
                <span className="trends-stat-label">First recorded</span>
                <span className="trends-stat-value">{firstYear}</span>
              </div>
              <div className="trends-stat">
                <span className="trends-stat-label">Most recent</span>
                <span className="trends-stat-value">{lastYear}</span>
              </div>
              <div className="trends-stat">
                <span className="trends-stat-label">Total reports</span>
                <span className="trends-stat-value">{data.records.toLocaleString()}</span>
              </div>
            </div>

            <div className="trends-chart-head">
              <span>Reports per year</span>
              {hasOlderData && (
                <button type="button" className="trends-toggle" onClick={() => setFullHistory((f) => !f)}>
                  {fullHistory ? `Since ${RECENT_START}` : `Full history, since ${firstYear}`}
                </button>
              )}
            </div>
            <svg
              className="trends-chart"
              viewBox={`0 0 ${chartYears.length * BAR} ${CHART_HEIGHT + 14}`}
              role="img"
              aria-label="Reports per year"
            >
              {chartYears.map(({ yr, n }, i) => {
                const h = maxN > 0 ? Math.max(1, (n / maxN) * CHART_HEIGHT) : 0
                return <rect key={yr} className="bar" x={i * BAR} y={CHART_HEIGHT - h} width={BAR - 2} height={h} />
              })}
              {chartYears.map(({ yr }, i) =>
                yr % tickEvery === 0 ? (
                  <text key={yr} x={i * BAR} y={CHART_HEIGHT + 12}>
                    {yr}
                  </text>
                ) : null,
              )}
            </svg>
          </>
        )}

        {countries.length > 0 && (
          <div className="trends-countries">
            <div className="trends-subhead">Most reports by country</div>
            <ol>
              {countries.map(([cc, n]) => (
                <li key={cc}>
                  <span>{cc}</span>
                  <span className="trends-count">{n.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
