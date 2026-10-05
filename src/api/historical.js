const DATA_BASE_URL = import.meta.env.VITE_DATA_BASE_URL ?? '/data'

async function getJson(path) {
  const res = await fetch(`${DATA_BASE_URL}/${path}`)
  if (!res.ok) throw new Error(`Historical data ${res.status}: ${path}`)
  return res.json()
}

export const getSpeciesIndex = () => getJson('index.json.gz')
export const getMeta = () => getJson('meta.json')
export const getEffort = () => getJson('effort.json.gz')
export const getEffortFine = () => getJson('effort-fine.json.gz')
export const getHistoricalSpecies = (code) => getJson(`range-fine/${code}.json.gz`)
export const getWeeklySpecies = (code) => getJson(`species/${code}.json.gz`)
