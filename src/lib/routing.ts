import { findCity } from '../data/places'
import { distanceKm } from './geo'

export type LngLat = [number, number]
export type Route = { coords: LngLat[]; km: number; minutes?: number; source: 'osrm' | 'direct' }

export async function geocode(name: string): Promise<{ lat: number; lng: number } | undefined> {
  const c = findCity(name)
  if (c) return c
  if (!navigator.onLine) return undefined
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ne&accept-language=fr&q=${encodeURIComponent(name)}`)
    const [hit] = (await r.json()) as { lat: string; lon: string }[]
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : undefined
  } catch {
    return undefined
  }
}

/** Itinéraire routier (OSRM). Repli en ligne droite si hors ligne ou en échec. */
export async function route(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<Route> {
  const direct: Route = { coords: [[from.lng, from.lat], [to.lng, to.lat]], km: distanceKm(from, to), source: 'direct' }
  if (!navigator.onLine) return direct
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`)
    const j = await r.json()
    const rt = j.routes?.[0]
    if (!rt) return direct
    return { coords: rt.geometry.coordinates, km: rt.distance / 1000, minutes: Math.round(rt.duration / 60), source: 'osrm' }
  } catch {
    return direct
  }
}

/** Calcule et enregistre départ, arrivée et itinéraire d'un trajet (conservés pour l'usage hors ligne) */
export async function ensureTripRoute(
  trip: { id: string; from: string; to: string; fromCoord?: { lat: number; lng: number }; toCoord?: { lat: number; lng: number }; route?: Route },
  patch: (id: string, p: { fromCoord?: { lat: number; lng: number }; toCoord?: { lat: number; lng: number }; route?: Route }) => void,
) {
  const from = trip.fromCoord ?? (await geocode(trip.from))
  const to = trip.toCoord ?? (await geocode(trip.to))
  if (!from || !to) return
  const needRoute = !trip.route || (trip.route.source === 'direct' && navigator.onLine)
  const r = needRoute ? await route(from, to) : trip.route
  patch(trip.id, { fromCoord: from, toCoord: to, route: r })
}
