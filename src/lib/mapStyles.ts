import type { StyleSpecification } from 'maplibre-gl'

export type MapStyleKey = 'nuit' | 'satellite' | 'plan' | 'relief'

export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
export const FONT_BOLD = ['Noto Sans Bold']
export const FONT_REG = ['Noto Sans Regular']
const OFM = '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">contributeurs OpenStreetMap</a>'

const ORANGE = '#E05206'
const WATER = '#0b3b52'
const RIVER = '#2aa7d6'

/**
 * « Nigora Nuit » — style sombre conçu pour NIGORA (schéma OpenMapTiles via OpenFreeMap, sans clé).
 * Routes principales en orange, eau en bleu lumineux, sable du Sahel discret.
 */
export const nuitStyle: StyleSpecification = {
  version: 8,
  name: 'Nigora Nuit',
  glyphs: GLYPHS,
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: OFM },
  },
  layers: [
    { id: 'fond', type: 'background', paint: { 'background-color': '#07090c' } },
    { id: 'sable', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['sand', 'rock', 'bare_rock']]], paint: { 'fill-color': '#17120c', 'fill-opacity': 0.9 } },
    { id: 'vegetation', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland', 'scrub', 'wetland']]], paint: { 'fill-color': '#0b1510', 'fill-opacity': 0.8 } },
    { id: 'zones-bati', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial']]], paint: { 'fill-color': '#101318' } },
    { id: 'sante-zone', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['==', ['get', 'class'], 'hospital'], paint: { 'fill-color': '#3a0d10' } },
    { id: 'parcs', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': '#0c1a12' } },
    { id: 'eau', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': WATER } },
    { id: 'eau-contour', type: 'line', source: 'omt', 'source-layer': 'water', paint: { 'line-color': RIVER, 'line-opacity': 0.5, 'line-width': 0.8 } },
    {
      id: 'cours-eau',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      filter: ['!=', ['get', 'intermittent'], 1],
      paint: {
        'line-color': RIVER,
        'line-opacity': ['match', ['get', 'class'], 'river', 0.9, 0.55],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'class'], 'river', 1.2, 0.3], 12, ['match', ['get', 'class'], 'river', 4, 1.2]],
      },
    },
    {
      // Koris et cours d'eau temporaires, très présents au Sahel
      id: 'koris',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      filter: ['==', ['get', 'intermittent'], 1],
      minzoom: 7,
      paint: { 'line-color': RIVER, 'line-opacity': 0.45, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 13, 2], 'line-dasharray': [2, 2] },
    },
    { id: 'pistes-aero', type: 'line', source: 'omt', 'source-layer': 'aeroway', filter: ['==', ['get', 'class'], 'runway'], paint: { 'line-color': '#2b2f36', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 20] } },
    { id: 'batiments', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': '#171b21', 'fill-outline-color': '#20252d' } },
    {
      id: 'pistes',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['track', 'path']]],
      minzoom: 10,
      paint: { 'line-color': '#4a3c2a', 'line-width': 1, 'line-dasharray': [2, 2] },
    },
    {
      id: 'routes-secondaires',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary', 'secondary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], 'secondary', '#5b4a3d', 'tertiary', '#3d3833', '#23262b'],
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.4, 16, 8],
      },
    },
    {
      id: 'routes-principales-halo',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'trunk', 'motorway']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ORANGE, 'line-opacity': 0.18, 'line-blur': 3, 'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5, 3, 16, 22] },
    },
    {
      id: 'routes-principales',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'trunk', 'motorway']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], 'primary', '#c2581b', ORANGE],
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5, 0.8, 16, 10],
      },
    },
    { id: 'frontiere-regions', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['==', ['get', 'admin_level'], 4], paint: { 'line-color': '#5b6170', 'line-width': 0.7, 'line-dasharray': [3, 2], 'line-opacity': 0.6 } },
    { id: 'frontiere-pays', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': ORANGE, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 10, 2.5], 'line-opacity': 0.7, 'line-dasharray': [4, 2] } },
    {
      id: 'noms-routes',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 11,
      layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']], 'text-font': FONT_REG, 'text-size': 11 },
      paint: { 'text-color': '#9aa0aa', 'text-halo-color': '#07090c', 'text-halo-width': 1.5 },
    },
    {
      id: 'numeros-routes',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 6,
      filter: ['has', 'ref'],
      layout: { 'symbol-placement': 'line', 'symbol-spacing': 400, 'text-field': ['get', 'ref'], 'text-font': FONT_BOLD, 'text-size': 10 },
      paint: { 'text-color': '#ffb27a', 'text-halo-color': '#3a1404', 'text-halo-width': 2 },
    },
    {
      id: 'noms-eau',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      layout: { 'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']], 'text-font': FONT_REG, 'text-size': 12, 'text-letter-spacing': 0.15 },
      paint: { 'text-color': '#7fd3f2', 'text-halo-color': '#04161f', 'text-halo-width': 1.5 },
    },
    {
      id: 'villages',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['village', 'hamlet', 'suburb', 'neighbourhood']]],
      layout: { 'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']], 'text-font': FONT_REG, 'text-size': 11 },
      paint: { 'text-color': '#8b919b', 'text-halo-color': '#07090c', 'text-halo-width': 1.5 },
    },
    {
      id: 'villes',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']],
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'class'], 'city', 13, 10], 12, ['match', ['get', 'class'], 'city', 20, 15]],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
      },
      paint: { 'text-color': '#f5f5f5', 'text-halo-color': '#000', 'text-halo-width': 2 },
    },
    {
      id: 'pays',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      maxzoom: 7,
      filter: ['==', ['get', 'class'], 'country'],
      layout: { 'text-field': ['coalesce', ['get', 'name:fr'], ['get', 'name']], 'text-font': FONT_BOLD, 'text-size': 14, 'text-transform': 'uppercase', 'text-letter-spacing': 0.3 },
      paint: { 'text-color': '#ffffff', 'text-opacity': 0.55, 'text-halo-color': '#000', 'text-halo-width': 1 },
    },
  ],
}

