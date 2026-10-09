'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/** A message with an optional "Did you mean…?" hint, for validation feedback. */
interface FieldErrorProps extends React.ComponentProps<'p'> {
  /** A related record to suggest (e.g. a similar existing name). */
  suggestion?: string | null
  /** Call to apply the suggestion above. */
  onAcceptSuggestion?: () => void
}

export function FieldError({
  suggestion,
  onAcceptSuggestion,
  className,
  children,
  ...props
}: FieldErrorProps) {
  return (
    <div role="alert" className={cn('space-y-1', className)} {...props}>
      <p className="text-xs text-destructive">{children}</p>
      {suggestion && onAcceptSuggestion && (
        <p className="text-xs text-muted-foreground">
          Did you mean{' '}
          <button
            type="button"
            onClick={onAcceptSuggestion}
            className="rounded font-medium underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {suggestion}
          </button>
          ?
        </p>
      )}
    </div>
  )
}
