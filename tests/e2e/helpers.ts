import type { Page, BrowserContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const overpass = readFileSync(new URL('../fixtures/overpass.json', import.meta.url), 'utf8')
const osrm = readFileSync(new URL('../fixtures/osrm.json', import.meta.url), 'utf8')

/** PNG 256×256 uni (tuile raster factice) */
function pngTile(r: number, g: number, b: number) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer) => {
    let c = 0xffffffff
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(256, 0)
  ihdr.writeUInt32BE(256, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: 256 }, () => [r, g, b]).flat())])
  const raw = Buffer.concat(Array.from({ length: 256 }, () => row))
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const SAT = pngTile(92, 70, 40)
const TOPO = pngTile(200, 190, 160)

export type NetLog = { overpass: number; osrm: number; esri: number; topo: number; vector: number }

/** Simule tous les services externes (tuiles, OpenStreetMap, itinéraires) */
export async function mockNetwork(ctx: BrowserContext): Promise<NetLog> {
  const log: NetLog = { overpass: 0, osrm: 0, esri: 0, topo: 0, vector: 0 }
  await ctx.route(/tiles\.openfreemap\.org\/planet$/, (r) =>
    r.fulfill({ json: { tilejson: '3.0.0', tiles: ['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, vector_layers: [] } }),
  )
  await ctx.route(/tiles\.openfreemap\.org\/planet\/test\//, (r) => (log.vector++, r.fulfill({ status: 204, body: '' })))
  await ctx.route(/tiles\.openfreemap\.org\/fonts\//, (r) => r.fulfill({ status: 404, body: '' }))
  await ctx.route(/tiles\.openfreemap\.org\/styles\/liberty/, (r) =>
    r.fulfill({ json: { version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f2efe9' } }] } }),
  )
  await ctx.route(/arcgisonline\.com/, (r) => (log.esri++, r.fulfill({ body: SAT, contentType: 'image/png' })))
  await ctx.route(/opentopomap\.org/, (r) => (log.topo++, r.fulfill({ body: TOPO, contentType: 'image/png' })))
  await ctx.route(/overpass/, (r) => (log.overpass++, r.fulfill({ body: overpass, contentType: 'application/json' })))
  await ctx.route(/router\.project-osrm\.org/, (r) => (log.osrm++, r.fulfill({ body: osrm, contentType: 'application/json' })))
  await ctx.route(/nominatim/, (r) => r.fulfill({ json: [] }))
  await ctx.route(/wa\.me|google\.com\/maps/, (r) => r.fulfill({ body: 'ok' }))
  return log
}

/** Empêche la navigation vers sms:/tel: (impossible sans téléphone) et l'enregistre */
export async function captureExternalLinks(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as { __links: string[] }).__links = []
    const push = (u: string) => (window as unknown as { __links: string[] }).__links.push(u)
    document.addEventListener(
      'click',
      (e) => {
        const a = (e.target as HTMLElement).closest('a')
        if (a && /^(sms|tel):/.test(a.getAttribute('href') ?? '')) {
          push(a.getAttribute('href')!)
          e.preventDefault()
        }
      },
      true,
    )
    const desc = Object.getOwnPropertyDescriptor(Location.prototype, 'href')
    void desc
    ;(window as unknown as { __nigoraOpenExternal: (u: string) => void }).__nigoraOpenExternal = push
  })
}

export const links = (page: Page) => page.evaluate(() => (window as unknown as { __links: string[] }).__links)

export async function waitMapIdle(page: Page) {
  await page.waitForFunction(() => {
    const m = (window as unknown as { __nigoraMap?: { getLayer: (id: string) => unknown } }).__nigoraMap
    return !!m && !!m.getLayer('pois')
  }, null, { timeout: 30000 })
}

/** Nombre de pictogrammes d'infrastructures réellement dessinés sur la carte */
export const renderedPois = (page: Page) =>
  page.evaluate(() => {
    const m = (window as unknown as { __nigoraMap: { queryRenderedFeatures: (o: object) => unknown[] } }).__nigoraMap
    return m.queryRenderedFeatures({ layers: ['pois', 'grappes'] }).length
  })
