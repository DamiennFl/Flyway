import { useEffect, useMemo, useRef } from 'react'
import Map, { Source, Layer } from 'react-map-gl/maplibre'
import { AGE_COLOR_EXPRESSION, ageInDays } from '../lib/ageScale.js'
import { DENSITY_COLOR_EXPRESSION } from '../lib/densityScale.js'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  longitude: -96,
  latitude: 39,
  zoom: 3.2,
}

// Zoomed far out, a 0.1 degree cell is under a pixel wide and map tiling drops polygons that small, so cells
// are drawn as dots there. From this zoom on they are drawn as real squares (dots leave gaps between rows).
const CELL_SQUARE_ZOOM = 4

const RECENT_LAYER = {
  id: 'sightings',
  type: 'circle',
  layout: { 'circle-sort-key': ['-', 0, ['get', 'ageDays']] },
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2, 8, 5],
    'circle-color': AGE_COLOR_EXPRESSION,
    'circle-opacity': 0.75,
    'circle-stroke-width': 0.5,
    'circle-stroke-color': '#0b0f14',
  },
}

const CELL_DOT_LAYER = {
  id: 'cell-dots',
  type: 'circle',
  maxzoom: CELL_SQUARE_ZOOM,
  layout: { 'circle-sort-key': ['get', 'n'] },
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 3, 0.8, CELL_SQUARE_ZOOM, 1.3],
    'circle-color': DENSITY_COLOR_EXPRESSION,
    'circle-opacity': 0.9,
  },
}

const CELL_SQUARE_LAYER = {
  id: 'cell-squares',
  type: 'fill',
  minzoom: CELL_SQUARE_ZOOM,
  layout: { 'fill-sort-key': ['get', 'n'] },
  paint: { 'fill-color': DENSITY_COLOR_EXPRESSION, 'fill-opacity': 0.9, 'fill-antialias': false },
}

// Range covering the central 98% of cells, so a few stray cells don't force a world-wide zoom.
// Cells are counted equally: weighting by reports would zoom in on the most heavily birded areas.
function centralRange(cells, key) {
  const values = cells.map((c) => c[key]).sort((a, b) => a - b)
  return [values[Math.floor(values.length * 0.01)], values[Math.ceil(values.length * 0.99) - 1]]
}

function cellPolygon(c, half) {
  const [w, e, s, n] = [c.lng - half, c.lng + half, c.lat - half, c.lat + half]
  return { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }
}

const collection = (features) => ({ type: 'FeatureCollection', features })

export default function MigrationMap({ mode = 'recent', sightings = [], cells = [], cellSize = 0.1, fitKey }) {
  const mapRef = useRef(null)

  // Zoom to the species' range when its historical data loads (not when the era filter changes).
  useEffect(() => {
    if (mode !== 'historical' || cells.length === 0) return
    const [west, east] = centralRange(cells, 'lng')
    const [south, north] = centralRange(cells, 'lat')
    const left = window.innerWidth > 700 ? 340 : 40
    mapRef.current?.fitBounds([[west, south], [east, north]], {
      padding: { top: 50, bottom: 50, left, right: 50 },
      maxZoom: 6,
      duration: 700,
    })
  }, [mode, fitKey])

  const recentData = useMemo(
    () =>
      collection(
        sightings.map((s) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
          properties: { locName: s.locName, obsDt: s.obsDt, howMany: s.howMany, ageDays: ageInDays(s.obsDt) },
        })),
      ),
    [sightings],
  )

  const cellDots = useMemo(
    () =>
      collection(
        cells.map((c) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
          properties: { n: c.n, t: c.t },
        })),
      ),
    [cells],
  )

  const cellSquares = useMemo(
    () =>
      collection(
        cells.map((c) => ({ type: 'Feature', geometry: cellPolygon(c, cellSize / 2), properties: { n: c.n, t: c.t } })),
      ),
    [cells, cellSize],
  )

  return (
    <Map ref={mapRef} initialViewState={INITIAL_VIEW} mapStyle={MAP_STYLE} style={{ width: '100%', height: '100%' }}>
      {mode === 'recent' ? (
        <Source key="sightings" id="sightings" type="geojson" data={recentData}>
          <Layer {...RECENT_LAYER} />
        </Source>
      ) : (
        <>
          <Source key="cell-dots" id="cell-dots" type="geojson" data={cellDots}>
            <Layer {...CELL_DOT_LAYER} />
          </Source>
          <Source key="cell-squares" id="cell-squares" type="geojson" data={cellSquares}>
            <Layer {...CELL_SQUARE_LAYER} />
          </Source>
        </>
      )}
    </Map>
  )
}
