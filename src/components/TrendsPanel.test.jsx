// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrendsPanel from './TrendsPanel.jsx'
import { getCountryIndex, getCountrySpecies, getEffortCountry, getWeeklySpecies } from '../api/historical.js'

vi.mock('../api/historical.js', () => ({
  getCountryIndex: vi.fn(),
  getCountrySpecies: vi.fn(),
  getWeeklySpecies: vi.fn(),
  getEffortCountry: vi.fn(),
}))

const SPECIES = [{ code: 'amerob', name: 'American Robin', sci: 'Turdus migratorius', n: 100, c: ['US'] }]

const RECENT_SPECIES_DATA = {
  code: 'amerob',
  name: 'American Robin',
  sci: 'Turdus migratorius',
  records: 1234,
  years: { year: [2010, 2015, 2020], n: [10, 20, 100] },
  countries: [['US', 1000], ['CA', 234]],
  week: [1, 2],
  country: ['US', 'CA'],
  n: [50, 20],
}

const OLD_SPECIES_DATA = {
  ...RECENT_SPECIES_DATA,
  years: { year: [1950, 2010, 2020], n: [1, 20, 100] },
}

function renderPanel(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onClose = vi.fn()
  const onSpeciesChange = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <TrendsPanel
        open
        onClose={onClose}
        species={SPECIES}
        speciesCode="amerob"
        onSpeciesChange={onSpeciesChange}
        onCountryFilterChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onClose, onSpeciesChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
  getCountryIndex.mockResolvedValue([])
  getCountrySpecies.mockResolvedValue({ species: [] })
  getWeeklySpecies.mockResolvedValue(RECENT_SPECIES_DATA)
  getEffortCountry.mockResolvedValue({ US: Array(52).fill(1000), CA: Array(52).fill(500) })
})

describe('TrendsPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TrendsPanel open={false} species={SPECIES} speciesCode="amerob" />
      </QueryClientProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('prompts for a species when none is selected', () => {
    renderPanel({ speciesCode: '' })
    expect(screen.getByText('Pick a species to see its trend.')).toBeInTheDocument()
  })

  it('shows stats, the species name, and the country list once data loads', async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText('American Robin')).toBeInTheDocument())
    expect(screen.getByText('Turdus migratorius')).toBeInTheDocument()
    const stats = within(document.querySelector('.trends-stats'))
    expect(stats.getByText('2010')).toBeInTheDocument() // First recorded
    expect(stats.getByText('2020')).toBeInTheDocument() // Most recent
    expect(stats.getByText('1,234')).toBeInTheDocument() // Total reports
    const pie = within(document.querySelector('.trends-pie-legend'))
    expect(pie.getByText('United States')).toBeInTheDocument()
    expect(pie.getByText(/1,000/)).toBeInTheDocument()
  })

  it('hides the full-history toggle when all data is already from 2000 onward', async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByText('American Robin')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Full history/ })).not.toBeInTheDocument()
  })

  it('shows and toggles the full-history control when older data exists', async () => {
    getWeeklySpecies.mockResolvedValue(OLD_SPECIES_DATA)
    const user = userEvent.setup()
    renderPanel()
    const toggle = await screen.findByRole('button', { name: 'Full history, since 1950' })
    // Only years >= 2000 render by default even though 1950 data exists.
    expect(screen.queryByText('1950', { selector: 'text' })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Since 2000' })).toBeInTheDocument()
  })

  it('renders the Flyway chart and toggles between linear and log scale', async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(document.querySelector('.flyway-chart')).toBeInTheDocument())
    expect(document.querySelectorAll('.flyway-line')).toHaveLength(2) // US, CA from countries list
    const toggle = screen.getByRole('button', { name: 'Log scale' })
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Linear scale' })).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not fetch trends data when closed', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TrendsPanel open={false} species={SPECIES} speciesCode="amerob" />
      </QueryClientProvider>,
    )
    expect(getWeeklySpecies).not.toHaveBeenCalled()
  })

  it('shows the report count for a year when hovering its bar', async () => {
    renderPanel()
    await waitFor(() => expect(document.querySelector('.trends-chart')).toBeInTheDocument())
    expect(screen.getByText('Hover over a bar to see its count.')).toBeInTheDocument()

    const hits = document.querySelectorAll('.trends-chart .bar-hit')
    await userEvent.hover(hits[2])
    expect(document.querySelector('.trends-readout').textContent).toBe('2020 100 reports')

    await userEvent.unhover(hits[2])
    await userEvent.hover(document.querySelector('.trends-chart'))
    await userEvent.unhover(document.querySelector('.trends-chart'))
    expect(screen.getByText('Hover over a bar to see its count.')).toBeInTheDocument()
  })
})
