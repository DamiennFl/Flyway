import { describe, expect, it } from 'vitest'
import { buildWave } from './wave.js'
import { WEEKS } from './season.js'

describe('buildWave', () => {
  it('marks a resident species (present all year) as week 1 to 52', () => {
    const effort = { cells: 1, week: Float32Array.from(Array(WEEKS).fill(100)) }
    const season = { n: Float32Array.from(Array(WEEKS).fill(20)) }
    const { arrival, departure } = buildWave(season, effort)
    expect(arrival[0]).toBe(1)
    expect(departure[0]).toBe(WEEKS)
  })

  it('finds the arrival/departure window for a migrant present only mid-year', () => {
    const effort = { cells: 1, week: Float32Array.from(Array(WEEKS).fill(100)) }
    const n = new Float32Array(WEEKS)
    for (let w = 9; w <= 19; w++) n[w] = 100 // present weeks 10-20 (1-indexed)
    const { arrival, departure } = buildWave({ n }, effort)
    expect(arrival[0]).toBe(10)
    expect(departure[0]).toBe(20)
  })

  it('leaves a cell at 0 when it has too few total reports', () => {
    const effort = { cells: 1, week: Float32Array.from(Array(WEEKS).fill(100)) }
    const n = new Float32Array(WEEKS)
    n[0] = 5 // below MIN_REPORTS (10)
    const { arrival, departure } = buildWave({ n }, effort)
    expect(arrival[0]).toBe(0)
    expect(departure[0]).toBe(0)
  })

  it('leaves a cell at 0 when too few weeks have enough effort to judge', () => {
    const effort = { cells: 1, week: new Float32Array(WEEKS) } // all effort 0, below MIN_EFFORT
    const n = Float32Array.from(Array(WEEKS).fill(20))
    const { arrival, departure } = buildWave({ n }, effort)
    expect(arrival[0]).toBe(0)
    expect(departure[0]).toBe(0)
  })
})
