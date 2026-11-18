import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapPin, Play, Plus, Route, Send, Share2, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Trip, TripStatus } from '../lib/types'
import { Badge, Button, ButtonLink, Card, Empty, Field, Input, PageHeader, Select, Textarea, Toggle } from '../components/ui'
import { NIGER_CITIES, TRANSPORTS } from '../data/places'
import { fmtDateTime, fmtTime, toLocalInput, token, uid } from '../lib/utils'
import { coords, getPosition, mapsLink } from '../lib/geo'
import { phonesOf, shareText, smsLink, tripText } from '../lib/messages'
import { cloudEnabled } from '../lib/supabase'
import ActiveTripActions from '../components/ActiveTripActions'

export const STATUS: Record<TripStatus, { label: string; tone: 'stone' | 'green' | 'orange' | 'red' | 'blue' }> = {
  planned: { label: 'Prévu', tone: 'blue' },
  active: { label: 'En cours', tone: 'green' },
  arrived: { label: 'Arrivé', tone: 'stone' },
  overdue: { label: 'En retard', tone: 'red' },
  cancelled: { label: 'Annulé', tone: 'stone' },
}

export function TripsList() {
  const { state } = useStore()
  const trips = [...state.trips].sort((a, b) => b.departureAt.localeCompare(a.departureAt))
  return (
    <div>
      <PageHeader
        title="Mes trajets"
        subtitle="Préparez, partagez et suivez vos déplacements"
        action={
          <ButtonLink to="/trajets/nouveau" className="!px-3">
            <Plus size={18} /> Nouveau
          </ButtonLink>
        }
      />
      {trips.length === 0 ? (
        <Empty icon={<Route size={36} />} title="Aucun trajet" text="Renseignez votre itinéraire, votre heure d’arrivée et les contacts à prévenir." action={<ButtonLink to="/trajets/nouveau">Préparer un trajet</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {trips.map((t) => (
            <li key={t.id}>
              <Link to={`/trajets/${t.id}`}>
                <Card className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">
                      {t.from} → {t.to}
                    </p>
                    <p className="text-xs text-white/50">
                      {fmtDateTime(t.departureAt)} · arrivée {fmtTime(t.etaAt)}
                      {t.company ? ` · ${t.company}` : ''}
                    </p>
                  </div>
                  <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TripNew() {
  const { state, upsertTrip } = useStore()
  const nav = useNavigate()
  const now = new Date()
  const [f, setF] = useState({
    from: 'Niamey',
    to: '',
    departureAt: toLocalInput(new Date(now.getTime() + 30 * 60000)),
    etaAt: toLocalInput(new Date(now.getTime() + 5 * 3600000)),
    transport: 'bus' as Trip['transport'],
    company: '',
    vehiclePlate: '',
    notes: '',
    contactIds: state.contacts.filter((c) => c.notifyOnTrip).map((c) => c.id),
    tracking: true,
    trackingIntervalMin: 15,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const valid = f.from.trim() && f.to.trim() && f.etaAt > f.departureAt

  function save(start: boolean) {
    const t: Trip = {
      id: uid(),
      ...f,
      departureAt: new Date(f.departureAt).toISOString(),
      etaAt: new Date(f.etaAt).toISOString(),
      status: start ? 'active' : 'planned',
      positions: [],
      checkins: start ? [{ at: new Date().toISOString(), label: `Départ de ${f.from}` }] : [],
      shareToken: f.tracking ? token() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    upsertTrip(t)
    if (start && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    nav(`/trajets/${t.id}${start ? '?partage=1' : ''}`, { replace: true })
  }

  return (
    <div>
      <PageHeader title="Préparer un trajet" back="/trajets" />
      <datalist id="villes">
        {NIGER_CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="space-y-4">
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Départ">
              <Input list="villes" value={f.from} onChange={(e) => set('from', e.target.value)} />
            </Field>
            <Field label="Destination">
              <Input list="villes" value={f.to} onChange={(e) => set('to', e.target.value)} placeholder="Ex. Zinder" />
            </Field>
          </div>
          <Field label="Heure de départ">
            <Input type="datetime-local" value={f.departureAt} onChange={(e) => set('departureAt', e.target.value)} />
          </Field>
          <Field label="Heure d’arrivée estimée" hint="Si vous ne confirmez pas votre arrivée 15 min après cette heure, NIGORA vous proposera de prévenir vos contacts.">
            <Input type="datetime-local" value={f.etaAt} onChange={(e) => set('etaAt', e.target.value)} />
          </Field>
        </Card>

        <Card className="space-y-3">
          <Field label="Moyen de transport">
            <Select value={f.transport} onChange={(e) => set('transport', e.target.value as Trip['transport'])}>
              {TRANSPORTS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Compagnie">
              <Input value={f.company} onChange={(e) => set('company', e.target.value)} placeholder="Facultatif" />
            </Field>
            <Field label="Immatriculation">
              <Input value={f.vehiclePlate} onChange={(e) => set('vehiclePlate', e.target.value.toUpperCase())} placeholder="Facultatif" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Siège, couleur du véhicule, arrêt prévu…" />
          </Field>
        </Card>

        <Card>
          <p className="mb-2 text-sm font-semibold text-white">Contacts à prévenir</p>
          {state.contacts.length === 0 ? (
            <p className="text-sm text-white/50">
              Aucun contact. <Link to="/contacts" className="font-semibold text-brand">Ajouter un contact de confiance</Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {state.contacts.map((c) => {
                const on = f.contactIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set('contactIds', on ? f.contactIds.filter((x) => x !== c.id) : [...f.contactIds, c.id])}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${on ? "bg-white text-black ring-white" : 'bg-white/[0.06] text-white/75 ring-white/15'}`}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}
          <div className="mt-3 border-t border-white/10 pt-2">
            <Toggle checked={f.tracking} onChange={(v) => set('tracking', v)} label="Suivi volontaire du trajet" hint="Votre position est enregistrée sur votre téléphone à intervalle régulier, tant que NIGORA est ouvert." />
            {f.tracking && (
              <Field label="Fréquence d’enregistrement">
                <Select value={f.trackingIntervalMin} onChange={(e) => set('trackingIntervalMin', Number(e.target.value))}>
                  {[5, 10, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      Toutes les {m} min
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" disabled={!valid} onClick={() => save(false)}>
            Enregistrer
          </Button>
          <Button size="lg" disabled={!valid} onClick={() => save(true)}>
            <Play size={18} /> Démarrer
          </Button>
        </div>
      </div>
    </div>
  )
}

export function TripDetail() {
  const { id } = useParams()
  const { state, upsertTrip, removeTrip, setLastPosition } = useStore()
  const nav = useNavigate()
  const trip = state.trips.find((t) => t.id === id)
  const contacts = useMemo(() => state.contacts.filter((c) => trip?.contactIds.includes(c.id)), [state.contacts, trip])
  const [shareMsg, setShareMsg] = useState('')
  if (!trip) return <Empty icon={<Route size={36} />} title="Trajet introuvable" action={<ButtonLink to="/trajets">Retour</ButtonLink>} />

  const shareUrl = cloudEnabled && trip.shareToken ? `${location.origin}/suivi/${trip.shareToken}` : undefined
  const text = tripText(trip, state.medical.fullName, trip.positions.at(-1) ?? state.lastPosition, shareUrl)
  const live = trip.status === 'active' || trip.status === 'overdue'

  async function start() {
    let p
    try {
      p = await getPosition(10000)
      setLastPosition(p)
    } catch {
      /* sans position */
    }
    upsertTrip({ ...trip!, status: 'active', positions: p ? [...trip!.positions, p] : trip!.positions, checkins: [...trip!.checkins, { at: new Date().toISOString(), label: `Départ de ${trip!.from}`, position: p }] })
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`${trip.from} → ${trip.to}`} subtitle={`${fmtDateTime(trip.departureAt)} — arrivée ${fmtTime(trip.etaAt)}`} back="/trajets" action={<Badge tone={STATUS[trip.status].tone}>{STATUS[trip.status].label}</Badge>} />

      {live && (
        <Card>
          <ActiveTripActions trip={trip} />
        </Card>
      )}
      {trip.status === 'planned' && (
        <Button size="lg" className="w-full" onClick={start}>
          <Play size={18} /> Démarrer le trajet
        </Button>
      )}

      <Card>
        <p className="mb-1 font-semibold text-white">Partager le trajet</p>
        <p className="mb-3 text-sm text-white/50">
          {contacts.length ? `${contacts.map((c) => c.name).join(', ')} recevront l’itinéraire et l’heure d’arrivée.` : 'Aucun contact sélectionné pour ce trajet.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {contacts.length > 0 && (
            <a href={smsLink(phonesOf(contacts), text)}>
              <Button className="w-full" variant="success">
                <Send size={16} /> Par SMS
              </Button>
            </a>
          )}
          <Button
            variant="secondary"
            className={contacts.length ? '' : 'col-span-2'}
            onClick={async () => {
              const native = await shareText('Mon trajet NIGORA', text).catch(() => false)
              if (!native) setShareMsg('Message copié dans le presse-papiers.')
            }}
          >
            <Share2 size={16} /> Autre appli
          </Button>
        </div>
        {shareMsg && <p className="mt-2 text-xs text-emerald-400">{shareMsg}</p>}
        {shareUrl && <p className="mt-2 break-all text-xs text-white/50">Lien de suivi : {shareUrl}</p>}
      </Card>

      <Card>
        <p className="mb-2 font-semibold text-white">Détails</p>
        <dl className="grid grid-cols-3 gap-y-1.5 text-sm">
          <dt className="text-white/50">Transport</dt>
          <dd className="col-span-2">{TRANSPORTS.find((x) => x.v === trip.transport)?.l}</dd>
          {trip.company && (
            <>
              <dt className="text-white/50">Compagnie</dt>
              <dd className="col-span-2">{trip.company}</dd>
            </>
          )}
          {trip.vehiclePlate && (
            <>
              <dt className="text-white/50">Véhicule</dt>
              <dd className="col-span-2">{trip.vehiclePlate}</dd>
            </>
          )}
          <dt className="text-white/50">Suivi</dt>
          <dd className="col-span-2">{trip.tracking ? `Toutes les ${trip.trackingIntervalMin} min` : 'Désactivé'}</dd>
          {trip.notes && (
            <>
              <dt className="text-white/50">Notes</dt>
              <dd className="col-span-2">{trip.notes}</dd>
            </>
          )}
        </dl>
        {live && (
          <div className="mt-2 border-t border-white/10 pt-1">
            <Toggle checked={trip.tracking} onChange={(v) => upsertTrip({ ...trip, tracking: v })} label="Suivi volontaire" />
          </div>
        )}
      </Card>

      <Card>
        <p className="mb-2 font-semibold text-white">Journal du trajet</p>
        {trip.checkins.length === 0 && trip.positions.length === 0 ? (
          <p className="text-sm text-white/50">Rien pour l’instant.</p>
        ) : (
          <ol className="relative ml-2 border-l border-white/10">
            {[
              ...trip.checkins.map((c) => ({ at: c.at, label: c.label, p: c.position, strong: true })),
              ...trip.positions.slice(-15).map((p) => ({ at: p.at, label: 'Position enregistrée', p, strong: false })),
            ]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, 25)
              .map((e, i) => (
                <li key={i} className="mb-3 ml-4">
                  <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${e.strong ? 'bg-brand' : 'bg-white/20'}`} />
                  <p className={`text-sm ${e.strong ? 'font-semibold text-white' : 'text-white/60'}`}>
                    {fmtTime(e.at)} — {e.label}
                  </p>
                  {e.p && (
                    <a href={mapsLink(e.p)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-sky-400 underline">
                      <MapPin size={12} /> {coords(e.p)}
                    </a>
                  )}
                </li>
              ))}
          </ol>
        )}
      </Card>

      <div className="flex gap-2">
        {live && (
          <Button variant="secondary" className="flex-1" onClick={() => upsertTrip({ ...trip, status: 'cancelled' })}>
            <X size={16} /> Annuler le trajet
          </Button>
        )}
        <Button
          variant="ghost"
          className="flex-1 text-red-600"
          onClick={() => {
            if (confirm('Supprimer ce trajet et son historique ?')) {
              removeTrip(trip.id)
              nav('/trajets')
            }
          }}
        >
          <Trash2 size={16} /> Supprimer
        </Button>
      </div>
    </div>
  )
}
