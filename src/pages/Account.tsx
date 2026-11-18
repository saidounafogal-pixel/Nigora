import { useState } from 'react'
import { Building2, LogOut, UserCircle } from 'lucide-react'
import { supabase, cloudEnabled } from '../lib/supabase'
import { useMemberships, useSession } from '../lib/auth'
import { useStore } from '../lib/store'
import { Badge, Button, Card, Field, Input, PageHeader, Select } from '../components/ui'

const ROLE: Record<string, string> = { admin: 'Administrateur', dispatcher: 'Régulateur', traveler: 'Voyageur' }

export default function Account() {
  const { session } = useSession()
  const { state } = useStore()
  const { orgs, partners, refresh } = useMemberships(session?.user.id)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState(state.medical.fullName)
  const [msg, setMsg] = useState('')
  const [code, setCode] = useState('')
  const [org, setOrg] = useState({ name: '', kind: 'transport' })

  if (!cloudEnabled || !supabase) {
    return (
      <div className="space-y-4">
        <PageHeader title="Mon compte" back="/plus" />
        <Card>
          <UserCircle className="mb-2 text-white/40" size={32} />
          <p className="font-semibold text-white">Mode local</p>
          <p className="mt-1 text-sm text-white/60">
            Cette installation de NIGORA n’est reliée à aucun serveur : toutes les fonctions voyageur marchent sans compte et vos données restent sur ce téléphone. Les comptes, la synchronisation et les espaces professionnels s’activent en configurant Supabase (voir README).
          </p>
        </Card>
      </div>
    )
  }

  async function auth() {
    setMsg('')
    const r =
      mode === 'login'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : await supabase!.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
    if (r.error) setMsg(r.error.message)
    else if (mode === 'signup' && !r.data.session) setMsg('Compte créé. Confirmez votre e-mail puis connectez-vous.')
  }

  async function join() {
    const { error } = await supabase!.rpc('join_organization', { p_code: code.trim().toUpperCase() })
    setMsg(error ? error.message : 'Vous avez rejoint l’organisation. Vos trajets et alertes lui seront visibles.')
    refresh()
  }

  async function create() {
    const { error } = await supabase!.rpc('create_organization', { p_name: org.name, p_kind: org.kind })
    setMsg(error ? error.message : 'Organisation créée.')
    refresh()
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader title={mode === 'login' ? 'Connexion' : 'Créer un compte'} subtitle="Synchronisez vos données et rejoignez votre entreprise" back="/plus" />
        <Card className="space-y-3">
          {mode === 'signup' && (
            <Field label="Nom complet">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
          )}
          <Field label="E-mail">
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Mot de passe">
            <Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button className="w-full" onClick={auth} disabled={!email || password.length < 6}>
            {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </Button>
          <button className="w-full text-center text-sm font-semibold text-brand" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Pas encore de compte ? S’inscrire' : 'Déjà inscrit ? Se connecter'}
          </button>
          {msg && <p className="text-center text-sm text-white/60">{msg}</p>}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mon compte"
        subtitle={session.user.email}
        back="/plus"
        action={
          <Button size="sm" variant="ghost" onClick={() => supabase!.auth.signOut()}>
            <LogOut size={16} />
          </Button>
        }
      />

      <Card>
        <p className="mb-2 font-semibold text-white">Mes organisations</p>
        {orgs.length === 0 && partners.length === 0 && <p className="text-sm text-white/50">Aucune pour l’instant.</p>}
        <ul className="space-y-2">
          {orgs.map((o) => (
            <li key={o.org_id} className="flex items-center gap-2 text-sm">
              <Building2 size={16} className="text-white/40" />
              <span className="flex-1 font-medium">{o.organizations?.name}</span>
              <Badge tone={o.role === 'traveler' ? 'stone' : 'orange'}>{ROLE[o.role]}</Badge>
              {o.role === 'admin' && <code className="rounded bg-white/10 px-1.5 text-xs">{o.organizations?.join_code}</code>}
            </li>
          ))}
          {partners.map((p) => (
            <li key={p.partner_id} className="flex items-center gap-2 text-sm">
              <Building2 size={16} className="text-white/40" />
              <span className="flex-1 font-medium">{p.partners?.name}</span>
              <Badge tone="blue">Partenaire</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2">
        <p className="font-semibold text-white">Rejoindre mon entreprise</p>
        <p className="text-xs text-white/50">Code fourni par votre compagnie de transport ou votre employeur.</p>
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EX. RIMBO-2026" />
          <Button onClick={join} disabled={code.length < 4}>
            Rejoindre
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="font-semibold text-white">Créer une organisation</p>
        <Field label="Nom">
          <Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} placeholder="Ex. Compagnie de transport" />
        </Field>
        <Field label="Type">
          <Select value={org.kind} onChange={(e) => setOrg({ ...org, kind: e.target.value })}>
            <option value="transport">Compagnie de transport</option>
            <option value="entreprise">Entreprise</option>
            <option value="ong">ONG / organisation</option>
          </Select>
        </Field>
        <Button variant="secondary" onClick={create} disabled={org.name.length < 2}>
          Créer
        </Button>
      </Card>
      {msg && <p className="text-center text-sm text-white/60">{msg}</p>}
    </div>
  )
}
