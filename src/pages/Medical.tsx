import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { HeartPulse, Lock, Phone, Printer, QrCode, Save } from 'lucide-react'
import { useStore } from '../lib/store'
import type { MedicalProfile } from '../lib/types'
import { Button, ButtonLink, Card, Field, Input, PageHeader, Select, Textarea, Toggle } from '../components/ui'
import { medicalQrText } from '../lib/messages'
import { formatPhone, fmtDateTime } from '../lib/utils'

const GROUPS: MedicalProfile['bloodGroup'][] = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu']

export function Medical() {
  const { state, saveMedical } = useStore()
  const [m, setM] = useState<MedicalProfile>(state.medical)
  const [saved, setSaved] = useState(false)
  const set = <K extends keyof MedicalProfile>(k: K, v: MedicalProfile[K]) => {
    setSaved(false)
    setM((x) => ({ ...x, [k]: v }))
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Profil médical d’urgence" subtitle="Conservé sur votre téléphone, partagé seulement avec votre accord" action={<ButtonLink to="/fiche" variant="secondary" className="!px-3"><QrCode size={18} /></ButtonLink>} />

      <Card className="space-y-3">
        <Field label="Nom complet">
          <Input value={m.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Ex. Aïchatou Moussa" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Groupe sanguin">
            <Select value={m.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value as MedicalProfile['bloodGroup'])}>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g || 'Choisir…'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Année de naissance">
            <Input inputMode="numeric" maxLength={4} value={m.birthYear ?? ''} onChange={(e) => set('birthYear', e.target.value.replace(/\D/g, ''))} placeholder="1995" />
          </Field>
        </div>
        <Field label="Allergies" hint="Médicaments, aliments, piqûres…">
          <Textarea value={m.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Ex. pénicilline" />
        </Field>
        <Field label="Antécédents importants">
          <Textarea value={m.conditions} onChange={(e) => set('conditions', e.target.value)} placeholder="Ex. drépanocytose, diabète, asthme, grossesse…" />
        </Field>
        <Field label="Traitements en cours">
          <Textarea value={m.treatments} onChange={(e) => set('treatments', e.target.value)} placeholder="Ex. insuline, anticoagulant…" />
        </Field>
      </Card>

      <Card className="space-y-3">
        <p className="font-semibold text-white">Personne à contacter</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom">
            <Input value={m.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} />
          </Field>
          <Field label="Téléphone">
            <Input type="tel" value={m.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} placeholder="90 00 00 00" />
          </Field>
        </div>
        <Field label="Autres informations utiles">
          <Textarea value={m.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ex. porteur d’un pacemaker, langue parlée…" />
        </Field>
      </Card>

      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Lock size={16} className="text-emerald-400" />
          <p className="font-semibold text-white">Consentements</p>
        </div>
        <p className="mb-2 text-xs text-white/50">Rien n’est partagé sans votre accord. Vous pouvez modifier ces choix à tout moment.</p>
        <Toggle checked={m.consentShareInSos} onChange={(v) => set('consentShareInSos', v)} label="Joindre groupe sanguin et allergies à mes alertes SOS" hint="Envoyés à vos contacts de confiance dans le SMS d’alerte." />
        <Toggle checked={m.consentShowOnCard} onChange={(v) => set('consentShowOnCard', v)} label="Afficher mon profil sur la fiche d’urgence (QR code)" hint="Les secours pourront le lire sur votre téléphone, même sans Internet." />
        <Toggle checked={m.consentShareWithPartners} onChange={(v) => set('consentShareWithPartners', v)} label="Partager avec les structures partenaires lors d’une alerte" hint="Hôpitaux et autorités partenaires de NIGORA, uniquement pendant le traitement de votre alerte." />
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={() => {
          saveMedical(m)
          setSaved(true)
        }}
      >
        <Save size={18} /> {saved ? 'Enregistré ✓' : 'Enregistrer'}
      </Button>
      {state.medical.updatedAt && <p className="text-center text-xs text-white/40">Dernière mise à jour : {fmtDateTime(state.medical.updatedAt)}</p>}
    </div>
  )
}

/** Fiche plein écran à présenter aux secours */
export function EmergencyCard() {
  const { state } = useStore()
  const m = state.medical
  const filled = m.fullName || m.bloodGroup || m.allergies

  if (!m.consentShowOnCard || !filled) {
    return (
      <div className="space-y-4">
        <PageHeader title="Fiche d’urgence" back="/" />
        <Card className="text-center">
          <HeartPulse className="mx-auto mb-2 text-red-500" size={36} />
          <p className="font-semibold text-white">{filled ? 'Affichage non autorisé' : 'Profil médical vide'}</p>
          <p className="mt-1 text-sm text-white/50">
            {filled ? 'Activez « Afficher mon profil sur la fiche d’urgence » dans votre profil médical.' : 'Renseignez au moins votre nom et votre groupe sanguin.'}
          </p>
          <Link to="/medical" className="mt-4 inline-block font-semibold text-brand">
            Ouvrir le profil médical
          </Link>
        </Card>
      </div>
    )
  }

  const chips = (v: string) => v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)
  const [firstName, ...rest] = (m.fullName || 'Voyageur').split(' ')
  const age = m.birthYear ? new Date().getFullYear() - Number(m.birthYear) : undefined
  const groups: [string, string, string][] = [
    ['Allergies', m.allergies, 'bg-red-500/25 text-red-200 ring-red-400/40'],
    ['Antécédents', m.conditions, 'bg-white/10 text-white/85 ring-white/15'],
    ['Traitements', m.treatments, 'bg-sky-400/15 text-sky-200 ring-sky-300/30'],
  ]

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PageHeader title="Fiche d’urgence" subtitle="À montrer aux secours ou au personnel soignant" back="/" />
      </div>
      <div className="relative overflow-hidden rounded-[36px] p-[1px]" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,.35), rgba(255,255,255,.04) 40%, rgba(224,82,6,.5))' }}>
        <div className="relative overflow-hidden rounded-[35px] bg-[#0d0d0d] p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-600/30 blur-3xl" />
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/30" />
          <div className="relative flex items-start justify-between gap-3">
            <p className="text-[44px] font-semibold leading-[0.98] tracking-tight">
              {firstName}
              {rest.length > 0 && (
                <>
                  <br />
                  {rest.join(' ')}
                </>
              )}
            </p>
            <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-fuchsia-600 text-xs font-black shadow-[0_0_20px] shadow-red-500/50">SOS</span>
          </div>
          <p className="mt-2 text-sm text-white/45">Fiche médicale d’urgence · NIGORA</p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat value={m.bloodGroup || '?'} label="Groupe sanguin" accent />
            <Stat value={age ? String(age) : '—'} label="Âge" />
            <Stat value={String(chips(m.allergies).length)} label="Allergies" />
          </div>

          {groups.filter(([, v]) => v).map(([label, v, tone]) => (
            <div key={label} className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {chips(v).map((c) => (
                  <span key={c} className={`rounded-full px-3 py-1 text-[13px] font-medium ring-1 ${tone}`}>{c}</span>
                ))}
              </div>
            </div>
          ))}
          {m.notes && <p className="mt-4 text-sm text-white/70">{m.notes}</p>}

          {m.emergencyContactPhone && (
            <a href={`tel:${m.emergencyContactPhone}`} className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-brand text-lg font-bold text-black">{(m.emergencyContactName || '?')[0].toUpperCase()}</span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">{m.emergencyContactName || 'Personne à contacter'}</span>
                <span className="block text-sm text-white/45">{formatPhone(m.emergencyContactPhone)}</span>
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
                <Phone size={18} />
              </span>
            </a>
          )}

          <div className="mt-5 flex items-center gap-4 rounded-[28px] bg-white/[0.05] p-3 ring-1 ring-white/10">
            <div className="rounded-2xl bg-white p-2">
              <QRCodeSVG value={medicalQrText(m)} size={112} level="M" />
            </div>
            <p className="text-xs leading-relaxed text-white/55">Scannez ce code avec n’importe quel téléphone : la fiche s’affiche en texte, sans Internet ni application.</p>
          </div>
        </div>
      </div>
      <Button variant="secondary" className="w-full print:hidden" onClick={() => window.print()}>
        <Printer size={16} /> Imprimer la carte (portefeuille, pare-soleil)
      </Button>
    </div>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-[28px] font-semibold leading-none tracking-tight ${accent ? 'text-red-400' : ''}`}>{value}</p>
      <p className="mt-1 text-xs text-white/45">{label}</p>
    </div>
  )
}
