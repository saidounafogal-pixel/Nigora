import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { STYLES, FONT_BOLD, offlineStyle, type MapStyleKey } from '../lib/mapStyles'
import { CATEGORIES, type Poi, type PoiCategory, type BBox } from '../lib/poi'
import type { Position } from '../lib/types'
import { NIGER_CENTER } from '../data/places'

export type MapLine = { id: string; coords: [number, number][]; color: string; dashed?: boolean; width?: number }
export type MapPoint = { id: string; lat: number; lng: number; color: string; label?: string; pulse?: boolean }

type Props = {
  styleKey: MapStyleKey
  pois?: Poi[]
  visibleCats?: PoiCategory[]
  me?: Position
  lines?: MapLine[]
  points?: MapPoint[]
  /** Change cette valeur pour recadrer la carte sur les éléments fournis */
  fitKey?: string
  fitTo?: [number, number][]
  center?: { lat: number; lng: number }
  zoom?: number
  interactive?: boolean
  className?: string
  onMoveEnd?: (b: BBox, zoom: number) => void
  onPoiClick?: (p: Poi) => void
  onPointClick?: (id: string) => void
  onReady?: (m: MLMap) => void
}

// Le worker de MapLibre doit être servi comme fichier séparé en production
maplibregl.setWorkerUrl(workerUrl)
// Garde les workers actifs entre deux ouvertures de carte (évite de recharger le worker, y compris hors ligne)
maplibregl.prewarm()

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features })

