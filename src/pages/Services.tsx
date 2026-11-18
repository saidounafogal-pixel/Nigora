import { useEffect, useMemo, useState } from 'react'
import { get, set } from 'idb-keyval'
import { BadgeCheck, Navigation, Phone, Search } from 'lucide-react'
import { BASE_SERVICES, CATEGORY_LABEL, type Service } from '../data/services'
import { supabase } from '../lib/supabase'
import { searchMapsLink } from '../lib/geo'
import { Badge, Card, Input, PageHeader } from '../components/ui'
import Nearby from '../components/Nearby'
import { useStore } from '../lib/store'

const CACHE = 'nigora-services-cache'

export default function Services() {
  const { state } = useStore()
  const [extra, setExtra] = useState<Service[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Service['category'] | 'all'>('all')

  // Annuaire distant (partenaires validés) mis en cache pour l'usage hors ligne
  useEffect(() => {
    get<Service[]>(CACHE).then((c) => c && setExtra(c))
    if (!supabase || !navigator.onLine) return
    supabase
      .from('service_directory')
      .select('id,name,category,city,phone,description,verified')
      .eq('active', true)
      .then(({ data }) => {
        if (data) {
          setExtra(data as Service[])
          set(CACHE, data).catch(() => undefined)
        }
      })
  }, [])

  const all = useMemo(() => {
    const byId = new Map<string, Service>()
    ;[...BASE_SERVICES, ...extra].forEach((s) => byId.set(s.id, s))
    return [...byId.values()]
  }, [extra])

  const filtered = all.filter(
    (s) => (cat === 'all' || s.category === cat) && (!q || `${s.name} ${s.city} ${s.description ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )
  const groups = (Object.keys(CATEGORY_LABEL) as Service['category'][]).map((c) => [c, filtered.filter((s) => s.category === c)] as const).filter(([, l]) => l.length)

  return (
    <div className="space-y-4">
      <PageHeader title="Services d’assistance" subtitle="Disponible hors connexion" back="/plus" />
      <Nearby pos={state.lastPosition} cats={['sante', 'pharmacie', 'pompiers', 'police', 'eau', 'carburant', 'garage']} limit={6} title="Autour de moi" />
      <div className="relative">
        <Search className="absolute left-3 top-3 text-white/40" size={18} />
        <Input className="pl-10" placeholder="Ville, hôpital…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', ...Object.keys(CATEGORY_LABEL)] as const).map((c) => (
          <button key={c} onClick={() => setCat(c as typeof cat)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${cat === c ? 'bg-white text-black ring-white' : 'bg-white/[0.06] text-white/75 ring-white/15'}`}>
            {c === 'all' ? 'Tout' : CATEGORY_LABEL[c as Service['category']]}
          </button>
        ))}
      </div>
      {groups.map(([c, list]) => (
        <section key={c}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">{CATEGORY_LABEL[c]}</h2>
          <ul className="space-y-2">
            {list.map((s) => (
              <li key={s.id}>
                <Card className="flex items-center gap-3 !p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-white/50">
                      {s.city}
                      {s.description ? ` · ${s.description}` : ''}
                    </p>
                    <div className="mt-1">{s.verified ? <Badge tone="green"><BadgeCheck size={12} /> Vérifié</Badge> : <Badge>Coordonnées en cours de validation</Badge>}</div>
                  </div>
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white">
                      <Phone size={16} /> {s.phone}
                    </a>
                  )}
                  {s.city !== 'National' && (
                    <a href={searchMapsLink(`${s.name} ${s.city} Niger`)} target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 p-2.5 text-white/75" aria-label="Itinéraire">
                      <Navigation size={16} />
                    </a>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
