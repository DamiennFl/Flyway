import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Source, Layer } from 'react-map-gl/maplibre'
import { AGE_COLOR_EXPRESSION, ageInDays } from '../lib/ageScale.js'
import { PALETTES } from '../lib/palettes.js'
import { tintStyle } from '../lib/basemap.js'

const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  longitude: -96,
  latitude: 39,
  zoom: 3.2,
}

const RECENT_LAYER = {
  id: 'sightings',
  type: 'circle',
  layout: { 'circle-sort-key': ['-', 0, ['get', 'ageDays']] },
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2, 8, 5],
    'circle-color': AGE_COLOR_EXPRESSION,
    'circle-opacity': 0.75,
    'circle-stroke-width': 0.5,
    'circle-stroke-color': '#0f1d19',
  },
}

// Zoomed far out, a cell is under a pixel wide and map tiling drops polygons that small, so cells are drawn
// as dots there. From the switch zoom on they are drawn as real squares (dots leave gaps between rows).
// Coarse (0.5 degree, e.g. the effort view) cells switch later than fine ones: the gapped dot grid at that
// scale reads as a deliberate texture, not a rendering limitation, so it's kept longer.
const squareZoomFor = (cellSize) => (cellSize >= 0.5 ? 5 : 4)

// Dots beyond this many are thinned (the same cells every time, so nothing flickers) and drawn larger.
const MAX_DOTS = 40000

const keepDot = (c, stride) =>
  stride === 1 || ((((Math.round(c.lat * 10) * 73856093) ^ (Math.round(c.lng * 10) * 19349663)) >>> 0) % stride) === 0

function cellLayers(squareZoom, color, dotScale) {
  return {
    dots: {
      id: 'cell-dots',
      type: 'circle',
      maxzoom: squareZoom,
      layout: { 'circle-sort-key': ['get', 'n'] },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 0.8 * dotScale, squareZoom, 1.3 * dotScale],
        'circle-color': color,
        'circle-opacity': 0.75,
      },
    },
    squares: {
      id: 'cell-squares',
      type: 'fill',
      minzoom: squareZoom,
      layout: { 'fill-sort-key': ['get', 'n'] },
      paint: { 'fill-color': color, 'fill-opacity': 0.75, 'fill-antialias': false },
    },
  }
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
const EMPTY = collection([])

// stableCount: how many cells this species has in the current view mode regardless of week, so thinning
// does not change as the week does.
export default function MigrationMap({
  mode = 'recent',
  sightings = [],
  cells = [],
  stableCount = cells.length,
  cellSize = 0.1,
  palette = 'density',
  fitCells = [],
  fitKey,
  onBoundsChange,
}) {
  const mapRef = useRef(null)
  const [mapStyle, setMapStyle] = useState(MAP_STYLE_URL)
  const [view, setView] = useState({ zoom: INITIAL_VIEW.zoom, bounds: null })
  const squareZoom = squareZoomFor(cellSize)
  const stride = Math.max(1, Math.ceil(stableCount / MAX_DOTS))
  const dotScale = Math.min(2.2, Math.sqrt(stride))
  const layers = useMemo(
    () => cellLayers(squareZoom, PALETTES[palette].expression, dotScale),
    [squareZoom, palette, dotScale],
  )

  // Load the stock style and retint it; the stock style stays as the fallback if that fails.
  useEffect(() => {
    let cancelled = false
    fetch(MAP_STYLE_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((style) => !cancelled && setMapStyle(tintStyle(style)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Zoom to the species' range when its historical data loads (not when the era filter or week changes).
  useEffect(() => {
    if (mode !== 'historical' || fitCells.length === 0) return
    const [west, east] = centralRange(fitCells, 'lng')
    const [south, north] = centralRange(fitCells, 'lat')
    const left = window.innerWidth > 700 ? 340 : 40
    mapRef.current?.fitBounds([[west, south], [east, north]], {
      padding: { top: 50, bottom: 50, left, right: 50 },
      maxZoom: 6,
      duration: 700,
    })
  }, [mode, fitKey])

  function reportView(e) {
    const b = e.target.getBounds()
    const bounds = { west: Math.max(-180, b.getWest()), east: Math.min(180, b.getEast()), south: b.getSouth(), north: b.getNorth() }
    setView({ zoom: e.target.getZoom(), bounds })
    onBoundsChange?.(bounds)
  }

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

  // Only the layer that is visible at the current zoom is built, and squares only for cells in (or near) view,
  // so large species stay fast when the week changes.
  const showSquares = view.zoom >= squareZoom

  const cellDots = useMemo(
    () =>
      showSquares
        ? EMPTY
        : collection(
            cells
              .filter((c) => keepDot(c, stride))
              .map((c) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
                properties: { n: c.n, t: c.t },
              })),
          ),
    [cells, showSquares, stride],
  )

  const cellSquares = useMemo(() => {
    if (!showSquares || !view.bounds) return EMPTY
    const { west, east, south, north } = view.bounds
    const padLng = (east - west) / 2
    const padLat = (north - south) / 2
    return collection(
      cells
        .filter(
          (c) => c.lng >= west - padLng && c.lng <= east + padLng && c.lat >= south - padLat && c.lat <= north + padLat,
        )
        .map((c) => ({ type: 'Feature', geometry: cellPolygon(c, cellSize / 2), properties: { n: c.n, t: c.t } })),
    )
  }, [cells, cellSize, showSquares, view.bounds])

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      mapStyle={mapStyle}
      style={{ width: '100%', height: '100%' }}
      onLoad={reportView}
      onMoveEnd={reportView}
    >
      {mode === 'recent' ? (
        <Source key="sightings" id="sightings" type="geojson" data={recentData}>
          <Layer {...RECENT_LAYER} />
        </Source>
      ) : (
        <>
          <Source key="cell-dots" id="cell-dots" type="geojson" data={cellDots}>
            <Layer key={`dots-${squareZoom}-${palette}-${dotScale}`} {...layers.dots} />
          </Source>
          <Source key="cell-squares" id="cell-squares" type="geojson" data={cellSquares}>
            <Layer key={`squares-${squareZoom}-${palette}`} {...layers.squares} />
          </Source>
        </>
      )}
    </Map>
  )
}
