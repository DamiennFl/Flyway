import { cellKey, MIN_EFFORT } from './season.js'

const ERAS = 5

// A cell is only compared if both eras had enough effort to expect at least this many reports
// of the species at its typical rate; otherwise a few reports would look like a big change.
const MIN_EXPECTED = 2

// A species' reports per cell and era, pooled over weeks, plus its typical share of reports where it occurs.
export function buildEraCounts(data, effort) {
  const n = new Float32Array(effort.cells * ERAS)
  for (let i = 0; i < data.n.length; i++) {
    const cell = effort.index.get(cellKey(data.lat[i], data.lng[i]))
    if (cell !== undefined) n[cell * ERAS + data.era[i]] += data.n[i]
  }

  let reports = 0
  let total = 0
  for (let cell = 0; cell < effort.cells; cell++) {
    let cellReports = 0
    let cellTotal = 0
    for (let e = 0; e < ERAS; e++) {
      cellReports += n[cell * ERAS + e]
      cellTotal += effort.era[cell * ERAS + e]
    }
    if (cellReports > 0) {
      reports += cellReports
      total += cellTotal
    }
  }
  return { n, typicalShare: total > 0 ? reports / total : 0 }
}

// Change in share of reports from one era to another, as a log2 ratio clamped to 8x either way.
// t is 0.5 for no change, 1 for 8x more common, 0 for 8x less common.
export function compareEras(counts, effort, fromEra, toEra) {
  const cells = []
  let more = 0
  let less = 0
  for (let i = 0; i < effort.cells; i++) {
    const effortFrom = effort.era[i * ERAS + fromEra]
    const effortTo = effort.era[i * ERAS + toEra]
    if (effortFrom < MIN_EFFORT || effortTo < MIN_EFFORT) continue
    if (Math.min(effortFrom, effortTo) * counts.typicalShare < MIN_EXPECTED) continue

    const from = counts.n[i * ERAS + fromEra]
    const to = counts.n[i * ERAS + toEra]
    if (from + to === 0) continue

    const ratio = Math.log2((to + 0.5) / effortTo / ((from + 0.5) / effortFrom))
    const clamped = Math.max(-3, Math.min(3, ratio))
    if (ratio >= 1) more++
    else if (ratio <= -1) less++
    cells.push({ lat: effort.lat[i] * effort.cell, lng: effort.lng[i] * effort.cell, n: Math.abs(ratio), t: 0.5 + clamped / 6 })
  }
  return { cells, more, less }
}
