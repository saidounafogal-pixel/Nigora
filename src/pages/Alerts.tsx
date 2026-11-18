import { History, MapPin } from 'lucide-react'
import { useStore } from '../lib/store'
import { Badge, Card, Empty, PageHeader } from '../components/ui'
import { fmtDateTime } from '../lib/utils'
import { coords, mapsLink } from '../lib/geo'
import type { AlertStatus } from '../lib/types'

export const ALERT_STATUS: Record<AlertStatus, { l: string; t: 'stone' | 'green' | 'orange' | 'red' | 'blue' }> = {
  pending: { l: 'En attente', t: 'orange' },
  sent: { l: 'Envoyée', t: 'blue' },
  received: { l: 'Reçue', t: 'blue' },
  in_progress: { l: 'Prise en charge', t: 'orange' },
  closed: { l: 'Clôturée', t: 'green' },
  cancelled: { l: 'Annulée', t: 'stone' },
}

export default function Alerts() {
  const { state } = useStore()
  return (
    <div className="space-y-4">
      <PageHeader title="Historique des alertes" back="/plus" />
      {state.alerts.length === 0 ? (
        <Empty icon={<History size={36} />} title="Aucune alerte" text="Espérons que cela reste ainsi." />
      ) : (
        state.alerts.map((a) => (
          <Card key={a.id}>
            <div className="flex items-center justify-between">
              <p className="font-semibold capitalize text-white">{a.kind}</p>
              <Badge tone={ALERT_STATUS[a.status].t}>{ALERT_STATUS[a.status].l}</Badge>
            </div>
            <p className="text-xs text-white/50">{fmtDateTime(a.createdAt)} · {a.channels.join(', ') || 'appel direct'}</p>
            {a.message && <p className="mt-1 text-sm">{a.message}</p>}
            {a.position && (
              <a href={mapsLink(a.position)} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs text-sky-400 underline">
                <MapPin size={12} /> {coords(a.position)}
              </a>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
