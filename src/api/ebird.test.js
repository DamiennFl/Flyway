import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSpeciesObservations } from './ebird.js'

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('getSpeciesObservations', () => {
  it("asks this site's own API rather than eBird, and returns the sightings", async () => {
    const sightings = [{ lat: 40, lng: -96 }]
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => sightings })
    vi.stubGlobal('fetch', fetchMock)

    expect(await getSpeciesObservations('barswa', 'US')).toEqual(sightings)
    expect(fetchMock).toHaveBeenCalledWith('/api/flyway/recent/US/barswa/')
  })

  it('says so when the server could not get the sightings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))

    await expect(getSpeciesObservations('barswa', 'US')).rejects.toThrow('unavailable right now (502)')
  })
})
