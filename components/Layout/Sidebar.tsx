'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Target, Handshake, Home, X, Settings, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: Home,
  },
  {
    label: 'Transactions',
    href: '/transactions',
    icon: BarChart3,
  },
  {
    label: 'Budgets',
    href: '/budgets',
    icon: PieChart,
  },
  {
    label: 'Utang Tracker',
    href: '/tracker',
    icon: Handshake,
  },
  {
    label: 'Goals',
    href: '/goals',
    icon: Target,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

interface SidebarProps {
  /** Mobile drawer visibility (ignored on md+ where the sidebar is always shown). */
  open?: boolean
  /** Called when the user dismisses the mobile drawer. */
  onClose?: () => void
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname()

  // Close the mobile drawer after navigating.
  useEffect(() => {
    onClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 h-screen w-64 border-r border-border bg-sidebar p-6 transition-transform duration-200 ease-in-out',
        // Mobile: off-canvas unless open. Desktop: always in place.
        open ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0'
      )}
    >
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">PisoWise</h1>
          <p className="text-sm text-muted-foreground">Personal Finance Tracker</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
          className="-mr-1 rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="absolute bottom-6 left-6 right-6 border-t border-sidebar-border pt-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Tip:</span> Check &quot;Petsa de Peligro&quot; on your
          dashboard!
        </p>
      </div>
    </aside>
  )
}
