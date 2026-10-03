import { AGE_CSS_GRADIENT, MAX_AGE_DAYS } from '../lib/ageScale.js'
import { DENSITY_CSS_GRADIENT } from '../lib/densityScale.js'

export default function Legend({ mode }) {
  const recent = mode === 'recent'
  const labels = recent ? ['Today', `${MAX_AGE_DAYS} days ago`] : ['Fewer reports', 'More reports']

  return (
    <div className="legend">
      <div className="legend-bar" style={{ background: recent ? AGE_CSS_GRADIENT : DENSITY_CSS_GRADIENT }} />
      <div className="legend-labels">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  )
}
