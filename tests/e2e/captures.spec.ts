import { test } from '@playwright/test'
import { mockNetwork, waitMapIdle, captureExternalLinks } from './helpers'

// Captures pour la documentation : CAPTURES=1 npx playwright test captures
test.skip(!process.env.CAPTURES, 'captures désactivées')

const iso = (min: number) => new Date(Date.now() + min * 60000).toISOString()
const state = {
  contacts: [{ id: 'c1', name: 'Moussa', phone: '+22790123456', notifyOnTrip: true, notifyOnSos: true }, { id: 'c2', name: 'Fati', phone: '+22796543210', notifyOnTrip: true, notifyOnSos: true }],
  trips: [],
  medical: { fullName: 'Aïchatou Moussa', bloodGroup: 'O+', allergies: 'Pénicilline', conditions: 'Asthme', treatments: '', emergencyContactName: 'Moussa', emergencyContactPhone: '+22790123456', notes: '', consentShareInSos: true, consentShowOnCard: true, consentShareWithPartners: false },
  alerts: [], queue: [], lastPosition: { lat: 13.5116, lng: 2.1254, accuracy: 25, at: iso(0) },
  settings: { onboarded: true, sosCountdownSec: 0, lowDataMode: false },
}

test('captures', async ({ page, context }) => {
  await mockNetwork(context)
  await captureExternalLinks(page)
  await page.goto('/')
  await page.evaluate((s) => localStorage.setItem('nigora-state-v1', JSON.stringify(s)), state)
  const out = process.env.CAPTURES_DIR ?? 'docs/captures'

  await page.goto('/carte')
  await waitMapIdle(page)
  await page.getByText('11 infrastructures · OpenStreetMap').waitFor()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/10-carte.png` })
  await page.getByTestId('a-proximite').getByText('Clinique Gamkalé').click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/11-carte-fiche.png` })
  await page.getByRole('button', { name: 'Fonds de carte' }).click()
  await page.screenshot({ path: `${out}/12-carte-fonds.png` })

  await page.goto('/trajets/nouveau')
  await page.locator('input[list="villes"]').nth(1).fill('Zinder')
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await page.getByText(/902 km/).waitFor()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/13-trajet-carte.png` })

  await page.goto('/sos')
  await page.getByRole('button', { name: /Appuyer pour alerter/ }).click()
  await page.getByText('Clinique Gamkalé').waitFor()
  await page.evaluate(() => window.scrollTo(0, 420))
  await page.screenshot({ path: `${out}/14-sos-secours-proches.png` })

  await page.setViewportSize({ width: 1280, height: 860 })
  await page.goto('/pro')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${out}/15-pro-carte.png` })
})
