// Variables for coloring dots/squares based on density

export const DENSITY_STOPS = [
  [0, '#7b4fb3'],
  [0.35, '#3a7bd5'],
  [0.65, '#5ee0c1'],
  [1, '#ffe45e'],
]

export const DENSITY_COLOR_EXPRESSION = [
  'interpolate',
  ['linear'],
  ['get', 't'],
  ...DENSITY_STOPS.flat(),
]

export const DENSITY_CSS_GRADIENT = `linear-gradient(to right, ${DENSITY_STOPS.map(
  ([t, color]) => `${color} ${t * 100}%`,
).join(', ')})`
