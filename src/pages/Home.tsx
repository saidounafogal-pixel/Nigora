import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, Circle, CloudOff, MapPin, Phone, Plus, QrCode, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/hooks'
import { coords, mapsLink } from '../lib/geo'
import { fmtTime, minutesUntil, timeAgo } from '../lib/utils'
import ActiveTripActions from '../components/ActiveTripActions'
import { Dunes, SCENES } from '../components/Scene'
import type { Trip } from '../lib/types'

export default function Home() {
  const { state } = useStore()
  useNow(30000)
  const first = state.medical.fullName.split(' ')[0]
  const active = state.trips.filter((t) => t.status === 'active' || t.status === 'overdue')
  const upcoming = state.trips.filter((t) => t.status === 'planned').slice(0, 4)

  const steps = [
    { done: state.contacts.length > 0, label: 'Ajouter un contact de confiance', to: '/contacts' },
    { done: !!state.medical.bloodGroup || !!state.medical.allergies, label: 'Remplir le profil médical', to: '/medical' },
    { done: state.trips.length > 0, label: 'Préparer un premier trajet', to: '/trajets/nouveau' },
  ]
  const progress = steps.filter((s) => s.done).length

  return (
    <div className="space-y-7">
      <section>
        <p className="text-sm text-white/50">{first ? `Bonjour ${first},` : 'Bienvenue,'}</p>
        <h1 className="text-[34px] font-bold leading-[1.02] tracking-tight">
          Voyagez <span className="text-white/40">serein</span>
          <br />
          au Niger.
        </h1>
      </section>

      <section>
        <SectionTitle a="Vos" b="contacts" to="/contacts" />
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
          <Link to="/contacts" className="flex shrink-0 flex-col items-center gap-1.5">
            <span className="flex h-[60px] w-[60px] items-center justify-center rounded-[20px] border border-dashed border-white/25 text-white/70">
              <Plus size={22} />
            </span>
            <span className="text-[11px] text-white/50">Ajouter</span>
          </Link>
          {state.contacts.map((c, i) => (
            <a key={c.id} href={`tel:${c.phone}`} className="flex shrink-0 flex-col items-center gap-1.5">
              <span className="relative flex h-[60px] w-[60px] items-center justify-center rounded-[20px] text-xl font-bold" style={{ background: SCENES[i % SCENES.length] }}>
                {c.name[0]?.toUpperCase()}
                {c.notifyOnSos && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-black bg-emerald-400" />}
              </span>
              <span className="max-w-[64px] truncate text-[11px] text-white/70">{c.name.split(' ')[0]}</span>
            </a>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle a="Trajet" b="en direct" to="/trajets" />
        {active.length ? (
          <div className="space-y-4">
            {active.map((t) => (
              <LiveTripCard key={t.id} trip={t} contactsCount={state.contacts.filter((c) => t.contactIds.includes(c.id)).length} />
            ))}
          </div>
        ) : (
          <Link to="/trajets/nouveau" className="relative block h-56 overflow-hidden rounded-[32px]" style={{ background: SCENES[1] }}>
            <Dunes />
            <span className="glass absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-semibold">Aucun trajet en cours</span>
            <div className="absolute inset-x-5 bottom-5">
              <p className="display text-[40px] leading-[0.95]">
                Préparez votre
                <br />
                prochain trajet
              </p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">
                Commencer <ArrowUpRight size={14} />
              </span>
            </div>
          </Link>
        )}
      </section>

      {progress < steps.length && (
        <section className="glass rounded-[28px] p-5">
          <div className="mb-3 flex items-end justify-between">
            <p className="text-lg font-bold leading-tight">Prêt en 3 étapes</p>
            <span className="text-3xl font-bold tracking-tight">
              {progress}
              <span className="text-white/30">/{steps.length}</span>
            </span>
          </div>
          <div className="space-y-1">
            {steps.map((s) => (
              <Link key={s.label} to={s.to} className="flex items-center gap-3 rounded-2xl px-1 py-2 text-sm">
                {s.done ? <CheckCircle2 className="text-brand" size={20} /> : <Circle className="text-white/25" size={20} />}
                <span className={s.done ? 'text-white/35 line-through' : 'text-white'}>{s.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle a="Accès" b="rapide" />
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
          <Tile to="/fiche" scene={0} tag="QR" title="Fiche d’urgence" icon={<QrCode size={18} />} />
          <Tile to="/services" scene={2} tag="15 · 17 · 18" title="Services d’assistance" icon={<Phone size={18} />} />
          <Tile to="/contacts" scene={3} tag={`${state.contacts.length} contacts`} title="Cercle de confiance" icon={<Users size={18} />} />
          <Tile to="/hors-ligne" scene={1} tag="SMS" title="Mode hors ligne" icon={<CloudOff size={18} />} />
        </div>
      </section>

      {upcoming.length > 0 && (
        <section>
          <SectionTitle a="Trajets" b="à venir" to="/trajets" />
          <div className="space-y-2">
            {upcoming.map((t) => (
              <Link key={t.id} to={`/trajets/${t.id}`} className="glass flex items-center justify-between rounded-3xl px-4 py-3">
                <span className="font-semibold">
                  {t.from} → {t.to}
                </span>
                <span className="rounded-full bg-sky-500 px-2.5 py-0.5 text-xs font-bold">{fmtTime(t.departureAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="glass flex items-center gap-3 rounded-[28px] p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
          <MapPin size={20} className="text-brand" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-white/40">Dernière position connue</p>
          {state.lastPosition ? (
            <a href={mapsLink(state.lastPosition)} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold">
              {coords(state.lastPosition)} <span className="font-normal text-white/40">· {timeAgo(state.lastPosition.at)}</span>
            </a>
          ) : (
            <p className="text-sm text-white/60">Autorisez la localisation</p>
          )}
        </div>
      </section>

      <p className="px-4 text-center text-[11px] leading-relaxed text-white/35">
        NIGORA ne remplace pas les services de secours.
        <br />
        En danger immédiat : SAMU 15 · Police 17 · Pompiers 18
      </p>
    </div>
  )
}

function LiveTripCard({ trip, contactsCount }: { trip: Trip; contactsCount: number }) {
  const overdue = trip.status === 'overdue'
  const mins = minutesUntil(trip.etaAt)
  const left = mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}` : `${mins} min`
  return (
    <div>
      <div className="relative h-[300px] overflow-hidden rounded-[32px]" style={{ background: overdue ? 'radial-gradient(120% 80% at 70% 0%, #ff8a8a 0%, #c81e1e 35%, #3a0606 75%, #0a0202 100%)' : SCENES[0] }}>
        <Dunes />
        <div className="glass absolute left-3 right-3 top-3 flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-1.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-[11px] font-black">{(trip.company ?? trip.transport)[0].toUpperCase()}</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{trip.company ?? 'Trajet personnel'}</span>
            <span className="block text-[10px] uppercase tracking-wider text-white/60">{trip.vehiclePlate ?? trip.transport}</span>
          </span>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${trip.tracking ? 'bg-amber-300/90 text-black' : 'bg-white/15'}`}>{trip.tracking ? 'Suivi actif' : 'Sans suivi'}</span>
        </div>
        <Link to={`/trajets/${trip.id}`} className="absolute inset-x-5 bottom-4 block">
          <p className="display text-[48px] leading-[0.92] drop-shadow-lg">
            {trip.from}
            <br />→ {trip.to}
          </p>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${overdue ? 'bg-white text-red-600' : 'bg-brand'}`}>{overdue ? 'Retard' : 'Live'}</span>
            <span className="text-white/85">● {overdue ? `+${-mins} min` : left}</span>
            <span className="text-white/85">Arrivée {fmtTime(trip.etaAt)}</span>
            <span className="ml-auto flex h-7 min-w-7 items-center justify-center rounded-full bg-black/40 px-1.5 text-[11px] font-bold">+{contactsCount}</span>
          </div>
        </Link>
      </div>
      <ActiveTripActions trip={trip} />
    </div>
  )
}

function SectionTitle({ a, b, to }: { a: string; b: string; to?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold">
        {a} <span className="text-white/45">{b}</span>
      </h2>
      {to && (
        <Link to={to} className="text-xs text-white/45">
          Voir tout
        </Link>
      )}
    </div>
  )
}

function Tile({ to, scene, tag, title, icon }: { to: string; scene: number; tag: string; title: string; icon: ReactNode }) {
  return (
    <Link to={to} className="relative flex h-44 w-36 shrink-0 flex-col justify-end overflow-hidden rounded-[28px] p-3.5" style={{ background: SCENES[scene] }}>
      <Dunes />
      <span className="absolute left-3 top-3 rounded-full bg-sky-500 px-2.5 py-0.5 text-[11px] font-bold">{tag}</span>
      <span className="glass absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full">{icon}</span>
      <span className="relative text-[15px] font-bold leading-tight">{title}</span>
    </Link>
  )
}
