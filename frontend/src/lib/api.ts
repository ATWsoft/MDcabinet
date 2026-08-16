/**
 * Tenký klient nad PHP API.
 *
 * - Autentifikácia stojí na session cookie, takže stačí `credentials: 'same-origin'`.
 * - CSRF token držíme v pamäti; keď vyprší, raz ho automaticky obnovíme a request zopakujeme.
 */

import type {
  AdminSettings, Breadcrumb, Cabinet, Doc, DocumentSummary, Folder, Instance,
  PublicShare, Revision, SetupStatus, Share, Tray, UploadedFile, User,
} from './types'

declare global {
  interface Window {
    __MDCABINET__?: { basePath: string; appName: string; installed: boolean }
  }
}

export const bootstrap = window.__MDCABINET__ ?? {
  basePath: '',
  appName: 'MDcabinet',
  installed: true,
}

/**
 * Nie každý hosting má funkčný mod_rewrite. Preto sa pri štarte zistí,
 * ktorý tvar adries funguje:
 *
 *   pekné adresy   /api/auth/me              (rewrite funguje)
 *   záložné adresy /index.php/api/auth/me    (rewrite nefunguje)
 *
 * Podľa výsledku sa zvolí aj typ routera – bez rewritu musí frontend
 * používať hash routing, inak by priame odkazy na dokumenty končili 404.
 */
export type ApiMode = 'pretty' | 'pathinfo' | 'query'

const MODE_KEY = 'mdcabinet.apiMode'
const MODES: ApiMode[] = ['pretty', 'pathinfo', 'query']

let apiMode: ApiMode = 'pretty'

export function currentApiMode(): ApiMode {
  return apiMode
}

export function usesPrettyUrls(): boolean {
  return apiMode === 'pretty'
}

/**
 * Zloží adresu API volania pre aktuálny režim.
 * `path` je napr. `/search?q=abc`.
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

/** Adresa verejného zdieľaného odkazu v tvare, ktorý na tomto hostingu funguje. */
export function publicShareUrl(token: string): string {
  const origin = `${window.location.origin}${bootstrap.basePath}`

  // Bez rewritu beží SPA na hash routeri, takže odkaz musí mať mriežku.
  return apiMode === 'pretty' ? `${origin}/s/${token}` : `${origin}/#/s/${token}`
}

function applyMode(mode: ApiMode): void {
  apiMode = mode
  try {
    sessionStorage.setItem(MODE_KEY, mode)
  } catch {
    /* privátny režim prehliadača – nevadí, zistí sa to znova */
  }
}

/** Odpovedá endpoint naším JSON-om (a nie chybovou stránkou hostingu)? */
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

/** Už overený režim z predchádzajúceho načítania, ak nejaký je. */
export function cachedApiMode(): ApiMode | null {
  try {
    const cached = sessionStorage.getItem(MODE_KEY)

    return cached && MODES.includes(cached as ApiMode) ? (cached as ApiMode) : null
  } catch {
    return null
  }
}

/**
 * Vyskúša režimy v poradí a zapamätá prvý funkčný.
 *
 * Appka sa nevykreslí až po tomto teste – štartuje optimisticky s peknými
 * adresami a detekcia beží na pozadí (viď main.tsx). Na hostingu, kde
 * rewrite funguje, teda nestojí ani jeden krok navyše.
 */
export async function detectApiMode(): Promise<ApiMode> {
  for (const mode of MODES) {
    if (await probe(mode)) {
      applyMode(mode)
      return mode
    }
  }

  // Ani jeden režim neprešiel – necháme pekné adresy a chybu ohlási samotná appka.
  applyMode('pretty')

  return 'pretty'
}

export function setApiMode(mode: ApiMode): void {
  applyMode(mode)
}

let csrfToken: string | null = null

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

/** Chyba z API aj s validačnými hláškami po jednotlivých poliach. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Hláška pre konkrétne pole formulára. */
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
      typeof payload.message === 'string' ? payload.message : 'Požiadavka zlyhala.',
      (payload.errors ?? {}) as Record<string, string>,
    )

    // Vypršaný CSRF token vieme obnoviť potichu – používateľ o tom nemusí vedieť.
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
    register: (email: string, name: string, password: string, registrationCode?: string) =>
      post<{ user: User; csrf: string }>('/auth/register', {
        email,
        name,
        password,
        registrationCode: registrationCode || undefined,
      }),
    logout: () => post<{ ok: boolean }>('/auth/logout'),
    updateProfile: (data: { name: string; avatarColor?: string }) =>
      put<{ user: User }>('/auth/profile', data),
    changePassword: (currentPassword: string, newPassword: string) =>
      put<{ ok: boolean }>('/auth/password', { currentPassword, newPassword }),
  },

  admin: {
    settings: () => get<{ settings: AdminSettings }>('/admin/settings'),
    updateSettings: (data: Partial<Pick<AdminSettings, 'registrationOpen' | 'registrationCode'>>) =>
      put<{ settings: AdminSettings }>('/admin/settings', data),
    suggestCode: () => post<{ code: string }>('/admin/registration-code'),
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
