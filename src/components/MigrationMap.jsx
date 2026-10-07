import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre'
import { AGE_COLOR_EXPRESSION, ageInDays } from '../lib/ageScale.js'
import { PALETTES } from '../lib/palettes.js'
import { tintStyle } from '../lib/basemap.js'
import { densestSpot, inBounds } from '../lib/densest.js'
import { cellHeadline, cellRanges } from '../lib/cellInfo.js'
import { sightingHeadline, sightingWhen } from '../lib/sightingInfo.js'

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

// Recent dots are only a few pixels wide, so an invisible, larger copy on top is what the mouse hits.
const RECENT_HIT_LAYER = {
  id: 'sightings-hit',
  type: 'circle',
  layout: RECENT_LAYER.layout,
  paint: { 'circle-radius': 9, 'circle-opacity': 0 },
}

// The hovered dot, ringed in white like a hovered cell.
const SIGHTING_HOVER_LAYER = {
  id: 'sighting-hover',
  type: 'circle',
  paint: {
    'circle-radius': 8,
    'circle-color': '#ffffff',
    'circle-opacity': 0.18,
    'circle-stroke-width': 2.5,
    'circle-stroke-color': '#ffffff',
  },
}

// Zoomed far out, a cell is under a pixel wide and map tiling drops polygons that small, so cells are drawn
// as dots there. From the switch zoom on they are drawn as real squares (dots leave gaps between rows).
const SQUARE_ZOOM = 4

// Half a cell's width in pixels at a zoom level (512px tiles; the world is 360 degrees wide at zoom 0).
const halfCellPx = (cellSize, zoom) => ((cellSize * 512) / 360 / 2) * 2 ** zoom

// When a species has sightings but none in view, the map moves to where they are densest, at this zoom.
const RECENTER_ZOOM = 4.5

// Dots beyond this many are thinned (the same cells every time, so nothing flickers) and drawn larger.
const MAX_DOTS = 40000

const keepDot = (c, stride) =>
  stride === 1 || ((((Math.round(c.lat * 10) * 73856093) ^ (Math.round(c.lng * 10) * 19349663)) >>> 0) % stride) === 0

// Dot radius by zoom: the small fixed dots used for fine (0.1 degree) cells, but never smaller than the cell
// itself, so coarser cells (the effort view) still tile the map instead of leaving a grid of specks.
function dotRadius(cellSize, dotScale) {
  const stops = []
  for (let z = 0; z <= SQUARE_ZOOM; z++) {
    const base = (0.8 + (0.5 * z) / SQUARE_ZOOM) * dotScale
    stops.push(z, Math.max(base, halfCellPx(cellSize, z) * 1.1))
  }
  return ['interpolate', ['linear'], ['zoom'], ...stops]
}

function cellLayers(color, cellSize, dotScale) {
  return {
    dots: {
      id: 'cell-dots',
      type: 'circle',
      maxzoom: SQUARE_ZOOM,
      layout: { 'circle-sort-key': ['get', 'n'] },
      paint: {
        'circle-radius': dotRadius(cellSize, dotScale),
        'circle-color': color,
        'circle-opacity': 0.75,
      },
    },
    squares: {
      id: 'cell-squares',
      type: 'fill',
      minzoom: SQUARE_ZOOM,
      layout: { 'fill-sort-key': ['get', 'n'] },
      paint: { 'fill-color': color, 'fill-opacity': 0.75, 'fill-antialias': false },
    },
  }
}

