import { describe, expect, it } from 'vitest'
import { BASEMAP, tintStyle } from './basemap.js'

describe('tintStyle', () => {
  const style = {
    version: 8,
    sources: { carto: { type: 'vector' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0e0e0e' } },
      { id: 'water', type: 'fill', paint: { 'fill-color': '#000', 'fill-opacity': 0.5 } },
      { id: 'landcover', type: 'fill', paint: { 'fill-color': '#111' } },
      { id: 'boundary_country', type: 'line', paint: { 'line-color': '#333', 'line-width': 2 } },
      { id: 'road_major', type: 'line' },
      { id: 'place_city', type: 'symbol', layout: { 'text-field': '{name}' }, paint: {} },
    ],
  }
  const byId = (s, id) => s.layers.find((l) => l.id === id)

  it('recolors each layer type and keeps unrelated paint and layout', () => {
    const out = tintStyle(style)
    expect(byId(out, 'background').paint['background-color']).toBe(BASEMAP.land)
    expect(byId(out, 'water').paint['fill-color']).toBe(BASEMAP.water)
    expect(byId(out, 'water').paint['fill-opacity']).toBe(0.5)
    expect(byId(out, 'landcover').paint['fill-color']).toBe(BASEMAP.land)
    expect(byId(out, 'boundary_country').paint['line-color']).toBe(BASEMAP.border)
    expect(byId(out, 'boundary_country').paint['line-width']).toBe(2)
    expect(byId(out, 'road_major').paint['line-color']).toBe(BASEMAP.road)
    expect(byId(out, 'place_city').paint['text-color']).toBe(BASEMAP.label)
    expect(byId(out, 'place_city').layout['text-field']).toBe('{name}')
  })

  it('does not change the input style', () => {
    tintStyle(style)
    expect(byId(style, 'background').paint['background-color']).toBe('#0e0e0e')
  })
})
