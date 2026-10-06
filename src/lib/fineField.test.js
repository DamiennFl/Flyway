import { describe, expect, it } from 'vitest'
import { buildInterpolation, waveCellsFine, weekCellsFine } from './fineField.js'
import { WEEKS, cellKey } from './season.js'

describe('buildInterpolation', () => {
  it('finds the four surrounding coarse cells with bilinear weights', () => {
    const index = new Map([
      [cellKey(0, 0), 0],
      [cellKey(0, 1), 1],
      [cellKey(1, 0), 2],
      [cellKey(1, 1), 3],
    ])
    const interp = buildInterpolation([{ lat: 0.5, lng: 0.5 }], { cell: 1, index })
    expect([...interp.idx]).toEqual([0, 1, 2, 3])
    expect([...interp.weight]).toEqual([0.25, 0.25, 0.25, 0.25])
  })

  it('marks missing corners as -1 instead of throwing', () => {
    const interp = buildInterpolation([{ lat: 50, lng: 50 }], { cell: 1, index: new Map() })
    expect([...interp.idx]).toEqual([-1, -1, -1, -1])
  })
})

function makeEffortWeek(cells, value) {
  return Float32Array.from({ length: cells * WEEKS }, () => value)
}

describe('weekCellsFine', () => {
  it('blends the four surrounding cells into one share value', () => {
    const interp = { idx: Int32Array.from([0, 0, 0, 0]), weight: Float32Array.from([0.25, 0.25, 0.25, 0.25]) }
    const effort = { week: makeEffortWeek(1, 100) }
    const freq = new Float32Array(WEEKS)
    freq[0] = 0.4
    const season = { freq, max: 0.4 }
    const cells = weekCellsFine(season, effort, interp, [{ lat: 1, lng: 1 }], 1)
    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ lat: 1, lng: 1, t: 1 })
    expect(cells[0].n).toBeCloseTo(0.4) // Float32 storage, not exactly 0.4
  })

  it('drops a fine cell when its surrounding weight is too thin', () => {
    const interp = { idx: Int32Array.from([-1, -1, -1, 0]), weight: Float32Array.from([0, 0, 0, 0.1]) }
    const effort = { week: makeEffortWeek(1, 100) }
    const season = { freq: new Float32Array(WEEKS), max: 1 }
    expect(weekCellsFine(season, effort, interp, [{ lat: 1, lng: 1 }], 1)).toEqual([])
  })

  it('skips corners whose effort is below MIN_EFFORT for that week', () => {
    const interp = { idx: Int32Array.from([0, 0, 0, 0]), weight: Float32Array.from([0.25, 0.25, 0.25, 0.25]) }
    const effort = { week: makeEffortWeek(1, 10) } // below MIN_EFFORT (50)
    const freq = new Float32Array(WEEKS)
    freq[0] = 0.4
    const cells = weekCellsFine({ freq, max: 0.4 }, effort, interp, [{ lat: 1, lng: 1 }], 1)
    expect(cells).toEqual([])
  })
})

describe('waveCellsFine', () => {
  const interp = { idx: Int32Array.from([0, 0, 0, 0]), weight: Float32Array.from([0.25, 0.25, 0.25, 0.25]) }

  it('includes a cell the wave has already reached, for arrival', () => {
    const wave = { arrival: Uint8Array.from([10]), departure: Uint8Array.from([0]) }
    const cells = waveCellsFine(wave, interp, [{ lat: 1, lng: 1 }], 12, 'arrival')
    expect(cells).toEqual([{ lat: 1, lng: 1, n: 10, t: 9 / 51 }])
  })

  it('excludes a cell the wave has not reached yet, for arrival', () => {
    const wave = { arrival: Uint8Array.from([10]), departure: Uint8Array.from([0]) }
    expect(waveCellsFine(wave, interp, [{ lat: 1, lng: 1 }], 5, 'arrival')).toEqual([])
  })

  it('includes a cell the wave has not yet left, for departure', () => {
    const wave = { arrival: Uint8Array.from([0]), departure: Uint8Array.from([40]) }
    const cells = waveCellsFine(wave, interp, [{ lat: 1, lng: 1 }], 35, 'departure')
    expect(cells).toEqual([{ lat: 1, lng: 1, n: 40, t: 39 / 51 }])
  })

  it('excludes a cell the wave has already left, for departure', () => {
    const wave = { arrival: Uint8Array.from([0]), departure: Uint8Array.from([40]) }
    expect(waveCellsFine(wave, interp, [{ lat: 1, lng: 1 }], 45, 'departure')).toEqual([])
  })
})
