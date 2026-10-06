import { describe, expect, it } from 'vitest'
import { pieSlices } from './pie.js'

describe('pieSlices', () => {
  it('splits values into fractions that sum to 1', () => {
    const slices = pieSlices([3, 1])
    expect(slices[0].fraction).toBeCloseTo(0.75)
    expect(slices[1].fraction).toBeCloseTo(0.25)
    expect(slices.reduce((sum, s) => sum + s.fraction, 0)).toBeCloseTo(1)
  })

  it('starts the first slice at 12 o\'clock (-90deg) and proceeds clockwise without gaps', () => {
    const slices = pieSlices([1, 1, 1])
    expect(slices[0].startAngle).toBeCloseTo(-Math.PI / 2)
    // each slice's end angle is the next slice's start angle
    expect(slices[0].endAngle).toBeCloseTo(slices[1].startAngle)
    expect(slices[1].endAngle).toBeCloseTo(slices[2].startAngle)
    // full circle by the end
    expect(slices[2].endAngle - slices[0].startAngle).toBeCloseTo(Math.PI * 2)
  })

  it('returns an empty array when the total is zero', () => {
    expect(pieSlices([0, 0])).toEqual([])
  })

  it('returns an empty array for no values', () => {
    expect(pieSlices([])).toEqual([])
  })

  it('gives a single value the entire circle', () => {
    const slices = pieSlices([5])
    expect(slices[0].fraction).toBe(1)
    expect(slices[0].endAngle - slices[0].startAngle).toBeCloseTo(Math.PI * 2)
  })
})
