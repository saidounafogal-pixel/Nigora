import type { BBox } from './poi'
import type { MapStyleKey } from './mapStyles'

const lon2x = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z)
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

export function tilesFor(b: BBox, minZ: number, maxZ: number) {
  const out: { z: number; x: number; y: number }[] = []
  for (let z = minZ; z <= maxZ; z++)
    for (let x = lon2x(b.west, z); x <= lon2x(b.east, z); x++)
      for (let y = lat2y(b.north, z); y <= lat2y(b.south, z); y++) out.push({ z, x, y })
  return out
}

const RASTER: Partial<Record<MapStyleKey, string>> = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  relief: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
}

async function templateFor(style: MapStyleKey): Promise<string | undefined> {
  if (RASTER[style]) return RASTER[style]
  // Fonds vectoriels (Nuit et Plan) : modèle d'URL lu dans le TileJSON d'OpenFreeMap
  const r = await fetch('https://tiles.openfreemap.org/planet')
  const j = await r.json()
  return j.tiles?.[0]
}

/**
 * Télécharge les tuiles de la zone pour qu'elles soient servies par le service worker hors connexion.
 * Limité à `max` tuiles ; les niveaux de zoom sont réduits automatiquement si la zone est grande.
 */
export async function prefetchArea(b: BBox, style: MapStyleKey, onProgress?: (done: number, total: number) => void, max = 600) {
  const tpl = await templateFor(style)
  if (!tpl) throw new Error('Fond de carte non téléchargeable')
  let maxZ = 15
  let tiles = tilesFor(b, 6, maxZ)
  while (tiles.length > max && maxZ > 8) tiles = tilesFor(b, 6, --maxZ)
  tiles = tiles.slice(0, max)
  let done = 0
  const queue = [...tiles]
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift()!
      const url = tpl.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y))
      await fetch(url, { mode: 'cors' }).catch(() => undefined)
      onProgress?.(++done, tiles.length)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return { tiles: tiles.length, maxZoom: maxZ }
}
