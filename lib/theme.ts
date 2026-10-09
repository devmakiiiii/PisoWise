'use client'

export type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'pisowise_theme'
const THEME_EVENT = 'pisowise:theme-changed'

export const THEME_ORDER: Theme[] = ['light', 'dark', 'system']

/** light → dark → system → light … */
export const nextTheme = (current: Theme): Theme => {
  const index = THEME_ORDER.indexOf(current)
  return THEME_ORDER[(index + 1) % THEME_ORDER.length]
}

const isTheme = (value: string | null): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system'

export const getTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export const setTheme = (theme: Theme): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Non-critical preference — ignore storage failures.
  }
  window.dispatchEvent(new Event(THEME_EVENT))
}

export const subscribeTheme = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) callback()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(THEME_EVENT, callback)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(THEME_EVENT, callback)
  }
}

/**
 * Resolves the theme and (re)applies the `.dark` / `.light` classes on <html>.
 *
 * Both classes are always set explicitly. globals.css scopes its automatic
 * `@media (prefers-color-scheme: dark)` block to `:root:not(.light)`, and that
 * selector has higher specificity (0,2,0) than `.dark` (0,1,0). So an explicit
 * light choice MUST add `.light` — otherwise that media block keeps the dark
 * variables applied and the toggle appears to do nothing on a machine whose OS
 * is set to dark mode.
 */
export const applyTheme = (theme: Theme): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const prefersDark =
    theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || prefersDark
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.classList.toggle('light', !dark)
}
