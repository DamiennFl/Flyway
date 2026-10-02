import { useMemo } from 'react'
import Map, { Source, Layer } from 'react-map-gl/maplibre'
import { AGE_COLOR_EXPRESSION, ageInDays } from '../lib/ageScale.js'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  longitude: -96,
  latitude: 39,
  zoom: 3.2,
}

const DOT_LAYER = {
  id: 'sightings',
  type: 'circle',
  layout: {
    'circle-sort-key': ['-', 0, ['get', 'ageDays']],
  },
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2, 8, 5],
    'circle-color': AGE_COLOR_EXPRESSION,
    'circle-opacity': 0.75,
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
        properties: {
          locName: s.locName,
          obsDt: s.obsDt,
          howMany: s.howMany,
          ageDays: ageInDays(s.obsDt),
        },
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
