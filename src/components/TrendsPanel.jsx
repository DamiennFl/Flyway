import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWeeklySpecies } from '../api/historical.js'
import SpeciesSelect from './SpeciesSelect.jsx'

const CHART_HEIGHT = 56
const BAR = 3

export default function TrendsPanel({ open, onClose, species, speciesCode, onSpeciesChange, speciesDisabled }) {
  const [pos, setPos] = useState({ x: 312, y: 16 })
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

  const years = trends.data?.years
  const countries = trends.data?.countries ?? []
  const maxN = years ? Math.max(...years.n) : 0

  return (
    <div className="trends" style={{ left: pos.x, top: pos.y }}>
      <div className="trends-head" onPointerDown={startDrag} onPointerMove={onDrag} onPointerUp={endDrag}>
        <span>Species trends</span>
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
            <svg
              className="trends-chart"
              viewBox={`0 0 ${years.year.length * BAR} ${CHART_HEIGHT}`}
              role="img"
              aria-label="Reports per year"
            >
              {years.year.map((yr, i) => {
                const h = maxN > 0 ? Math.max(1, (years.n[i] / maxN) * CHART_HEIGHT) : 0
                return (
                  <rect key={yr} className="bar" x={i * BAR} y={CHART_HEIGHT - h} width={BAR - 1} height={h} />
                )
              })}
            </svg>
            <div className="trends-range">
              First recorded {years.year[0]} · Last recorded {years.year[years.year.length - 1]}
            </div>
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
