import type { AppState, Position } from './types'
import type { Poi, PoiCategory } from './poi'

/** Mode aperçu : aucune connexion réseau, données fictives (lien de prévisualisation privé) */
export const DEMO = import.meta.env.VITE_DEMO === '1'

export const DEMO_POSITION: Position = { lat: 13.5137, lng: 2.1098, accuracy: 18, at: new Date().toISOString() }

const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const inMin = (m: number) => new Date(Date.now() + m * 60000).toISOString()

// Itinéraire approximatif Niamey → Dosso → Konni → Maradi → Zinder (RN1)
export const DEMO_ROUTE: [number, number][] = [
  [2.1254, 13.5116], [2.4, 13.42], [2.75, 13.3], [3.1937, 13.049], [3.6, 13.35], [4.0287, 13.6403], [4.6, 13.75],
  [5.2503, 13.7956], [5.9604, 14.073], [6.5, 13.75], [7.1017, 13.5], [7.55, 13.6], [7.9874, 13.7573], [8.5, 13.8], [8.9881, 13.8053],
]

export function demoState(): AppState {
  const positions = [
    { lat: 13.5116, lng: 2.1254, at: ago(170) },
    { lat: 13.3, lng: 2.75, at: ago(120) },
    { lat: 13.049, lng: 3.1937, at: ago(80) },
    { lat: 13.35, lng: 3.6, at: ago(40) },
    { lat: 13.64, lng: 4.0287, at: ago(6) },
  ]
  return {
    contacts: [
      { id: 'c1', name: 'Moussa (frère)', phone: '+22790123456', relation: 'Famille', notifyOnTrip: true, notifyOnSos: true },
      { id: 'c2', name: 'Fati', phone: '+22796543210', relation: 'Amie', notifyOnTrip: true, notifyOnSos: true },
      { id: 'c3', name: 'Dr Issa', phone: '+22791112233', relation: 'Médecin', notifyOnTrip: false, notifyOnSos: true },
    ],
    trips: [
      {
        id: 'demo-trip', from: 'Niamey', to: 'Zinder', departureAt: ago(180), etaAt: inMin(420), transport: 'bus', company: 'Rimbo Transport', vehiclePlate: '8A 4521 RN',
        contactIds: ['c1', 'c2'], tracking: true, trackingIntervalMin: 15, status: 'active', positions,
        checkins: [{ at: ago(180), label: 'Départ de Niamey' }, { at: ago(80), label: 'Point d’étape — tout va bien', position: positions[2] }],
        fromCoord: { lat: 13.5116, lng: 2.1254 }, toCoord: { lat: 13.8053, lng: 8.9881 },
        route: { coords: DEMO_ROUTE, km: 902, minutes: 660, source: 'osrm' }, shareToken: 'demo', createdAt: ago(200), updatedAt: ago(6),
      },
      {
        id: 'demo-trip-2', from: 'Niamey', to: 'Tillabéri', departureAt: inMin(60 * 26), etaAt: inMin(60 * 28), transport: 'voiture', contactIds: ['c1'], tracking: true, trackingIntervalMin: 15,
        status: 'planned', positions: [], checkins: [], createdAt: ago(30), updatedAt: ago(30),
      },
    ],
    medical: {
      fullName: 'Aïchatou Moussa', birthYear: '1998', bloodGroup: 'O+', allergies: 'Pénicilline, Arachide', conditions: 'Asthme', treatments: 'Ventoline si besoin',
      emergencyContactName: 'Moussa', emergencyContactPhone: '+22790123456', notes: '', consentShareInSos: true, consentShowOnCard: true, consentShareWithPartners: true,
    },
    alerts: [
      { id: 'demo-a1', createdAt: ago(60 * 24 * 9), kind: 'panne', message: 'Pneu crevé km 40', position: { lat: 13.3, lng: 2.6, at: ago(60 * 24 * 9) }, positionIsLastKnown: false, channels: ['sms'], status: 'closed', includeMedical: false },
    ],
    lastPosition: DEMO_POSITION,
    queue: [],
    settings: { onboarded: true, sosCountdownSec: 5, lowDataMode: false, mapStyle: 'nuit' },
  }
}