/** Pictogramme rond dessiné sur canvas (aucune ressource externe → marche hors ligne) */
function makeIcon(color: string, emoji: string, size = 64) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.beginPath()
  g.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
  g.fillStyle = color
  g.fill()
  g.lineWidth = 4
  g.strokeStyle = 'rgba(0,0,0,.65)'
  g.stroke()
  g.font = `${size * 0.46}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(emoji, size / 2, size / 2 + 2)
  return g.getImageData(0, 0, size, size)
}

function makeCount(label: string, size = 44) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.font = `bold ${label.length > 2 ? 15 : 19}px system-ui, sans-serif`
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(label, size / 2, size / 2 + 1)
  return g.getImageData(0, 0, size, size)
}

export default function MapView(p: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const props = useRef(p)
  const fallback = useRef(false)
  const styleReady = useRef(false)
  props.current = p

  // ---- Couches NIGORA ajoutées par-dessus n'importe quel fond de carte ----
  function addOverlays(m: MLMap) {
    for (const c of CATEGORIES) if (!m.hasImage(`poi-${c.key}`)) m.addImage(`poi-${c.key}`, makeIcon(c.color, c.emoji), { pixelRatio: 2 })

    if (!m.getSource('lignes')) m.addSource('lignes', { type: 'geojson', data: fc([]) })
    if (!m.getSource('pois')) m.addSource('pois', { type: 'geojson', data: fc([]), cluster: true, clusterRadius: 42, clusterMaxZoom: 13 })
    if (!m.getSource('points')) m.addSource('points', { type: 'geojson', data: fc([]) })
    // Les textes ont leurs propres sources : si les polices sont injoignables (hors ligne),
    // seuls les libellés disparaissent, jamais les pictogrammes.
    if (!m.getSource('pois-noms')) m.addSource('pois-noms', { type: 'geojson', data: fc([]) })
    if (!m.getSource('points-noms')) m.addSource('points-noms', { type: 'geojson', data: fc([]) })
    if (!m.getSource('moi')) m.addSource('moi', { type: 'geojson', data: fc([]) })

    const add = (layer: maplibregl.AddLayerObject) => !m.getLayer(layer.id) && m.addLayer(layer)
    add({ id: 'lignes-halo', type: 'line', source: 'lignes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['+', ['get', 'width'], 6], 'line-opacity': 0.25, 'line-blur': 2 } })
    add({ id: 'lignes-pleines', type: 'line', source: 'lignes', filter: ['!', ['get', 'dashed']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'] } })
    add({ id: 'lignes-tirets', type: 'line', source: 'lignes', filter: ['get', 'dashed'], layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-dasharray': [1.5, 1.5] } })

    add({ id: 'grappes', type: 'circle', source: 'pois', filter: ['has', 'point_count'], paint: { 'circle-color': 'rgba(20,20,20,.85)', 'circle-stroke-color': '#E05206', 'circle-stroke-width': 2, 'circle-radius': ['step', ['get', 'point_count'], 16, 20, 20, 100, 26] } })
    add({ id: 'grappes-nombre', type: 'symbol', source: 'pois', filter: ['has', 'point_count'], layout: { 'icon-image': ['concat', 'n-', ['get', 'point_count_abbreviated']], 'icon-allow-overlap': true } })
    add({ id: 'pois', type: 'symbol', source: 'pois', filter: ['!', ['has', 'point_count']], layout: { 'icon-image': ['concat', 'poi-', ['get', 'cat']], 'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 15, 1.1], 'icon-allow-overlap': true } })
    add({ id: 'pois-noms', type: 'symbol', source: 'pois-noms', minzoom: 14, layout: { 'text-field': ['get', 'name'], 'text-font': FONT_BOLD, 'text-size': 11, 'text-offset': [0, 1.6], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1.5 } })

    add({ id: 'points-halo', type: 'circle', source: 'points', filter: ['get', 'pulse'], paint: { 'circle-radius': 22, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25 } })
    add({ id: 'points', type: 'circle', source: 'points', paint: { 'circle-radius': 8, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } })
    add({ id: 'points-noms', type: 'symbol', source: 'points-noms', layout: { 'text-field': ['get', 'label'], 'text-font': FONT_BOLD, 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 2 } })

    add({ id: 'moi-precision', type: 'circle', source: 'moi', paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 0, 20, ['*', ['get', 'acc'], 6.5]], 'circle-color': '#3b82f6', 'circle-opacity': 0.15, 'circle-stroke-color': '#3b82f6', 'circle-stroke-opacity': 0.4, 'circle-stroke-width': 1 } })
    add({ id: 'moi', type: 'circle', source: 'moi', paint: { 'circle-radius': 7, 'circle-color': '#3b82f6', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } })
    syncData(m)
  }

  function syncData(m: MLMap) {
    const { pois = [], visibleCats, lines = [], points = [], me } = props.current
    const shown = visibleCats ? pois.filter((x) => visibleCats.includes(x.cat)) : pois
    ;(m.getSource('pois') as GeoJSONSource | undefined)?.setData(
      fc(shown.map((x) => ({ type: 'Feature', id: undefined, geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { pid: x.id, cat: x.cat, name: x.name } }))),
    )
    ;(m.getSource('pois-noms') as GeoJSONSource | undefined)?.setData(
      fc(shown.map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { name: x.name } }))),
    )
    ;(m.getSource('lignes') as GeoJSONSource | undefined)?.setData(
      fc(lines.map((l) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: l.coords }, properties: { id: l.id, color: l.color, dashed: !!l.dashed, width: l.width ?? 4 } }))),
    )
    ;(m.getSource('points') as GeoJSONSource | undefined)?.setData(
      fc(points.map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { id: x.id, color: x.color, label: x.label ?? '', pulse: !!x.pulse } }))),
    )
    ;(m.getSource('points-noms') as GeoJSONSource | undefined)?.setData(
      fc(points.filter((x) => x.label).map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { label: x.label } }))),
    )
    ;(m.getSource('moi') as GeoJSONSource | undefined)?.setData(fc(me ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [me.lng, me.lat] }, properties: { acc: me.accuracy ?? 50 } }] : []))
  }

  const emitMove = (m: MLMap) => {
    const b = m.getBounds()
    props.current.onMoveEnd?.({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, m.getZoom())
  }

  // ---- Création ----
  useEffect(() => {
    if (!el.current) return
    const c = p.center ?? p.me ?? NIGER_CENTER
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLES[p.styleKey].style,
      center: [c.lng, c.lat],
      zoom: p.zoom ?? 11,
      attributionControl: { compact: true },
      interactive: p.interactive ?? true,
      maxPitch: 60,
      fadeDuration: 150,
    })
    map.current = m
    ;(window as unknown as { __nigoraMap?: MLMap }).__nigoraMap = m
    m.on('style.load', () => {
      styleReady.current = true
      addOverlays(m)
    })
    // Nombre des grappes dessiné en image (aucune police réseau nécessaire)
    m.on('styleimagemissing', (e) => {
      if (!e.id.startsWith('n-') || m.hasImage(e.id)) return
      m.addImage(e.id, makeCount(e.id.slice(2)), { pixelRatio: 2 })
    })
    m.on('error', (e) => {
      console.warn('[carte]', e.error?.message)
      const ev = e as unknown as { sourceId?: string; tile?: unknown }
      // Fond injoignable (hors ligne, sans cache) : style ou métadonnées de source en échec — pas une simple tuile.
      // On bascule sur un fond local pour que position, trajets et infrastructures en cache restent visibles.
      const styleFailed = !styleReady.current || (!!ev.sourceId && !ev.tile && !['pois', 'lignes', 'points', 'moi'].includes(ev.sourceId))
      if (styleFailed && !fallback.current) {
        fallback.current = true
        m.setStyle(offlineStyle, { diff: false })
      }
    })
    m.on('moveend', () => emitMove(m))
    m.once('load', () => {
      emitMove(m)
      props.current.onReady?.(m)
    })

    m.on('click', 'pois', (e) => {
      const id = e.features?.[0]?.properties?.pid
      const poi = props.current.pois?.find((x) => x.id === id)
      if (poi) props.current.onPoiClick?.(poi)
    })
    m.on('click', 'points', (e) => {
      const id = e.features?.[0]?.properties?.id
      if (id) props.current.onPointClick?.(id)
    })
    m.on('click', 'grappes', async (e) => {
      const f = e.features?.[0]
      if (!f) return
      const z = await (m.getSource('pois') as GeoJSONSource).getClusterExpansionZoom(f.properties!.cluster_id)
      m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z })
    })
    for (const l of ['pois', 'points', 'grappes']) {
      m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', l, () => (m.getCanvas().style.cursor = ''))
    }
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Changement de fond de carte ----
  const firstStyle = useRef(true)
  useEffect(() => {
    if (firstStyle.current) {
      firstStyle.current = false
      return
    }
    fallback.current = false
    styleReady.current = false
    map.current?.setStyle(STYLES[p.styleKey].style, { diff: false })
  }, [p.styleKey])

  // ---- Données ----
  useEffect(() => {
    const m = map.current
    if (m?.isStyleLoaded() || m?.getSource('pois')) syncData(m!)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.pois, p.visibleCats, p.lines, p.points, p.me])

  // ---- Recadrage ----
  useEffect(() => {
    const m = map.current
    if (!m || !p.fitKey || !p.fitTo?.length) return
    if (p.fitTo.length === 1) {
      m.easeTo({ center: p.fitTo[0], zoom: Math.max(m.getZoom(), 13) })
      return
    }
    const b = new maplibregl.LngLatBounds(p.fitTo[0], p.fitTo[0])
    p.fitTo.forEach((c) => b.extend(c))
    m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 700 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.fitKey])

  return <div ref={el} className={p.className ?? 'h-full w-full'} data-testid="carte" />
}
