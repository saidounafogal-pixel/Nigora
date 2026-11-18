import { test, expect, type Page } from '@playwright/test'
import { captureExternalLinks, links, mockNetwork, renderedPois, waitMapIdle, type NetLog } from './helpers'

let net: NetLog
test.beforeEach(async ({ context, page }) => {
  net = await mockNetwork(context)
  await captureExternalLinks(page)
})

const iso = (min: number) => new Date(Date.now() + min * 60000).toISOString()

async function seed(page: Page, extra: Record<string, unknown> = {}) {
  const state = {
    contacts: [
      { id: 'c1', name: 'Moussa', phone: '+22790123456', notifyOnTrip: true, notifyOnSos: true },
      { id: 'c2', name: 'Fati', phone: '+22796543210', notifyOnTrip: true, notifyOnSos: false },
    ],
    trips: [],
    medical: { fullName: 'Awa Issa', bloodGroup: 'O+', allergies: 'Pénicilline', conditions: '', treatments: '', emergencyContactName: 'Moussa', emergencyContactPhone: '+22790123456', notes: '', consentShareInSos: true, consentShowOnCard: true, consentShareWithPartners: false },
    alerts: [],
    queue: [],
    settings: { onboarded: true, sosCountdownSec: 3, lowDataMode: false },
    ...extra,
  }
  await page.goto('/')
  await page.evaluate((s) => localStorage.setItem('nigora-state-v1', JSON.stringify(s)), state)
}

test('premier lancement : contact, profil médical, fiche d’urgence', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Prêt en 3 étapes')).toBeVisible()

  await page.getByRole('link', { name: 'Ajouter un contact de confiance' }).click()
  await page.getByRole('button', { name: 'Ajouter un contact' }).click()
  await page.getByPlaceholder('Ex. Moussa (frère)').fill('Moussa')
  await page.getByPlaceholder('90 12 34 56').fill('90 12 34 56')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('+227 90 12 34 56')).toBeVisible()

  await page.goto('/medical')
  await page.getByPlaceholder('Ex. Aïchatou Moussa').fill('Awa Issa')
  await page.locator('select').first().selectOption('B+')
  await page.getByPlaceholder('Ex. pénicilline').fill('Arachide, Pénicilline')
  await page.getByText('Afficher mon profil sur la fiche d’urgence (QR code)').click()
  await page.getByRole('button', { name: /Enregistrer/ }).click()
  await expect(page.getByRole('button', { name: 'Enregistré ✓' })).toBeVisible()

  await page.goto('/fiche')
  await expect(page.getByText('B+')).toBeVisible()
  await expect(page.getByText('Arachide')).toBeVisible()
  await expect(page.locator('svg[role="img"], svg').filter({ has: page.locator('path') }).first()).toBeVisible()

  // Persistance après rechargement (IndexedDB)
  await page.reload()
  await expect(page.getByText('B+')).toBeVisible()
  await expect(page.getByText('Arachide')).toBeVisible()
})

