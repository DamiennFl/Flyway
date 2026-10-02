export default function SpeciesSelect({ species, value, onChange, disabled }) {
  return (
    <select
      className="species-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">Select a species…</option>
      {species.map((s) => (
        <option key={s.speciesCode} value={s.speciesCode}>
          {s.comName}
        </option>
      ))}
    </select>
  )
}
