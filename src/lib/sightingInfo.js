// What the map says about one recent sighting when you hover over its dot.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// eBird leaves the count out when the observer saw the species but did not count it.
export function sightingHeadline(howMany) {
  if (typeof howMany !== 'number' || !Number.isFinite(howMany)) return 'Count not reported'
  return `${howMany.toLocaleString()} ${howMany === 1 ? 'bird' : 'birds'}`
}

// obsDt looks like "2026-10-06 12:21", in the local time of the place the bird was seen. The time is missing
// when the observer did not record one.
export function sightingWhen(obsDt) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(obsDt ?? '')
  if (!match) return obsDt ?? ''
  const [, year, month, day, hour, minute] = match
  const date = `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`
  if (hour === undefined) return date
  const h = Number(hour)
  return `${date}, ${h % 12 || 12}:${minute} ${h < 12 ? 'AM' : 'PM'}`
}
