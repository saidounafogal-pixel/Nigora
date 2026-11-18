import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bus, ChevronLeft, MapPin, Phone, Plus, Siren, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMemberships, useSession } from '../lib/auth'
import { DEMO_ALERTS, DEMO_MEMBERS, DEMO_ORG, DEMO_TRIPS, DEMO_VEHICLES, type Member, type OrgAlert, type OrgTrip, type Vehicle } from '../data/demo'
import { Badge, Button, Card, Input } from '../components/ui'
import { fmtTime, timeAgo } from '../lib/utils'
import { mapsLink } from '../lib/geo'
import { ALERT_STATUS } from './Alerts'
import { STATUS } from './Trips'
import type { AlertStatus, TripStatus } from '../lib/types'

export function WideShell({ title, subtitle, children, demo }: { title: string; subtitle?: string; children: React.ReactNode; demo?: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-black">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/plus" className="rounded-lg p-1 text-white/50 hover:bg-white/10" aria-label="Retour">
            <ChevronLeft />
          </Link>
          <img src="/favicon.svg" className="h-7 w-7" alt="" />
          <div className="flex-1">
            <p className="font-bold leading-tight text-white">{title}</p>
            {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
          </div>
          {demo && <Badge tone="orange">Démonstration</Badge>}
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  )
}

export function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: string }) {
  return (
    <Card className="flex items-center gap-3 !p-3">
      <span className={`rounded-xl p-2.5 ${tone}`}>{icon}</span>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="text-xs text-white/50">{label}</p>
      </div>
    </Card>
  )
}

