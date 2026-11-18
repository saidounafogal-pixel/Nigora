import { useState } from 'react'
import { CheckCircle2, Flag, MessageSquareWarning } from 'lucide-react'
import type { Trip } from '../lib/types'
import { useStore } from '../lib/store'
import { getPosition } from '../lib/geo'
import { arrivalText, overdueText, phonesOf, smsLink } from '../lib/messages'
import { Button } from './ui'

export default function ActiveTripActions({ trip }: { trip: Trip }) {
  const { state, upsertTrip, setLastPosition } = useStore()
  const [busy, setBusy] = useState(false)
  const contacts = state.contacts.filter((c) => trip.contactIds.includes(c.id))
  const phones = phonesOf(contacts)
  const name = state.medical.fullName

  async function pos() {
    try {
      const p = await getPosition(10000)
      setLastPosition(p)
      return p
    } catch {
      return state.lastPosition
    }
  }

  async function arrived() {
    setBusy(true)
    const p = await pos()
    upsertTrip({
      ...trip,
      status: 'arrived',
      positions: p ? [...trip.positions, p].slice(-200) : trip.positions,
      checkins: [...trip.checkins, { at: new Date().toISOString(), label: `Arrivé·e à ${trip.to}`, position: p }],
    })
    setBusy(false)
    if (phones.length) window.location.href = smsLink(phones, arrivalText(trip, name))
  }

  async function checkin() {
    setBusy(true)
    const p = await pos()
    upsertTrip({
      ...trip,
      positions: p ? [...trip.positions, p].slice(-200) : trip.positions,
      checkins: [...trip.checkins, { at: new Date().toISOString(), label: 'Point d’étape — tout va bien', position: p }],
    })
    setBusy(false)
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="success" onClick={arrived} disabled={busy}>
          <CheckCircle2 size={18} /> Je suis arrivé·e
        </Button>
        <Button variant="secondary" onClick={checkin} disabled={busy}>
          <Flag size={18} /> Point d’étape
        </Button>
      </div>
      {trip.status === 'overdue' && phones.length > 0 && (
        <a href={smsLink(phones, overdueText(trip, name, trip.positions.at(-1) ?? state.lastPosition))} className="block">
          <Button variant="danger" className="w-full">
            <MessageSquareWarning size={18} /> Prévenir mes contacts du retard
          </Button>
        </a>
      )}
    </div>
  )
}
