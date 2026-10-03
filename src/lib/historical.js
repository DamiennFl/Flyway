// Cells are packed into one number so they can be summed in a Map. Indices are degrees divided by
// the cell size, so they reach 900 (lat) and 1800 (lng) at 0.1 degree cells; the offsets keep them positive.
const LAT_OFFSET = 1000
const LNG_OFFSET = 2000
const STRIDE = 10000

// Sums a species file's rows into one value per map cell, for the selected era (null = all eras).
// `t` is a log-scaled 0-1 intensity used for color.
export function aggregateCells(data, eraId) {
  const sums = new Map()
  for (let i = 0; i < data.n.length; i++) {
    if (eraId !== null && data.era[i] !== eraId) continue
    const key = (data.lat[i] + LAT_OFFSET) * STRIDE + (data.lng[i] + LNG_OFFSET)
    sums.set(key, (sums.get(key) ?? 0) + data.n[i])
  }

  let max = 0
  let total = 0
  for (const n of sums.values()) {
    if (n > max) max = n
    total += n
  }

  const cells = []
  for (const [key, n] of sums) {
    cells.push({
      lat: (Math.floor(key / STRIDE) - LAT_OFFSET) * data.cell,
      lng: ((key % STRIDE) - LNG_OFFSET) * data.cell,
      n,
      t: Math.log1p(n) / Math.log1p(max),
    })
  }
  return { cells, total, cellSize: data.cell }
}
