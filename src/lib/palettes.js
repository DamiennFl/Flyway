import { DENSITY_COLOR_EXPRESSION, DENSITY_CSS_GRADIENT } from './densityScale.js'

const stops = (list) => ({
  expression: ['interpolate', ['linear'], ['get', 't'], ...list.flat()],
  gradient: `linear-gradient(to right, ${list.map(([t, color]) => `${color} ${t * 100}%`).join(', ')})`,
})

// Orange = less common, grey = no change, teal = more common (readable for most color blindness).
const diverging = stops([
  [0, '#ff7a3d'],
  [0.25, '#c9805a'],
  [0.5, '#6f7b8a'],
  [0.75, '#4fb3c4'],
  [1, '#2de0c4'],
])

// Week of the year: winter blue, spring green, summer yellow, autumn orange, late autumn pink.
const wave = stops([
  [0, '#4a6fe3'],
  [0.25, '#5ee0a0'],
  [0.5, '#ffe45e'],
  [0.75, '#ff8a4c'],
  [1, '#d94f9a'],
])

export const PALETTES = {
  density: { expression: DENSITY_COLOR_EXPRESSION, gradient: DENSITY_CSS_GRADIENT },
  diverging,
  wave,
}
