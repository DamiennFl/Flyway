const BIN = 4 // degrees; a spot is judged by its bin plus the eight around it, so a cluster on a bin edge isn't split

// The center of the most crowded part of a set of points ({ lat, lng }), or null for no points.
export function densestSpot(points) {
  const bins = new Map()
  const key = (i, j) => `${i}:${j}`
  for (const p of points) {
    const k = key(Math.floor(p.lat / BIN), Math.floor(p.lng / BIN))
    bins.set(k, (bins.get(k) ?? 0) + 1)
  }

  let best = null
  for (const k of bins.keys()) {
    const [i, j] = k.split(':').map(Number)
    let count = 0
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) count += bins.get(key(i + di, j + dj)) ?? 0
    if (!best || count > best.count) best = { i, j, count }
  }
  if (!best) return null

  let lat = 0
  let lng = 0
  let n = 0
  for (const p of points) {
    if (Math.abs(Math.floor(p.lat / BIN) - best.i) <= 1 && Math.abs(Math.floor(p.lng / BIN) - best.j) <= 1) {
      lat += p.lat
      lng += p.lng
      n++
    }
  }
  return { lat: lat / n, lng: lng / n }
}

export const inBounds = (p, b) => p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east
