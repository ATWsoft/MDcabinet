/**
 * A small set of UI primitives. Deliberately in one file – the app has only a
 * handful and this way they stay consistent without jumping between files.
 */

import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Check, Loader2, X } from 'lucide-react'

import { cx } from '@/lib/utils'
import { useI18n } from '@/state/locale'

/* -------------------------------------------------------------- Button --- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-600 text-white shadow-sm hover:bg-accent-700 active:bg-accent-800 disabled:bg-accent-300 dark:disabled:bg-accent-900',
  secondary:
    'bg-white text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 dark:bg-ink-800 dark:text-ink-100 dark:ring-ink-700 dark:hover:bg-ink-700',
  ghost:
    'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-70',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

/* ------------------------------------------------------- Input / Textarea --- */

interface FieldProps {
  label?: string
  hint?: string
  error?: string
}

export function Input({
  label, hint, error, className, ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-700 dark:text-ink-200">
          {label}
        </label>
      )}
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        className={cx(
          'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm',
          'ring-1 ring-inset transition placeholder:text-ink-400',
          'focus:ring-2 focus:ring-inset focus:ring-accent-500',
          'disabled:bg-ink-50 disabled:text-ink-400 dark:disabled:bg-ink-800/50',
          'dark:bg-ink-800 dark:text-white dark:placeholder:text-ink-500',
          error
            ? 'ring-red-400 dark:ring-red-500'
            : 'ring-ink-200 dark:ring-ink-700',
          className,
        )}
      />
      {error ? (
        <p className="flex items-center gap-1.5 text-[13px] text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-500 dark:text-ink-400">{hint}</p>
      ) : null}
    </div>
  )
}

export function Textarea({
  label, hint, error, className, ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-700 dark:text-ink-200">
          {label}
        </label>
      )}
      <textarea
        id={id}
        {...props}
        className={cx(
          'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm',
          'ring-1 ring-inset ring-ink-200 transition placeholder:text-ink-400',
          'focus:ring-2 focus:ring-inset focus:ring-accent-500',
          'dark:bg-ink-800 dark:text-white dark:ring-ink-700 dark:placeholder:text-ink-500',
          className,
        )}
      />
      {error ? (
        <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-ink-500 dark:text-ink-400">{hint}</p>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------- Select --- */

export function Select<T extends string>({
  label, hint, value, options, onChange, disabled,
}: {
  label?: string
  hint?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const id = useId()

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-700 dark:text-ink-200">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className={cx(
          'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm',
          'ring-1 ring-inset ring-ink-200 transition',
          'focus:ring-2 focus:ring-inset focus:ring-accent-500',
          'dark:bg-ink-800 dark:text-white dark:ring-ink-700',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-[13px] text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  )
}

/* --------------------------------------------------------------- Modal --- */

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('input, textarea, button')?.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-ink-950/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative w-full animate-slide-up rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-ink-900',
          'ring-1 ring-ink-200 dark:ring-ink-700',
          size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h2 className="text-base font-semibold text-ink-900 dark:text-white">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t('Close')}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto scrollbar-slim px-5 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3.5 dark:border-ink-800">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------- Toasts --- */

interface Toast {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const push = useCallback((message: string, tone: Toast['tone']) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message, tone }])
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4200)
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={cx(
                'pointer-events-auto flex animate-slide-up items-start gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg ring-1',
                toast.tone === 'success' &&
                  'bg-white text-ink-800 ring-emerald-200 dark:bg-ink-800 dark:text-white dark:ring-emerald-800',
                toast.tone === 'error' &&
                  'bg-white text-ink-800 ring-red-200 dark:bg-ink-800 dark:text-white dark:ring-red-800',
                toast.tone === 'info' &&
                  'bg-white text-ink-800 ring-ink-200 dark:bg-ink-800 dark:text-white dark:ring-ink-700',
              )}
            >
              {toast.tone === 'success' && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
              {toast.tone === 'error' && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
              <span className="leading-snug">{toast.message}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')

  return context
}

/* --------------------------------------------------------- State blocks --- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-5 w-5 animate-spin text-ink-400', className)} />
}

export function PageLoader({ label }: { label?: string }) {
  const { t } = useI18n()

  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-ink-400">
      <Spinner className="h-6 w-6" />
      <p className="text-sm">{label ?? t('Loading…')}</p>
    </div>
  )
}

export function EmptyState({
  icon, title, description, action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 px-6 py-14 text-center dark:border-ink-700">
      {icon && <div className="mb-3 text-ink-300 dark:text-ink-600">{icon}</div>}
      <h3 className="text-base font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-ink-500 dark:text-ink-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------- Confirm dialog --- */

export function ConfirmDialog({
  open, title, description, confirmLabel, note, onConfirm, onCancel, loading,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  note?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}) {
  const { t } = useI18n()

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel} disabled={loading}>
            {t('Cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel ?? t('Delete')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-600 dark:text-ink-300">
        {note ??
          t('The content is flagged as deleted in the database (not removed for good), but it disappears from the app.')}
      </p>
    </Modal>
  )
}
