import { get, set } from 'idb-keyval'
import { distanceKm } from './geo'

export type PoiCategory = 'sante' | 'pharmacie' | 'eau' | 'carburant' | 'police' | 'pompiers' | 'garage' | 'transport' | 'hebergement'

export type Poi = {
  id: string
  cat: PoiCategory
  name: string
  lat: number
  lng: number
  phone?: string
  detail?: string
  tags: Record<string, string>
}

export type CategoryDef = { key: PoiCategory; label: string; short: string; color: string; emoji: string; selectors: string[] }

/** Infrastructures utiles à un voyageur en difficulté au Niger (balises OpenStreetMap) */
export const CATEGORIES: CategoryDef[] = [
  { key: 'sante', label: 'Hôpitaux et centres de santé', short: 'Santé', color: '#ef4444', emoji: '🏥', selectors: ['["amenity"~"^(hospital|clinic|doctors)$"]', '["healthcare"~"^(hospital|clinic|centre|doctor)$"]'] },
  { key: 'pharmacie', label: 'Pharmacies', short: 'Pharmacies', color: '#22c55e', emoji: '💊', selectors: ['["amenity"="pharmacy"]'] },
  { key: 'eau', label: 'Points d’eau (puits, forages, bornes)', short: 'Eau', color: '#38bdf8', emoji: '💧', selectors: ['["amenity"~"^(drinking_water|water_point)$"]', '["man_made"~"^(water_well|water_tap|borehole|water_tower|reservoir_covered)$"]', '["natural"="spring"]'] },
  { key: 'carburant', label: 'Stations-service', short: 'Carburant', color: '#f59e0b', emoji: '⛽', selectors: ['["amenity"="fuel"]'] },
  { key: 'police', label: 'Police et gendarmerie', short: 'Police', color: '#6366f1', emoji: '👮', selectors: ['["amenity"="police"]'] },
  { key: 'pompiers', label: 'Sapeurs-pompiers', short: 'Pompiers', color: '#f97316', emoji: '🚒', selectors: ['["amenity"="fire_station"]'] },
  { key: 'garage', label: 'Garages et dépannage', short: 'Garages', color: '#a3a3a3', emoji: '🔧', selectors: ['["shop"~"^(car_repair|tyres|motorcycle_repair)$"]', '["amenity"="vehicle_inspection"]'] },
  { key: 'transport', label: 'Gares routières', short: 'Gares', color: '#e879f9', emoji: '🚌', selectors: ['["amenity"="bus_station"]', '["public_transport"="station"]["bus"="yes"]'] },
  { key: 'hebergement', label: 'Hébergement', short: 'Hébergement', color: '#14b8a6', emoji: '🛏️', selectors: ['["tourism"~"^(hotel|guest_house|motel|hostel)$"]'] },
]
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<PoiCategory, CategoryDef>

export type BBox = { south: number; west: number; north: number; east: number }

export const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

export function buildOverpassQuery(b: BBox, cats: PoiCategory[] = CATEGORIES.map((c) => c.key)) {
  const box = `(${b.south.toFixed(4)},${b.west.toFixed(4)},${b.north.toFixed(4)},${b.east.toFixed(4)})`
  const parts = cats.flatMap((k) => CAT[k].selectors.map((s) => `nwr${s}${box};`))
  return `[out:json][timeout:25];(${parts.join('')});out center tags 3000;`
}

/** Détermine la catégorie d'un objet OSM à partir de ses balises */
export function categorize(t: Record<string, string>): PoiCategory | undefined {
  const a = t.amenity
  if (a === 'hospital' || a === 'clinic' || a === 'doctors' || ['hospital', 'clinic', 'centre', 'doctor'].includes(t.healthcare)) return 'sante'
  if (a === 'pharmacy') return 'pharmacie'
  if (a === 'drinking_water' || a === 'water_point' || ['water_well', 'water_tap', 'borehole', 'water_tower', 'reservoir_covered'].includes(t.man_made) || t.natural === 'spring') return 'eau'
  if (a === 'fuel') return 'carburant'
  if (a === 'police') return 'police'
  if (a === 'fire_station') return 'pompiers'
  if (['car_repair', 'tyres', 'motorcycle_repair'].includes(t.shop) || a === 'vehicle_inspection') return 'garage'
  if (a === 'bus_station' || (t.public_transport === 'station' && t.bus === 'yes')) return 'transport'
  if (['hotel', 'guest_house', 'motel', 'hostel'].includes(t.tourism)) return 'hebergement'
  return undefined
}

const FALLBACK_NAME: Record<PoiCategory, string> = {
  sante: 'Centre de santé',
  pharmacie: 'Pharmacie',
  eau: 'Point d’eau',
  carburant: 'Station-service',
  police: 'Poste de police',
  pompiers: 'Caserne de pompiers',
  garage: 'Garage',
  transport: 'Gare routière',
  hebergement: 'Hébergement',
}

function detailOf(cat: PoiCategory, t: Record<string, string>) {
  if (cat === 'eau') {
    const kind = t.man_made === 'borehole' ? 'Forage' : t.man_made === 'water_well' ? 'Puits' : t.man_made === 'water_tower' ? 'Château d’eau' : t.man_made === 'water_tap' ? 'Robinet / borne' : t.natural === 'spring' ? 'Source' : 'Point d’eau'
    const potable = t.drinking_water === 'yes' ? ' · potable' : t.drinking_water === 'no' ? ' · non potable' : ''
    const pump = t.pump && t.pump !== 'no' ? ` · pompe ${t.pump === 'manual' ? 'manuelle' : t.pump === 'powered' ? 'motorisée' : ''}` : ''
    return kind + potable + pump
  }
  if (cat === 'sante') return t['healthcare:speciality'] || (t.emergency === 'yes' ? 'Urgences' : t.amenity === 'hospital' ? 'Hôpital' : 'Centre de santé')
  if (cat === 'carburant') return t.brand || t.operator
  return t.operator || t['addr:city'] || undefined
}

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

