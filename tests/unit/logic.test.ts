import { describe, expect, it, vi, beforeEach } from 'vitest'
import { clear } from 'idb-keyval'
import overpass from '../fixtures/overpass.json'
import osrm from '../fixtures/osrm.json'
import { normalizePhone, formatPhone, minutesUntil } from '../../src/lib/utils'
import { findCity, CITIES } from '../../src/data/places'
import { buildOverpassQuery, categorize, cellsFor, loadPois, nearest, parseOverpass, fmtKm, cachedPoisAround } from '../../src/lib/poi'
import { medicalQrText, smsLink, sosText, overdueText } from '../../src/lib/messages'
import { emptyMedical } from '../../src/lib/store'
import { toRows } from '../../src/lib/sync'
import { distanceKm } from '../../src/lib/geo'
import { tilesFor } from '../../src/lib/offlineMap'
import { route, geocode } from '../../src/lib/routing'
import type { SosAlert, Trip } from '../../src/lib/types'

const setOnline = (v: boolean) => Object.defineProperty(navigator, 'onLine', { value: v, configurable: true })

describe('téléphones', () => {
  it('complète les numéros nigériens', () => {
    expect(normalizePhone('90 12 34 56')).toBe('+22790123456')
    expect(normalizePhone('0022790123456')).toBe('+22790123456')
    expect(normalizePhone('22796000000')).toBe('+22796000000')
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678')
    expect(formatPhone('90123456')).toBe('+227 90 12 34 56')
  })
})

describe('villes et distances', () => {
  it('trouve les villes sans accents ni apostrophes', () => {
    expect(findCity('tillaberi')?.name).toBe('Tillabéri')
    expect(findCity("Birni N'Konni")?.name).toBe('Birni N’Konni')
    expect(findCity('Zind')?.name).toBe('Zinder')
    expect(findCity('Paris')).toBeUndefined()
  })
  it('toutes les villes sont au Niger', () => {
    for (const c of CITIES) {
      expect(c.lat).toBeGreaterThan(11.5)
      expect(c.lat).toBeLessThan(23.6)
      expect(c.lng).toBeGreaterThan(0)
      expect(c.lng).toBeLessThan(16.1)
    }
  })
  it('distance Niamey–Zinder ≈ 740 km à vol d’oiseau', () => {
    const d = distanceKm(findCity('Niamey')!, findCity('Zinder')!)
    expect(d).toBeGreaterThan(720)
    expect(d).toBeLessThan(760)
    expect(fmtKm(0.42)).toBe('420 m')
    expect(fmtKm(3.25)).toBe('3,3 km')
  })
})

describe('infrastructures OpenStreetMap', () => {
  it('classe les balises', () => {
    expect(categorize({ amenity: 'hospital' })).toBe('sante')
    expect(categorize({ healthcare: 'centre' })).toBe('sante')
    expect(categorize({ man_made: 'borehole' })).toBe('eau')
    expect(categorize({ natural: 'spring' })).toBe('eau')
    expect(categorize({ amenity: 'fuel' })).toBe('carburant')
    expect(categorize({ shop: 'tyres' })).toBe('garage')
    expect(categorize({ amenity: 'bench' })).toBeUndefined()
  })
  it('lit la réponse Overpass (nœuds, voies, sans coordonnées, hors catégorie)', () => {
    const pois = parseOverpass(overpass)
    expect(pois).toHaveLength(12)
    const well = pois.find((p) => p.id === 'node/4')!
    expect(well.cat).toBe('eau')
    expect(well.name).toBe('Point d’eau')
    expect(well.detail).toBe('Puits · potable · pompe manuelle')
    expect(pois.find((p) => p.id === 'way/2')!.lat).toBe(13.514)
    expect(pois.find((p) => p.id === 'node/1')!.phone).toBe('+227 20 72 22 53')
    expect(pois.find((p) => p.id === 'node/7')!.detail).toBe('Total')
  })
  it('construit une requête bornée', () => {
    const q = buildOverpassQuery({ south: 13.4, west: 2, north: 13.6, east: 2.2 }, ['eau'])
    expect(q).toContain('(13.4000,2.0000,13.6000,2.2000)')
    expect(q).toContain('water_well')
    expect(q).not.toContain('fuel')
  })
  it('découpe en cellules de 0,5°', () => {
    expect(cellsFor({ south: 13.4, west: 1.9, north: 13.6, east: 2.2 })).toHaveLength(4)
  })
  it('trie par distance et filtre les catégories', () => {
    const pois = parseOverpass(overpass)
    const n = nearest(pois, { lat: 13.5116, lng: 2.1254 }, ['sante'], 2)
    expect(n.map((p) => p.name)).toEqual(['Clinique Gamkalé', 'Hôpital National de Niamey'])
  })

  beforeEach(async () => {
    await clear()
    vi.restoreAllMocks()
  })

  it('télécharge une fois, puis sert depuis le cache même hors ligne', async () => {
    setOnline(true)
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(overpass)))
    const box = { south: 13.45, west: 2.05, north: 13.55, east: 2.2 }
    const a = await loadPois(box)
    expect(f).toHaveBeenCalledTimes(1)
    expect(a.pois).toHaveLength(12)
    expect(a.fetched).toBeGreaterThan(0)

    setOnline(false)
    const b = await loadPois(box)
    expect(f).toHaveBeenCalledTimes(1)
    expect(b.pois).toHaveLength(12)
    expect(b.fromCache).toBe(a.fetched)
    expect(await cachedPoisAround({ lat: 13.51, lng: 2.12 })).toHaveLength(12)
    setOnline(true)
  })
  it('bascule sur le second serveur Overpass en cas d’échec', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(new Response(JSON.stringify(overpass)))
    const r = await loadPois({ south: 13.45, west: 2.05, north: 13.55, east: 2.2 })
    expect(f).toHaveBeenCalledTimes(2)
    expect(String(f.mock.calls[1][0])).toContain('kumi')
    expect(r.pois.length).toBe(12)
  })
})

