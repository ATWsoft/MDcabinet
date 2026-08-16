import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { App } from './App'
import { bootstrap, cachedApiMode, detectApiMode, setApiMode, usesPrettyUrls } from '@/lib/api'
import { ToastProvider } from '@/components/ui'
import { AuthProvider } from '@/state/auth'
import { ThemeProvider } from '@/state/theme'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // 401/403/404 nemá zmysel skúšať znova.
        const status = (error as { status?: number }).status
        if (status && status >= 400 && status < 500) return false

        return failureCount < 2
      },
      staleTime: 30_000,
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('Chýba #root element.')

function render(): void {
  // Bez mod_rewrite by priame odkazy typu /documents/5 vracali 404 zo servera,
  // preto sa v záložnom režime prepína na hash router.
  const Router = usesPrettyUrls() ? BrowserRouter : HashRouter
  const basename = usesPrettyUrls() ? bootstrap.basePath || undefined : undefined

  createRoot(root!).render(
    <StrictMode>
      <Router basename={basename}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
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
  // Optimisticky štartujeme s peknými adresami – to je prípad drvivej väčšiny
  // hostingov. Detekcia beží popri tom; ak vyjde iný režim, appka sa raz
  // načíta znova už so správnym nastavením. Funkčný hosting tak nezdržíme.
  setApiMode('pretty')
  render()

  void detectApiMode().then((mode) => {
    if (mode !== 'pretty') window.location.reload()
  })
}
