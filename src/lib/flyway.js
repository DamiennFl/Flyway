import { WEEKS } from './season.js'

// Weeks with less country-wide activity than this are too thin to trust as a denominator.
const MIN_COUNTRY_EFFORT = 20

export const COUNTRY_LINE_COLORS = ['#5ee0c1', '#ffe45e', '#ff8a4c', '#4a6fe3', '#d94f9a']

// Effort-corrected share of a species' reports, by week, for its top reporting countries.
// Matches the app's existing approach of dividing by all-species activity in the same place/time
// (see season.js), just with country+week as the place/time instead of cell+week - so countries
// with very different numbers of birders are still comparable to each other.
export function buildCountryWeekShare(data, effortCountry, countries, topN = 5) {
  const byCountryWeek = {}
  for (let i = 0; i < data.n.length; i++) {
    const cc = data.country[i]
    const bucket = (byCountryWeek[cc] ??= new Float64Array(WEEKS))
    bucket[data.week[i] - 1] += data.n[i]
  }

  const series = countries.slice(0, topN).map(([cc]) => {
    const reports = byCountryWeek[cc] ?? new Float64Array(WEEKS)
    const effort = effortCountry[cc]
    const values = Array.from(reports, (n, w) => {
      const total = effort ? effort[w] : 0
      return total >= MIN_COUNTRY_EFFORT ? n / total : 0
    })
    return { cc, values }
  })

  const maxShare = Math.max(0, ...series.flatMap((s) => s.values))
  return { series, maxShare }
}

// Picks the single (country, week) with the highest effort-corrected share, across whichever
// series are given - callers can pass every available country, not just the ones charted, since
// this is one concrete recommendation rather than something that needs to fit on an axis.
export function bestTimePlace(series) {
  let best = null
  for (const s of series) {
    for (let w = 0; w < s.values.length; w++) {
      const share = s.values[w]
      if (!best || share > best.share) best = { cc: s.cc, week: w + 1, share }
    }
  }
  return best
}

// Raw shares are typically well under 0.05, where log1p barely curves at all, so scale up
// first to make the log view actually show shape instead of looking linear anyway.
const LOG_DISPLAY_SCALE = 1000

export function scaleForDisplay(value, logScale) {
  return logScale ? Math.log1p(value * LOG_DISPLAY_SCALE) : value
}
