import { cellKey, MIN_EFFORT, WEEKS } from './season.js'

// Weekly values only exist at 0.5 degrees, so each fine (0.1 degree) cell takes its value from the four
// coarse cells around it, weighted by distance. The fine cells decide where the species is drawn; the
// coarse cells decide the color. Cells need at least this share of their weight on cells with data.
const MIN_WEIGHT = 0.25

// For every fine cell: the four surrounding coarse cells (-1 if none) and their bilinear weights.
export function buildInterpolation(fineCells, effort) {
  const idx = new Int32Array(fineCells.length * 4).fill(-1)
  const weight = new Float32Array(fineCells.length * 4)
  for (let i = 0; i < fineCells.length; i++) {
    const gy = fineCells[i].lat / effort.cell
    const gx = fineCells[i].lng / effort.cell
    const y0 = Math.floor(gy)
    const x0 = Math.floor(gx)
    const fy = gy - y0
    const fx = gx - x0
    for (let corner = 0; corner < 4; corner++) {
      const dy = corner >> 1
      const dx = corner & 1
      idx[i * 4 + corner] = effort.index.get(cellKey(y0 + dy, x0 + dx)) ?? -1
      weight[i * 4 + corner] = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy)
    }
  }
  return { idx, weight }
}

// Fine cells where the species' smoothed share of reports in this week is above zero.
export function weekCellsFine(season, effort, interp, fineCells, week) {
  const w = week - 1
  const cells = []
  for (let i = 0; i < fineCells.length; i++) {
    let sum = 0
    let total = 0
    for (let c = 0; c < 4; c++) {
      const cell = interp.idx[i * 4 + c]
      if (cell < 0 || effort.week[cell * WEEKS + w] < MIN_EFFORT) continue
      sum += interp.weight[i * 4 + c] * season.freq[cell * WEEKS + w]
      total += interp.weight[i * 4 + c]
    }
    if (total < MIN_WEIGHT || sum <= 0) continue
    const f = sum / total
    cells.push({ lat: fineCells[i].lat, lng: fineCells[i].lng, n: f, t: Math.min(1, Math.sqrt(f / season.max)) })
  }
  return cells
}

// Fine cells the wave has reached by `week` (arrival) or has not yet left (departure), colored by the
// smoothed arrival or departure week.
export function waveCellsFine(wave, interp, fineCells, week, kind) {
  const weeks = kind === 'departure' ? wave.departure : wave.arrival
  const cells = []
  for (let i = 0; i < fineCells.length; i++) {
    let sum = 0
    let total = 0
    for (let c = 0; c < 4; c++) {
      const cell = interp.idx[i * 4 + c]
      if (cell < 0 || weeks[cell] === 0) continue
      sum += interp.weight[i * 4 + c] * weeks[cell]
      total += interp.weight[i * 4 + c]
    }
    if (total < MIN_WEIGHT) continue
    const w = sum / total
    if (kind === 'departure' ? w < week : w > week) continue
    cells.push({ lat: fineCells[i].lat, lng: fineCells[i].lng, n: w, t: (w - 1) / (WEEKS - 1) })
  }
  return cells
}