const ESRI = 'Imagerie © Esri, Maxar, Earthstar Geographics'

export const satelliteStyle: StyleSpecification = {
  version: 8,
  name: 'Satellite',
  glyphs: GLYPHS,
  sources: {
    imagerie: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 18, attribution: ESRI },
    etiquettes: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 18 },
    routes: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 18 },
  },
  layers: [
    { id: 'fond', type: 'background', paint: { 'background-color': '#0a0a0a' } },
    { id: 'imagerie', type: 'raster', source: 'imagerie', paint: { 'raster-saturation': -0.1, 'raster-contrast': 0.1 } },
    { id: 'routes', type: 'raster', source: 'routes', minzoom: 7, paint: { 'raster-opacity': 0.75 } },
    { id: 'etiquettes', type: 'raster', source: 'etiquettes' },
  ],
}

export const reliefStyle: StyleSpecification = {
  version: 8,
  name: 'Relief',
  glyphs: GLYPHS,
  sources: {
    topo: {
      type: 'raster',
      tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
      tileSize: 256,
      maxzoom: 17,
      attribution: 'Carte : © OpenTopoMap (CC-BY-SA) · © contributeurs OpenStreetMap',
    },
  },
  layers: [{ id: 'topo', type: 'raster', source: 'topo' }],
}

export const STYLES: Record<MapStyleKey, { label: string; style: StyleSpecification | string; dark: boolean }> = {
  nuit: { label: 'Nuit', style: nuitStyle, dark: true },
  satellite: { label: 'Satellite', style: satelliteStyle, dark: true },
  plan: { label: 'Plan', style: 'https://tiles.openfreemap.org/styles/liberty', dark: false },
  relief: { label: 'Relief', style: reliefStyle, dark: false },
}

/** Fond minimal sans aucune ressource réseau : utilisé si le fond choisi est injoignable (hors ligne) */
export const offlineStyle: StyleSpecification = {
  version: 8,
  name: 'Hors ligne',
  glyphs: GLYPHS,
  sources: {},
  layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#0b0e12' } }],
}
