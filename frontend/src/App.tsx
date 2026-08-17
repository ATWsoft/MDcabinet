import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { bootstrap } from '@/lib/api'
import { useAuth } from '@/state/auth'
import { useI18n } from '@/state/locale'
import { EmptyState, PageLoader } from '@/components/ui'
import { Layout } from '@/components/Layout'
import { AuthPage } from '@/pages/AuthPage'
import { CabinetPage } from '@/pages/CabinetPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SetupPage } from '@/pages/SetupPage'
import { TrayPage } from '@/pages/TrayPage'

// CodeMirror and the Markdown renderer are the heaviest part of the bundle;
// they load only when a document or a shared link is actually opened.
const DocumentPage = lazy(() =>
  import('@/pages/DocumentPage').then((module) => ({ default: module.DocumentPage })),
)
const PublicSharePage = lazy(() =>
  import('@/pages/PublicSharePage').then((module) => ({ default: module.PublicSharePage })),
)

export function App() {
  const { t } = useI18n()

  // The backend injects `installed: false` until setup has been completed.
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
                title={t('This page does not exist')}
                description={t('Check the address or go back to the overview.')}
              />
            </div>
          }
        />
      </Routes>
    </Suspense>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label={t('Checking your session…')} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <>{children}</>
}
