'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Rocket } from 'lucide-react'

interface WelcomeBannerProps {
  /** Start with an empty state (default choice). */
  onStartFresh: () => void
  /** Load the demo dataset so the user can explore the app. */
  onLoadDemo: () => void
}

/**
 * Shown once to first-time users. Demo/sample data is only ever written
 * to storage through this explicit choice — new users start empty.
 */
export function WelcomeBanner({ onStartFresh, onLoadDemo }: WelcomeBannerProps) {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Welcome to PisoWise! 👋</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your data stays on this device. Start fresh with your own numbers, or explore
            first with sample data — you can delete it anytime.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onStartFresh} className="gap-2">
            <Rocket className="h-4 w-4" />
            Start fresh
          </Button>
          <Button size="sm" onClick={onLoadDemo} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Load demo data
          </Button>
        </div>
      </div>
    </Card>
  )
}