export function parseOverpass(json: { elements?: OsmElement[] }): Poi[] {
  const out: Poi[] = []
  for (const e of json.elements ?? []) {
    const lat = e.lat ?? e.center?.lat
    const lng = e.lon ?? e.center?.lon
    const tags = e.tags ?? {}
    if (lat == null || lng == null) continue
    const cat = categorize(tags)
    if (!cat) continue
    out.push({
      id: `${e.type}/${e.id}`,
      cat,
      name: tags['name:fr'] || tags.name || FALLBACK_NAME[cat],
      lat,
      lng,
      phone: tags.phone || tags['contact:phone'] || tags['emergency:phone'] || undefined,
      detail: detailOf(cat, tags) || undefined,
      tags,
    })
  }
  return out
}

// ---------- Cache par cellule de 0,5° (fonctionne hors ligne une fois la zone consultée) ----------
const CELL = 0.5
const TTL = 7 * 24 * 3600 * 1000
const cellKey = (lat: number, lng: number) => `poi:${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`

export function cellsFor(b: BBox) {
  const keys: { key: string; box: BBox }[] = []
  for (let la = Math.floor(b.south / CELL); la <= Math.floor(b.north / CELL); la++)
    for (let ln = Math.floor(b.west / CELL); ln <= Math.floor(b.east / CELL); ln++)
      keys.push({ key: `poi:${la}:${ln}`, box: { south: la * CELL, west: ln * CELL, north: (la + 1) * CELL, east: (ln + 1) * CELL } })
  return keys
}

type CacheEntry = { at: number; pois: Poi[] }

async function overpass(query: string, signal?: AbortSignal) {
  let lastErr: unknown
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal })
      if (!r.ok) throw new Error(`Overpass ${r.status}`)
      return await r.json()
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      lastErr = e
    }
  }
  throw lastErr
}

export type PoiLoad = { pois: Poi[]; fromCache: number; fetched: number; failed: number }

/**
 * Charge les infrastructures d'une zone : cache local d'abord, puis OpenStreetMap si en ligne.
 * Limité à 12 cellules (≈ 3° × 2°) par appel pour rester raisonnable.
 */
export async function loadPois(b: BBox, opts: { force?: boolean; signal?: AbortSignal; online?: boolean } = {}): Promise<PoiLoad> {
  const cells = cellsFor(b).slice(0, 12)
  const online = opts.online ?? navigator.onLine
  const res: PoiLoad = { pois: [], fromCache: 0, fetched: 0, failed: 0 }
  const missing: typeof cells = []
  for (const c of cells) {
    const hit = await get<CacheEntry>(c.key).catch(() => undefined)
    if (hit && !opts.force && Date.now() - hit.at < TTL) {
      res.pois.push(...hit.pois)
      res.fromCache++
    } else {
      if (hit) res.pois.push(...hit.pois) // données périmées affichées en attendant
      missing.push(c)
    }
  }
  if (online && missing.length) {
    // Une seule requête englobante pour les cellules manquantes
    const box: BBox = {
      south: Math.min(...missing.map((m) => m.box.south)),
      west: Math.min(...missing.map((m) => m.box.west)),
      north: Math.max(...missing.map((m) => m.box.north)),
      east: Math.max(...missing.map((m) => m.box.east)),
    }
    try {
      const fresh = parseOverpass(await overpass(buildOverpassQuery(box), opts.signal))
      for (const c of missing) {
        const inCell = fresh.filter((p) => cellKey(p.lat, p.lng) === c.key)
        await set(c.key, { at: Date.now(), pois: inCell } satisfies CacheEntry).catch(() => undefined)
      }
      const missingKeys = new Set(missing.map((m) => m.key))
      res.pois = res.pois.filter((p) => !missingKeys.has(cellKey(p.lat, p.lng))).concat(fresh)
      res.fetched = missing.length
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      res.failed = missing.length
    }
  } else res.failed = missing.length
  const seen = new Set<string>()
  res.pois = res.pois.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
  return res
}

/** Tous les points déjà en cache (utile hors ligne, après un SOS) */
export async function cachedPoisAround(pos: { lat: number; lng: number }, radiusDeg = 1): Promise<Poi[]> {
  const out: Poi[] = []
  for (const c of cellsFor({ south: pos.lat - radiusDeg, north: pos.lat + radiusDeg, west: pos.lng - radiusDeg, east: pos.lng + radiusDeg })) {
    const hit = await get<CacheEntry>(c.key).catch(() => undefined)
    if (hit) out.push(...hit.pois)
  }
  return out
}

export function nearest(pois: Poi[], pos: { lat: number; lng: number }, cats?: PoiCategory[], limit = 5) {
  return pois
    .filter((p) => !cats || cats.includes(p.cat))
    .map((p) => ({ ...p, km: distanceKm(pos, p) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
}

export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`)

export const directionsLink = (to: { lat: number; lng: number }, from?: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1${from ? `&origin=${from.lat},${from.lng}` : ''}&destination=${to.lat},${to.lng}`