export function AlertRow({ a, onStatus, showMedical }: { a: OrgAlert; onStatus: (id: string, s: AlertStatus) => void; showMedical?: boolean }) {
  const st = ALERT_STATUS[a.status as AlertStatus] ?? ALERT_STATUS.sent
  const open = a.status !== 'closed' && a.status !== 'cancelled'
  const med = [a.blood_group && `Groupe ${a.blood_group}`, a.allergies && `Allergies : ${a.allergies}`, a.conditions && `Antécédents : ${a.conditions}`, a.treatments && `Traitements : ${a.treatments}`].filter(Boolean)
  return (
    <Card className={open ? 'ring-2 ring-red-500/40' : ''}>
      <div className="flex flex-wrap items-center gap-2">
        <Siren size={18} className={open ? 'text-red-600' : 'text-white/40'} />
        <p className="font-semibold capitalize text-white">{a.kind}</p>
        <span className="text-sm text-white/60">— {a.traveler}</span>
        <Badge tone={st.t}>{st.l}</Badge>
        <span className="ml-auto text-xs text-white/50">{timeAgo(a.created_at)}</span>
      </div>
      {a.trip && <p className="mt-1 text-sm text-white/60">Trajet : {a.trip}</p>}
      {a.message && <p className="mt-1 text-sm">{a.message}</p>}
      {showMedical && med.length > 0 && <p className="mt-2 rounded-lg bg-red-500/15 px-2 py-1.5 text-sm text-red-400">{med.join(' · ')}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {a.lat != null && a.lng != null && (
          <a href={mapsLink({ lat: a.lat, lng: a.lng })} target="_blank" rel="noreferrer">
            <Button size="sm" variant="secondary">
              <MapPin size={14} /> Position
            </Button>
          </a>
        )}
        {a.phone && (
          <a href={`tel:${a.phone}`}>
            <Button size="sm" variant="secondary">
              <Phone size={14} /> Appeler
            </Button>
          </a>
        )}
        {open && a.status !== 'in_progress' && (
          <Button size="sm" onClick={() => onStatus(a.id, 'in_progress')}>
            Prendre en charge
          </Button>
        )}
        {open && (
          <Button size="sm" variant="success" onClick={() => onStatus(a.id, 'closed')}>
            Clôturer
          </Button>
        )}
      </div>
    </Card>
  )
}

export default function Pro() {
  const { session } = useSession()
  const { orgs } = useMemberships(session?.user.id)
  const staff = orgs.find((o) => o.role === 'admin' || o.role === 'dispatcher')
  const demo = !staff
  const [trips, setTrips] = useState<OrgTrip[]>(DEMO_TRIPS)
  const [alerts, setAlerts] = useState<OrgAlert[]>(DEMO_ALERTS)
  const [vehicles, setVehicles] = useState<Vehicle[]>(DEMO_VEHICLES)
  const [members, setMembers] = useState<Member[]>(DEMO_MEMBERS)
  const [tab, setTab] = useState<'live' | 'vehicles' | 'members'>('live')
  const [nv, setNv] = useState({ plate: '', label: '', capacity: '' })

  const load = useCallback(async () => {
    if (!supabase || !staff) return
    const id = staff.org_id
    const [t, a, v, m] = await Promise.all([
      supabase.rpc('org_trips', { p_org: id }),
      supabase.rpc('org_alerts', { p_org: id }),
      supabase.from('vehicles').select('id,plate,label,capacity,active').eq('org_id', id).order('plate'),
      supabase.rpc('org_members_list', { p_org: id }),
    ])
    setTrips((t.data as OrgTrip[]) ?? [])
    setAlerts((a.data as OrgAlert[]) ?? [])
    setVehicles((v.data as Vehicle[]) ?? [])
    setMembers((m.data as Member[]) ?? [])
  }, [staff])

  useEffect(() => {
    load()
    if (!supabase || !staff) return
    const ch = supabase
      .channel('org-' + staff.org_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `org_id=eq.${staff.org_id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `org_id=eq.${staff.org_id}` }, () => load())
      .subscribe()
    const t = setInterval(load, 60000)
    return () => {
      supabase!.removeChannel(ch)
      clearInterval(t)
    }
  }, [load, staff])

  async function setStatus(id: string, status: AlertStatus) {
    if (demo || !supabase) return setAlerts((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)))
    await supabase.rpc('update_alert_status', { p_alert: id, p_status: status, p_note: null })
    load()
  }

  async function addVehicle() {
    const v = { plate: nv.plate.toUpperCase(), label: nv.label || null, capacity: nv.capacity ? Number(nv.capacity) : null, active: true }
    if (demo || !supabase) setVehicles((xs) => [...xs, { id: crypto.randomUUID(), ...v }])
    else await supabase.from('vehicles').insert({ ...v, org_id: staff!.org_id })
    setNv({ plate: '', label: '', capacity: '' })
    load()
  }

  const openAlerts = alerts.filter((a) => a.status !== 'closed' && a.status !== 'cancelled')
  const live = trips.filter((t) => t.status === 'active' || t.status === 'overdue')
  const overdue = trips.filter((t) => t.status === 'overdue')
  const orgName = staff?.organizations?.name ?? DEMO_ORG.name

  return (
    <WideShell title={orgName} subtitle="Espace entreprise · supervision des voyageurs et des véhicules" demo={demo}>
      {demo && (
        <Card className="mb-4 !bg-brand/15 text-sm text-brand">
          Aperçu avec des données fictives. Pour superviser vos propres voyageurs, créez une organisation dans <Link to="/compte" className="font-bold underline">Mon compte</Link>, puis partagez le code d’adhésion à vos équipes.
        </Card>
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={<Siren size={20} />} label="Alertes ouvertes" value={openAlerts.length} tone="bg-red-500/15 text-red-600" />
        <Kpi icon={<AlertTriangle size={20} />} label="Arrivées en retard" value={overdue.length} tone="bg-amber-500/15 text-amber-400" />
        <Kpi icon={<Bus size={20} />} label="Trajets en cours" value={live.length} tone="bg-emerald-500/15 text-emerald-400" />
        <Kpi icon={<Users size={20} />} label="Membres" value={members.length} tone="bg-sky-500/15 text-sky-400" />
      </div>

      <div className="mb-4 flex gap-2">
        {(
          [
            ['live', 'Suivi en direct'],
            ['vehicles', `Véhicules (${vehicles.length})`],
            ['members', 'Équipe'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-white text-black' : 'bg-white/[0.06] text-white/75 ring-1 ring-white/10'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'live' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">Alertes</h2>
            {alerts.length === 0 && <p className="text-sm text-white/50">Aucune alerte.</p>}
            {alerts.map((a) => (
              <AlertRow key={a.id} a={a} onStatus={setStatus} />
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">Trajets</h2>
            <Card className="overflow-x-auto !p-0">
              <table className="w-full text-sm">
                <thead className="bg-black text-left text-xs uppercase text-white/50">
                  <tr>
                    <th className="px-3 py-2">Voyageur / véhicule</th>
                    <th className="px-3 py-2">Itinéraire</th>
                    <th className="px-3 py-2">Arrivée</th>
                    <th className="px-3 py-2">Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {trips.map((t) => {
                    const st = STATUS[t.status as TripStatus] ?? STATUS.planned
                    return (
                      <tr key={t.id} className={t.status === 'overdue' ? 'bg-red-500/10' : ''}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-white">{t.traveler}</p>
                          {t.vehicle_plate && <p className="text-xs text-white/50">{t.vehicle_plate}</p>}
                        </td>
                        <td className="px-3 py-2">
                          {t.from_place} → {t.to_place}
                          <div className="mt-0.5">
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtTime(t.eta_at)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {t.last_lat != null && t.last_lng != null ? (
                            <a href={mapsLink({ lat: t.last_lat, lng: t.last_lng })} target="_blank" rel="noreferrer" className="text-sky-400 underline">
                              {timeAgo(t.last_position_at ?? undefined)}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          </section>
        </div>
      )}

      {tab === 'vehicles' && (
        <div className="space-y-3">
          <Card className="grid gap-2 sm:grid-cols-4">
            <Input placeholder="Immatriculation" value={nv.plate} onChange={(e) => setNv({ ...nv, plate: e.target.value })} />
            <Input placeholder="Nom (ex. Car 12)" value={nv.label} onChange={(e) => setNv({ ...nv, label: e.target.value })} />
            <Input placeholder="Places" inputMode="numeric" value={nv.capacity} onChange={(e) => setNv({ ...nv, capacity: e.target.value.replace(/\D/g, '') })} />
            <Button onClick={addVehicle} disabled={nv.plate.length < 3}>
              <Plus size={16} /> Ajouter
            </Button>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => {
              const onRoad = live.find((t) => t.vehicle_plate === v.plate)
              return (
                <Card key={v.id} className="flex items-center gap-3">
                  <Bus className="text-white/40" />
                  <div className="flex-1">
                    <p className="font-semibold text-white">{v.label ?? v.plate}</p>
                    <p className="text-xs text-white/50">
                      {v.plate}
                      {v.capacity ? ` · ${v.capacity} places` : ''}
                    </p>
                  </div>
                  {onRoad ? <Badge tone={onRoad.status === 'overdue' ? 'red' : 'green'}>{onRoad.to_place}</Badge> : <Badge>Au dépôt</Badge>}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          <Card className="text-sm">
            Code d’adhésion à transmettre à vos voyageurs et chauffeurs : <code className="rounded bg-white/10 px-2 py-0.5 font-bold">{staff?.organizations?.join_code ?? DEMO_ORG.join_code}</code>
            <p className="mt-1 text-xs text-white/50">Dans l’application : Plus → Mon compte → Rejoindre mon entreprise.</p>
          </Card>
          <Card className="divide-y divide-white/10 !p-0">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 font-bold text-white/60">{(m.full_name ?? '?')[0]}</div>
                <span className="flex-1 text-sm font-medium">{m.full_name ?? 'Sans nom'}</span>
                <Badge tone={m.role === 'traveler' ? 'stone' : 'orange'}>{m.role === 'admin' ? 'Administrateur' : m.role === 'dispatcher' ? 'Régulateur' : 'Voyageur'}</Badge>
              </div>
            ))}
          </Card>
        </div>
      )}
    </WideShell>
  )
}
