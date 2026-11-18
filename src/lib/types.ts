export type Contact = {
  id: string
  name: string
  phone: string
  relation?: string
  notifyOnTrip: boolean
  notifyOnSos: boolean
}

export type Position = {
  lat: number
  lng: number
  accuracy?: number
  at: string // ISO
}

export type TripStatus = 'planned' | 'active' | 'arrived' | 'overdue' | 'cancelled'

export type Trip = {
  id: string
  from: string
  to: string
  departureAt: string
  etaAt: string
  transport: 'bus' | 'voiture' | 'moto' | 'taxi-brousse' | 'avion' | 'autre'
  company?: string
  vehiclePlate?: string
  notes?: string
  contactIds: string[]
  tracking: boolean
  trackingIntervalMin: number
  status: TripStatus
  positions: Position[]
  checkins: { at: string; label: string; position?: Position }[]
  shareToken?: string
  fromCoord?: { lat: number; lng: number }
  toCoord?: { lat: number; lng: number }
  route?: { coords: [number, number][]; km: number; minutes?: number; source: 'osrm' | 'direct' }
  createdAt: string
  updatedAt: string
}

export type MedicalProfile = {
  fullName: string
  birthYear?: string
  bloodGroup: '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Inconnu'
  allergies: string
  conditions: string
  treatments: string
  emergencyContactName: string
  emergencyContactPhone: string
  notes: string
  // Consentements explicites
  consentShareInSos: boolean
  consentShowOnCard: boolean
  consentShareWithPartners: boolean
  updatedAt?: string
}

export type AlertStatus = 'pending' | 'sent' | 'received' | 'in_progress' | 'closed' | 'cancelled'

export type SosAlert = {
  id: string
  createdAt: string
  kind: 'accident' | 'panne' | 'malaise' | 'agression' | 'autre'
  message?: string
  position?: Position
  positionIsLastKnown: boolean
  tripId?: string
  channels: ('sms' | 'whatsapp' | 'share' | 'serveur')[]
  status: AlertStatus
  includeMedical: boolean
}

export type SyncItem = {
  id: string
  table: 'trips' | 'alerts' | 'positions' | 'medical_profiles' | 'trusted_contacts'
  op: 'upsert' | 'delete'
  payload: Record<string, unknown>
  queuedAt: string
  attempts: number
}

export type Settings = {
  onboarded: boolean
  sosCountdownSec: number
  lowDataMode: boolean
  orgCode?: string
  mapStyle?: 'nuit' | 'satellite' | 'plan' | 'relief'
  mapCats?: string[]
}

export type AppState = {
  contacts: Contact[]
  trips: Trip[]
  medical: MedicalProfile
  alerts: SosAlert[]
  lastPosition?: Position
  queue: SyncItem[]
  settings: Settings
  savedAt?: number
}
