import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { App } from './App'
import { bootstrap } from '@/lib/api'
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

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={bootstrap.basePath || undefined}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
