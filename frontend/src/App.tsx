import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { bootstrap } from '@/lib/api'
import { useAuth } from '@/state/auth'
import { EmptyState, PageLoader } from '@/components/ui'
import { Layout } from '@/components/Layout'
import { AuthPage } from '@/pages/AuthPage'
import { CabinetPage } from '@/pages/CabinetPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SetupPage } from '@/pages/SetupPage'
import { TrayPage } from '@/pages/TrayPage'

// CodeMirror aj Markdown renderer sú najťažšia časť bundle – načítajú sa
// až keď používateľ otvorí konkrétny dokument alebo zdieľaný odkaz.
const DocumentPage = lazy(() =>
  import('@/pages/DocumentPage').then((module) => ({ default: module.DocumentPage })),
)
const PublicSharePage = lazy(() =>
  import('@/pages/PublicSharePage').then((module) => ({ default: module.PublicSharePage })),
)

export function App() {
  // Backend do stránky vloží `installed: false`, kým nie je hotová inštalácia.
  if (!bootstrap.installed && !location.pathname.endsWith('/setup')) {
    return <SetupPage />
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/s/:token" element={<PublicSharePage />} />

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/cabinets/:id" element={<CabinetPage />} />
          <Route path="/trays/:id" element={<TrayPage />} />
          <Route path="/documents/:id" element={<DocumentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="*"
          element={
            <div className="grid h-full place-items-center p-8">
              <EmptyState
                title="Stránka neexistuje"
                description="Skontroluj adresu alebo sa vráť na prehľad."
              />
            </div>
          }
        />
      </Routes>
    </Suspense>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label="Overujem prihlásenie…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <>{children}</>
}
