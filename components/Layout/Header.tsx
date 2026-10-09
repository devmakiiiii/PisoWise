'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/Layout/ThemeToggle'

interface HeaderProps {
  onQuickAdd?: () => void
}

export function Header({ onQuickAdd }: HeaderProps) {
  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between gap-4 p-4 md:p-6">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground sm:text-xl">
            {greeting}! 👋
          </h2>
          <p className="hidden truncate text-sm text-muted-foreground sm:block">
            {today.toLocaleDateString('en-PH', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Button onClick={onQuickAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Add</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
