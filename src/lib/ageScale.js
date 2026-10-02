export const MAX_AGE_DAYS = 30

export const AGE_STOPS = [
  [0, '#ffe45e'],
  [7, '#5ee0c1'],
  [15, '#3a7bd5'],
  [30, '#7b4fb3'],
]

const DAY_MS = 24 * 60 * 60 * 1000

export function ageInDays(obsDt) {
  const observed = new Date(obsDt.replace(' ', 'T')).getTime()
  return Math.max(0, (Date.now() - observed) / DAY_MS)
}

export const AGE_COLOR_EXPRESSION = [
  'interpolate',
  ['linear'],
  ['get', 'ageDays'],
  ...AGE_STOPS.flat(),
]

export const AGE_CSS_GRADIENT = `linear-gradient(to right, ${AGE_STOPS.map(
  ([days, color]) => `${color} ${(days / MAX_AGE_DAYS) * 100}%`,
).join(', ')})`
