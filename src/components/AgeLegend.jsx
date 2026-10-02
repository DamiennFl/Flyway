import { AGE_CSS_GRADIENT, MAX_AGE_DAYS } from '../lib/ageScale.js'

export default function AgeLegend() {
  return (
    <div className="legend">
      <div className="legend-bar" style={{ background: AGE_CSS_GRADIENT }} />
      <div className="legend-labels">
        <span>Today</span>
        <span>{MAX_AGE_DAYS} days ago</span>
      </div>
    </div>
  )
}
