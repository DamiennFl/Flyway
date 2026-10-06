import { describe, expect, it } from 'vitest'
import { bestTimePlace, buildCountryWeekShare, scaleForDisplay } from './flyway.js'

describe('buildCountryWeekShare', () => {
  const data = {
    week: [1, 1, 2],
    country: ['US', 'MX', 'US'],
    n: [50, 10, 100],
  }
  const effortCountry = {
    US: Array(52).fill(100),
    MX: Array(52).fill(100),
  }
  const countries = [['US', 150], ['MX', 10]]

  it('divides each country-week total by that country-week\'s all-species effort', () => {
    const { series } = buildCountryWeekShare(data, effortCountry, countries)
    const us = series.find((s) => s.cc === 'US')
    const mx = series.find((s) => s.cc === 'MX')
    expect(us.values[0]).toBeCloseTo(0.5) // 50/100
    expect(us.values[1]).toBeCloseTo(1) // 100/100
    expect(mx.values[0]).toBeCloseTo(0.1) // 10/100
  })

  it('only includes up to topN countries, in the order given', () => {
    const { series } = buildCountryWeekShare(data, effortCountry, countries, 1)
    expect(series).toHaveLength(1)
    expect(series[0].cc).toBe('US')
  })

  it('treats a week with too little country-wide effort as untrustworthy (0), not a spike', () => {
    const thinEffort = { US: Array(52).fill(5) } // below MIN_COUNTRY_EFFORT (20)
    const { series } = buildCountryWeekShare(data, thinEffort, [['US', 50]])
    expect(series[0].values[0]).toBe(0)
  })

  it('treats a country with no effort data at all as 0 everywhere, not a crash', () => {
    const { series } = buildCountryWeekShare(data, {}, [['US', 50]])
    expect(series[0].values.every((v) => v === 0)).toBe(true)
  })

  it('reports maxShare as the largest value across all returned series', () => {
    const { maxShare } = buildCountryWeekShare(data, effortCountry, countries)
    expect(maxShare).toBeCloseTo(1) // US week 2: 100/100
  })
})

describe('bestTimePlace', () => {
  it('picks the single highest share across every given series', () => {
    const series = [
      { cc: 'US', values: [0.1, 0.2, 0.05] },
      { cc: 'BM', values: [0.01, 0.9, 0.02] },
    ]
    expect(bestTimePlace(series)).toEqual({ cc: 'BM', week: 2, share: 0.9 })
  })

  it('returns week as 1-indexed, not the array index', () => {
    const series = [{ cc: 'US', values: [0.1, 0.1, 0.1, 0.5] }]
    expect(bestTimePlace(series).week).toBe(4)
  })

  it('returns null for an empty series list', () => {
    expect(bestTimePlace([])).toBeNull()
  })
})

describe('scaleForDisplay', () => {
  it('passes the value through unchanged when not on log scale', () => {
    expect(scaleForDisplay(0.02, false)).toBe(0.02)
  })

  it('compresses large values relative to small ones on log scale', () => {
    const small = scaleForDisplay(0.001, true)
    const large = scaleForDisplay(0.04, true)
    // 40x the raw value should be compressed to far less than 40x after log1p.
    expect(large / small).toBeLessThan(10)
    expect(large).toBeGreaterThan(small)
  })

  it('maps 0 to 0 either way', () => {
    expect(scaleForDisplay(0, false)).toBe(0)
    expect(scaleForDisplay(0, true)).toBe(0)
  })
})
