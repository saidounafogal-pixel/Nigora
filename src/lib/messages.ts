import type { Contact, MedicalProfile, Position, SosAlert, Trip } from './types'
import { coords, mapsLink } from './geo'
import { fmtDateTime, fmtTime, normalizePhone } from './utils'

const KIND: Record<SosAlert['kind'], string> = {
  accident: 'ACCIDENT',
  panne: 'PANNE',
  malaise: 'MALAISE',
  agression: 'AGRESSION',
  autre: 'URGENCE',
}

/** Message court (≤ ~300 caractères) pensé pour passer en SMS même sans Internet */
export function sosText(a: SosAlert, name: string, med?: MedicalProfile, trip?: Trip) {
  const who = name || 'Un voyageur NIGORA'
  const lines = [`🆘 NIGORA ${KIND[a.kind]} — ${who} a besoin d'aide.`]
  if (a.position) {
    lines.push(`${a.positionIsLastKnown ? 'Dernière position connue' : 'Position'} (${fmtTime(a.position.at)}) : ${coords(a.position)}`)
    lines.push(mapsLink(a.position))
  } else lines.push('Position indisponible.')
  if (trip) lines.push(`Trajet : ${trip.from} → ${trip.to}${trip.company ? ` (${trip.company}${trip.vehiclePlate ? ' ' + trip.vehiclePlate : ''})` : ''}`)
  if (a.message) lines.push(a.message)
  if (med && a.includeMedical && med.consentShareInSos) {
    const m = [med.bloodGroup && `Groupe ${med.bloodGroup}`, med.allergies && `Allergies : ${med.allergies}`].filter(Boolean).join(' · ')
    if (m) lines.push(m)
  }
  lines.push('Urgences Niger : SAMU 15 · Police 17 · Pompiers 18')
  return lines.join('\n')
}

export function tripText(t: Trip, name: string, pos?: Position, shareUrl?: string) {
  const l = [
    `🚌 NIGORA — ${name || 'Je'} part : ${t.from} → ${t.to}.`,
    `Départ ${fmtDateTime(t.departureAt)}, arrivée prévue ${fmtDateTime(t.etaAt)}.`,
  ]
  if (t.company || t.vehiclePlate) l.push(`Transport : ${[t.company, t.vehiclePlate].filter(Boolean).join(' · ')}`)
  if (pos) l.push(`Position : ${mapsLink(pos)}`)
  if (shareUrl) l.push(`Suivi : ${shareUrl}`)
  l.push('Sans nouvelles après l’heure prévue, merci de m’appeler.')
  return l.join('\n')
}

export function arrivalText(t: Trip, name: string) {
  return `✅ NIGORA — ${name || 'Je'} suis bien arrivé(e) à ${t.to} (${fmtTime(new Date().toISOString())}).`
}

export function overdueText(t: Trip, name: string, pos?: Position) {
  return [
    `⚠️ NIGORA — ${name || 'Le voyageur'} n'a pas confirmé son arrivée à ${t.to} (prévue ${fmtTime(t.etaAt)}).`,
    pos ? `Dernière position (${fmtTime(pos.at)}) : ${mapsLink(pos)}` : 'Aucune position enregistrée.',
    'Merci d’essayer de le/la joindre.',
  ].join('\n')
}

/** Lien SMS multi-destinataires. iOS utilise « &body », Android « ?body ». */
export function smsLink(phones: string[], body: string) {
  const to = phones.map(normalizePhone).join(',')
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  return `sms:${to}${ios ? '&' : '?'}body=${encodeURIComponent(body)}`
}

export const whatsappLink = (phone: string, body: string) => `https://wa.me/${normalizePhone(phone).replace('+', '')}?text=${encodeURIComponent(body)}`

export async function shareText(title: string, text: string) {
  if (navigator.share) {
    await navigator.share({ title, text })
    return true
  }
  await navigator.clipboard?.writeText(text)
  return false
}

export const phonesOf = (cs: Contact[]) => cs.map((c) => c.phone).filter(Boolean)

/** Contenu du QR code : lisible par n'importe quel lecteur, sans serveur ni Internet */
export function medicalQrText(m: MedicalProfile) {
  return [
    'NIGORA — FICHE MÉDICALE D’URGENCE',
    m.fullName && `Nom : ${m.fullName}${m.birthYear ? ` (né·e en ${m.birthYear})` : ''}`,
    m.bloodGroup && `Groupe sanguin : ${m.bloodGroup}`,
    m.allergies && `Allergies : ${m.allergies}`,
    m.conditions && `Antécédents : ${m.conditions}`,
    m.treatments && `Traitements : ${m.treatments}`,
    m.emergencyContactName && `Contact : ${m.emergencyContactName} ${m.emergencyContactPhone}`,
    m.notes && `Notes : ${m.notes}`,
  ]
    .filter(Boolean)
    .join('\n')
}
