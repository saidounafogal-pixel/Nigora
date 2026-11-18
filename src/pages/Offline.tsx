import { CheckCircle2, CircleAlert, Download, MapPin, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../lib/store'
import { useOnline } from '../lib/hooks'
import { cloudEnabled } from '../lib/supabase'
import { flushQueue } from '../lib/sync'
import { coords, getPosition, mapsLink } from '../lib/geo'
import { timeAgo } from '../lib/utils'
import { Button, Card, Field, PageHeader, Select, Toggle } from '../components/ui'

export default function Offline() {
  const { state, setQueue, updateSettings, setLastPosition, resetAll } = useStore()
  const online = useOnline()
  const [msg, setMsg] = useState('')
  const sw = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller

  const checks = [
    { ok: sw, label: 'Application installée pour fonctionner sans Internet' },
    { ok: state.contacts.length > 0, label: `${state.contacts.length} contact(s) d’urgence enregistrés sur le téléphone` },
    { ok: !!state.medical.fullName, label: 'Profil médical enregistré sur le téléphone' },
    { ok: !!state.lastPosition, label: state.lastPosition ? `Dernière position connue ${timeAgo(state.lastPosition.at)}` : 'Aucune position connue' },
    { ok: true, label: 'Alertes SMS possibles dès qu’il y a du réseau mobile' },
  ]

  async function sync() {
    setMsg('Synchronisation…')
    const r = await flushQueue(state.queue)
    setQueue(r.remaining)
    setMsg(r.error ? `Échec partiel : ${r.error}` : `${r.sent} élément(s) synchronisé(s).`)
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `nigora-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Mode hors ligne" subtitle={online ? 'Connexion Internet disponible' : 'Pas d’Internet : les alertes partent par SMS'} back="/plus" />

      <Card>
        <ul className="space-y-2.5">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2.5 text-sm">
              {c.ok ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-400" size={18} /> : <CircleAlert className="mt-0.5 shrink-0 text-amber-500" size={18} />}
              <span className={c.ok ? 'text-white/90' : 'text-white/60'}>{c.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <MapPin className="text-brand" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Dernière position connue</p>
            {state.lastPosition ? (
              <a className="text-sky-400 underline" href={mapsLink(state.lastPosition)} target="_blank" rel="noreferrer">
                {coords(state.lastPosition)}
              </a>
            ) : (
              <span className="text-white/50">—</span>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => getPosition().then(setLastPosition).catch((e) => setMsg(e.message))}>
            Actualiser
          </Button>
        </div>
      </Card>

      {cloudEnabled && (
        <Card>
          <p className="font-semibold text-white">Synchronisation</p>
          <p className="mb-3 text-sm text-white/50">{state.queue.length ? `${state.queue.length} élément(s) en attente — envoi automatique au retour de la connexion.` : 'Tout est synchronisé.'}</p>
          <Button size="sm" variant="secondary" disabled={!online || !state.queue.length} onClick={sync}>
            <RefreshCw size={14} /> Synchroniser maintenant
          </Button>
        </Card>
      )}

      <Card className="space-y-2">
        <p className="font-semibold text-white">Réglages</p>
        <Toggle checked={state.settings.lowDataMode} onChange={(v) => updateSettings({ lowDataMode: v })} label="Économie de batterie et de données" hint="Localisation moins précise pendant le suivi des trajets." />
        <Field label="Délai avant envoi d’un SOS">
          <Select value={state.settings.sosCountdownSec} onChange={(e) => updateSettings({ sosCountdownSec: Number(e.target.value) })}>
            {[0, 3, 5, 10].map((s) => (
              <option key={s} value={s}>
                {s === 0 ? 'Immédiat' : `${s} secondes (annulable)`}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {msg && <p className="text-center text-sm text-white/60">{msg}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={exportData}>
          <Download size={16} /> Sauvegarder
        </Button>
        <Button variant="ghost" className="text-red-600" onClick={() => confirm('Effacer toutes les données NIGORA de ce téléphone ?') && resetAll()}>
          <Trash2 size={16} /> Tout effacer
        </Button>
      </div>
    </div>
  )
}
