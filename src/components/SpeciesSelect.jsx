import { useMemo, useState } from 'react'

const MAX_SHOWN = 50

export default function SpeciesSelect({ species, value, onChange, disabled }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const selected = species.find((s) => s.code === value)
  const popular = useMemo(() => [...species].sort((a, b) => b.n - a.n).slice(0, MAX_SHOWN), [species])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return popular
    const found = []
    for (const s of species) {
      if (s.name.toLowerCase().includes(q) || s.sci.toLowerCase().includes(q)) {
        found.push(s)
        if (found.length === MAX_SHOWN) break
      }
    }
    return found
  }, [species, popular, query])

  function choose(s) {
    onChange(s.code)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault()
      choose(matches[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="combo">
      <input
        className="species-select"
        type="text"
        role="combobox"
        aria-expanded={open}
        placeholder="Search species…"
        value={open ? query : (selected?.name ?? '')}
        disabled={disabled}
        onFocus={() => {
          setQuery('')
          setActive(0)
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <ul className="combo-list" role="listbox">
          {matches.length === 0 && <li className="combo-empty">No matches</li>}
          {matches.map((s, i) => (
            <li
              key={s.code}
              role="option"
              aria-selected={s.code === value}
              className={`combo-item${i === active ? ' active' : ''}`}
              ref={(el) => {
                if (el && i === active) el.scrollIntoView({ block: 'nearest' })
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(s)
              }}
            >
              {s.name}
              <small>{s.sci}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
