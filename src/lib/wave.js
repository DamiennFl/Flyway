import { MIN_EFFORT, WEEKS } from './season.js'

const MIN_VALID_WEEKS = 26
const MIN_REPORTS = 10

// For each cell, the first and last week (1-52) where the species' share of reports, smoothed over three
// weeks, is at least half its yearly peak there. Resident species come out as week 1 to 52 everywhere,
// migrants as a wave. 0 means the cell has too little data.
export function buildWave(season, effort) {
  const arrival = new Uint8Array(effort.cells)
  const departure = new Uint8Array(effort.cells)
  const smooth = new Float32Array(WEEKS)

  for (let i = 0; i < effort.cells; i++) {
    const base = i * WEEKS
    let reports = 0
    let valid = 0
    for (let w = 0; w < WEEKS; w++) {
      reports += season.n[base + w]
      if (effort.week[base + w] >= MIN_EFFORT) valid++
    }
    if (reports < MIN_REPORTS || valid < MIN_VALID_WEEKS) continue

    let peak = 0
    for (let w = 0; w < WEEKS; w++) {
      let sum = 0
      let count = 0
      for (let k = Math.max(0, w - 1); k <= Math.min(WEEKS - 1, w + 1); k++) {
        if (effort.week[base + k] >= MIN_EFFORT) {
          sum += season.n[base + k] / effort.week[base + k]
          count++
        }
      }
      smooth[w] = count ? sum / count : -1
      if (smooth[w] > peak) peak = smooth[w]
    }
    if (peak <= 0) continue

    let first = -1
    let last = -1
    for (let w = 0; w < WEEKS; w++) {
      if (smooth[w] >= peak / 2) {
        if (first < 0) first = w
        last = w
      }
    }
    arrival[i] = first + 1
    departure[i] = last + 1
  }
  return { arrival, departure }
}
