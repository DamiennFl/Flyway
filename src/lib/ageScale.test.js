import { describe, expect, it } from 'vitest'
import { ageInDays } from './ageScale.js'

// ageInDays parses "YYYY-MM-DD HH:MM:SS" as local time (no timezone, like eBird's obsDt),
// so build the fixture from local fields, not toISOString() (which is UTC).
function localObsDt(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

describe('ageInDays', () => {
  it('computes days since an observation timestamp', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(ageInDays(localObsDt(twoDaysAgo))).toBeCloseTo(2, 1)
  })

  it('clamps a future timestamp to 0 instead of going negative', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    expect(ageInDays(localObsDt(tomorrow))).toBe(0)
  })
})
