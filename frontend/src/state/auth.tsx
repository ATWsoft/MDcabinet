import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api, setCsrfToken } from '@/lib/api'
import { isLocale } from '@/lib/i18n'
import type { Instance, User } from '@/lib/types'
import { useI18n } from '@/state/locale'

interface RegisterInput {
  email: string
  name: string
  password: string
  locale?: string
  registrationCode?: string
}

interface AuthContextValue {
  user: User | null
  instance: Instance | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Sign-in state. `/api/auth/me` is also the source of the CSRF token, so it
 * is called at start-up and after every change to the account.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { locale, setLocale } = useI18n()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const result = await api.auth.me()
      setCsrfToken(result.csrf)
      return result
    },
    retry: false,
    staleTime: 60_000,
  })

  // The language stored on the account is applied once per signed-in user.
  // Doing it on every change would fight the switch in the header.
  const localeAppliedFor = useRef<number | null>(null)

  useEffect(() => {
    const user = data?.user
    if (!user || localeAppliedFor.current === user.id) return

    localeAppliedFor.current = user.id
    if (isLocale(user.locale) && user.locale !== locale) {
      setLocale(user.locale)
    }
  }, [data?.user, locale, setLocale])

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.auth.login(email, password)
      setCsrfToken(result.csrf)
      await queryClient.invalidateQueries()
      await refetch()
    },
    [queryClient, refetch],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const result = await api.auth.register(input)
      setCsrfToken(result.csrf)
      await queryClient.invalidateQueries()
      await refetch()
    },
    [queryClient, refetch],
  )

  const logout = useCallback(async () => {
    await api.auth.logout()
    setCsrfToken(null)
    queryClient.clear()
    await refetch()
  }, [queryClient, refetch])

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data?.user ?? null,
      instance: data?.instance ?? null,
      loading: isLoading,
      login,
      register,
      logout,
      refresh,
    }),
    [data, isLoading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')

  return context
}
