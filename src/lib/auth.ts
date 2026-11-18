import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Membership = { org_id: string; role: 'admin' | 'dispatcher' | 'traveler'; organizations: { name: string; kind: string; join_code: string } | null }

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return { session, loading }
}

export function useMemberships(userId?: string) {
  const [orgs, setOrgs] = useState<Membership[]>([])
  const [partners, setPartners] = useState<{ partner_id: string; partners: { name: string; kind: string } | null }[]>([])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!supabase || !userId) return
    supabase
      .from('org_members')
      .select('org_id, role, organizations(name, kind, join_code)')
      .eq('user_id', userId)
      .then(({ data }) => setOrgs((data as unknown as Membership[]) ?? []))
    supabase
      .from('partner_members')
      .select('partner_id, partners(name, kind)')
      .eq('user_id', userId)
      .then(({ data }) => setPartners((data as unknown as typeof partners) ?? []))
  }, [userId, tick])
  return { orgs, partners, refresh: () => setTick((t) => t + 1) }
}
