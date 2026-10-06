import { WEEKS, weekLabel } from '../lib/season.js'

const BAR = 5
const CHART_HEIGHT = 56
const MONTH_STARTS = [[1, 'Jan'], [14, 'Apr'], [27, 'Jul'], [40, 'Oct']]

export default function SeasonPanel({ week, onWeek, playing, onTogglePlay, series, loading }) {
  const max = series ? Math.max(...series) : 0

  function pickWeek(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    onWeek(Math.min(WEEKS, Math.max(1, Math.floor(((e.clientX - rect.left) / rect.width) * WEEKS) + 1)))
  }

  return (
    <div className="season">
      <div className="season-head">
        <button type="button" className="play" onClick={onTogglePlay} disabled={loading}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <span>
          Week {week} · {weekLabel(week)}
        </span>
      </div>
      <input
        type="range"
        min="1"
        max={WEEKS}
        value={week}
        aria-label="Week of the year"
        onChange={(e) => onWeek(Number(e.target.value))}
        disabled={loading}
      />
      {series && (
        <>
          <svg
            className="season-chart"
            viewBox={`0 0 ${WEEKS * BAR} ${CHART_HEIGHT + 12}`}
            role="img"
            aria-label="Share of reports by week in the current map view"
            onClick={pickWeek}
          >
            {series.map((v, i) => {
              const h = max > 0 ? Math.max(v > 0 ? 1 : 0, (v / max) * CHART_HEIGHT) : 0
              return (
                <rect
                  key={i}
                  className={`bar${i + 1 === week ? ' active' : ''}`}
                  x={i * BAR}
                  y={CHART_HEIGHT - h}
                  width={BAR - 1}
                  height={h}
                />
              )
            })}
            {MONTH_STARTS.map(([w, label]) => (
              <text key={label} x={(w - 1) * BAR} y={CHART_HEIGHT + 10}>
                {label}
              </text>
            ))}
          </svg>
          <div className="season-caption">{max > 0 ? 'Share of reports by week, in the map view' : 'Not enough data in this view'}</div>
        </>
      )}
    </div>
  )
}
