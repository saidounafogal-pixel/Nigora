import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CloudDownload, Crosshair, Layers, Loader2, MessageSquare, Navigation, Phone, X } from 'lucide-react'
import MapView, { type MapLine, type MapPoint } from '../components/MapView'
import { useStore } from '../lib/store'
import { useOnline } from '../lib/hooks'
import { STYLES, type MapStyleKey } from '../lib/mapStyles'
import { CAT, CATEGORIES, directionsLink, fmtKm, loadPois, nearest, type BBox, type Poi, type PoiCategory } from '../lib/poi'
import { getPosition, mapsLink } from '../lib/geo'
import { prefetchArea } from '../lib/offlineMap'
import { phonesOf, smsLink } from '../lib/messages'
import { cx } from '../lib/utils'
import { DEMO } from '../lib/demo'

export const MIN_POI_ZOOM = 9
const DEFAULT_CATS: PoiCategory[] = ['sante', 'pharmacie', 'eau', 'carburant', 'police', 'pompiers', 'garage', 'transport']

export default function MapPage() {
  const { state, updateSettings, setLastPosition } = useStore()
  const online = useOnline()
  const styleKey = (state.settings.mapStyle ?? 'nuit') as MapStyleKey
  const cats = (state.settings.mapCats as PoiCategory[] | undefined) ?? DEFAULT_CATS
  const [pois, setPois] = useState<Poi[]>([])
  const [status, setStatus] = useState<{ loading: boolean; zoom: number; note?: string }>({ loading: false, zoom: 12 })
  const [selected, setSelected] = useState<Poi>()
  const [bbox, setBbox] = useState<BBox>()
  const [fit, setFit] = useState<{ key: string; to: [number, number][] }>()
  const [showStyles, setShowStyles] = useState(false)
  const [dl, setDl] = useState<string>()
  const abort = useRef<AbortController>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const me = state.lastPosition
  const activeTrip = state.trips.find((t) => t.status === 'active' || t.status === 'overdue')
  const openAlert = state.alerts.find((a) => a.status === 'pending' || a.status === 'sent' || a.status === 'in_progress')

  const onMoveEnd = useCallback(
    (b: BBox, zoom: number) => {
      setBbox(b)
      clearTimeout(timer.current)
      if (zoom < MIN_POI_ZOOM) {
        setStatus({ loading: false, zoom, note: 'Zoomez pour afficher les infrastructures' })
        return
      }
      timer.current = setTimeout(async () => {
        abort.current?.abort()
        const ac = new AbortController()
        abort.current = ac
        setStatus({ loading: true, zoom })
        try {
          const r = await loadPois(b, { signal: ac.signal, online })
          setPois(r.pois)
          setStatus({
            loading: false,
            zoom,
            note: r.failed && !r.pois.length ? (online ? 'Service OpenStreetMap indisponible, réessayez' : 'Hors ligne : aucune donnée enregistrée pour cette zone') : r.failed ? 'Hors ligne : données enregistrées' : undefined,
          })
        } catch {
          /* requête annulée */
        }
      }, 500)
    },
    [online],
  )

  useEffect(() => () => abort.current?.abort(), [])

  const lines = useMemo<MapLine[]>(() => {
    if (!activeTrip) return []
    const l: MapLine[] = []
    if (activeTrip.route) l.push({ id: 'route', coords: activeTrip.route.coords, color: '#E05206', width: 5, dashed: activeTrip.route.source === 'direct' })
    if (activeTrip.positions.length > 1) l.push({ id: 'trace', coords: activeTrip.positions.map((p) => [p.lng, p.lat]), color: '#60a5fa', width: 3 })
    return l
  }, [activeTrip])

  const points = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = []
    if (activeTrip?.fromCoord) pts.push({ id: 'depart', ...activeTrip.fromCoord, color: '#22c55e', label: activeTrip.from })
    if (activeTrip?.toCoord) pts.push({ id: 'arrivee', ...activeTrip.toCoord, color: '#E05206', label: activeTrip.to })
    if (openAlert?.position) pts.push({ id: 'alerte', lat: openAlert.position.lat, lng: openAlert.position.lng, color: '#ef4444', label: 'Alerte SOS', pulse: true })
    return pts
  }, [activeTrip, openAlert])

  const around = useMemo(() => (me ? nearest(pois, me, ['sante', 'eau', 'carburant', 'police', 'garage'], 8) : []), [pois, me])
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.key, pois.filter((p) => p.cat === c.key).length])), [pois])

  async function locate() {
    try {
      const p = await getPosition(10000)
      setLastPosition(p)
      setFit({ key: 'me' + p.at, to: [[p.lng, p.lat]] })
    } catch (e) {
      setStatus((s) => ({ ...s, note: (e as Error).message }))
    }
  }

  async function downloadArea() {
    if (!bbox) return
    setDl('Préparation…')
    try {
      await loadPois(bbox, { force: true })
      const r = await prefetchArea(bbox, styleKey, (d, t) => setDl(`Téléchargement ${Math.round((d / t) * 100)} %`))
      setDl(`Zone enregistrée (${r.tiles} tuiles, zoom ≤ ${r.maxZoom})`)
    } catch (e) {
      setDl((e as Error).message)
    }
    setTimeout(() => setDl(undefined), 4000)
  }

  const toggleCat = (k: PoiCategory) => updateSettings({ mapCats: cats.includes(k) ? cats.filter((c) => c !== k) : [...cats, k] })
  const sosPhones = phonesOf(state.contacts.filter((c) => c.notifyOnSos))

  return (
    <div className="fixed inset-0 z-10 mx-auto max-w-md overflow-hidden bg-black">
      <MapView
        styleKey={styleKey}
        pois={pois}
        visibleCats={cats}
        me={me}
        lines={lines}
        points={points}
        center={me ?? activeTrip?.fromCoord}
        zoom={me ? 13 : 11}
        fitKey={fit?.key}
        fitTo={fit?.to}
        onMoveEnd={onMoveEnd}
        onPoiClick={setSelected}
      />

      {/* Barre supérieure */}
      <div className="pointer-events-none absolute inset-x-0 top-[76px] space-y-2 px-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
            {CATEGORIES.map((c) => {
              const on = cats.includes(c.key)
              return (
                <button
                  key={c.key}
                  onClick={() => toggleCat(c.key)}
                  className={cx('flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-xl transition', on ? 'bg-white text-black' : 'border border-white/15 bg-black/50 text-white/70')}
                  aria-pressed={on}
                >
                  <span>{c.emoji}</span>
                  {c.short}
                  {counts[c.key] > 0 && <span className={cx('rounded-full px-1.5 text-[10px]', on ? 'bg-black/10' : 'bg-white/10')}>{counts[c.key]}</span>}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="glass pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] text-white/80" data-testid="statut-carte">
            {status.loading ? <Loader2 size={12} className="animate-spin" /> : <span className={cx('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-400' : 'bg-amber-400')} />}
            {status.loading ? 'Chargement des infrastructures…' : status.note ?? `${pois.filter((p) => cats.includes(p.cat)).length} infrastructures · ${DEMO ? 'données d’exemple' : 'OpenStreetMap'}`}
          </span>
        </div>
      </div>

      {/* Boutons latéraux */}
      <div className="absolute right-4 top-[150px] flex flex-col gap-2">
        <div className="relative">
          <button onClick={() => setShowStyles((v) => !v)} className="glass flex h-11 w-11 items-center justify-center rounded-full" aria-label="Fonds de carte">
            <Layers size={19} />
          </button>
          {showStyles && (
            <div className="glass absolute right-12 top-0 w-40 rounded-3xl bg-black/70 p-1.5">
              {(Object.keys(STYLES) as MapStyleKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    updateSettings({ mapStyle: k })
                    setShowStyles(false)
                  }}
                  className={cx('block w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold', k === styleKey ? 'bg-white text-black' : 'text-white/80')}
                >
                  {STYLES[k].label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={locate} className="glass flex h-11 w-11 items-center justify-center rounded-full" aria-label="Me localiser">
          <Crosshair size={19} />
        </button>
        <button onClick={downloadArea} disabled={!online || !!dl || status.zoom < MIN_POI_ZOOM} className="glass flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40" aria-label="Enregistrer la zone hors ligne">
          <CloudDownload size={19} />
        </button>
      </div>
      {dl && <div className="glass absolute left-1/2 top-[150px] -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs font-semibold">{dl}</div>}

      {/* Fiche de l'infrastructure sélectionnée / à proximité */}
      <div className="absolute inset-x-0 bottom-24 px-4">
        {selected ? (
          <div className="glass rounded-[28px] bg-black/60 p-4" data-testid="fiche-poi">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: CAT[selected.cat].color }}>
                {CAT[selected.cat].emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{CAT[selected.cat].label}</p>
                <p className="truncate text-lg font-bold leading-tight">{selected.name}</p>
                <p className="text-sm text-white/60">
                  {[selected.detail, me && fmtKm(nearest([selected], me)[0].km)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button onClick={() => setSelected(undefined)} className="rounded-full bg-white/10 p-1.5" aria-label="Fermer">
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              {selected.phone && (
                <a href={`tel:${selected.phone.split(';')[0]}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-sm font-bold text-black">
                  <Phone size={15} /> Appeler
                </a>
              )}
              <a href={directionsLink(selected, me)} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand py-2.5 text-sm font-bold">
                <Navigation size={15} /> Itinéraire
              </a>
              {sosPhones.length > 0 && (
                <a
                  href={smsLink(sosPhones, `📍 NIGORA — je me rends à : ${selected.name} (${CAT[selected.cat].short}) ${mapsLink(selected)}`)}
                  className="flex items-center justify-center rounded-full bg-white/10 px-3.5"
                  aria-label="Prévenir mes contacts"
                >
                  <MessageSquare size={16} />
                </a>
              )}
            </div>
          </div>
        ) : around.length > 0 ? (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" data-testid="a-proximite">
            {around.map((p) => (
              <button key={p.id} onClick={() => (setSelected(p), setFit({ key: p.id, to: [[p.lng, p.lat]] }))} className="glass flex w-44 shrink-0 items-center gap-2 rounded-3xl bg-black/50 p-2.5 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ background: CAT[p.cat].color }}>
                  {CAT[p.cat].emoji}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{p.name}</span>
                  <span className="block text-[11px] text-white/50">{fmtKm(p.km)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : activeTrip ? (
          <Link to={`/trajets/${activeTrip.id}`} className="glass block rounded-3xl bg-black/50 px-4 py-3 text-sm">
            Trajet en cours : <b>{activeTrip.from} → {activeTrip.to}</b>
            {activeTrip.route && <span className="text-white/50"> · {fmtKm(activeTrip.route.km)}</span>}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