test('trajet : itinéraire routier, carte, point d’étape, arrivée et SMS', async ({ page }) => {
  await seed(page)
  await page.goto('/trajets/nouveau')
  await page.locator('input[list="villes"]').nth(1).fill('Zinder')
  await page.getByRole('button', { name: 'Démarrer' }).click()

  await expect(page.getByRole('heading', { name: /Niamey → Zinder/ })).toBeVisible()
  await expect(page.getByText(/902 km · ≈ 11 h 00 de route/)).toBeVisible({ timeout: 15000 })
  expect(net.osrm).toBeGreaterThan(0)
  await expect(page.getByTestId('carte-trajet').locator('canvas')).toBeVisible()

  await page.getByRole('button', { name: 'Point d’étape' }).click()
  await expect(page.getByText(/Point d’étape — tout va bien/)).toBeVisible()

  await page.getByRole('link', { name: 'Accueil' }).click()
  await expect(page.getByText('Live', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Je suis arrivé·e' }).click()
  await expect.poll(() => links(page)).toContainEqual(expect.stringMatching(/^sms:\+22790123456,\+22796543210.*arriv/))
  await page.goto('/trajets')
  await expect(page.getByText('Arrivé', { exact: true })).toBeVisible()
})

test('retard : arrivée prévue dépassée → alerte proposée aux contacts', async ({ page }) => {
  await seed(page, {
    trips: [{ id: 't1', from: 'Niamey', to: 'Dosso', departureAt: iso(-240), etaAt: iso(-40), transport: 'bus', contactIds: ['c1'], tracking: false, trackingIntervalMin: 15, status: 'active', positions: [], checkins: [], createdAt: iso(-240), updatedAt: iso(-240) }],
  })
  await page.goto('/')
  await expect(page.getByText('Retard', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /Prévenir mes contacts du retard/ }).click()
  await expect.poll(() => links(page)).toContainEqual(expect.stringMatching(/^sms:\+22790123456.*Dosso/))
})

test('SOS : annulation, déclenchement, SMS, secours proches, fin d’alerte', async ({ page }) => {
  await seed(page)
  await page.goto('/sos')
  await page.getByRole('button', { name: /Malaise/ }).click()
  await page.getByRole('button', { name: /Appuyer pour alerter/ }).click()
  await expect(page.getByText('Alerte dans quelques secondes')).toBeVisible()
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('button', { name: /Appuyer pour alerter/ })).toBeVisible()

  await page.getByPlaceholder(/Précision facultative/).fill('Douleur thoracique')
  await page.getByRole('button', { name: /Appuyer pour alerter/ }).click()
  await expect(page.getByText(/l’aide s’organise/)).toBeVisible({ timeout: 15000 })

  // SMS ouvert automatiquement : seul le contact « SOS », position, groupe sanguin (consentement)
  await expect.poll(() => links(page)).toHaveLength(1)
  const [sms] = await links(page)
  const body = decodeURIComponent(sms)
  expect(sms).toMatch(/^sms:\+22790123456[?&]body=/)
  expect(body).toContain('MALAISE')
  expect(body).toContain('13.51160, 2.12540')
  expect(body).toContain('Groupe O+')
  expect(body).toContain('Douleur thoracique')

  await expect(page.getByTestId('a-proximite-liste').getByText('Clinique Gamkalé')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('link', { name: /15 SAMU/ })).toHaveAttribute('href', 'tel:15')

  await page.getByRole('button', { name: /Je suis en sécurité/ }).click()
  await page.goto('/alertes')
  await expect(page.getByText('Clôturée')).toBeVisible()
})

test('carte : fonds Nuit / Satellite / Plan / Relief, infrastructures, filtres, fiche', async ({ page }) => {
  await seed(page, { lastPosition: { lat: 13.5116, lng: 2.1254, accuracy: 25, at: iso(0) } })
  await page.goto('/carte')
  await waitMapIdle(page)
  // 8 catégories actives par défaut (hébergement masqué) → 11 points sur 12
  await expect(page.getByTestId('statut-carte')).toHaveText('11 infrastructures · OpenStreetMap', { timeout: 20000 })
  expect(net.overpass).toBe(1)
  expect(net.vector).toBeGreaterThan(0)
  await expect.poll(() => renderedPois(page)).toBeGreaterThan(0)
  await page.getByRole('button', { name: /Eau/ }).click()
  await expect(page.getByTestId('statut-carte')).toHaveText('8 infrastructures · OpenStreetMap')
  await page.getByRole('button', { name: /Eau/ }).click()

  // À proximité → fiche avec itinéraire
  await page.getByTestId('a-proximite').getByText('Commissariat Central').click()
  const fiche = page.getByTestId('fiche-poi')
  await expect(fiche.getByText('Police et gendarmerie')).toBeVisible()
  await expect(fiche.getByRole('link', { name: 'Itinéraire' })).toHaveAttribute('href', /destination=13.512,2.123/)

  // Clic directement sur un pictogramme de la carte
  await page.getByRole('button', { name: 'Fermer' }).click()
  await page.evaluate(() => (window as unknown as { __nigoraMap: { jumpTo: (o: object) => void } }).__nigoraMap.jumpTo({ center: [2.111, 13.5205], zoom: 16 }))
  await page.waitForTimeout(1200)
  const pt = await page.evaluate(() => {
    const m = (window as unknown as { __nigoraMap: { project: (c: number[]) => { x: number; y: number } } }).__nigoraMap
    return m.project([2.111, 13.5205])
  })
  await page.getByTestId('carte').click({ position: { x: pt.x, y: pt.y } })
  await expect(page.getByTestId('fiche-poi').getByText('Hôpital National de Niamey')).toBeVisible()
  await expect(page.getByTestId('fiche-poi').getByRole('link', { name: 'Appeler' })).toHaveAttribute('href', 'tel:+227 20 72 22 53')

  // Changement de fond : les couches NIGORA restent présentes
  for (const [label, check] of [['Satellite', () => net.esri], ['Relief', () => net.topo], ['Plan', () => 1], ['Nuit', () => net.vector]] as const) {
    await page.getByRole('button', { name: 'Fonds de carte' }).click()
    await page.getByRole('button', { name: label, exact: true }).click()
    await waitMapIdle(page)
    await expect.poll(check).toBeGreaterThan(0)
    await expect.poll(() => page.evaluate(() => !!(window as unknown as { __nigoraMap: { getLayer: (id: string) => unknown } }).__nigoraMap.getLayer('pois'))).toBe(true)
  }
})

test.describe('application installée (service worker actif)', () => {
  test.use({ serviceWorkers: 'allow' })

  test('hors ligne complet : rechargement sans réseau, carte depuis le cache, SOS par SMS', async ({ page, context }) => {
    await seed(page, { lastPosition: { lat: 13.5116, lng: 2.1254, accuracy: 25, at: iso(0) } })
    // Installation de la PWA : le service worker met l'application en cache
    await page.goto('/carte')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await waitMapIdle(page)
    await expect(page.getByTestId('statut-carte')).toHaveText('11 infrastructures · OpenStreetMap', { timeout: 20000 })

    // Coupure totale du réseau puis rechargement complet de l'application
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText('Hors ligne · SMS')).toBeVisible()
    await waitMapIdle(page)
    await expect(page.getByTestId('statut-carte')).toHaveText(/11 infrastructures/, { timeout: 20000 })
    await expect.poll(() => renderedPois(page), { timeout: 15000 }).toBeGreaterThan(0)
    expect(net.overpass).toBe(1)

    await page.getByRole('link', { name: /Déclencher une alerte SOS/ }).click()
    await page.getByRole('button', { name: /Appuyer pour alerter/ }).click()
    await expect(page.getByText(/l’aide s’organise/)).toBeVisible({ timeout: 15000 })
    await expect.poll(() => links(page)).toHaveLength(1)
    await expect(page.getByTestId('a-proximite-liste').getByText('Hôpital National de Niamey')).toBeVisible()
    await context.setOffline(false)
  })
})

test('espace entreprise et partenaires (démonstration) : carte et traitement des alertes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/pro')
  await expect(page.getByTestId('carte-ops').locator('canvas')).toBeVisible()
  const panne = page.locator('div', { hasText: /^Panne/ }).first()
  void panne
  await page.getByRole('button', { name: 'Prendre en charge' }).first().click()
  await expect(page.getByText('Prise en charge').first()).toBeVisible()
  await page.getByRole('button', { name: /Véhicules/ }).click()
  await page.getByPlaceholder('Immatriculation').fill('8A 7777 RN')
  await page.getByRole('button', { name: 'Ajouter' }).click()
  await expect(page.getByText('8A 7777 RN').first()).toBeVisible()

  await page.goto('/partenaires')
  await expect(page.getByText(/Groupe A- · Allergies : Pénicilline/)).toBeVisible()
  await page.getByRole('button', { name: 'Clôturer' }).first().click()
})

test('lien de suivi sans serveur configuré', async ({ page }) => {
  await page.goto('/suivi/inconnu')
  await expect(page.getByText(/lien de suivi est invalide/)).toBeVisible()
})
