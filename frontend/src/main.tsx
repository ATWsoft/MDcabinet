import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { App } from './App'
import { bootstrap, cachedApiMode, detectApiMode, setApiMode, usesPrettyUrls } from '@/lib/api'
import { ToastProvider } from '@/components/ui'
import { AuthProvider } from '@/state/auth'
import { LocaleProvider } from '@/state/locale'
import { ThemeProvider } from '@/state/theme'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 401/403/404 are not worth retrying.
        const status = (error as { status?: number }).status
        if (status && status >= 400 && status < 500) return false

        return failureCount < 2
      },
      staleTime: 30_000,
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('The #root element is missing.')

function render(): void {
  // Without mod_rewrite, deep links such as /documents/5 would 404 on the
  // server, so the fallback mode switches to a hash router.
  const Router = usesPrettyUrls() ? BrowserRouter : HashRouter
  const basename = usesPrettyUrls() ? bootstrap.basePath || undefined : undefined

  createRoot(root!).render(
    <StrictMode>
      <Router basename={basename}>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <ThemeProvider>
              <ToastProvider>
                <AuthProvider>
                  <App />
                </AuthProvider>
              </ToastProvider>
            </ThemeProvider>
          </LocaleProvider>
        </QueryClientProvider>
      </Router>
    </StrictMode>,
  )
}

const known = cachedApiMode()

if (known) {
  setApiMode(known)
  render()
} else {
  // Start optimistically with pretty URLs – that is the case on the vast
  // majority of hostings. Detection runs alongside; if it finds a different
  // mode the app reloads once with the right setting, so a healthy hosting
  // is never held up.
  setApiMode('pretty')
  render()

  void detectApiMode().then((mode) => {
    if (mode !== 'pretty') window.location.reload()
  })
}
