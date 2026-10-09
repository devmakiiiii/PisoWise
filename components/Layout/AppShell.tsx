'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

/**
 * Responsive app chrome:
 * - Desktop (md+): fixed sidebar, content offset with ml-64.
 * - Mobile: fixed top bar with a hamburger button; sidebar slides in
 *   as an off-canvas drawer with a backdrop overlay.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-card px-4 md:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          className="-ml-1 rounded-md p-2 text-foreground hover:bg-secondary"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">PisoWise</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Personal Finance Tracker
          </span>
        </div>
      </header>

      {/* Backdrop when the mobile drawer is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="pt-14 md:ml-64 md:pt-0">{children}</div>
    </div>
  )
}
