import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, MapPin, MessageCircle, MessageSquare, Phone, QrCode, ShieldCheck, X } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Position, SosAlert } from '../lib/types'
import { getPosition, coords, mapsLink } from '../lib/geo'
import { phonesOf, smsLink, sosText, whatsappLink } from '../lib/messages'
import { fmtTime, timeAgo, uid } from '../lib/utils'
import { useOnline } from '../lib/hooks'
import { cloudEnabled } from '../lib/supabase'
import { Button, Card, Toggle } from '../components/ui'
import { BASE_SERVICES } from '../data/services'

const KINDS: { v: SosAlert['kind']; l: string; e: string }[] = [
  { v: 'accident', l: 'Accident', e: '🚗' },
  { v: 'malaise', l: 'Malaise', e: '🩺' },
  { v: 'panne', l: 'Panne', e: '🛠️' },
  { v: 'agression', l: 'Agression', e: '⚠️' },
  { v: 'autre', l: 'Autre', e: '🆘' },
]

type Phase = 'idle' | 'countdown' | 'locating' | 'sent'

export default function Sos() {
  const { state, addAlert, updateAlert, setLastPosition } = useStore()
  const nav = useNavigate()
  const online = useOnline()
  const [kind, setKind] = useState<SosAlert['kind']>('accident')
  const [message, setMessage] = useState('')
  const [includeMedical, setIncludeMedical] = useState(state.medical.consentShareInSos)
  const [phase, setPhase] = useState<Phase>('idle')
  const [left, setLeft] = useState(state.settings.sosCountdownSec)
  const [alertId, setAlertId] = useState<string>()
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)

  const sosContacts = state.contacts.filter((c) => c.notifyOnSos)
  const activeTrip = state.trips.find((t) => t.status === 'active' || t.status === 'overdue')
  const alert = state.alerts.find((a) => a.id === alertId)
  const emergency = BASE_SERVICES.filter((s) => s.category === 'urgence')

  useEffect(() => () => clearInterval(timer.current), [])

  function startCountdown() {
    navigator.vibrate?.(200)
    if (state.settings.sosCountdownSec <= 0) return trigger()
    setPhase('countdown')
    setLeft(state.settings.sosCountdownSec)
    timer.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(timer.current)
          trigger()
          return 0
        }
        navigator.vibrate?.(80)
        return l - 1
      })
    }, 1000)
  }

  function cancelCountdown() {
    clearInterval(timer.current)
    setPhase('idle')
  }

  async function trigger() {
    setPhase('locating')
    let position: Position | undefined
    let lastKnown = false
    try {
      position = await getPosition(8000)
      setLastPosition(position)
    } catch {
      position = activeTrip?.positions.at(-1) ?? state.lastPosition
      lastKnown = !!position
    }
    const a: SosAlert = {
      id: uid(),
      createdAt: new Date().toISOString(),
      kind,
      message: message.trim() || undefined,
      position,
      positionIsLastKnown: lastKnown,
      tripId: activeTrip?.id,
      channels: cloudEnabled ? ['serveur'] : [],
      status: 'pending',
      includeMedical,
    }
    addAlert(a)
    setAlertId(a.id)
    setPhase('sent')
    navigator.vibrate?.([400, 100, 400])
    // Ouverture immédiate de l'application SMS : fonctionne sans Internet
    const phones = phonesOf(sosContacts)
    if (phones.length) {
      setTimeout(() => {
        window.location.href = smsLink(phones, sosText(a, state.medical.fullName, state.medical, activeTrip))
      }, 300)
    }
  }

  function markChannel(c: SosAlert['channels'][number]) {
    if (alert && !alert.channels.includes(c)) updateAlert(alert.id, { channels: [...alert.channels, c], status: 'sent' })
  }

  // ---------- Écran d'alerte envoyée ----------
  if (phase === 'sent' && alert) {
    const text = sosText(alert, state.medical.fullName, state.medical, activeTrip)
    const safe = `✅ NIGORA — ${state.medical.fullName || 'Je'} suis en sécurité. Fin de l’alerte de ${fmtTime(alert.createdAt)}.`
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-red-600 via-red-700 to-fuchsia-900 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Alerte déclenchée · {fmtTime(alert.createdAt)}</p>
          <p className="display mt-1 text-[38px] leading-[0.95]">Restez calme,<br />l’aide s’organise.</p>
          <p className="mt-2 text-sm opacity-90">
            {sosContacts.length ? `${sosContacts.length} contact(s) de confiance à prévenir.` : 'Aucun contact de confiance : appelez directement les secours.'}
            {cloudEnabled && (online ? ' Alerte transmise au serveur NIGORA.' : ' Le serveur sera informé dès le retour de la connexion.')}
          </p>
        </div>

        <Card>
          <p className="mb-2 text-sm font-semibold text-white">Appeler les secours</p>
          <div className="grid grid-cols-3 gap-2">
            {emergency.map((s) => (
              <a key={s.id} href={`tel:${s.phone}`} className="flex flex-col items-center rounded-3xl bg-white/[0.06] py-3 text-white ring-1 ring-white/10">
                <Phone size={18} />
                <span className="text-2xl font-black">{s.phone}</span>
                <span className="text-[11px] font-semibold">{s.id === 'samu' ? 'SAMU' : s.id === 'police' ? 'Police' : 'Pompiers'}</span>
              </a>
            ))}
          </div>
        </Card>

        {sosContacts.length > 0 && (
          <Card>
            <p className="mb-2 text-sm font-semibold text-white">Prévenir mes contacts</p>
            <a href={smsLink(phonesOf(sosContacts), text)} onClick={() => markChannel('sms')}>
              <Button className="mb-2 w-full" size="lg">
                <MessageSquare size={18} /> Envoyer le SMS d’alerte à tous
              </Button>
            </a>
            <ul className="divide-y divide-white/10">
              {sosContacts.map((c) => (
                <li key={c.id} className="flex items-center gap-2 py-2">
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  <a href={`tel:${c.phone}`} className="rounded-lg bg-white/10 p-2" aria-label={`Appeler ${c.name}`}>
                    <Phone size={16} />
                  </a>
                  {online && (
                    <a href={whatsappLink(c.phone, text)} target="_blank" rel="noreferrer" onClick={() => markChannel('whatsapp')} className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400" aria-label="WhatsApp">
                      <MessageCircle size={16} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 text-brand" size={20} />
            <div className="text-sm">
              {alert.position ? (
                <>
                  <p className="font-semibold text-white">{alert.positionIsLastKnown ? `Dernière position connue (${timeAgo(alert.position.at)})` : 'Position actuelle'}</p>
                  <a href={mapsLink(alert.position)} target="_blank" rel="noreferrer" className="text-sky-400 underline">
                    {coords(alert.position)}
                  </a>
                  {alert.position.accuracy && <span className="text-white/50"> · ±{alert.position.accuracy} m</span>}
                </>
              ) : (
                <p className="text-white/60">Position indisponible. Décrivez votre emplacement aux secours (route, village, borne kilométrique).</p>
              )}
            </div>
          </div>
        </Card>

        <Link to="/fiche" className="glass flex items-center gap-3 rounded-[28px] p-4">
          <QrCode className="text-red-600" />
          <span className="flex-1 text-sm font-semibold">Montrer ma fiche médicale aux secours</span>
        </Link>

        <a
          href={sosContacts.length ? smsLink(phonesOf(sosContacts), safe) : undefined}
          onClick={() => {
            updateAlert(alert.id, { status: 'closed' })
            setTimeout(() => nav('/'), 400)
          }}
        >
          <Button variant="success" size="lg" className="w-full">
            <ShieldCheck size={18} /> Je suis en sécurité — terminer l’alerte
          </Button>
        </a>
      </div>
    )
  }

  // ---------- Compte à rebours / localisation ----------
  if (phase === 'countdown' || phase === 'locating') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <div className="relative mb-6 flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-red-500 via-brand to-fuchsia-600 text-white shadow-[0_0_80px] shadow-red-600/60">
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
          <span className="relative text-7xl font-black">{phase === 'countdown' ? left : '…'}</span>
        </div>
        <p className="text-lg font-bold text-white">{phase === 'countdown' ? 'Alerte dans quelques secondes' : 'Localisation en cours…'}</p>
        <p className="mb-6 text-sm text-white/50">{phase === 'countdown' ? 'Appuyez sur Annuler si c’est une erreur.' : 'Si la position n’est pas trouvée, la dernière position connue sera utilisée.'}</p>
        {phase === 'countdown' && (
          <Button variant="secondary" size="lg" onClick={cancelCountdown} className="w-48">
            <X size={18} /> Annuler
          </Button>
        )}
      </div>
    )
  }

  // ---------- Préparation ----------
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Alerte d’urgence</h1>
        <Link to="/" className="rounded-lg p-1 text-white/50" aria-label="Fermer">
          <X />
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.v}
            onClick={() => setKind(k.v)}
            className={`flex flex-col items-center rounded-2xl py-2.5 text-[11px] font-semibold ring-1 ${kind === k.v ? 'bg-white text-black ring-white' : 'bg-white/[0.06] text-white/70 ring-white/10'}`}
          >
            <span className="text-xl">{k.e}</span>
            {k.l}
          </button>
        ))}
      </div>

      <div className="flex justify-center py-4">
        <button
          onClick={startCountdown}
          className="relative flex h-52 w-52 flex-col items-center justify-center rounded-full bg-gradient-to-br from-red-500 via-brand to-fuchsia-600 text-white shadow-[0_0_80px] shadow-red-600/60 ring-[14px] ring-white/[0.06] transition active:scale-95"
        >
          <span className="display text-6xl">SOS</span>
          <span className="mt-1 text-sm font-medium opacity-90">Appuyer pour alerter</span>
        </button>
      </div>

      <Card className="space-y-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Précision facultative (ex. 2 blessés, km 40 après Dosso)"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-red-500"
        />
        <Toggle
          checked={includeMedical && state.medical.consentShareInSos}
          onChange={(v) => (state.medical.consentShareInSos ? setIncludeMedical(v) : nav('/medical'))}
          label="Joindre groupe sanguin et allergies"
          hint={state.medical.consentShareInSos ? 'Selon votre consentement dans le profil médical.' : 'Activez d’abord ce partage dans votre profil médical.'}
        />
        <div className="flex items-center gap-2 border-t border-white/10 pt-2 text-xs text-white/50">
          <CheckCircle2 size={14} className={sosContacts.length ? 'text-emerald-400' : 'text-white/25'} />
          {sosContacts.length ? `${sosContacts.length} contact(s) seront prévenus par SMS` : <Link to="/contacts" className="font-semibold text-brand">Ajoutez un contact à prévenir en cas de SOS</Link>}
        </div>
        {activeTrip && <p className="text-xs text-white/50">Trajet en cours joint : {activeTrip.from} → {activeTrip.to}</p>}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {emergency.map((s) => (
          <a key={s.id} href={`tel:${s.phone}`} className="glass flex items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-bold text-white">
            <Phone size={14} /> {s.phone} {s.id === 'samu' ? 'SAMU' : s.id === 'police' ? 'Police' : 'Pomp.'}
          </a>
        ))}
      </div>
    </div>
  )
}
