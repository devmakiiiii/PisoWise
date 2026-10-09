'use client'

import { cn } from '@/lib/utils'

/**
 * A thin colored strip at the top of a card, used as a status accent
 * (budget warning, overdue utang, etc.). Purely decorative.
 */
interface AccentBarProps extends React.ComponentProps<'div'> {
  /** Background color for the bar (e.g. `bg-emerald-500`). */
  color?: string
}

export function AccentBar({
  color = 'bg-primary',
  className,
  ...props
}: AccentBarProps) {
  return (
    <div
      data-slot="accent-bar"
      aria-hidden="true"
      className={cn('h-1 w-full rounded-t-xl', color, className)}
      {...props}
    />
  )
}
