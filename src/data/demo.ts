// Données fictives pour présenter les espaces professionnels sans backend configuré
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString()
const inMin = (min: number) => new Date(Date.now() + min * 60000).toISOString()

export type OrgTrip = { id: string; traveler: string; from_place: string; to_place: string; departure_at: string; eta_at: string; status: string; vehicle_plate: string | null; last_lat: number | null; last_lng: number | null; last_position_at: string | null }
export type OrgAlert = { id: string; traveler: string; phone?: string | null; kind: string; message: string | null; status: string; lat: number | null; lng: number | null; created_at: string; trip?: string | null; blood_group?: string | null; allergies?: string | null; conditions?: string | null; treatments?: string | null }
export type Vehicle = { id: string; plate: string; label: string | null; capacity: number | null; active: boolean }
export type Member = { user_id: string; role: string; full_name: string | null }

export const DEMO_ORG = { name: 'Rimbo Transport (démo)', kind: 'transport', join_code: 'RIMBO-2026' }

export const DEMO_TRIPS: OrgTrip[] = [
  { id: 't1', traveler: 'Car 12 — ligne Niamey–Zinder', from_place: 'Niamey', to_place: 'Zinder', departure_at: ago(240), eta_at: inMin(420), status: 'active', vehicle_plate: '8A 4521 RN', last_lat: 13.79, last_lng: 5.26, last_position_at: ago(6) },
  { id: 't2', traveler: 'Car 07 — ligne Niamey–Agadez', from_place: 'Niamey', to_place: 'Agadez', departure_at: ago(600), eta_at: ago(35), status: 'overdue', vehicle_plate: '8A 1187 RN', last_lat: 16.35, last_lng: 7.62, last_position_at: ago(52) },
  { id: 't3', traveler: 'Mission ONG — Hadiza A.', from_place: 'Niamey', to_place: 'Tillabéri', departure_at: ago(90), eta_at: inMin(30), status: 'active', vehicle_plate: null, last_lat: 13.98, last_lng: 1.71, last_position_at: ago(12) },
  { id: 't4', traveler: 'Car 03 — ligne Niamey–Dosso', from_place: 'Niamey', to_place: 'Dosso', departure_at: ago(300), eta_at: ago(120), status: 'arrived', vehicle_plate: '8A 9902 RN', last_lat: 13.05, last_lng: 3.19, last_position_at: ago(118) },
  { id: 't5', traveler: 'Car 15 — ligne Niamey–Maradi', from_place: 'Niamey', to_place: 'Maradi', departure_at: inMin(60), eta_at: inMin(660), status: 'planned', vehicle_plate: '8A 3310 RN', last_lat: null, last_lng: null, last_position_at: null },
]

export const DEMO_ALERTS: OrgAlert[] = [
  { id: 'a1', traveler: 'Ibrahim S. (Car 07)', phone: '+22790000000', kind: 'panne', message: 'Car en panne, 40 passagers, pas de réseau régulier', status: 'sent', lat: 16.35, lng: 7.62, created_at: ago(48), trip: 'Niamey → Agadez', blood_group: 'O+', allergies: null },
  { id: 'a2', traveler: 'Mariama K.', phone: '+22796000000', kind: 'malaise', message: null, status: 'in_progress', lat: 13.51, lng: 2.11, created_at: ago(15), trip: null, blood_group: 'A-', allergies: 'Pénicilline', conditions: 'Drépanocytose', treatments: 'Acide folique' },
  { id: 'a3', traveler: 'Abdou M.', kind: 'accident', message: '2 blessés légers', status: 'closed', lat: 13.3, lng: 2.6, created_at: ago(1440), trip: 'Niamey → Dosso' },
]

export const DEMO_VEHICLES: Vehicle[] = [
  { id: 'v1', plate: '8A 4521 RN', label: 'Car 12', capacity: 60, active: true },
  { id: 'v2', plate: '8A 1187 RN', label: 'Car 07', capacity: 45, active: true },
  { id: 'v3', plate: '8A 9902 RN', label: 'Car 03', capacity: 60, active: true },
  { id: 'v4', plate: '8A 3310 RN', label: 'Car 15', capacity: 70, active: true },
]

export const DEMO_MEMBERS: Member[] = [
  { user_id: 'm1', role: 'admin', full_name: 'Responsable sécurité' },
  { user_id: 'm2', role: 'dispatcher', full_name: 'Régulateur gare routière' },
  { user_id: 'm3', role: 'traveler', full_name: 'Ibrahim S. (chauffeur)' },
  { user_id: 'm4', role: 'traveler', full_name: 'Hadiza A.' },
]
