import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Siren } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useMemberships, useSession } from '../lib/auth'
import { DEMO_ALERTS, type OrgAlert } from '../data/demo'
import type { AlertStatus } from '../lib/types'
import { Card } from '../components/ui'
import { AlertRow, Kpi, WideShell } from './Pro'

/**
 * Console des partenaires (autorités, sapeurs-pompiers, hôpitaux).
 * Les informations médicales n'apparaissent que si le voyageur a consenti au partage avec les partenaires.
 */
export default function Partners() {
  const { session } = useSession()
  const { partners } = useMemberships(session?.user.id)
  const partner = partners[0]
  const demo = !partner
  const [alerts, setAlerts] = useState<OrgAlert[]>(DEMO_ALERTS)
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  const load = useCallback(async () => {
    if (!supabase || !partner) return
    const { data } = await supabase.rpc('partner_alerts')
    setAlerts((data as OrgAlert[]) ?? [])
  }, [partner])

  useEffect(() => {
    load()
    if (!supabase || !partner) return
    const ch = supabase
      .channel('partner-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => load())
      .subscribe()
    const t = setInterval(load, 30000)
    return () => {
      supabase!.removeChannel(ch)
      clearInterval(t)
    }
  }, [load, partner])

  async function setStatus(id: string, status: AlertStatus) {
    if (demo || !supabase) return setAlerts((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)))
    await supabase.rpc('update_alert_status', { p_alert: id, p_status: status, p_note: null })
    load()
  }

  const open = alerts.filter((a) => a.status !== 'closed' && a.status !== 'cancelled')
  const shown = filter === 'open' ? open : alerts

  return (
    <WideShell title={partner?.partners?.name ?? 'Centre partenaire (démo)'} subtitle="Réception et traitement des alertes NIGORA" demo={demo}>
      {demo && (
        <Card className="mb-4 !bg-sky-500/15 text-sm text-sky-400">
          Aperçu avec des données fictives. L’accès réel est ouvert aux structures partenaires (autorités, secours, hôpitaux) selon les protocoles définis lors du pilote ; il est attribué par l’administrateur NIGORA.
        </Card>
      )}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi icon={<Siren size={20} />} label="À traiter" value={open.filter((a) => a.status !== 'in_progress').length} tone="bg-red-500/15 text-red-600" />
        <Kpi icon={<Clock size={20} />} label="En cours" value={open.filter((a) => a.status === 'in_progress').length} tone="bg-amber-500/15 text-amber-400" />
        <Kpi icon={<CheckCircle2 size={20} />} label="Clôturées" value={alerts.filter((a) => a.status === 'closed').length} tone="bg-emerald-500/15 text-emerald-400" />
      </div>
      <div className="mb-3 flex gap-2">
        {(['open', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === f ? 'bg-white text-black' : 'bg-white/[0.06] text-white/75 ring-1 ring-white/10'}`}>
            {f === 'open' ? 'Ouvertes' : 'Toutes'}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((a) => (
          <AlertRow key={a.id} a={a} onStatus={setStatus} showMedical />
        ))}
        {shown.length === 0 && <p className="text-sm text-white/50">Aucune alerte.</p>}
      </div>
    </WideShell>
  )
}
