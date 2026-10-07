import { describe, expect, it } from 'vitest'
import { sightingHeadline, sightingWhen } from './sightingInfo.js'

describe('sightingHeadline', () => {
  it('says how many birds were counted', () => {
    expect(sightingHeadline(12)).toBe('12 birds')
    expect(sightingHeadline(1)).toBe('1 bird')
    expect(sightingHeadline(1500)).toBe('1,500 birds')
  })

  it('says so when the observer did not count', () => {
    expect(sightingHeadline(undefined)).toBe('Count not reported')
    expect(sightingHeadline(null)).toBe('Count not reported')
  })
})

describe('sightingWhen', () => {
  it('writes the date and a 12-hour time', () => {
    expect(sightingWhen('2026-10-06 12:21')).toBe('Oct 6, 2026, 12:21 PM')
    expect(sightingWhen('2026-01-31 18:05')).toBe('Jan 31, 2026, 6:05 PM')
  })

  it('handles midnight and noon', () => {
    expect(sightingWhen('2026-10-06 00:05')).toBe('Oct 6, 2026, 12:05 AM')
    expect(sightingWhen('2026-10-06 12:00')).toBe('Oct 6, 2026, 12:00 PM')
  })

  it('leaves the time out when there is none', () => {
    expect(sightingWhen('2026-10-06')).toBe('Oct 6, 2026')
  })

  it('shows anything it cannot read as it is', () => {
    expect(sightingWhen('yesterday')).toBe('yesterday')
    expect(sightingWhen(undefined)).toBe('')
  })
})
