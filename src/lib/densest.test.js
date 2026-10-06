import { describe, expect, it } from 'vitest'
import { densestSpot, inBounds } from './densest.js'

const cluster = (lat, lng, n) => Array.from({ length: n }, (_, i) => ({ lat: lat + (i % 3) * 0.1, lng: lng + (i % 5) * 0.1 }))

describe('densestSpot', () => {
  it('returns null when there are no points', () => {
    expect(densestSpot([])).toBeNull()
  })

  it('picks the crowded cluster over a few strays', () => {
    const spot = densestSpot([...cluster(45, -120, 30), ...cluster(30, -80, 5), { lat: 10, lng: 10 }])
    expect(spot.lat).toBeCloseTo(45.1, 0)
    expect(spot.lng).toBeCloseTo(-119.8, 0)
  })

  it('keeps a cluster together when it straddles a bin edge', () => {
    // 28 points either side of the 40-degree line, plus a rival of 40 points that is spread out over fewer bins.
    const straddle = [...cluster(39.9, -100, 28), ...cluster(40.1, -100, 28)]
    const spot = densestSpot([...straddle, ...cluster(10, 10, 40)])
    expect(spot.lat).toBeGreaterThan(39)
    expect(spot.lat).toBeLessThan(41)
  })
})

describe('inBounds', () => {
  const bounds = { west: -10, east: 10, south: -5, north: 5 }
  it('tests whether a point is inside the bounds', () => {
    expect(inBounds({ lat: 0, lng: 0 }, bounds)).toBe(true)
    expect(inBounds({ lat: 6, lng: 0 }, bounds)).toBe(false)
  })
})
