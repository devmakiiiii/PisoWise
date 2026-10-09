'use client'

import { useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/lib/hooks'
import { applyTheme, nextTheme, setTheme, Theme } from '@/lib/theme'

const labels: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

const icons: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

/**
 * Cycles light → dark → system. The `.dark` class is applied imperatively
 * (not via state), and an inline script in the root layout applies it before
 * first paint to avoid a flash of the wrong theme.
 */
export function ThemeToggle() {
  const theme = useTheme()

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    // While following the system, react to OS changes live.
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [theme])

  const Icon = icons[theme]

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme(theme))}
      aria-label={`Color theme: ${labels[theme]}. Click to switch.`}
      title={`Theme: ${labels[theme]} — click to switch`}
      className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-transparent px-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{labels[theme]}</span>
    </button>
  )
}
