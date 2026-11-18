import type { Position } from './types'

export function getPosition(timeoutMs = 12000, highAccuracy = true): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Géolocalisation indisponible sur cet appareil'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), at: new Date(p.timestamp).toISOString() }),
      (e) => reject(new Error(e.code === 1 ? 'Autorisation de localisation refusée' : e.code === 3 ? 'Délai de localisation dépassé' : 'Position introuvable')),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 60000 },
    )
  })
}

export const mapsLink = (p: Pick<Position, 'lat' | 'lng'>) => `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`
export const coords = (p: Pick<Position, 'lat' | 'lng'>) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
export const searchMapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

/** Distance en km (haversine) */
export function distanceKm(a: Pick<Position, 'lat' | 'lng'>, b: Pick<Position, 'lat' | 'lng'>) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
