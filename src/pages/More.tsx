import { Link } from 'react-router-dom'
import { Building2, ChevronRight, CloudOff, HeartPulse, History, Hospital, Phone, QrCode, UserCircle, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'

export default function More() {
  const { state } = useStore()
  return (
    <div className="space-y-5">
      <h1 className="text-[34px] font-bold leading-none tracking-tight">Plus</h1>
      <Group title="Ma sécurité">
        <Item to="/medical" icon={<HeartPulse />} label="Profil médical d’urgence" />
        <Item to="/contacts" icon={<Users />} label="Contacts de confiance" meta={String(state.contacts.length)} />
        <Item to="/fiche" icon={<QrCode />} label="Fiche d’urgence (QR)" />
        <Item to="/alertes" icon={<History />} label="Historique des alertes" meta={String(state.alerts.length)} />
        <Item to="/services" icon={<Phone />} label="Services d’assistance" />
        <Item to="/hors-ligne" icon={<CloudOff />} label="Mode hors ligne et réglages" />
      </Group>
      <Group title="Professionnels">
        <Item to="/pro" icon={<Building2 />} label="Espace entreprise / transporteur" />
        <Item to="/partenaires" icon={<Hospital />} label="Espace partenaires (secours, hôpitaux)" />
        <Item to="/compte" icon={<UserCircle />} label="Mon compte" />
      </Group>
      <p className="px-2 text-center text-xs text-white/40">NIGORA · version pilote Niamey · Vos données restent sur votre téléphone tant que vous ne vous connectez pas.</p>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-white/50">{title}</h2>
      <ul className="divide-y divide-white/10 glass overflow-hidden rounded-[28px]">{children}</ul>
    </section>
  )
}

function Item({ to, icon, label, meta }: { to: string; icon: ReactNode; label: string; meta?: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-4 py-3.5 text-[15px]">
        <span className="text-white/50 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        <span className="flex-1 font-medium text-white">{label}</span>
        {meta && <span className="text-sm text-white/40">{meta}</span>}
        <ChevronRight size={18} className="text-white/25" />
      </Link>
    </li>
  )
}
