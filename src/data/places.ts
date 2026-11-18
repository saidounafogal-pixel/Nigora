export type City = { name: string; lat: number; lng: number; region: string }

/** Chefs-lieux et villes étapes du Niger (coordonnées approximatives du centre-ville) */
export const CITIES: City[] = [
  { name: 'Niamey', lat: 13.5116, lng: 2.1254, region: 'Niamey' },
  { name: 'Kollo', lat: 13.3043, lng: 2.3393, region: 'Tillabéri' },
  { name: 'Say', lat: 13.1009, lng: 2.3602, region: 'Tillabéri' },
  { name: 'Tillabéri', lat: 14.2117, lng: 1.4531, region: 'Tillabéri' },
  { name: 'Téra', lat: 14.0078, lng: 0.7531, region: 'Tillabéri' },
  { name: 'Ayorou', lat: 14.7308, lng: 0.9174, region: 'Tillabéri' },
  { name: 'Filingué', lat: 14.3521, lng: 3.3168, region: 'Tillabéri' },
  { name: 'Balleyara', lat: 13.7833, lng: 2.95, region: 'Tillabéri' },
  { name: 'Dosso', lat: 13.049, lng: 3.1937, region: 'Dosso' },
  { name: 'Loga', lat: 13.6181, lng: 3.2346, region: 'Dosso' },
  { name: 'Dogondoutchi', lat: 13.6403, lng: 4.0287, region: 'Dosso' },
  { name: 'Gaya', lat: 11.8843, lng: 3.4492, region: 'Dosso' },
  { name: 'Tahoua', lat: 14.8888, lng: 5.2692, region: 'Tahoua' },
  { name: 'Birni N’Konni', lat: 13.7956, lng: 5.2503, region: 'Tahoua' },
  { name: 'Madaoua', lat: 14.073, lng: 5.9604, region: 'Tahoua' },
  { name: 'Illéla', lat: 14.4621, lng: 5.2436, region: 'Tahoua' },
  { name: 'Bouza', lat: 14.4224, lng: 6.0428, region: 'Tahoua' },
  { name: 'Keita', lat: 14.7563, lng: 5.7744, region: 'Tahoua' },
  { name: 'Abalak', lat: 15.459, lng: 6.2792, region: 'Tahoua' },
  { name: 'Tchintabaraden', lat: 15.8969, lng: 5.7985, region: 'Tahoua' },
  { name: 'Maradi', lat: 13.5, lng: 7.1017, region: 'Maradi' },
  { name: 'Tessaoua', lat: 13.7573, lng: 7.9874, region: 'Maradi' },
  { name: 'Dakoro', lat: 14.5106, lng: 6.765, region: 'Maradi' },
  { name: 'Mayahi', lat: 13.9551, lng: 7.6719, region: 'Maradi' },
  { name: 'Zinder', lat: 13.8053, lng: 8.9881, region: 'Zinder' },
  { name: 'Mirriah', lat: 13.7071, lng: 9.1506, region: 'Zinder' },
  { name: 'Magaria', lat: 12.9983, lng: 8.9097, region: 'Zinder' },
  { name: 'Matameye', lat: 13.4232, lng: 8.4777, region: 'Zinder' },
  { name: 'Gouré', lat: 13.9835, lng: 10.2704, region: 'Zinder' },
  { name: 'Tanout', lat: 14.9709, lng: 8.8879, region: 'Zinder' },
  { name: 'Diffa', lat: 13.3154, lng: 12.6113, region: 'Diffa' },
  { name: 'Mainé-Soroa', lat: 13.2114, lng: 11.9853, region: 'Diffa' },
  { name: 'N’Guigmi', lat: 14.2532, lng: 13.1105, region: 'Diffa' },
  { name: 'Agadez', lat: 16.9742, lng: 7.9865, region: 'Agadez' },
  { name: 'Arlit', lat: 18.7369, lng: 7.3853, region: 'Agadez' },
  { name: 'Ingall', lat: 16.7867, lng: 6.9303, region: 'Agadez' },
  { name: 'Bilma', lat: 18.6853, lng: 12.9164, region: 'Agadez' },
]

export const NIGER_CITIES = CITIES.map((c) => c.name)
export const NIGER_CENTER = { lat: 13.5116, lng: 2.1254 } // Niamey
export const NIGER_BOUNDS: [[number, number], [number, number]] = [[0.1, 11.6], [16.1, 23.6]]

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').toLowerCase().trim()
export function findCity(name: string): City | undefined {
  const n = norm(name)
  return CITIES.find((c) => norm(c.name) === n) ?? CITIES.find((c) => n.length >= 4 && norm(c.name).startsWith(n))
}

export const TRANSPORTS = [
  { v: 'bus', l: 'Bus / car' },
  { v: 'taxi-brousse', l: 'Taxi-brousse' },
  { v: 'voiture', l: 'Voiture' },
  { v: 'moto', l: 'Moto' },
  { v: 'avion', l: 'Avion' },
  { v: 'autre', l: 'Autre' },
] as const
