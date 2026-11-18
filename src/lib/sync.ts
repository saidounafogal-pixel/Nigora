import { supabase } from './supabase'
import type { SyncItem } from './types'

type Row = Record<string, unknown>
const s = (v: unknown) => (v === '' || v === undefined ? null : v)

/** Conversion des objets locaux (camelCase) vers les colonnes Postgres (snake_case) */
export function toRows(item: SyncItem, userId: string): { table: string; rows: Row[]; conflict?: string; extra?: { table: string; rows: Row[]; conflict: string } } {
  const p = item.payload as Row
  switch (item.table) {
    case 'trusted_contacts':
      return {
        table: 'trusted_contacts',
        rows: [{ id: p.id, user_id: userId, name: p.name, phone: p.phone, relation: s(p.relation), notify_on_trip: p.notifyOnTrip, notify_on_sos: p.notifyOnSos }],
      }
    case 'medical_profiles':
      return {
        table: 'medical_profiles',
        conflict: 'user_id',
        rows: [
          {
            user_id: userId,
            full_name: s(p.fullName),
            birth_year: s(p.birthYear),
            blood_group: s(p.bloodGroup),
            allergies: s(p.allergies),
            conditions: s(p.conditions),
            treatments: s(p.treatments),
            emergency_contact_name: s(p.emergencyContactName),
            emergency_contact_phone: s(p.emergencyContactPhone),
            notes: s(p.notes),
            consent_share_in_sos: p.consentShareInSos,
            consent_show_on_card: p.consentShowOnCard,
            consent_share_with_partners: p.consentShareWithPartners,
            updated_at: p.updatedAt ?? new Date().toISOString(),
          },
        ],
      }
    case 'trips': {
      const positions = (p.positions as { lat: number; lng: number; accuracy?: number; at: string }[]) ?? []
      const last = positions[positions.length - 1]
      return {
        table: 'trips',
        rows: [
          {
            id: p.id,
            user_id: userId,
            from_place: p.from,
            to_place: p.to,
            departure_at: p.departureAt,
            eta_at: p.etaAt,
            transport: p.transport,
            company: s(p.company),
            vehicle_plate: s(p.vehiclePlate),
            notes: s(p.notes),
            status: p.status,
            tracking: p.tracking,
            share_token: s(p.shareToken),
            last_lat: last?.lat ?? null,
            last_lng: last?.lng ?? null,
            last_position_at: last?.at ?? null,
            updated_at: p.updatedAt,
          },
        ],
        extra: positions.length
          ? {
              table: 'positions',
              conflict: 'trip_id,recorded_at',
              rows: positions.slice(-50).map((x) => ({ trip_id: p.id, user_id: userId, lat: x.lat, lng: x.lng, accuracy: x.accuracy ?? null, recorded_at: x.at })),
            }
          : undefined,
      }
    }
    case 'alerts': {
      const pos = p.position as { lat: number; lng: number; accuracy?: number; at: string } | undefined
      return {
        table: 'alerts',
        rows: [
          {
            id: p.id,
            user_id: userId,
            trip_id: s(p.tripId),
            kind: p.kind,
            message: s(p.message),
            lat: pos?.lat ?? null,
            lng: pos?.lng ?? null,
            accuracy: pos?.accuracy ?? null,
            position_at: pos?.at ?? null,
            position_is_last_known: p.positionIsLastKnown,
            include_medical: p.includeMedical,
            channels: p.channels,
            status: p.status === 'pending' ? 'sent' : p.status,
            created_at: p.createdAt,
          },
        ],
      }
    }
    default:
      return { table: item.table, rows: [p] }
  }
}

/**
 * Envoie la file d'attente locale vers Supabase.
 * Retourne la file restante (éléments en échec conservés pour un prochain essai).
 */
export async function flushQueue(queue: SyncItem[]): Promise<{ remaining: SyncItem[]; sent: number; error?: string }> {
  if (!supabase || !queue.length || !navigator.onLine) return { remaining: queue, sent: 0 }
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return { remaining: queue, sent: 0 }

  const remaining: SyncItem[] = []
  let sent = 0
  let lastError: string | undefined
  for (const item of queue) {
    try {
      if (item.op === 'delete') {
        const table = item.table === 'medical_profiles' ? 'medical_profiles' : item.table
        const { error } = await supabase.from(table).delete().eq('id', item.payload.id as string)
        if (error) throw error
      } else {
        const { table, rows, conflict, extra } = toRows(item, userId)
        const { error } = await supabase.from(table).upsert(rows, conflict ? { onConflict: conflict } : undefined)
        if (error) throw error
        if (extra) {
          const r = await supabase.from(extra.table).upsert(extra.rows, { onConflict: extra.conflict, ignoreDuplicates: true })
          if (r.error) throw r.error
        }
      }
      sent++
    } catch (e) {
      lastError = (e as Error).message
      if (item.attempts < 20) remaining.push({ ...item, attempts: item.attempts + 1 })
    }
  }
  return { remaining, sent, error: lastError }
}
