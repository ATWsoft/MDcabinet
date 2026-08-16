/** Tvary, ktoré vracia PHP API (app/Support/Presenter.php). */

export type Role = 'admin' | 'user'

export interface User {
  id: number
  email: string
  name: string
  role: Role
  avatarColor: string
  createdAt: string | null
}

export interface Instance {
  name: string
  hasUsers: boolean
  allowRegistration: boolean
  /** Registrácia vyžaduje kód od správcu (samotný kód sa cez API neposiela). */
  requiresRegistrationCode: boolean
}

export interface AdminSettings {
  registrationOpen: boolean
  registrationCode: string
  userCount: number
}

export interface Cabinet {
  id: number
  name: string
  slug: string
  description: string | null
  color: string
  icon: string | null
  position: number
  createdAt: string
  updatedAt: string
  trayCount?: number
  documentCount?: number
  trays?: Tray[]
}

export interface Tray {
  id: number
  cabinetId: number
  name: string
  slug: string
  description: string | null
  icon: string | null
  position: number
  createdAt: string
  updatedAt: string
  folders?: Folder[]
  documents?: DocumentSummary[]
}

export interface Folder {
  id: number
  trayId: number
  parentId: number | null
  name: string
  slug: string
  position: number
  createdAt: string
  updatedAt: string
  children?: Folder[]
  documents?: DocumentSummary[]
}

export interface DocumentSummary {
  id: number
  trayId: number
  folderId: number | null
  title: string
  slug: string | null
  excerpt: string
  wordCount: number | null
  isPinned: boolean
  position: number
  createdAt: string | null
  updatedAt: string | null
  /** Dopĺňa sa pri hľadaní a v zozname naposledy upravených. */
  trayName?: string
  cabinetId?: number
  cabinetName?: string
  cabinetColor?: string
  score?: number
  highlight?: string
}

export interface Doc extends DocumentSummary {
  content: string
  createdBy: number | null
  updatedBy: number | null
}

export type CrumbType = 'cabinet' | 'tray' | 'folder' | 'document'

export interface Breadcrumb {
  type: CrumbType
  id: number
  name: string
}

export interface Revision {
  id: number
  revisionNo: number
  title: string
  summary: string | null
  changeType: 'create' | 'update' | 'revert'
  userId: number | null
  userName: string | null
  createdAt: string
  contentLength?: number
  content?: string
}

export interface Share {
  token: string
  url: string
  targetType: CrumbType
  targetId: number
  hasPassword: boolean
  expiresAt: string | null
  views: number
  lastViewedAt: string | null
  createdAt: string
}

export interface UploadedFile {
  id: number
  url: string
  originalName: string
  mime: string
  size: number
  width: number | null
  height: number | null
  isImage: boolean
  createdAt: string
}

export interface SetupRequirement {
  key: string
  label: string
  ok: boolean
  detail: string
}

export interface SetupStatus {
  installed: boolean
  requirements: SetupRequirement[]
  configPath: string
  suggestedUrl: string
}

export interface PublicShare {
  needsPassword: boolean
  targetType: CrumbType
  sharedAt?: string
  document?: Doc
  breadcrumbs?: Breadcrumb[]
  cabinet?: Cabinet
  tray?: Tray
  folder?: Folder
}
