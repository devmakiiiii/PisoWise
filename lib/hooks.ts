'use client'

import { useSyncExternalStore } from 'react'
import { StorageManager } from './storage'
import { getTheme, subscribeTheme, Theme } from './theme'
import { FinanceCalculations } from './calculations'
import { AppData } from './types'

/**
 * Live view of the app data backed by localStorage.
 * Updates on same-tab writes and cross-tab `storage` events; during SSR/prerender
 * it returns the stable empty snapshot (no hydration mismatch).
 */
export function useAppData(): AppData {
  return useSyncExternalStore(
    StorageManager.subscribe,
    StorageManager.getSnapshot,
    StorageManager.getServerSnapshot
  )
}

/** Whether the first-run welcome banner has been dismissed (true during SSR). */
export function useHasSeenWelcome(): boolean {
  return useSyncExternalStore(
    StorageManager.subscribe,
    StorageManager.hasSeenWelcome,
    () => true
  )
}

/**
 * ISO timestamp of the last successful backup, or null if the user has never
 * taken one. `null` during SSR, so callers should treat it as "unknown yet"
 * rather than "never backed up".
 */
export function useLastBackupAt(): string | null {
  return useSyncExternalStore(
    StorageManager.subscribe,
    StorageManager.getLastBackupAt,
    () => null
  )
}

/** Current color theme preference ('system' during SSR). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, () => 'system' as Theme)
}

/**
 * Current month as 'YYYY-MM'.
 *
 * The server snapshot is a stable empty string so prerendered HTML matches
 * the hydration render; React swaps in the real month right after hydration
 * (useSyncExternalStore's designed behavior — no mismatch). Components should
 * treat '' as "not yet known" and render a neutral label/empty state.
 */
const noopSubscribe = () => () => {}

export function useMonthKey(): string {
  return useSyncExternalStore(
    noopSubscribe,
    FinanceCalculations.getCurrentMonthKey,
    () => ''
  )
}
