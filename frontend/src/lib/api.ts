/**
 * Thin client for the PHP API.
 *
 * - Authentication rides on the session cookie, so `credentials: 'same-origin'`
 *   is all that is needed.
 * - The CSRF token is kept in memory; when it expires it is refreshed once
 *   automatically and the request is retried.
 * - The active language travels in X-Locale so API messages come back
 *   in the language the user actually sees.
 */

import type {
  AdminSettings, Breadcrumb, Cabinet, Doc, DocumentSummary, Folder, Instance,
  PublicShare, Revision, SetupStatus, Share, Tray, UploadedFile, User,
} from './types'

declare global {
  interface Window {
    __MDCABINET__?: {
      basePath: string
      appName: string
      installed: boolean
      locale?: string
      locales?: string[]
    }
  }
}

export const bootstrap = window.__MDCABINET__ ?? {
  basePath: '',
  appName: 'MDcabinet',
  installed: true,
}

/**
 * Not every hosting has a working mod_rewrite. On start-up the app finds out
 * which URL shape works:
 *
 *   pretty   /api/auth/me
 *   pathinfo /index.php/api/auth/me
 *   query    /index.php?_route=/api/auth/me
 *
 * The routing mode also decides the router type – without rewrite the frontend
 * has to use hash routing, otherwise deep links would 404 on the server.
 */
export type ApiMode = 'pretty' | 'pathinfo' | 'query'

const MODE_KEY = 'mdcabinet.apiMode'
const MODES: ApiMode[] = ['pretty', 'pathinfo', 'query']

let apiMode: ApiMode = 'pretty'
let csrfToken: string | null = null
let requestLocale: string | null = null

export function currentApiMode(): ApiMode {
  return apiMode
}

