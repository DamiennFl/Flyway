// Variables for coloring dots/squares based on density

export const DENSITY_STOPS = [
  [0, '#3b6a86'],
  [0.35, '#7cc4de'],
  [0.65, '#e6d58a'],
  [1, '#ff7a33'],
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
