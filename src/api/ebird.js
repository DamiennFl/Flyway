export const speciesUrl = (code) => new URL(`https://ebird.org/species/${code}`).toString()

// Recent sightings come from this site's own API, which holds the eBird key so it never reaches the browser.
// In development vite.config.js answers the same address by calling eBird with the key from .env.
// Every sighting of one species in the region over the last 30 days (capped at 10,000).
export async function getSpeciesObservations(speciesCode, regionCode) {
  const res = await fetch(`/api/flyway/recent/${regionCode}/${speciesCode}/`)
  if (!res.ok) throw new Error(`Recent sightings are unavailable right now (${res.status})`)
  const data = await res.json()
  console.log(`[eBird] ${regionCode} ${speciesCode}: ${data.length} records`)
  return data
}
