import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Badge, Card } from '../components/ui'
import { fmtDateTime, fmtTime, timeAgo } from '../lib/utils'
import { mapsLink } from '../lib/geo'
import { STATUS } from './Trips'
import type { TripStatus } from '../lib/types'

type Shared = { traveler: string | null; from_place: string; to_place: string; departure_at: string; eta_at: string; status: TripStatus; company: string | null; vehicle_plate: string | null; positions: { lat: number; lng: number; recorded_at: string }[] }

/** Page publique ouverte par les proches via le lien de suivi */
export default function SharedTrip() {
  const { token } = useParams()
  const [trip, setTrip] = useState<Shared | null>()

  useEffect(() => {
    if (!supabase) return setTrip(null)
    const load = () => supabase!.rpc('get_shared_trip', { p_token: token }).then(({ data }) => setTrip((data as Shared) ?? null))
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [token])

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center gap-2">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} className="h-8 w-8" alt="" />
        <span className="text-lg font-extrabold">NIGORA · Suivi de trajet</span>
      </div>
      {trip === undefined && <p className="text-sm text-white/50">Chargement…</p>}
      {trip === null && <Card>Ce lien de suivi est invalide ou le trajet est terminé depuis plus de 24 h.</Card>}
      {trip && (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold">
                {trip.from_place} → {trip.to_place}
              </p>
              <Badge tone={STATUS[trip.status].tone}>{STATUS[trip.status].label}</Badge>
            </div>
            <p className="text-sm text-white/60">{trip.traveler ?? 'Voyageur'} · départ {fmtDateTime(trip.departure_at)} · arrivée prévue {fmtTime(trip.eta_at)}</p>
            {(trip.company || trip.vehicle_plate) && <p className="text-sm text-white/50">{[trip.company, trip.vehicle_plate].filter(Boolean).join(' · ')}</p>}
          </Card>
          <Card>
            <p className="mb-2 font-semibold">Positions partagées</p>
            {trip.positions.length === 0 && <p className="text-sm text-white/50">Aucune position reçue pour l’instant.</p>}
            <ul className="space-y-1.5">
              {trip.positions.map((p, i) => (
                <li key={i}>
                  <a href={mapsLink(p)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-sky-400 underline">
                    <MapPin size={14} /> {fmtTime(p.recorded_at)} ({timeAgo(p.recorded_at)})
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
