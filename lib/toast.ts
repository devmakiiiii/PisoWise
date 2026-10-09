'use client'

import { Toast, type ToastManager } from '@base-ui/react/toast'

/**
 * App-wide toast manager. Created once at module scope so any component (or a
 * plain helper) can enqueue feedback without prop-drilling or being inside a
 * provider — the provider is mounted once by `<Toaster />` in the root layout.
 */
export const toastManager: ToastManager = Toast.createToastManager()

/** Convenience helpers for the two feedback tones this app uses. */
export const toast = {
  success: (message: string, description?: string) =>
    toastManager.add({
      type: 'success',
      title: message,
      description,
      timeout: 4000,
    }),
  error: (message: string, description?: string) =>
    toastManager.add({
      type: 'error',
      title: message,
      description,
      timeout: 6000,
    }),
}
