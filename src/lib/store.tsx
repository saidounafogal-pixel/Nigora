import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { get, set } from 'idb-keyval'
import type { AppState, Contact, MedicalProfile, Position, SosAlert, SyncItem, Trip } from './types'
import { uid } from './utils'

const KEY = 'nigora-state-v1'

export const emptyMedical: MedicalProfile = {
  fullName: '',
  bloodGroup: '',
  allergies: '',
  conditions: '',
  treatments: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  notes: '',
  consentShareInSos: false,
  consentShowOnCard: false,
  consentShareWithPartners: false,
}

const initial: AppState = {
  contacts: [],
  trips: [],
  medical: emptyMedical,
  alerts: [],
  queue: [],
  settings: { onboarded: false, sosCountdownSec: 5, lowDataMode: false },
}

type Ctx = {
  state: AppState
  ready: boolean
  upsertContact: (c: Contact) => void
  removeContact: (id: string) => void
  upsertTrip: (t: Trip) => void
  removeTrip: (id: string) => void
  patchTrip: (id: string, patch: Partial<Trip> | ((t: Trip) => Partial<Trip>)) => void
  saveMedical: (m: MedicalProfile) => void
  addAlert: (a: SosAlert) => void
  updateAlert: (id: string, patch: Partial<SosAlert>) => void
  setLastPosition: (p: Position) => void
  enqueue: (item: Omit<SyncItem, 'id' | 'queuedAt' | 'attempts'>) => void
  setQueue: (q: SyncItem[]) => void
  updateSettings: (patch: Partial<AppState['settings']>) => void
  resetAll: () => void
}

const StoreCtx = createContext<Ctx | null>(null)

// Copie de secours synchrone dans localStorage : utile si IndexedDB est indisponible
function backup(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    localStorage.setItem(KEY + ':at', String(s.savedAt ?? 0))
  } catch {
    /* quota ou mode privé */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initial)
  const [ready, setReady] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    ;(async () => {
      // Deux copies : IndexedDB (principale) et localStorage (synchrone). On garde la plus récente,
      // car une écriture IndexedDB peut ne pas être terminée si l'application est fermée brutalement.
      let fromIdb: AppState | undefined
      let fromLs: AppState | undefined
      try {
        fromIdb = await get<AppState>(KEY)
      } catch {
        /* ignore */
      }
      try {
        const raw = localStorage.getItem(KEY)
        if (raw) fromLs = JSON.parse(raw)
      } catch {
        /* ignore */
      }
      const loaded = (fromLs?.savedAt ?? 0) > (fromIdb?.savedAt ?? 0) ? fromLs : (fromIdb ?? fromLs)
      if (loaded) setState({ ...initial, ...loaded, settings: { ...initial.settings, ...loaded.settings }, medical: { ...emptyMedical, ...loaded.medical } })
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    if (!ready) return
    if (first.current) {
      first.current = false
      return
    }
    const stamped = { ...state, savedAt: Date.now() }
    backup(stamped)
    set(KEY, stamped).catch(() => undefined)
  }, [state, ready])

  const enqueueInto = (s: AppState, item: Omit<SyncItem, 'id' | 'queuedAt' | 'attempts'>): AppState => ({
    ...s,
    queue: [
      // Dédoublonnage : on ne garde que la dernière version d'un même enregistrement
      ...s.queue.filter((q) => !(q.table === item.table && q.payload.id === item.payload.id && q.op === item.op)),
      { ...item, id: uid(), queuedAt: new Date().toISOString(), attempts: 0 },
    ],
  })

  const upsertContact = useCallback((c: Contact) => {
    setState((s) =>
      enqueueInto(
        { ...s, contacts: s.contacts.some((x) => x.id === c.id) ? s.contacts.map((x) => (x.id === c.id ? c : x)) : [...s.contacts, c] },
        { table: 'trusted_contacts', op: 'upsert', payload: c as unknown as Record<string, unknown> },
      ),
    )
  }, [])

  const removeContact = useCallback((id: string) => {
    setState((s) => enqueueInto({ ...s, contacts: s.contacts.filter((x) => x.id !== id) }, { table: 'trusted_contacts', op: 'delete', payload: { id } }))
  }, [])

  const upsertTrip = useCallback((t: Trip) => {
    const trip = { ...t, updatedAt: new Date().toISOString() }
    setState((s) =>
      enqueueInto(
        { ...s, trips: s.trips.some((x) => x.id === t.id) ? s.trips.map((x) => (x.id === t.id ? trip : x)) : [trip, ...s.trips] },
        { table: 'trips', op: 'upsert', payload: trip as unknown as Record<string, unknown> },
      ),
    )
  }, [])

  const patchTrip = useCallback((id: string, patch: Partial<Trip> | ((t: Trip) => Partial<Trip>)) => {
    setState((s) => {
      const cur = s.trips.find((x) => x.id === id)
      if (!cur) return s
      const trip = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch), updatedAt: new Date().toISOString() }
      return enqueueInto({ ...s, trips: s.trips.map((x) => (x.id === id ? trip : x)) }, { table: 'trips', op: 'upsert', payload: trip as unknown as Record<string, unknown> })
    })
  }, [])

  const removeTrip = useCallback((id: string) => {
    setState((s) => enqueueInto({ ...s, trips: s.trips.filter((x) => x.id !== id) }, { table: 'trips', op: 'delete', payload: { id } }))
  }, [])

  const saveMedical = useCallback((m: MedicalProfile) => {
    const med = { ...m, updatedAt: new Date().toISOString() }
    setState((s) => enqueueInto({ ...s, medical: med }, { table: 'medical_profiles', op: 'upsert', payload: { id: 'me', ...med } }))
  }, [])

  const addAlert = useCallback((a: SosAlert) => {
    setState((s) => enqueueInto({ ...s, alerts: [a, ...s.alerts] }, { table: 'alerts', op: 'upsert', payload: a as unknown as Record<string, unknown> }))
  }, [])

  const updateAlert = useCallback((id: string, patch: Partial<SosAlert>) => {
    setState((s) => {
      const alerts = s.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a))
      const a = alerts.find((x) => x.id === id)
      return a ? enqueueInto({ ...s, alerts }, { table: 'alerts', op: 'upsert', payload: a as unknown as Record<string, unknown> }) : s
    })
  }, [])

  const setLastPosition = useCallback((p: Position) => setState((s) => ({ ...s, lastPosition: p })), [])
  const enqueue = useCallback((item: Omit<SyncItem, 'id' | 'queuedAt' | 'attempts'>) => setState((s) => enqueueInto(s, item)), [])
  const setQueue = useCallback((queue: SyncItem[]) => setState((s) => ({ ...s, queue })), [])
  const updateSettings = useCallback((patch: Partial<AppState['settings']>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })), [])
  const resetAll = useCallback(() => setState({ ...initial, settings: { ...initial.settings, onboarded: true } }), [])

  return (
    <StoreCtx.Provider
      value={{ state, ready, upsertContact, removeContact, upsertTrip, removeTrip, patchTrip, saveMedical, addAlert, updateAlert, setLastPosition, enqueue, setQueue, updateSettings, resetAll }}
    >
      {children}
    </StoreCtx.Provider>
  )
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore hors StoreProvider')
  return c
}