describe('itinéraires', () => {
  beforeEach(() => vi.restoreAllMocks())
  it('utilise OSRM quand il répond', async () => {
    setOnline(true)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(osrm)))
    const r = await route(findCity('Niamey')!, findCity('Zinder')!)
    expect(r.source).toBe('osrm')
    expect(Math.round(r.km)).toBe(902)
    expect(r.minutes).toBe(660)
  })
  it('se replie sur la ligne droite hors ligne', async () => {
    setOnline(false)
    const r = await route(findCity('Niamey')!, findCity('Dosso')!)
    expect(r.source).toBe('direct')
    expect(r.coords).toHaveLength(2)
    expect(await geocode('Agadez')).toMatchObject({ lat: 16.9742 })
    setOnline(true)
  })
})

describe('messages d’alerte', () => {
  const alert: SosAlert = { id: 'a', createdAt: new Date().toISOString(), kind: 'accident', position: { lat: 13.5, lng: 2.1, at: new Date().toISOString() }, positionIsLastKnown: true, channels: [], status: 'pending', includeMedical: true }
  const med = { ...emptyMedical, fullName: 'Awa', bloodGroup: 'O+' as const, allergies: 'Pénicilline' }

  it('ne joint le médical qu’avec consentement', () => {
    expect(sosText(alert, 'Awa', { ...med, consentShareInSos: false })).not.toContain('O+')
    const t = sosText(alert, 'Awa', { ...med, consentShareInSos: true })
    expect(t).toContain('Groupe O+')
    expect(t).toContain('Dernière position connue')
    expect(t).toContain('maps.google.com/?q=13.500000,2.100000')
    expect(t).toContain('SAMU 15')
  })
  it('construit un lien SMS multi-destinataires', () => {
    const l = smsLink(['90123456', '+22796000000'], 'Aide')
    expect(l).toMatch(/^sms:\+22790123456,\+22796000000[?&]body=Aide$/)
  })
  it('QR médical lisible et message de retard', () => {
    expect(medicalQrText(med)).toContain('Groupe sanguin : O+')
    const trip = { to: 'Zinder', etaAt: new Date().toISOString() } as Trip
    expect(overdueText(trip, 'Awa')).toContain('Zinder')
  })
})

describe('synchronisation', () => {
  it('convertit un trajet et ses positions en lignes Postgres', () => {
    const r = toRows(
      { id: 'q', table: 'trips', op: 'upsert', queuedAt: '', attempts: 0, payload: { id: 't', from: 'Niamey', to: 'Dosso', departureAt: 'd', etaAt: 'e', transport: 'bus', status: 'active', tracking: true, positions: [{ lat: 1, lng: 2, at: 'x' }], company: '' } },
      'u',
    )
    expect(r.rows[0]).toMatchObject({ id: 't', user_id: 'u', from_place: 'Niamey', last_lat: 1, company: null })
    expect(r.extra?.rows[0]).toMatchObject({ trip_id: 't', recorded_at: 'x' })
  })
  it('une alerte en attente part en « sent »', () => {
    const r = toRows({ id: 'q', table: 'alerts', op: 'upsert', queuedAt: '', attempts: 0, payload: { id: 'a', kind: 'panne', status: 'pending', channels: [] } }, 'u')
    expect(r.rows[0].status).toBe('sent')
  })
})

describe('carte', () => {
  it('styles valides selon la spécification MapLibre', async () => {
    const { validateStyleMin } = await import('@maplibre/maplibre-gl-style-spec')
    const { STYLES } = await import('../../src/lib/mapStyles')
    for (const [k, v] of Object.entries(STYLES)) {
      if (typeof v.style === 'string') continue
      const errors = validateStyleMin(v.style as never)
      expect(errors.map((e) => `${k}: ${e.message}`)).toEqual([])
    }
  })
  it('compte les tuiles à télécharger', () => {
    const t = tilesFor({ south: 13.4, west: 2.0, north: 13.6, east: 2.2 }, 10, 10)
    expect(t.length).toBeGreaterThan(0)
    expect(t.length).toBeLessThan(10)
  })
  it('retard détecté via minutesUntil', () => {
    expect(minutesUntil(new Date(Date.now() - 30 * 60000).toISOString())).toBe(-30)
  })
})