// Infrastructures fictives mais plausibles (Niamey et villes étapes) pour la démonstration
const P = (id: string, cat: PoiCategory, name: string, lat: number, lng: number, detail?: string, phone?: string): Poi => ({ id, cat, name, lat, lng, detail, phone, tags: {} })
export const DEMO_POIS: Poi[] = [
  P('d1', 'sante', 'Hôpital National de Niamey', 13.5205, 2.111, 'Urgences'),
  P('d2', 'sante', 'Hôpital National Amirou Boubacar Diallo', 13.4905, 2.1505, 'Hôpital'),
  P('d3', 'sante', 'Centre de santé intégré Yantala', 13.5285, 2.0935, 'Centre de santé'),
  P('d4', 'sante', 'Clinique Gamkalé', 13.514, 2.129, 'Centre de santé'),
  P('d5', 'sante', 'Maternité Issaka Gazobi', 13.5175, 2.1185, 'Maternité'),
  P('d6', 'pharmacie', 'Pharmacie du Plateau', 13.509, 2.118),
  P('d7', 'pharmacie', 'Pharmacie Liberté', 13.5245, 2.1265),
  P('d8', 'pharmacie', 'Pharmacie Kalley', 13.5065, 2.1335),
  P('d9', 'eau', 'Point d’eau', 13.53, 2.14, 'Puits · potable · pompe manuelle'),
  P('d10', 'eau', 'Forage communautaire', 13.498, 2.15, 'Forage'),
  P('d11', 'eau', 'Borne fontaine Yantala', 13.525, 2.095, 'Robinet / borne · potable'),
  P('d12', 'eau', 'Château d’eau', 13.536, 2.118, 'Château d’eau'),
  P('d13', 'eau', 'Forage Gamkallé', 13.5035, 2.1395, 'Forage · potable'),
  P('d14', 'carburant', 'Station Total Corniche', 13.516, 2.105, 'Total'),
  P('d15', 'carburant', 'Station Oryx', 13.5225, 2.1385, 'Oryx'),
  P('d16', 'carburant', 'Station Sonidep', 13.4995, 2.124, 'Sonidep'),
  P('d17', 'police', 'Commissariat Central', 13.512, 2.123),
  P('d18', 'police', 'Brigade de gendarmerie', 13.532, 2.108),
  P('d19', 'pompiers', 'Caserne des sapeurs-pompiers', 13.506, 2.108, undefined, '18'),
  P('d20', 'garage', 'Garage Moussa', 13.535, 2.145),
  P('d21', 'garage', 'Vulcanisation Wadata', 13.5215, 2.1475),
  P('d22', 'transport', 'Gare routière de Wadata', 13.5225, 2.134),
  P('d23', 'transport', 'Gare Rimbo Transport', 13.5175, 2.1395),
  P('d24', 'hebergement', 'Hôtel Terminus', 13.51, 2.115),
  // Dosso
  P('d30', 'sante', 'Centre Hospitalier Régional de Dosso', 13.052, 3.198, 'Hôpital'),
  P('d31', 'carburant', 'Station Dosso Sortie Est', 13.045, 3.21),
  P('d32', 'eau', 'Forage Dosso', 13.06, 3.185, 'Forage · potable'),
  P('d33', 'police', 'Poste de contrôle Dosso', 13.041, 3.17),
  P('d34', 'garage', 'Garage de la Route', 13.048, 3.205),
  // Dogondoutchi, Konni, Maradi, Zinder
  P('d40', 'sante', 'Hôpital de district Dogondoutchi', 13.645, 4.035, 'Hôpital'),
  P('d41', 'eau', 'Puits pastoral', 13.7, 4.4, 'Puits · pompe manuelle'),
  P('d42', 'sante', 'Hôpital de district Birni N’Konni', 13.8, 5.255, 'Hôpital'),
  P('d43', 'carburant', 'Station Konni', 13.79, 5.245),
  P('d44', 'sante', 'CHR de Maradi', 13.505, 7.105, 'Hôpital'),
  P('d45', 'sante', 'Hôpital National de Zinder', 13.81, 8.995, 'Hôpital'),
  P('d46', 'eau', 'Forage Tessaoua', 13.76, 7.99, 'Forage'),
]

export const DEMO_ROADS: { name: string; coords: [number, number][] }[] = [
  { name: 'RN1', coords: DEMO_ROUTE },
  { name: 'RN1', coords: [[8.9881, 13.8053], [10.27, 13.9835], [11.9853, 13.2114], [12.6113, 13.3154], [13.1105, 14.2532]] },
  { name: 'RN1', coords: [[2.1254, 13.5116], [1.6, 13.85], [1.4531, 14.2117], [0.9174, 14.7308]] },
  { name: 'RN4', coords: [[2.1254, 13.5116], [1.4, 13.75], [0.7531, 14.0078]] },
  { name: 'RN25', coords: [[5.2503, 13.7956], [5.2436, 14.4621], [5.2692, 14.8888], [6.2792, 15.459], [7.9865, 16.9742], [7.3853, 18.7369]] },
  { name: 'RN7', coords: [[3.1937, 13.049], [3.35, 12.5], [3.4492, 11.8843]] },
  { name: 'RN11', coords: [[8.9881, 13.8053], [8.8879, 14.9709], [7.9865, 16.9742]] },
  { name: 'RN25', coords: [[2.1254, 13.5116], [2.95, 13.7833], [3.3168, 14.3521]] },
]

// Fleuve Niger (tracé simplifié)
export const DEMO_RIVER: [number, number][] = [
  [0.6, 15.05], [0.75, 14.95], [0.9174, 14.7308], [1.2, 14.4], [1.4531, 14.2117], [1.75, 13.85], [2.0, 13.6], [2.1, 13.5], [2.25, 13.3], [2.36, 13.1], [2.6, 12.6], [2.95, 12.3], [3.45, 11.88], [3.65, 11.7],
]