// The hovered cell, outlined in white so it stands out from its neighbours at any zoom.
const HOVER_FILL = { id: 'cell-hover-fill', type: 'fill', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.18 } }
const HOVER_LINE = {
  id: 'cell-hover-line',
  type: 'line',
  layout: { 'line-join': 'round' },
  paint: { 'line-color': '#ffffff', 'line-width': 2.5 },
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
  statMode = 'historical',
  palette = 'density',
  fitCells = [],
  fitKey,
  onBoundsChange,
}) {
  const mapRef = useRef(null)
  const [mapStyle, setMapStyle] = useState(MAP_STYLE_URL)
  const [hover, setHover] = useState(null)
  const [view, setView] = useState({ zoom: INITIAL_VIEW.zoom, bounds: null })
  const stride = Math.max(1, Math.ceil(stableCount / MAX_DOTS))
  const dotScale = Math.min(2.2, Math.sqrt(stride))
  const layers = useMemo(
    () => cellLayers(PALETTES[palette].expression, cellSize, dotScale),
    [palette, cellSize, dotScale],
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

  // A popup for a cell or dot that is no longer on the map (new week, new species) would show stale numbers.
  useEffect(() => setHover(null), [cells, sightings, mode])

  function hoverFeature(e) {
    const f = e.features?.[0]
    if (!f) return setHover(null)
    if (mode === 'recent') {
      const [lng, lat] = f.geometry.coordinates
      const { howMany, obsDt } = f.properties
      setHover((h) =>
        h && h.lat === lat && h.lng === lng && h.obsDt === obsDt ? h : { kind: 'sighting', lat, lng, howMany, obsDt },
      )
      return
    }
    const { lat, lng, n, t } = f.properties
    setHover((h) => (h && h.lat === lat && h.lng === lng && h.n === n ? h : { kind: 'cell', lat, lng, n, t }))
  }

  // When a species loads (last 30 days or historical) and none of its points are in view, say a European bird
  // while looking at the US, fly to where they are most crowded instead of leaving the map looking empty.
  // Points already in view leave the map alone. The historical points are the species' cells across all
  // years, so changing the era filter or week never moves the map.
  const recenterPoints = mode === 'recent' ? sightings : mode === 'historical' ? fitCells : []
  const recenterKey = mode === 'recent' ? sightings : fitKey
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || recenterPoints.length === 0) return
    const b = map.getBounds()
    const bounds = { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() }
    if (recenterPoints.some((p) => inBounds(p, bounds))) return
    const spot = densestSpot(recenterPoints)
    const left = window.innerWidth > 700 ? 340 : 40 // keep the spot clear of the sidebar
    if (spot) map.flyTo({ center: [spot.lng, spot.lat], zoom: RECENTER_ZOOM, duration: 1200, padding: { left } })
  }, [mode, recenterKey])

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
          properties: { obsDt: s.obsDt, howMany: s.howMany, ageDays: ageInDays(s.obsDt) },
        })),
      ),
    [sightings],
  )

  // Only the layer that is visible at the current zoom is built, and squares only for cells in (or near) view,
  // so large species stay fast when the week changes.
  const showSquares = view.zoom >= SQUARE_ZOOM

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
                properties: { n: c.n, t: c.t, lat: c.lat, lng: c.lng },
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
        .map((c) => ({ type: 'Feature', geometry: cellPolygon(c, cellSize / 2), properties: { n: c.n, t: c.t, lat: c.lat, lng: c.lng } })),
    )
  }, [cells, cellSize, showSquares, view.bounds])

  const hoverShape = useMemo(
    () =>
      hover?.kind === 'cell'
        ? collection([{ type: 'Feature', geometry: cellPolygon(hover, cellSize / 2), properties: {} }])
        : EMPTY,
    [hover, cellSize],
  )

  const hoverPoint = useMemo(
    () =>
      hover?.kind === 'sighting'
        ? collection([{ type: 'Feature', geometry: { type: 'Point', coordinates: [hover.lng, hover.lat] }, properties: {} }])
        : EMPTY,
    [hover],
  )

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      mapStyle={mapStyle}
      style={{ width: '100%', height: '100%' }}
      onLoad={reportView}
      onMoveEnd={reportView}
      interactiveLayerIds={mode === 'recent' ? ['sightings-hit'] : ['cell-dots', 'cell-squares']}
      onMouseMove={hoverFeature}
      onMouseLeave={() => setHover(null)}
      cursor={hover ? 'pointer' : ''}
    >
      {mode === 'recent' ? (
        <>
          <Source key="sightings" id="sightings" type="geojson" data={recentData}>
            <Layer {...RECENT_LAYER} />
            <Layer {...RECENT_HIT_LAYER} />
          </Source>
          <Source key="sighting-hover" id="sighting-hover" type="geojson" data={hoverPoint}>
            <Layer {...SIGHTING_HOVER_LAYER} />
          </Source>
        </>
      ) : (
        <>
          <Source key="cell-dots" id="cell-dots" type="geojson" data={cellDots}>
            <Layer key={`dots-${palette}-${cellSize}-${dotScale}`} {...layers.dots} />
          </Source>
          <Source key="cell-squares" id="cell-squares" type="geojson" data={cellSquares}>
            <Layer key={`squares-${palette}`} {...layers.squares} />
          </Source>
          <Source key="cell-hover" id="cell-hover" type="geojson" data={hoverShape}>
            <Layer {...HOVER_FILL} />
            <Layer {...HOVER_LINE} />
          </Source>
        </>
      )}
      {hover && hover.kind === (mode === 'recent' ? 'sighting' : 'cell') && (
        <Popup
          longitude={hover.lng}
          latitude={hover.lat}
          anchor="bottom"
          offset={hover.kind === 'sighting' ? 14 : 8}
          closeButton={false}
          closeOnClick={false}
          focusAfterOpen={false}
          className="cell-popup"
        >
          {hover.kind === 'sighting' ? (
            <SightingInfo sighting={hover} />
          ) : (
            <CellInfo cell={hover} cellSize={cellSize} statMode={statMode} />
          )}
        </Popup>
      )}
    </Map>
  )
}

function SightingInfo({ sighting }) {
  return (
    <div className="cell-info">
      <strong>{sightingHeadline(sighting.howMany)}</strong>
      <span>{sightingWhen(sighting.obsDt)}</span>
    </div>
  )
}

function CellInfo({ cell, cellSize, statMode }) {
  const headline = cellHeadline(statMode, cell)
  const range = cellRanges(cell, cellSize)
  return (
    <div className="cell-info">
      {headline && <strong>{headline}</strong>}
      <span>Lat {range.lat}</span>
      <span>Lng {range.lng}</span>
    </div>
  )
}
