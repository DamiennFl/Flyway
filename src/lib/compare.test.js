import { describe, expect, it } from 'vitest'
import { buildEraCounts, compareEras } from './compare.js'
import { cellKey } from './season.js'

function makeEffort({ lat, lng, era }) {
  const index = new Map(lat.map((la, i) => [cellKey(la, lng[i]), i]))
  return { cells: lat.length, lat, lng, cell: 1, era: Float32Array.from(era), index }
}

describe('buildEraCounts', () => {
  it('bins a species records by cell and era, and computes its typical share', () => {
    const effort = makeEffort({ lat: [0], lng: [0], era: [100, 100, 100, 100, 100] })
    const { n, typicalShare } = buildEraCounts({ lat: [0], lng: [0], era: [2], n: [10] }, effort)
    expect(n[2]).toBe(10) // cell 0, era 2
    expect(typicalShare).toBeCloseTo(10 / 500) // 10 reports over this cell's total effort across all 5 eras
  })

  it('ignores records outside any known effort cell', () => {
    const effort = makeEffort({ lat: [0], lng: [0], era: [100, 100, 100, 100, 100] })
    const { typicalShare } = buildEraCounts({ lat: [99], lng: [99], era: [0], n: [10] }, effort)
    expect(typicalShare).toBe(0)
  })
})

describe('compareEras', () => {
  it('flags a cell as "more common" when the later era has a much higher share', () => {
    const effort = makeEffort({ lat: [0], lng: [0], era: [100, 0, 100, 0, 0] })
    const n = new Float32Array(5)
    n[0] = 5 // fromEra
    n[2] = 20 // toEra
    const { cells, more, less } = compareEras({ n, typicalShare: 0.1 }, effort, 0, 2)
    expect(more).toBe(1)
    expect(less).toBe(0)
    expect(cells).toHaveLength(1)
    expect(cells[0].n).toBeCloseTo(Math.log2((20.5 / 100) / (5.5 / 100)), 5)
  })

  it('skips a cell when effort in either era is below MIN_EFFORT', () => {
    const effort = makeEffort({ lat: [0], lng: [0], era: [10, 0, 100, 0, 0] }) // fromEra effort too low
    const n = new Float32Array(5)
    n[0] = 5
    n[2] = 20
    const { cells } = compareEras({ n, typicalShare: 0.1 }, effort, 0, 2)
    expect(cells).toEqual([])
  })

  it('skips a cell with no records in either era, even with enough effort', () => {
    const effort = makeEffort({ lat: [0], lng: [0], era: [100, 0, 100, 0, 0] })
    const { cells } = compareEras({ n: new Float32Array(5), typicalShare: 0.1 }, effort, 0, 2)
    expect(cells).toEqual([])
  })
})
