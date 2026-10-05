export const WEEKS = 52

// Cell-weeks with fewer all-species records than this are too thinly covered for a reliable share.
export const MIN_EFFORT = 50

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Cell indices are degrees divided by the cell size: up to +-900 (lat) and +-1800 (lng) at 0.1 degrees.
export const cellKey = (lat, lng) => (lat + 1000) * 10000 + (lng + 2000)

// Effort = all-species records per cell, by week (0.5 degree cells) and/or by era. A species' share of it
// corrects for where and when people bird.
export function buildEffortIndex(effort) {
  const cells = effort.lat.length
  const index = new Map()
  for (let i = 0; i < cells; i++) index.set(cellKey(effort.lat[i], effort.lng[i]), i)
  return {
    cell: effort.cell,
    cells,
    lat: effort.lat,
    lng: effort.lng,
    week: effort.week ? Float32Array.from(effort.week) : null,
    era: Float32Array.from(effort.era),
    index,
  }
}

// Pools a species' weekly file over all eras into n[cell * 52 + week - 1] and the matching share of reports.
export function buildSpeciesSeason(data, effort) {
  const n = new Float32Array(effort.cells * WEEKS)
  for (let i = 0; i < data.n.length; i++) {
    const cell = effort.index.get(cellKey(data.lat[i], data.lng[i]))
    if (cell !== undefined) n[cell * WEEKS + data.week[i] - 1] += data.n[i]
  }

  const freq = new Float32Array(n.length)
  const positive = []
  for (let i = 0; i < n.length; i++) {
    if (n[i] > 0 && effort.week[i] >= MIN_EFFORT) {
      freq[i] = n[i] / effort.week[i]
      positive.push(freq[i])
    }
  }

  // The top 2% are treated as saturated so a few outlier cells don't wash out the color scale.
  const sorted = Float32Array.from(positive).sort()
  const max = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))] : 1
  return { n, freq, max }
}

// Share of reports by week across the cells inside the map view.
export function regionSeries(season, effort, bounds) {
  const reports = new Float64Array(WEEKS)
  const total = new Float64Array(WEEKS)
  for (let i = 0; i < effort.cells; i++) {
    const lat = effort.lat[i] * effort.cell
    const lng = effort.lng[i] * effort.cell
    if (lat < bounds.south || lat > bounds.north || lng < bounds.west || lng > bounds.east) continue
    for (let w = 0; w < WEEKS; w++) {
      total[w] += effort.week[i * WEEKS + w]
      reports[w] += season.n[i * WEEKS + w]
    }
  }
  return Array.from(reports, (n, w) => (total[w] >= MIN_EFFORT ? n / total[w] : 0))
}

export function weekLabel(week) {
  const start = new Date(2023, 0, 1 + (week - 1) * 7)
  const end = new Date(2023, 0, week === WEEKS ? 365 : week * 7)
  if (start.getMonth() === end.getMonth()) return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`
}
