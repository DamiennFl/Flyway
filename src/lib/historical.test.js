import { describe, expect, it } from 'vitest'
import { aggregateCells, filterByCountry } from './historical.js'

describe('aggregateCells', () => {
  const data = {
    cell: 0.5,
    era: [0, 0, 1, 2],
    lat: [2, 2, 2, 4],
    lng: [4, 4, 4, 8],
    n: [10, 5, 7, 100],
  }

  it('sums records that share a cell, across eras when eraId is null', () => {
    const { cells, total, cellSize } = aggregateCells(data, null)
    expect(cellSize).toBe(0.5)
    expect(total).toBe(122)
    const merged = cells.find((c) => c.lat === 1 && c.lng === 2)
    expect(merged.n).toBe(22) // rows 0, 1, 2 share lat=2*0.5, lng=4*0.5
    const other = cells.find((c) => c.lat === 2 && c.lng === 4)
    expect(other.n).toBe(100)
  })

  it('filters to a single era when eraId is given', () => {
    const { cells, total } = aggregateCells(data, 0)
    expect(total).toBe(15)
    expect(cells).toHaveLength(1)
    expect(cells[0].n).toBe(15)
  })

  it('scales the intensity t by the cell with the most records', () => {
    const { cells } = aggregateCells(data, null)
    const max = cells.find((c) => c.n === 100)
    const min = cells.find((c) => c.n === 22)
    expect(max.t).toBe(1)
    expect(min.t).toBeCloseTo(Math.log1p(22) / Math.log1p(100))
  })
})

describe('filterByCountry', () => {
  const weekly = {
    code: 'amerob',
    cell: 0.5,
    era: [0, 1, 2],
    week: [1, 2, 3],
    lat: [1, 2, 3],
    lng: [1, 2, 3],
    country: ['US', 'MX', 'US'],
    n: [10, 20, 30],
  }

  it('returns the data unchanged when no country is given', () => {
    expect(filterByCountry(weekly, null)).toBe(weekly)
    expect(filterByCountry(weekly, undefined)).toBe(weekly)
  })

  it('returns the data unchanged when the payload has no country field yet', () => {
    // Regression: this used to throw reading .length on undefined, which crashed every
    // historical lens while range-fine data was mid-re-ingest and didn't have country yet.
    const noCountry = { cell: 0.1, era: [0], lat: [1], lng: [1], n: [5] }
    expect(filterByCountry(noCountry, 'US')).toBe(noCountry)
  })

  it('narrows every parallel array to the matching country, preserving other fields', () => {
    const filtered = filterByCountry(weekly, 'US')
    expect(filtered.era).toEqual([0, 2])
    expect(filtered.week).toEqual([1, 3])
    expect(filtered.lat).toEqual([1, 3])
    expect(filtered.lng).toEqual([1, 3])
    expect(filtered.n).toEqual([10, 30])
    expect(filtered.code).toBe('amerob')
    expect(filtered.cell).toBe(0.5)
  })

  it('omits week when the source data has no week field (range-fine shape)', () => {
    const rangeFine = { cell: 0.1, era: [0, 1], lat: [1, 2], lng: [1, 2], country: ['US', 'MX'], n: [1, 2] }
    const filtered = filterByCountry(rangeFine, 'MX')
    expect(filtered.era).toEqual([1])
    expect(filtered.week).toBeUndefined()
  })

  it('produces empty arrays, not a crash, when the country has no records', () => {
    const filtered = filterByCountry(weekly, 'JP')
    expect(filtered.era).toEqual([])
    expect(filtered.n).toEqual([])
  })
})
