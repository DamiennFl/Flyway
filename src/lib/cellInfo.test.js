import { describe, expect, it } from 'vitest'
import { cellHeadline, cellRanges } from './cellInfo.js'

describe('cellRanges', () => {
  it('spans half a cell either side of the center, with hemispheres', () => {
    expect(cellRanges({ lat: 40, lng: -96 }, 0.1)).toEqual({ lat: '39.95°N to 40.05°N', lng: '96.05°W to 95.95°W' })
  })

  it('handles cells that cross the equator and the prime meridian', () => {
    expect(cellRanges({ lat: 0, lng: 0 }, 0.5)).toEqual({ lat: '0.25°S to 0.25°N', lng: '0.25°W to 0.25°E' })
  })

  it('drops trailing zeros', () => {
    expect(cellRanges({ lat: 40.25, lng: 10.25 }, 0.5)).toEqual({ lat: '40°N to 40.5°N', lng: '10°E to 10.5°E' })
  })
})

describe('cellHeadline', () => {
  it('shows a report count for the all-years and effort views', () => {
    expect(cellHeadline('historical', { n: 12345 })).toBe('12,345 reports')
    expect(cellHeadline('effort', { n: 1 })).toBe('1 report')
  })

  it('says how much more or less common a cell is when comparing periods', () => {
    expect(cellHeadline('compare', { n: 2, t: 0.8 })).toBe('4.0× more common')
    expect(cellHeadline('compare', { n: 1, t: 0.2 })).toBe('2.0× less common')
    expect(cellHeadline('compare', { n: 0.01, t: 0.5 })).toBe('About the same')
  })

  it('gives no count where n is not a report count', () => {
    expect(cellHeadline('season', { n: 0.3, t: 0.5 })).toBeNull()
    expect(cellHeadline('wave', { n: 30, t: 0.5 })).toBeNull()
  })
})
