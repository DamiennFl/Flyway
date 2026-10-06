// What the map says about one grid cell when you hover over it.

const trim = (x) => Number(x.toFixed(2)).toString()

const latText = (v) => `${trim(Math.abs(v))}°${v < 0 ? 'S' : 'N'}`
const lngText = (v) => `${trim(Math.abs(v))}°${v < 0 ? 'W' : 'E'}`

// lat and lng are the cell's center; the cell reaches half its size either way.
export function cellRanges({ lat, lng }, cellSize) {
  const half = cellSize / 2
  return {
    lat: `${latText(lat - half)} to ${latText(lat + half)}`,
    lng: `${lngText(lng - half)} to ${lngText(lng + half)}`,
  }
}

// Only views where `n` really is a report count say "reports"; the season and wave views hold estimates
// and week numbers, so they get no count rather than a wrong one.
export function cellHeadline(mode, { n, t }) {
  if (mode === 'historical' || mode === 'effort') return `${Math.round(n).toLocaleString()} ${Math.round(n) === 1 ? 'report' : 'reports'}`
  if (mode === 'compare') {
    const times = 2 ** n
    return `${times < 1.05 ? 'About the same' : `${times.toFixed(1)}× ${t > 0.5 ? 'more' : 'less'} common`}`
  }
  return null
}
