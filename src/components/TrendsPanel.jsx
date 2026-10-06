import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { speciesUrl } from '../api/ebird.js'
import { getEffortCountry, getWeeklySpecies } from '../api/historical.js'
import { countryName } from '../lib/countries.js'
import { COUNTRY_LINE_COLORS, bestTimePlace, buildCountryWeekShare, scaleForDisplay } from '../lib/flyway.js'
import { pieSlices } from '../lib/pie.js'
import { WEEKS, weekLabel } from '../lib/season.js'
import SpeciesSelect from './SpeciesSelect.jsx'

const CHART_HEIGHT = 90
// The chart is always this wide in viewBox units (about its on-screen width), so the labels stay readable
// however many years are shown; the bars share the width.
const CHART_WIDTH = 300
const RECENT_START = 2000

const FLYWAY_HEIGHT = 56
const FLYWAY_BAR = 5
const MONTH_STARTS = [[1, 'Jan'], [14, 'Apr'], [27, 'Jul'], [40, 'Oct']]

const PIE_MAX = 8
const PIE_COLORS = [...COUNTRY_LINE_COLORS, '#a58bd0', '#b9a98a', '#d3ddd0', '#6f7f78']

function slicePath(start, end) {
  const x1 = Math.cos(start)
  const y1 = Math.sin(start)
  const x2 = Math.cos(end)
  const y2 = Math.sin(end)
  const large = end - start > Math.PI ? 1 : 0
  return `M0,0 L${x1},${y1} A1,1 0 ${large} 1 ${x2},${y2} Z`
}

