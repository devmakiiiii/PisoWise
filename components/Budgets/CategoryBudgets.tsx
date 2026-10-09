'use client'

import { Card } from '@/components/ui/card'
import { BudgetStatus } from '@/lib/types'
import {
  EXPENSE_CATEGORIES,
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type ExpenseCategory,
} from '@/lib/categories'
import { FinanceCalculations } from '@/lib/calculations'

interface CategoryBudgetsProps {
  status: BudgetStatus[]
}

/** Progress bars for each budgetable category in display order. */
export function CategoryBudgets({ status }: CategoryBudgetsProps) {
  const rows = EXPENSE_CATEGORIES.map((category) =>
    status.find((s) => s.category === category)
  ).filter((s): s is BudgetStatus => s !== undefined)

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">Category Budgets</h2>
        <p className="text-xs text-muted-foreground">{rows.length} active</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No budgets or spending this month yet. Set a monthly limit per
          category below, or add expenses to see where your piso goes.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const percent = row.percentUsed
            const barWidth = percent !== null ? Math.min(percent, 100) : 0
            return (
              <div
                key={row.category}
                className={`rounded-lg border p-3 ${
                  row.overBudget
                    ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950'
                    : 'border-border'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="text-lg">
                      {CATEGORY_EMOJIS[row.category]}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {CATEGORY_LABELS[row.category]}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <span className="font-semibold">
                      {FinanceCalculations.formatCurrency(row.spent)}
                    </span>
                    {row.budget !== null && (
                      <span className="text-muted-foreground">
                        {' '}/ {FinanceCalculations.formatCurrency(row.budget)}
                      </span>
                    )}
                  </div>
                </div>

                {row.budget !== null ? (
                  <>
                    <div
                      role="progressbar"
                      aria-label={`${CATEGORY_LABELS[row.category]} budget used`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(Math.min(percent ?? 0, 100))}
                      className="h-2 w-full overflow-hidden rounded-full bg-secondary"
                    >
                      <div
                        className={`h-full rounded-full ${
                          row.overBudget
                            ? 'bg-red-500'
                            : CATEGORY_COLORS[row.category as ExpenseCategory]
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {percent !== null && `${Math.round(percent)}% used`}
                      </span>
                      <span
                        className={
                          row.overBudget
                            ? 'font-medium text-red-600 dark:text-red-400'
                            : 'text-muted-foreground'
                        }
                      >
                        {row.overBudget
                          ? `Over by ${FinanceCalculations.formatCurrency(
                              Math.abs(row.remaining ?? 0)
                            )}`
                          : `${FinanceCalculations.formatCurrency(
                              row.remaining ?? 0
                            )} left`}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No budget set — spending tracked only
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