export function usesPrettyUrls(): boolean {
  return apiMode === 'pretty'
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

/** Language sent with every request so the API answers in it. */
export function setRequestLocale(locale: string | null): void {
  requestLocale = locale
}

/**
 * Builds the URL of an API call for the current mode.
 * `path` looks like `/search?q=abc`.
 */
function buildUrl(path: string, mode: ApiMode = apiMode): string {
  const base = bootstrap.basePath

  if (mode === 'pretty') return `${base}/api${path}`
  if (mode === 'pathinfo') return `${base}/index.php/api${path}`

  const [pathname, query] = path.split('?')
  const params = new URLSearchParams(query ?? '')
  params.set('_route', `/api${pathname}`)

  return `${base}/index.php?${params.toString()}`
}

/** URL of a public share link in the shape that works on this hosting. */
export function publicShareUrl(token: string): string {
  const origin = `${window.location.origin}${bootstrap.basePath}`

  // Without rewrite the SPA uses a hash router, so the link needs the hash.
  return apiMode === 'pretty' ? `${origin}/s/${token}` : `${origin}/#/s/${token}`
}

function applyMode(mode: ApiMode): void {
  apiMode = mode
  try {
    sessionStorage.setItem(MODE_KEY, mode)
  } catch {
    /* private browsing – it will simply be detected again */
  }
}

export function setApiMode(mode: ApiMode): void {
  applyMode(mode)
}

/** The mode confirmed by an earlier page load, if there is one. */
export function cachedApiMode(): ApiMode | null {
  try {
    const cached = sessionStorage.getItem(MODE_KEY)

    return cached && MODES.includes(cached as ApiMode) ? (cached as ApiMode) : null
  } catch {
    return null
  }
}

/** Does the endpoint answer with our JSON (and not the hosting error page)? */
async function probe(mode: ApiMode): Promise<boolean> {
  try {
    const response = await fetch(buildUrl('/auth/me', mode), {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
    if (!response.ok) return false

    const payload: unknown = await response.json()

    return typeof payload === 'object' && payload !== null && 'csrf' in payload
  } catch {
    return false
  }
}

/**
 * Tries the modes in order and remembers the first that works.
 *
 * The app does not wait for this before rendering: it starts optimistically
 * with pretty URLs and the detection runs alongside (see main.tsx), so a
 * healthy hosting pays nothing extra.
 */
export async function detectApiMode(): Promise<ApiMode> {
  for (const mode of MODES) {
    if (await probe(mode)) {
      applyMode(mode)
      return mode
    }
  }

  applyMode('pretty')

  return 'pretty'
}

/** An API error, including per-field validation messages. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** The message for one form field. */
  fieldError(field: string): string | undefined {
    return this.errors[field]
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isCsrfExpired(): boolean {
    return this.status === 403 && this.errors.csrf === 'expired'
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function send<T>(method: Method, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const isForm = body instanceof FormData

  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken
  if (requestLocale) headers['X-Locale'] = requestLocale

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })

  if (response.status === 204) return undefined as T

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new ApiError(
      response.status,
      typeof payload.message === 'string' ? payload.message : 'The request failed.',
      (payload.errors ?? {}) as Record<string, string>,
    )

    // An expired CSRF token can be refreshed silently.
    if (error.isCsrfExpired && retry) {
      const me = await send<{ csrf: string }>('GET', '/auth/me', undefined, false)
      setCsrfToken(me.csrf)
      return send<T>(method, path, body, false)
    }

    throw error
  }

  return payload as T
}

const get = <T>(path: string) => send<T>('GET', path)
const post = <T>(path: string, body?: unknown) => send<T>('POST', path, body ?? {})
const put = <T>(path: string, body?: unknown) => send<T>('PUT', path, body ?? {})
const del = <T>(path: string) => send<T>('DELETE', path)

// ---------------------------------------------------------------------------

export const api = {
  setup: {
    status: () => get<SetupStatus>('/setup/status'),
    install: (data: {
      dbHost: string; dbPort?: number; dbName: string
      dbUser: string; dbPass?: string; appUrl?: string
    }) => post<{ ok: boolean; migrations: string[] }>('/setup/install', data),
  },

  auth: {
    me: () => get<{ user: User | null; csrf: string; instance: Instance }>('/auth/me'),
    login: (email: string, password: string) =>
      post<{ user: User; csrf: string }>('/auth/login', { email, password }),
    register: (data: {
      email: string; name: string; password: string
      locale?: string; registrationCode?: string
    }) => post<{ user: User; csrf: string }>('/auth/register', data),
    logout: () => post<{ ok: boolean }>('/auth/logout'),
    updateProfile: (data: { name: string; avatarColor?: string; locale?: string }) =>
      put<{ user: User }>('/auth/profile', data),
    changePassword: (currentPassword: string, newPassword: string) =>
      put<{ ok: boolean }>('/auth/password', { currentPassword, newPassword }),
  },

  admin: {
    settings: () => get<{ settings: AdminSettings }>('/admin/settings'),
    updateSettings: (data: Partial<Pick<AdminSettings, 'registrationOpen' | 'registrationCode'>>) =>
      put<{ settings: AdminSettings }>('/admin/settings', data),
    suggestCode: () => post<{ code: string }>('/admin/registration-code'),
    migrations: () => get<{ pending: string[]; applied: string[] }>('/admin/migrations'),
    runMigrations: () => post<{ ran: string[]; pending: string[] }>('/admin/migrations'),
  },

  dashboard: () => get<{ cabinets: Cabinet[]; recent: DocumentSummary[] }>('/dashboard'),

  cabinets: {
    list: () => get<{ cabinets: Cabinet[] }>('/cabinets'),
    show: (id: number) => get<{ cabinet: Cabinet }>(`/cabinets/${id}`),
    create: (data: { name: string; description?: string; color?: string; icon?: string }) =>
      post<{ cabinet: Cabinet }>('/cabinets', data),
    update: (id: number, data: Partial<{ name: string; description: string; color: string; icon: string }>) =>
      put<{ cabinet: Cabinet }>(`/cabinets/${id}`, data),
    remove: (id: number) => del<{ ok: boolean }>(`/cabinets/${id}`),
    reorder: (ids: number[]) => post<{ ok: boolean }>('/cabinets/reorder', { ids }),
  },

  trays: {
    show: (id: number) => get<{ tray: Tray }>(`/trays/${id}`),
    create: (data: { cabinetId: number; name: string; description?: string; icon?: string }) =>
      post<{ tray: Tray }>('/trays', data),
    update: (id: number, data: Partial<{ name: string; description: string; icon: string }>) =>
      put<{ tray: Tray }>(`/trays/${id}`, data),
    remove: (id: number) => del<{ ok: boolean }>(`/trays/${id}`),
    reorder: (cabinetId: number, ids: number[]) =>
      post<{ ok: boolean }>('/trays/reorder', { cabinetId, ids }),
  },

  folders: {
    create: (data: { trayId: number; parentId?: number | null; name: string }) =>
      post<{ folder: Folder }>('/folders', data),
    rename: (id: number, name: string) => put<{ folder: Folder }>(`/folders/${id}`, { name }),
    move: (id: number, parentId: number | null) =>
      put<{ folder: Folder }>(`/folders/${id}/move`, { parentId }),
    remove: (id: number) => del<{ ok: boolean }>(`/folders/${id}`),
  },

  documents: {
    show: (id: number) => get<{ document: Doc; breadcrumbs: Breadcrumb[] }>(`/documents/${id}`),
    create: (data: { trayId: number; folderId?: number | null; title: string; content?: string }) =>
      post<{ document: Doc }>('/documents', data),
    update: (id: number, data: Partial<{ title: string; content: string; summary: string; isPinned: boolean }>) =>
      put<{ document: Doc; revisionAdded: boolean }>(`/documents/${id}`, data),
    move: (id: number, data: { trayId?: number; folderId?: number | null }) =>
      put<{ document: Doc }>(`/documents/${id}/move`, data),
    remove: (id: number) => del<{ ok: boolean }>(`/documents/${id}`),
    revisions: (id: number) => get<{ revisions: Revision[] }>(`/documents/${id}/revisions`),
    revision: (id: number, revisionId: number) =>
      get<{ revision: Revision }>(`/documents/${id}/revisions/${revisionId}`),
    revert: (id: number, revisionId: number) =>
      post<{ document: Doc }>(`/documents/${id}/revisions/${revisionId}/revert`),
  },

  search: (query: string, cabinetId?: number) => {
    const params = new URLSearchParams({ q: query })
    if (cabinetId) params.set('cabinetId', String(cabinetId))
    return get<{ query: string; results: DocumentSummary[] }>(`/search?${params}`)
  },

  files: {
    upload: (file: File, documentId?: number) => {
      const form = new FormData()
      form.append('file', file)
      if (documentId) form.append('documentId', String(documentId))
      return send<{ file: UploadedFile }>('POST', '/files', form)
    },
    remove: (id: number) => del<{ ok: boolean }>(`/files/${id}`),
  },

  shares: {
    list: (targetType: string, targetId: number) =>
      get<{ shares: Share[] }>(`/shares?targetType=${targetType}&targetId=${targetId}`),
    create: (data: { targetType: string; targetId: number; password?: string; expiresAt?: string }) =>
      post<{ share: Share }>('/shares', data),
    remove: (token: string) => del<{ ok: boolean }>(`/shares/${token}`),
  },

  public: {
    show: (token: string) => get<PublicShare>(`/public/${token}`),
    unlock: (token: string, password: string) =>
      post<PublicShare>(`/public/${token}/unlock`, { password }),
    document: (token: string, documentId: number) =>
      get<{ document: Doc; breadcrumbs: Breadcrumb[] }>(`/public/${token}/documents/${documentId}`),
  },
}
