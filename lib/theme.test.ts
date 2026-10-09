import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const THEME_KEY = 'pisowise_theme'

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

class FakeClassList {
  private set = new Set<string>()
  toggle(name: string, force?: boolean): boolean {
    const next = force === undefined ? !this.set.has(name) : force
    if (next) this.set.add(name)
    else this.set.delete(name)
    return next
  }
  contains(name: string): boolean {
    return this.set.has(name)
  }
}

type MockWindow = EventTarget & {
  localStorage: MemoryStorage
  matchMedia: (query: string) => {
    matches: boolean
    addEventListener: () => void
    removeEventListener: () => void
  }
}
type MockDocument = { documentElement: { classList: FakeClassList } }

const globalScope = globalThis as unknown as {
  window?: MockWindow
  document?: MockDocument
}

let win: MockWindow
let doc: MockDocument
let theme: typeof import('./theme')

beforeEach(async () => {
  // Fresh module registry per test (parity with storage.test.ts).
  vi.resetModules()
  win = Object.assign(new EventTarget(), {
    localStorage: new MemoryStorage(),
    matchMedia: () => ({
      matches: false, // simulate light OS preference
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  }) as MockWindow
  doc = { documentElement: { classList: new FakeClassList() } }
  globalScope.window = win
  globalScope.document = doc
  theme = await import('./theme')
})

afterEach(() => {
  delete globalScope.window
  delete globalScope.document
})

describe('theme preference', () => {
  it('defaults to system when nothing is stored', () => {
    expect(theme.getTheme()).toBe('system')
  })

  it('persists the selected theme', () => {
    theme.setTheme('dark')
    expect(theme.getTheme()).toBe('dark')
    expect(win.localStorage.getItem(THEME_KEY)).toBe('dark')
  })

  it('ignores corrupted stored values', () => {
    win.localStorage.setItem(THEME_KEY, 'neon')
    expect(theme.getTheme()).toBe('system')
  })

  it('cycles light → dark → system → light', () => {
    expect(theme.nextTheme('light')).toBe('dark')
    expect(theme.nextTheme('dark')).toBe('system')
    expect(theme.nextTheme('system')).toBe('light')
  })

  it('notifies subscribers when the theme changes', () => {
    const listener = vi.fn()
    const unsubscribe = theme.subscribeTheme(listener)
    theme.setTheme('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    theme.setTheme('light')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('applyTheme', () => {
  it('adds the dark class for theme "dark"', () => {
    theme.applyTheme('dark')
    expect(doc.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes the dark class for theme "light"', () => {
    theme.applyTheme('dark')
    theme.applyTheme('light')
    expect(doc.documentElement.classList.contains('dark')).toBe(false)
  })

  it('follows the OS preference for theme "system"', () => {
    win.matchMedia = () => ({
      matches: true, // simulate dark OS preference
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    theme.applyTheme('system')
    expect(doc.documentElement.classList.contains('dark')).toBe(true)
  })

  it('adds the light class alongside removing dark for theme "light"', () => {
    theme.applyTheme('dark')
    theme.applyTheme('light')
    expect(doc.documentElement.classList.contains('light')).toBe(true)
  })

  // Regression: globals.css scopes its `@media (prefers-color-scheme: dark)`
  // block to `:root:not(.light)`, which outranks `.dark` on specificity. Without
  // an explicit `.light` class an explicit light choice is silently overridden
  // back to dark on a machine whose OS prefers dark.
  it('adds .light for theme "light" even when the OS prefers dark', () => {
    win.matchMedia = () => ({
      matches: true, // dark OS preference
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    theme.applyTheme('light')
    expect(doc.documentElement.classList.contains('dark')).toBe(false)
    expect(doc.documentElement.classList.contains('light')).toBe(true)
  })

  it('adds .light when theme "system" resolves to a light OS', () => {
    win.matchMedia = () => ({
      matches: false, // light OS preference
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    theme.applyTheme('system')
    expect(doc.documentElement.classList.contains('dark')).toBe(false)
    expect(doc.documentElement.classList.contains('light')).toBe(true)
  })

  it('never leaves both dark and light set at once', () => {
    for (const t of ['dark', 'light', 'system'] as const) {
      theme.applyTheme(t)
      const isDark = doc.documentElement.classList.contains('dark')
      const isLight = doc.documentElement.classList.contains('light')
      expect(isDark && isLight).toBe(false)
      expect(isDark || isLight).toBe(true)
    }
  })
})
