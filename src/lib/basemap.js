// The stock Carto dark basemap is blue-grey. Retinting it to the app's spruce map sheet keeps the data
// the only bright thing on the map.
export const BASEMAP = { land: '#142620', water: '#0a161a', border: '#5f7a58', road: '#1d3229', label: '#9fb3a6' }

function tintedPaint(layer) {
  const { id, type } = layer
  if (type === 'background') return { 'background-color': BASEMAP.land }
  if (type === 'fill') return { 'fill-color': /water/.test(id) ? BASEMAP.water : BASEMAP.land }
  if (type === 'line') {
    if (/boundary|admin/.test(id)) return { 'line-color': BASEMAP.border }
    return { 'line-color': /water/.test(id) ? BASEMAP.water : BASEMAP.road }
  }
  if (type === 'symbol') return { 'text-color': BASEMAP.label, 'text-halo-color': BASEMAP.land }
  return {}
}

// Returns a copy of a MapLibre style with its colours replaced. Layers that already use an expression
// for a colour are overwritten too; only the colours change, never the layout or filters.
export function tintStyle(style) {
  return {
    ...style,
    layers: style.layers.map((layer) => ({ ...layer, paint: { ...layer.paint, ...tintedPaint(layer) } })),
  }
}
