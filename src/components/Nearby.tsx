import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Navigation, Phone } from 'lucide-react'
import { CAT, cachedPoisAround, directionsLink, fmtKm, loadPois, nearest, type Poi, type PoiCategory } from '../lib/poi'

type Props = { pos?: { lat: number; lng: number }; cats: PoiCategory[]; limit?: number; title: string }

/** Infrastructures les plus proches : cache local immédiatement, puis OpenStreetMap si en ligne */
export default function Nearby({ pos, cats, limit = 4, title }: Props) {
  const [list, setList] = useState<(Poi & { km: number })[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pos) return
    let alive = true
    cachedPoisAround(pos, 0.5).then((c) => alive && setList(nearest(c, pos, cats, limit)))
    if (navigator.onLine) {
      setLoading(true)
      const d = 0.2
      loadPois({ south: pos.lat - d, north: pos.lat + d, west: pos.lng - d, east: pos.lng + d })
        .then((r) => {
          if (alive && r.pois.length) setList(nearest(r.pois, pos, cats, limit))
        })
        .catch(() => undefined)
        .finally(() => alive && setLoading(false))
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos?.lat, pos?.lng])

  if (!pos) return null
  return (
    <div className="glass rounded-[28px] p-4" data-testid="a-proximite-liste">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        {loading ? <Loader2 size={14} className="animate-spin text-white/50" /> : <Link to="/carte" className="text-xs text-white/50">Carte</Link>}
      </div>
      {list.length === 0 && !loading && <p className="text-sm text-white/50">Aucune donnée pour cette zone. Ouvrez la carte une fois en ligne pour l’enregistrer.</p>}
      <ul className="divide-y divide-white/10">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: CAT[p.cat].color }}>
              {CAT[p.cat].emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-white/50">
                {fmtKm(p.km)}
                {p.detail ? ` · ${p.detail}` : ''}
              </p>
            </div>
            {p.phone && (
              <a href={`tel:${p.phone.split(';')[0]}`} className="rounded-full bg-white p-2 text-black" aria-label={`Appeler ${p.name}`}>
                <Phone size={15} />
              </a>
            )}
            <a href={directionsLink(p, pos)} target="_blank" rel="noreferrer" className="rounded-full bg-brand p-2" aria-label="Itinéraire">
              <Navigation size={15} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