export default function TrendsPanel({
  open,
  onClose,
  species,
  speciesCode,
  onSpeciesChange,
  speciesDisabled,
  countryFilter,
  onCountryFilterChange,
}) {
  const [pos, setPos] = useState({ x: 344, y: 70 })
  const [fullHistory, setFullHistory] = useState(false)
  const [hoverYear, setHoverYear] = useState(null)
  const [logScale, setLogScale] = useState(false)
  const dragRef = useRef(null)

  const trends = useQuery({
    queryKey: ['trends', speciesCode],
    queryFn: () => getWeeklySpecies(speciesCode),
    enabled: open && Boolean(speciesCode),
    staleTime: Infinity,
  })
  const effortCountry = useQuery({
    queryKey: ['effort-country'],
    queryFn: getEffortCountry,
    enabled: open,
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
  const hovered = chartYears.find((d) => d.yr === hoverYear)

  const flyway =
    data && effortCountry.data && countries.length
      ? buildCountryWeekShare(data, effortCountry.data, countries)
      : null
  const flywayScaled = flyway
    ? flyway.series.map((s) => s.values.map((v) => scaleForDisplay(v, logScale)))
    : []
  const flywayMax = flywayScaled.length ? Math.max(0, ...flywayScaled.flat()) : 0

  const allCountryShare =
    data && effortCountry.data && countries.length
      ? buildCountryWeekShare(data, effortCountry.data, countries, countries.length)
      : null
  const pieTop = countries.slice(0, PIE_MAX)
  const pieRest = countries.slice(PIE_MAX).reduce((sum, [, n]) => sum + n, 0)
  const pieCountries = pieRest > 0 ? [...pieTop, ['Other', pieRest]] : pieTop
  const pieTotal = pieCountries.reduce((sum, [, n]) => sum + n, 0)

  const best = allCountryShare ? bestTimePlace(allCountryShare.series) : null

  return (
    <div className={`trends${years ? ' trends-wide' : ''}`} style={{ left: pos.x, top: pos.y }}>
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
        <SpeciesSelect
          species={species}
          value={speciesCode}
          onChange={onSpeciesChange}
          disabled={speciesDisabled}
          countryFilter={countryFilter}
          onCountryFilterChange={onCountryFilterChange}
        />

        {speciesCode && (
          <a className="ebird-link" href={speciesUrl(speciesCode)} target="_blank" rel="noopener noreferrer">
            View on eBird ↗
          </a>
        )}

        {!speciesCode && <p className="trends-note">Pick a species to see its trend.</p>}
        {speciesCode && trends.isLoading && <p className="trends-note">Loading…</p>}
        {speciesCode && trends.isError && <p className="trends-note error">{trends.error.message}</p>}

        {years && (
          <div className="trends-columns">
            <div className="trends-col">
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
              <div className="trends-readout" aria-live="polite">
                {hovered ? (
                  <>
                    <strong>{hovered.yr}</strong> {hovered.n.toLocaleString()} {hovered.n === 1 ? 'report' : 'reports'}
                  </>
                ) : (
                  'Hover over a bar to see its count.'
                )}
              </div>
              <svg
                className="trends-chart"
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 16}`}
                role="img"
                aria-label="Reports per year"
                onMouseLeave={() => setHoverYear(null)}
              >
                {chartYears.map(({ yr, n }, i) => {
                  const h = maxN > 0 ? Math.max(1, (n / maxN) * CHART_HEIGHT) : 0
                  const step = CHART_WIDTH / chartYears.length
                  return (
                    <g key={yr} onMouseEnter={() => setHoverYear(yr)}>
                      {/* Full-height hit area, so thin bars and tiny counts are still easy to point at. */}
                      <rect className="bar-hit" x={i * step} y={0} width={step} height={CHART_HEIGHT} />
                      <rect
                        className={`bar${yr === hoverYear ? ' active' : ''}`}
                        x={i * step}
                        y={CHART_HEIGHT - h}
                        width={Math.max(0.5, step - Math.min(2, step * 0.2))}
                        height={h}
                      />
                    </g>
                  )
                })}
                {chartYears.map(({ yr }, i) =>
                  yr % tickEvery === 0 ? (
                    <text key={yr} x={i * (CHART_WIDTH / chartYears.length)} y={CHART_HEIGHT + 13}>
                      {yr}
                    </text>
                  ) : null,
                )}
              </svg>
              <div className="trends-chart-note">
                eBird reports were sparse before 2000. Counts are not a reliable gauge of the species' actual range
                or abundance that far back.
              </div>
              
            </div>

            <div className="trends-col">
              {flyway && (
                <>
                  <div className="trends-chart-head">
                    <span>Where, by week</span>
                    <button type="button" className="trends-toggle" onClick={() => setLogScale((l) => !l)}>
                      {logScale ? 'Linear scale' : 'Log scale'}
                    </button>
                  </div>
                  <svg
                    className="flyway-chart"
                    viewBox={`0 0 ${WEEKS * FLYWAY_BAR} ${FLYWAY_HEIGHT + 12}`}
                    role="img"
                    aria-label="Effort-corrected share of reports by week, for the top reporting countries"
                  >
                    {flyway.series.map((s, i) => (
                      <polyline
                        key={s.cc}
                        className="flyway-line"
                        style={{ stroke: COUNTRY_LINE_COLORS[i] }}
                        points={flywayScaled[i]
                          .map((v, w) => {
                            const h = flywayMax > 0 ? (v / flywayMax) * FLYWAY_HEIGHT : 0
                            return `${w * FLYWAY_BAR},${FLYWAY_HEIGHT - h}`
                          })
                          .join(' ')}
                      />
                    ))}
                    {MONTH_STARTS.map(([w, label]) => (
                      <text key={label} x={(w - 1) * FLYWAY_BAR} y={FLYWAY_HEIGHT + 10}>
                        {label}
                      </text>
                    ))}
                  </svg>
                  <ul className="flyway-legend">
                    {flyway.series.map((s, i) => (
                      <li key={s.cc}>
                        <span className="flyway-swatch" style={{ background: COUNTRY_LINE_COLORS[i] }} />
                        {countryName(s.cc)}
                      </li>
                    ))}
                  </ul>
                  <div className="trends-chart-note">
                    Each line is that country's share of this species' reports, divided by all-species activity in
                    the same country and week, making it comparable across countries regardless of how many birders each has.
                  </div>
                </>
              )}

            </div>
          </div>
        )}

        {years && countries.length > 0 && (
          <div className="trends-countries">
            <div className="trends-subhead">Most reports by country</div>
            <div className="trends-pie-row">
              <svg className="trends-pie" viewBox="-1 -1 2 2" role="img" aria-label="Share of reports by country">
                {pieSlices(pieCountries.map(([, n]) => n)).map((s, i) =>
                  s.fraction >= 0.9999 ? (
                    <circle key={pieCountries[i][0]} r="1" fill={PIE_COLORS[i]} />
                  ) : (
                    <path
                      key={pieCountries[i][0]}
                      d={slicePath(s.startAngle, s.endAngle)}
                      fill={PIE_COLORS[i]}
                      className="pie-slice"
                    />
                  ),
                )}
              </svg>
              <ol className="trends-pie-legend">
                {pieCountries.map(([cc, n], i) => (
                  <li key={cc}>
                    <span className="flyway-swatch" style={{ background: PIE_COLORS[i] }} />
                    <span className="trends-pie-name">{cc === 'Other' ? cc : countryName(cc)}</span>
                    <span className="trends-count">
                      {n.toLocaleString()} · {Math.round((n / pieTotal) * 100)}%
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
