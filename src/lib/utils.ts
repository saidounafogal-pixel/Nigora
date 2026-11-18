export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

export const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('')

/** Normalise un numéro nigérien : 90 12 34 56 → +22790123456 */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[^\d+]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (!p.startsWith('+') && p.length === 8) p = '+227' + p
  if (!p.startsWith('+') && p.startsWith('227') && p.length === 11) p = '+' + p
  return p
}

export function formatPhone(p: string) {
  const n = normalizePhone(p)
  if (n.startsWith('+227') && n.length === 12) return `+227 ${n.slice(4, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)} ${n.slice(10, 12)}`
  return n
}

const dtf = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const tf = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
export const fmtDateTime = (iso?: string) => (iso ? dtf.format(new Date(iso)) : '—')
export const fmtTime = (iso?: string) => (iso ? tf.format(new Date(iso)) : '—')

export function timeAgo(iso?: string) {
  if (!iso) return 'jamais'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`
  return `il y a ${Math.round(s / 86400)} j`
}

export function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000)
}

/** Valeur pour <input type="datetime-local"> à partir d'une Date */
export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
