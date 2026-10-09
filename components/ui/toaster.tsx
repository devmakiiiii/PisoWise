'use client'

import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

import { toastManager } from '@/lib/toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

/** Icon per toast type, so success and errors read at a glance. */
const ICONS: Record<string, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const ICON_STYLES: Record<string, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-destructive',
  info: 'text-muted-foreground',
}

/**
 * Global toast viewport. Mounted once in the root layout; renders the queue
 * owned by the shared `toastManager` and exposes `toast.success/error`.
 *
 * The provider must wrap `useToastManager()`, so the toast list lives in an
 * inner component rendered as the provider's child.
 */
export function Toaster() {
  return (
    <ToastProvider toastManager={toastManager} timeout={4000} limit={3}>
      <ToastList />
    </ToastProvider>
  )
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return (
    <>
      {toasts.map((toast) => {
        const type = toast.type ?? 'info'
        const Icon = ICONS[type] ?? Info
        return (
          <Toast key={toast.id} toast={toast}>
            <div className="flex items-start gap-2.5 pr-4">
              <Icon
                className={`mt-0.5 size-4 shrink-0 ${ICON_STYLES[type] ?? ICON_STYLES.info}`}
              />
              <div className="grid gap-0.5">
                <ToastTitle>{toast.title}</ToastTitle>
                {toast.description && (
                  <ToastDescription>{toast.description}</ToastDescription>
                )}
              </div>
            </div>
            <ToastClose aria-label="Dismiss notification" />
          </Toast>
        )
      })}
      <ToastViewport />
    </>
  )
}
