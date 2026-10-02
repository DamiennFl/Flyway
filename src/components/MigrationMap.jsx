import { useMemo } from 'react'
import Map, { Source, Layer } from 'react-map-gl/maplibre'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  longitude: -96,
  latitude: 39,
  zoom: 3.2,
}

const DOT_LAYER = {
  id: 'sightings',
  type: 'circle',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2, 8, 5],
    'circle-color': '#5ee0c1',
    'circle-opacity': 0.6,
    'circle-stroke-width': 0.5,
    'circle-stroke-color': '#0b0f14',
  },
}

export default function MigrationMap({ sightings = [] }) {
  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: sightings.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: { locName: s.locName, obsDt: s.obsDt, howMany: s.howMany },
      })),
    }),
    [sightings],
  )

  return (
    <Map
      initialViewState={INITIAL_VIEW}
      mapStyle={MAP_STYLE}
      style={{ width: '100%', height: '100%' }}
    >
      <Source id="sightings" type="geojson" data={geojson}>
        <Layer {...DOT_LAYER} />
      </Source>
    </Map>
  )
}
