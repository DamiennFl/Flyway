import { describe, expect, it } from 'vitest'
import { WEEKS, buildEffortIndex, buildSpeciesSeason, effortCellsForWeek, regionSeries, weekLabel } from './season.js'

describe('buildEffortIndex', () => {
  it('indexes cells by lat/lng and copies week/era into typed arrays', () => {
    const effort = { cell: 0.5, lat: [2, -3], lng: [4, 7], week: [1, 2], era: [10, 20] }
    const index = buildEffortIndex(effort)
    expect(index.cells).toBe(2)
    expect(index.index.get).toBeInstanceOf(Function)
    expect(index.index.get(index.index.keys().next().value)).toBeDefined()
    expect([...index.week]).toEqual([1, 2])
    expect([...index.era]).toEqual([10, 20])
  })

  it('leaves week null when the source has no week data (range layers)', () => {
    const index = buildEffortIndex({ cell: 0.1, lat: [1], lng: [1], era: [5] })
    expect(index.week).toBeNull()
  })
})

describe('buildSpeciesSeason', () => {
  it('bins records into cell*week and computes share of effort', () => {
    const effort = buildEffortIndex({
      cell: 0.5,
      lat: [5],
      lng: [5],
      week: Array(WEEKS).fill(100),
      era: [0, 0, 0, 0, 0],
    })
    const season = buildSpeciesSeason({ lat: [5], lng: [5], week: [1], n: [20] }, effort)
    expect(season.n[0]).toBe(20)
    expect(season.freq[0]).toBeCloseTo(0.2)
    expect(season.max).toBeCloseTo(0.2)
  })

  it('ignores cell/week combinations below MIN_EFFORT when picking the max', () => {
    const effort = buildEffortIndex({
      cell: 0.5,
      lat: [5],
      lng: [5],
      week: Array(WEEKS).fill(10), // below MIN_EFFORT (50)
      era: [0, 0, 0, 0, 0],
    })
    const season = buildSpeciesSeason({ lat: [5], lng: [5], week: [1], n: [20] }, effort)
    expect(season.freq[0]).toBe(0) // not counted as "positive" since effort is too thin
    expect(season.max).toBe(1) // falls back to 1 when nothing qualifies
  })

  it('drops records whose cell has no effort entry at all', () => {
    const effort = buildEffortIndex({ cell: 0.5, lat: [5], lng: [5], week: Array(WEEKS).fill(100), era: [0] })
    const season = buildSpeciesSeason({ lat: [999], lng: [999], week: [1], n: [20] }, effort)
    expect(season.n.every((v) => v === 0)).toBe(true)
  })
})

describe('regionSeries', () => {
  it('sums reports/effort by week for cells inside the given bounds', () => {
    const n = new Float32Array(2 * WEEKS)
    n[0] = 5 // cell 0, week 1
    const season = { n }
    const effort = {
      cell: 1,
      cells: 2,
      lat: [0, 10],
      lng: [0, 10],
      week: Float32Array.from({ length: 2 * WEEKS }, (_, i) => (i < WEEKS ? 100 : 100)),
    }
    const series = regionSeries(season, effort, { south: -1, north: 1, west: -1, east: 1 })
    expect(series[0]).toBeCloseTo(0.05) // only cell 0 is inside bounds: 5 / 100
    expect(series[1]).toBe(0)
  })

  it('returns 0 for weeks with too little effort to trust, even with bounds matching', () => {
    const n = new Float32Array(WEEKS)
    n[0] = 5
    const effort = { cell: 1, cells: 1, lat: [0], lng: [0], week: Float32Array.from(Array(WEEKS).fill(10)) }
    const series = regionSeries({ n }, effort, { south: -1, north: 1, west: -1, east: 1 })
    expect(series[0]).toBe(0)
  })
})

describe('effortCellsForWeek', () => {
  const effort = {
    cell: 0.5,
    lat: [2, 4],
    lng: [6, 8],
    week: (() => {
      const w = new Array(2 * WEEKS).fill(0)
      w[0] = 50 // cell 0, week 1
      w[1 * WEEKS + 0] = 200 // cell 1, week 1
      w[5] = 10 // cell 0, week 6
      return w
    })(),
  }

  it('converts cell indices to degrees and reports raw activity for the given week', () => {
    const { cells, cellSize } = effortCellsForWeek(effort, 1)
    expect(cellSize).toBe(0.5)
    expect(cells).toEqual([
      { lat: 1, lng: 3, n: 50, t: Math.log1p(50) / Math.log1p(200) },
      { lat: 2, lng: 4, n: 200, t: 1 },
    ])
  })

  it('omits cells with no activity in that week', () => {
    const { cells } = effortCellsForWeek(effort, 2)
    expect(cells).toEqual([])
  })

  it('reads a different week correctly', () => {
    const { cells } = effortCellsForWeek(effort, 6)
    expect(cells).toEqual([{ lat: 1, lng: 3, n: 10, t: 1 }])
  })
})

describe('weekLabel', () => {
  it('labels a week fully inside one month', () => {
    expect(weekLabel(1)).toBe('Jan 1–7')
  })

  it('labels a week that spans two months', () => {
    expect(weekLabel(5)).toBe('Jan 29 – Feb 4')
  })

  it('labels the last week of the year through Dec 31', () => {
    expect(weekLabel(WEEKS)).toBe('Dec 24–31')
  })
})
