// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SpeciesSelect from './SpeciesSelect.jsx'
import { getCountryIndex, getCountrySpecies } from '../api/historical.js'

vi.mock('../api/historical.js', () => ({
  getCountryIndex: vi.fn(),
  getCountrySpecies: vi.fn(),
}))

const SPECIES = [
  { code: 'amerob', name: 'American Robin', sci: 'Turdus migratorius', n: 100, c: ['US'] },
  { code: 'blujay', name: 'Blue Jay', sci: 'Cyanocitta cristata', n: 50, c: ['US'] },
]

function renderSelect(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onChange = vi.fn()
  const onCountryFilterChange = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <SpeciesSelect
        species={SPECIES}
        value=""
        onChange={onChange}
        onCountryFilterChange={onCountryFilterChange}
        {...props}
      />
    </QueryClientProvider>,
  )
  return { onChange, onCountryFilterChange }
}

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView; the combo list's active item calls it on render.
  Element.prototype.scrollIntoView = vi.fn()
  getCountryIndex.mockResolvedValue([{ cc: 'JP', n: 631 }])
  getCountrySpecies.mockResolvedValue({ species: [['blujay', 'Blue Jay', 10]] })
})

describe('SpeciesSelect', () => {
  it('shows the selected species name, and a placeholder when nothing is selected', () => {
    renderSelect({ value: 'amerob' })
    expect(screen.getByPlaceholderText('Search species…')).toHaveValue('American Robin')
  })

  it('opens a filtered dropdown as the user types and reports the chosen species', async () => {
    const user = userEvent.setup()
    const { onChange } = renderSelect()
    const input = screen.getByPlaceholderText('Search species…')
    await user.click(input)
    expect(screen.getByText('American Robin')).toBeInTheDocument()
    expect(screen.getByText('Blue Jay')).toBeInTheDocument()

    await user.type(input, 'blue')
    expect(screen.queryByText('American Robin')).not.toBeInTheDocument()
    expect(screen.getByText('Blue Jay')).toBeInTheDocument()

    await user.click(screen.getByText('Blue Jay'))
    expect(onChange).toHaveBeenCalledWith('blujay')
  })

  it('disables the species input and country chip when disabled', () => {
    renderSelect({ disabled: true })
    expect(screen.getByPlaceholderText('Search species…')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Filter by country' })).toBeDisabled()
  })

  it('lets the user pick a country, which narrows the species list', async () => {
    const user = userEvent.setup()
    const { onCountryFilterChange } = renderSelect()
    await user.click(screen.getByRole('button', { name: 'Filter by country' }))
    const japan = await screen.findByText('Japan')
    await user.click(japan)
    expect(onCountryFilterChange).toHaveBeenCalledWith('JP')
  })

  it('shows the active country filter as the chip label, with a clear control', async () => {
    const user = userEvent.setup()
    const { onCountryFilterChange } = renderSelect({ countryFilter: 'JP' })
    expect(screen.getByRole('button', { name: 'Japan' })).toBeInTheDocument()
    await user.click(screen.getByLabelText('Clear country filter'))
    expect(onCountryFilterChange).toHaveBeenCalledWith(null)
  })

  it('narrows the species dropdown to the filtered country once its data loads', async () => {
    const user = userEvent.setup()
    renderSelect({ countryFilter: 'JP' })
    const input = screen.getByPlaceholderText('Search species…')
    await user.click(input)
    await waitFor(() => expect(screen.queryByText('American Robin')).not.toBeInTheDocument())
    expect(screen.getByText('Blue Jay')).toBeInTheDocument()
  })
})
