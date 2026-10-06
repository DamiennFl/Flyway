import { DENSITY_COLOR_EXPRESSION, DENSITY_CSS_GRADIENT } from './densityScale.js'

const stops = (list) => ({
  expression: ['interpolate', ['linear'], ['get', 't'], ...list.flat()],
  gradient: `linear-gradient(to right, ${list.map(([t, color]) => `${color} ${t * 100}%`).join(', ')})`,
})

// Orange = less common, grey = no change, teal = more common (readable for most color blindness).
const diverging = stops([
  [0, '#ff7a33'],
  [0.25, '#c98a5c'],
  [0.5, '#6f7f78'],
  [0.75, '#6fb5cf'],
  [1, '#b4ecf5'],
])

// Week of the year: winter blue, spring green, summer yellow, autumn orange, late autumn pink.
const wave = stops([
  [0, '#5b8fd6'],
  [0.25, '#8fb56a'],
  [0.5, '#f0dc6a'],
  [0.75, '#ff7a33'],
  [1, '#c25a8a'],
])

export const PALETTES = {
  density: { expression: DENSITY_COLOR_EXPRESSION, gradient: DENSITY_CSS_GRADIENT },
  diverging,
  wave,
}
