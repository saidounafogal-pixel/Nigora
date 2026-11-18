// NIGORA — envoi serveur des SMS d'alerte (complément du SMS envoyé depuis le téléphone).
// À brancher sur un « Database Webhook » Supabase : table public.alerts, événement INSERT.
// Fournisseur configurable : SMS_PROVIDER = "africastalking" | "twilio".
import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function sendSms(to: string[], message: string) {
  const provider = Deno.env.get('SMS_PROVIDER')
  if (provider === 'africastalking') {
    const r = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: { apiKey: Deno.env.get('AT_API_KEY')!, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: Deno.env.get('AT_USERNAME')!, to: to.join(','), message, ...(Deno.env.get('AT_SENDER_ID') ? { from: Deno.env.get('AT_SENDER_ID')! } : {}) }),
    })
    return r.ok
  }
  if (provider === 'twilio') {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID')!
    const auth = btoa(`${sid}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`)
    const results = await Promise.all(
      to.map((n) =>
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: n, From: Deno.env.get('TWILIO_FROM')!, Body: message }),
        }),
      ),
    )
    return results.every((r) => r.ok)
  }
  console.log('[notify-alert] Aucun fournisseur SMS configuré', { to, message })
  return false
}

Deno.serve(async (req) => {
  // Secret obligatoire : sans lui, n'importe qui pourrait déclencher des SMS
  const secret = Deno.env.get('WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('Unauthorized', { status: 401 })

  const { record } = await req.json()
  if (!record?.id || !record?.user_id) return new Response('Bad request', { status: 400 })

  const [{ data: contacts }, { data: profile }, { data: med }] = await Promise.all([
    admin.from('trusted_contacts').select('phone').eq('user_id', record.user_id).eq('notify_on_sos', true),
    admin.from('profiles').select('full_name').eq('id', record.user_id).maybeSingle(),
    admin.from('medical_profiles').select('full_name, blood_group, allergies, consent_share_in_sos').eq('user_id', record.user_id).maybeSingle(),
  ])
  const phones = (contacts ?? []).map((c) => c.phone)
  if (!phones.length) return Response.json({ sent: false, reason: 'no_contacts' })

  const name = med?.full_name || profile?.full_name || 'Un voyageur NIGORA'
  const lines = [`NIGORA ALERTE ${String(record.kind).toUpperCase()} : ${name} a besoin d'aide.`]
  if (record.lat != null) lines.push(`Position : https://maps.google.com/?q=${record.lat},${record.lng}`)
  if (record.message) lines.push(record.message)
  if (record.include_medical && med?.consent_share_in_sos) {
    const m = [med.blood_group && `Groupe ${med.blood_group}`, med.allergies && `Allergies : ${med.allergies}`].filter(Boolean).join(' - ')
    if (m) lines.push(m)
  }
  lines.push('Urgences : SAMU 15, Police 17, Pompiers 18')

  const ok = await sendSms(phones, lines.join('\n'))
  if (ok) await admin.from('alerts').update({ channels: [...new Set([...(record.channels ?? []), 'sms-serveur'])] }).eq('id', record.id)
  return Response.json({ sent: ok, recipients: phones.length })
})
