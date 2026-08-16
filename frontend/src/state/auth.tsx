import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, setCsrfToken } from '@/lib/api'
import type { Instance, User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  instance: Instance | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Stav prihlásenia. `/api/auth/me` je zároveň zdrojom CSRF tokenu,
 * takže sa volá hneď pri štarte appky a po každej zmene účtu.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

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
    async (email: string, name: string, password: string) => {
      const result = await api.auth.register(email, name, password)
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
  if (!context) throw new Error('useAuth musí byť vnútri <AuthProvider>')

  return context
}
