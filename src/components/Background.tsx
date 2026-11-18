import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { getPosition } from '../lib/geo'
import { flushQueue } from '../lib/sync'
import { cloudEnabled } from '../lib/supabase'
import { useOnline } from '../lib/hooks'

export const OVERDUE_GRACE_MIN = 15

/** Synchronise la file d'attente dès que la connexion revient */
export function SyncManager() {
  const { state, setQueue, ready } = useStore()
  const online = useOnline()
  const busy = useRef(false)
  const queueRef = useRef(state.queue)
  queueRef.current = state.queue

  useEffect(() => {
    if (!cloudEnabled || !ready || !online || busy.current || !state.queue.length) return
    busy.current = true
    const snapshot = state.queue
    const t = setTimeout(async () => {
      const { remaining } = await flushQueue(snapshot)
      // Conserver les éléments ajoutés pendant l'envoi
      const added = queueRef.current.filter((q) => !snapshot.some((s) => s.id === q.id))
      setQueue([...remaining, ...added])
      busy.current = false
    }, 1500)
    return () => {
      clearTimeout(t)
      busy.current = false
    }
  }, [online, ready, state.queue, setQueue])
  return null
}

/** Suivi volontaire des trajets actifs + détection des retards */
export function TripWatcher() {
  const { state, patchTrip, setLastPosition, ready } = useStore()
  const [tick, setTick] = useState(0)
  const notified = useRef<Set<string>>(new Set())

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000)
    return () => clearInterval(t)
  }, [])

  // Rafraîchir la dernière position connue à l'ouverture de l'application
  useEffect(() => {
    if (!ready) return
    getPosition(15000, false).then(setLastPosition).catch(() => undefined)
  }, [ready, setLastPosition])

  useEffect(() => {
    if (!ready) return
    const now = Date.now()
    for (const trip of state.trips) {
      if (trip.status !== 'active' && trip.status !== 'overdue') continue

      // Retard : l'heure d'arrivée + marge est dépassée sans confirmation
      if (trip.status === 'active' && now > new Date(trip.etaAt).getTime() + OVERDUE_GRACE_MIN * 60000) {
        patchTrip(trip.id, { status: 'overdue' })
        if (!notified.current.has(trip.id)) {
          notified.current.add(trip.id)
          navigator.vibrate?.([300, 150, 300])
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('NIGORA — êtes-vous bien arrivé·e ?', { body: `Arrivée prévue à ${trip.to} dépassée. Confirmez ou prévenez vos contacts.`, icon: '/icon-192.png' })
          }
        }
        continue
      }

      if (!trip.tracking) continue
      const last = trip.positions[trip.positions.length - 1]
      const due = !last || now - new Date(last.at).getTime() >= trip.trackingIntervalMin * 60000
      if (!due) continue
      getPosition(20000, !state.settings.lowDataMode)
        .then((p) => {
          setLastPosition(p)
          patchTrip(trip.id, (t) => ({ positions: [...t.positions, p].slice(-200) }))
        })
        .catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ready, state.trips.length])
  return null
}
