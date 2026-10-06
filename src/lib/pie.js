// Angle geometry for a simple pie chart from category values. Returns rendering concerns (SVG path,
// the single-slice-is-a-full-circle edge case) to the caller - this just does the math.
export function pieSlices(values) {
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return []

  let angle = -Math.PI / 2 // start at 12 o'clock
  return values.map((value) => {
    const fraction = value / total
    const startAngle = angle
    const endAngle = angle + fraction * Math.PI * 2
    angle = endAngle
    return { value, fraction, startAngle, endAngle }
  })
}
