import { AGE_CSS_GRADIENT, MAX_AGE_DAYS } from '../lib/ageScale.js'
import { PALETTES } from '../lib/palettes.js'

const SCALES = {
  recent: { gradient: AGE_CSS_GRADIENT, labels: ['Today', `${MAX_AGE_DAYS} days ago`] },
  historical: { gradient: PALETTES.density.gradient, labels: ['Fewer reports', 'More reports'] },
  season: { gradient: PALETTES.density.gradient, labels: ['Rarer', 'More common'] },
  compare: { gradient: PALETTES.diverging.gradient, labels: ['8x less common', 'Same', '8x more common'] },
  wave: { gradient: PALETTES.wave.gradient, labels: ['Jan', 'Apr', 'Jul', 'Oct', 'Dec'] },
}

export default function Legend({ mode }) {
  const { gradient, labels } = SCALES[mode]

  return (
    <div className="legend">
      <div className="legend-bar" style={{ background: gradient }} />
      <div className="legend-labels">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  )
}
