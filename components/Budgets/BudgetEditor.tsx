'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save } from 'lucide-react'
import { TransactionCategory } from '@/lib/types'
import {
  EXPENSE_CATEGORIES,
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
} from '@/lib/categories'

interface BudgetEditorProps {
  budgets: Partial<Record<TransactionCategory, number>>
  onSave: (budgets: Partial<Record<TransactionCategory, number>>) => void
}

/**
 * Monthly limit per expense category.
 * Input values are derived from `budgets` with a draft override so they stay
 * correct when real data replaces the SSR snapshot after hydration.
 */
export function BudgetEditor({ budgets, onSave }: BudgetEditorProps) {
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const valueFor = (category: TransactionCategory): string => {
    if (draft && draft[category] !== undefined) return draft[category]
    const stored = budgets[category]
    return stored !== undefined ? String(stored) : ''
  }

  const handleChange = (category: TransactionCategory, value: string) => {
    setDraft({ ...(draft ?? {}), [category]: value })
    setSaved(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: Partial<Record<TransactionCategory, number>> = {}
    for (const category of EXPENSE_CATEGORIES) {
      const raw = valueFor(category).trim()
      if (raw === '') continue // cleared → no budget for this category
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 0) {
        setError(`Invalid budget for ${CATEGORY_LABELS[category]} — use 0 or more.`)
        setSaved(false)
        return
      }
      next[category] = value
    }
    setError(null)
    onSave(next)
    setDraft(null)
    setSaved(true)
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-1">Monthly Budget Limits</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Set how much you want to spend per category each month. Leave blank for
        no limit.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXPENSE_CATEGORIES.map((category) => (
            <div key={category} className="space-y-2">
              <Label htmlFor={`budget-${category}`} className="flex items-center gap-1.5">
                <span aria-hidden="true">{CATEGORY_EMOJIS[category]}</span>
                {CATEGORY_LABELS[category]}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-muted-foreground">₱</span>
                <Input
                  id={`budget-${category}`}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="No limit"
                  value={valueFor(category)}
                  onChange={(e) => handleChange(category, e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" className="gap-2">
            <Save className="h-4 w-4" />
            Save budgets
          </Button>
          {saved && (
            <span role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              Budgets saved.
            </span>
          )}
        </div>
      </form>
    </Card>
  )
}
