import { useState } from 'react'
import { BookUser, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Contact } from '../lib/types'
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Toggle } from '../components/ui'
import { formatPhone, normalizePhone, uid } from '../lib/utils'

const blank = (): Contact => ({ id: uid(), name: '', phone: '', relation: '', notifyOnTrip: true, notifyOnSos: true })

type PickerContact = { name?: string[]; tel?: string[] }
type ContactsManager = { select: (props: string[], opts: { multiple: boolean }) => Promise<PickerContact[]> }

export default function Contacts() {
  const { state, upsertContact, removeContact } = useStore()
  const [edit, setEdit] = useState<Contact | null>(null)
  const picker = (navigator as unknown as { contacts?: ContactsManager }).contacts

  async function importFromPhone() {
    try {
      const res = await picker!.select(['name', 'tel'], { multiple: true })
      res.forEach((c) => c.tel?.[0] && upsertContact({ ...blank(), name: c.name?.[0] ?? c.tel[0], phone: normalizePhone(c.tel[0]) }))
    } catch {
      /* annulé */
    }
  }

  if (edit) {
    const valid = edit.name.trim() && normalizePhone(edit.phone).length >= 8
    return (
      <div className="space-y-4">
        <PageHeader title={state.contacts.some((c) => c.id === edit.id) ? 'Modifier le contact' : 'Nouveau contact'} />
        <Card className="space-y-3">
          <Field label="Nom">
            <Input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ex. Moussa (frère)" />
          </Field>
          <Field label="Téléphone" hint="Les numéros à 8 chiffres sont complétés avec +227.">
            <Input type="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="90 12 34 56" />
          </Field>
          <Field label="Lien">
            <Input value={edit.relation} onChange={(e) => setEdit({ ...edit, relation: e.target.value })} placeholder="Famille, collègue, responsable de mission…" />
          </Field>
          <Toggle checked={edit.notifyOnTrip} onChange={(v) => setEdit({ ...edit, notifyOnTrip: v })} label="Prévenir lors de mes trajets" />
          <Toggle checked={edit.notifyOnSos} onChange={(v) => setEdit({ ...edit, notifyOnSos: v })} label="Prévenir en cas d’alerte SOS" />
        </Card>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setEdit(null)}>
            Annuler
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              upsertContact({ ...edit, name: edit.name.trim(), phone: normalizePhone(edit.phone) })
              setEdit(null)
            }}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Contacts de confiance" subtitle="Ils reçoivent vos trajets et vos alertes" back="/plus" action={<Button className="!px-3" onClick={() => setEdit(blank())}><Plus size={18} /> Ajouter</Button>} />
      {picker && (
        <Button variant="secondary" className="w-full" onClick={importFromPhone}>
          <BookUser size={18} /> Importer depuis le répertoire
        </Button>
      )}
      {state.contacts.length === 0 ? (
        <Empty icon={<Users size={36} />} title="Aucun contact" text="Ajoutez 2 ou 3 proches joignables rapidement." action={<Button onClick={() => setEdit(blank())}>Ajouter un contact</Button>} />
      ) : (
        <ul className="space-y-2">
          {state.contacts.map((c) => (
            <li key={c.id}>
              <Card className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 font-bold text-brand">{c.name[0]?.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{c.name}</p>
                  <p className="text-sm text-white/50">{formatPhone(c.phone)}</p>
                  <div className="mt-1 flex gap-1">
                    {c.notifyOnSos && <Badge tone="red">SOS</Badge>}
                    {c.notifyOnTrip && <Badge tone="green">Trajets</Badge>}
                  </div>
                </div>
                <a href={`tel:${c.phone}`} className="rounded-lg p-2 text-emerald-400" aria-label="Appeler">
                  <Phone size={18} />
                </a>
                <button onClick={() => setEdit(c)} className="rounded-lg p-2 text-white/50" aria-label="Modifier">
                  <Pencil size={18} />
                </button>
                <button onClick={() => confirm(`Supprimer ${c.name} ?`) && removeContact(c.id)} className="rounded-lg p-2 text-red-500" aria-label="Supprimer">
                  <Trash2 size={18} />
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
