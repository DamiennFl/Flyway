const BASE_URL = 'https://api.ebird.org/v2'
const API_KEY = import.meta.env.VITE_EBIRD_API_KEY

async function ebirdFetch(path, params = {}) {
  if (!API_KEY) throw new Error('Missing VITE_EBIRD_API_KEY — add it to .env and restart the dev server')

  const url = new URL(`${BASE_URL}${path}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  const res = await fetch(url, { headers: { 'X-eBirdApiToken': API_KEY } })
  if (!res.ok) throw new Error(`eBird ${res.status}: ${res.statusText}`)
  return res.json()
}

// Most recent sighting of each species in the region (one record per species).
export async function getRecentObservations(regionCode, { back = 30, maxResults = 10000 } = {}) {
  const data = await ebirdFetch(`/data/obs/${regionCode}/recent`, { back, maxResults })
  console.log(`[eBird] ${regionCode} recent: ${data.length} records`, data[0])
  return data
}

// Every sighting of one species in the region (capped at maxResults).
export async function getSpeciesObservations(speciesCode, regionCode, { back = 30, maxResults = 10000 } = {}) {
  const data = await ebirdFetch(`/data/obs/${regionCode}/recent/${speciesCode}`, { back, maxResults })
  console.log(`[eBird] ${regionCode} ${speciesCode}: ${data.length} records`)
  return data
}
