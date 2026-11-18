import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { DEMO } from './lib/demo'
import { StoreProvider, useStore } from './lib/store'
import Layout from './components/Layout'
import { SyncManager, TripWatcher } from './components/Background'
import Home from './pages/Home'
import Sos from './pages/Sos'
import { TripDetail, TripNew, TripsList } from './pages/Trips'
import { EmergencyCard, Medical } from './pages/Medical'
import Contacts from './pages/Contacts'
import Services from './pages/Services'
import Offline from './pages/Offline'
import More from './pages/More'
import Alerts from './pages/Alerts'
import Account from './pages/Account'
import Pro from './pages/Pro'
import Partners from './pages/Partners'
import SharedTrip from './pages/SharedTrip'
import MapPage from './pages/MapPage'
import ErrorBoundary from './components/ErrorBoundary'

function Shell() {
  const { ready } = useStore()
  if (!ready) return <div className="flex min-h-[100dvh] items-center justify-center text-stone-400">NIGORA…</div>
  return (
    <>
      <SyncManager />
      <TripWatcher />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="sos" element={<Sos />} />
          <Route path="carte" element={<MapPage />} />
          <Route path="trajets" element={<TripsList />} />
          <Route path="trajets/nouveau" element={<TripNew />} />
          <Route path="trajets/:id" element={<TripDetail />} />
          <Route path="medical" element={<Medical />} />
          <Route path="fiche" element={<EmergencyCard />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="services" element={<Services />} />
          <Route path="hors-ligne" element={<Offline />} />
          <Route path="alertes" element={<Alerts />} />
          <Route path="compte" element={<Account />} />
          <Route path="plus" element={<More />} />
          <Route path="*" element={<Home />} />
        </Route>
        <Route path="pro" element={<Pro />} />
        <Route path="partenaires" element={<Partners />} />
        <Route path="suivi/:token" element={<SharedTrip />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        {DEMO ? (
          <MemoryRouter>
            <Shell />
          </MemoryRouter>
        ) : (
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
            <Shell />
          </BrowserRouter>
        )}
      </StoreProvider>
    </ErrorBoundary>
  )
}
