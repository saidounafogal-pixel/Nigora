import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, Route, Map as MapIcon, Menu, CloudOff, RefreshCw } from 'lucide-react'
import { useOnline } from '../lib/hooks'
import { useStore } from '../lib/store'
import { cloudEnabled } from '../lib/supabase'
import { cx } from '../lib/utils'

const tabs = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/carte', label: 'Carte', icon: MapIcon },
  { to: '/sos', label: 'SOS', icon: null },
  { to: '/trajets', label: 'Trajets', icon: Route },
  { to: '/plus', label: 'Plus', icon: Menu },
]

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-[30%] bg-gradient-to-br from-amber-300 via-brand to-fuchsia-600 blur-[6px] opacity-70" />
      <img src="/favicon.svg" alt="" className="relative h-full w-full" />
    </span>
  )
}

export default function Layout() {
  const online = useOnline()
  const { state } = useStore()
  const loc = useLocation()
  const isSos = loc.pathname.startsWith('/sos')
  const initial = state.medical.fullName.trim()[0]?.toUpperCase()

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-5 pb-3 pt-4 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[19px] font-semibold tracking-tight text-white">Nigora</span>
        </Link>
        <div className="flex items-center gap-2 text-xs">
          {cloudEnabled && state.queue.length > 0 && (
            <span className="glass flex items-center gap-1 rounded-full px-2 py-1 text-white/60" title="En attente de synchronisation">
              <RefreshCw size={12} /> {state.queue.length}
            </span>
          )}
          {online ? (
            <span className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" /> En ligne
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 font-bold text-black">
              <CloudOff size={12} /> Hors ligne · SMS
            </span>
          )}
          <Link to="/medical" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-base font-black text-black" aria-label="Mon profil">
            {initial ?? '?'}
          </Link>
        </div>
      </header>

      <main className={cx('flex-1 px-5 pt-2', isSos ? 'pb-8' : 'pb-32')}>
        <Outlet />
      </main>

      {!isSos && (
        <nav className="fixed inset-x-0 bottom-4 z-30 mx-auto w-[calc(100%-2.5rem)] max-w-[23rem] pb-[env(safe-area-inset-bottom)]">
          <ul className="flex items-center justify-between rounded-full border border-white/15 bg-[rgba(70,62,58,0.55)] px-3 py-2 shadow-2xl shadow-black/60 backdrop-blur-2xl">
            {tabs.map((t) =>
              t.icon ? (
                <li key={t.to}>
                  <NavLink
                    to={t.to}
                    end={t.end}
                    aria-label={t.label}
                    className={({ isActive }) => cx('flex h-11 w-11 items-center justify-center rounded-full transition', isActive ? 'bg-white text-black' : 'text-white/80')}
                  >
                    <t.icon size={21} strokeWidth={1.8} />
                  </NavLink>
                </li>
              ) : (
                <li key={t.to}>
                  <NavLink
                    to="/sos"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-500 via-brand to-fuchsia-600 text-[13px] font-black text-white shadow-[0_0_24px] shadow-brand/60"
                    aria-label="Déclencher une alerte SOS"
                  >
                    SOS
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </nav>
      )}
    </div>
  )
}
