import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCountryIndex, getCountrySpecies } from '../api/historical.js'
import { countryName } from '../lib/countries.js'

const MAX_SHOWN = 50

export default function SpeciesSelect({ species, value, onChange, disabled, countryFilter, onCountryFilterChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [countryOpen, setCountryOpen] = useState(false)
  const [countryQuery, setCountryQuery] = useState('')

  const countryIndex = useQuery({ queryKey: ['country-index'], queryFn: getCountryIndex, staleTime: Infinity })
  const countrySpecies = useQuery({
    queryKey: ['country-species', countryFilter],
    queryFn: () => getCountrySpecies(countryFilter),
    enabled: Boolean(countryFilter),
    staleTime: Infinity,
  })

  const filteredSpecies = useMemo(() => {
    if (!countryFilter || !countrySpecies.data) return species
    const allowed = new Set(countrySpecies.data.species.map(([code]) => code))
    return species.filter((s) => allowed.has(s.code))
  }, [species, countryFilter, countrySpecies.data])

  const selected = species.find((s) => s.code === value)
  // With no search text: every species reported in the chosen country, most reported there first (the country
  // file is already in that order); otherwise just the most reported species overall.
  const popular = useMemo(() => {
    if (countryFilter && countrySpecies.data) {
      const rank = new Map(countrySpecies.data.species.map(([code], i) => [code, i]))
      return [...filteredSpecies].sort((a, b) => rank.get(a.code) - rank.get(b.code))
    }
    return [...filteredSpecies].sort((a, b) => b.n - a.n).slice(0, MAX_SHOWN)
  }, [filteredSpecies, countryFilter, countrySpecies.data])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return popular
    const found = []
    for (const s of filteredSpecies) {
      if (s.name.toLowerCase().includes(q) || s.sci.toLowerCase().includes(q)) {
        found.push(s)
        if (found.length === MAX_SHOWN) break
      }
    }
    return found
  }, [filteredSpecies, popular, query])

  const countryMatches = useMemo(() => {
    const q = countryQuery.trim().toLowerCase()
    const named = (countryIndex.data ?? []).map((e) => ({ ...e, label: countryName(e.cc) }))
    // Unlike species (10,761 of them), the country list is small enough (~250) to show in full.
    return q ? named.filter((e) => e.label.toLowerCase().includes(q)) : named
  }, [countryIndex.data, countryQuery])

  function choose(s) {
    onChange(s.code)
    setOpen(false)
    setQuery('')
  }

  function chooseCountry(cc) {
    onCountryFilterChange(cc)
    setCountryOpen(false)
    setCountryQuery('')
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
    <div className="species-picker">
      <div className="country-filter">
        <button
          type="button"
          className={`country-chip${countryFilter ? ' active' : ''}`}
          onClick={() => setCountryOpen((o) => !o)}
          disabled={disabled}
        >
          {countryFilter ? countryName(countryFilter) : 'Filter by country'}
        </button>
        {countryFilter && (
          <button
            type="button"
            className="country-clear"
            onClick={() => onCountryFilterChange(null)}
            aria-label="Clear country filter"
          >
            ×
          </button>
        )}
        {countryOpen && (
          <div className="country-list-wrap">
            <input
              className="country-search"
              type="text"
              placeholder="Search countries…"
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              onBlur={() => setCountryOpen(false)}
              autoFocus
            />
            <ul className="country-list" role="listbox">
              <li className="combo-item" onMouseDown={(e) => { e.preventDefault(); chooseCountry(null) }}>
                All countries
              </li>
              {countryMatches.map((c) => (
                <li
                  key={c.cc}
                  role="option"
                  aria-selected={c.cc === countryFilter}
                  className={`combo-item${c.cc === countryFilter ? ' active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); chooseCountry(c.cc) }}
                >
                  {c.label}
                  <small>{c.n.toLocaleString()} species</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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
    </div>
  )
}
