'use client'

import { Card } from '@/components/ui/card'
import { MonthlyTrendPoint } from '@/lib/types'
import { FinanceCalculations } from '@/lib/calculations'

interface MonthlyTrendChartProps {
  points: MonthlyTrendPoint[]
}

/**
 * Income vs expenses for the last N months — pure CSS bars (no chart
 * dependency; keeps with the libraries already used in this codebase).
 */
export function MonthlyTrendChart({ points }: MonthlyTrendChartProps) {
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expenses]))
  // Zero stays 0%; tiny positive values get a 3% sliver so they're visible.
  const barHeight = (value: number) =>
    value <= 0 ? 0 : Math.max((value / max) * 100, 3)

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Last {points.length || 6} Months</h2>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
            Expenses
          </span>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Loading month data…
        </div>
      ) : (
        <div className="flex h-44 items-end gap-2 sm:gap-4">
          {points.map((point) => (
            <div
              key={point.monthKey}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${point.label}: ${FinanceCalculations.formatCurrency(
                point.income
              )} in, ${FinanceCalculations.formatCurrency(point.expenses)} out`}
            >
              <div className="flex h-full items-end justify-center gap-1">
                <div
                  className="w-1/3 max-w-7 rounded-t bg-emerald-500"
                  style={{ height: `${barHeight(point.income)}%` }}
                  aria-label={`${point.label} income: ${FinanceCalculations.formatCurrency(
                    point.income
                  )}`}
                />
                <div
                  className="w-1/3 max-w-7 rounded-t bg-rose-500"
                  style={{ height: `${barHeight(point.expenses)}%` }}
                  aria-label={`${point.label} expenses: ${FinanceCalculations.formatCurrency(
                    point.expenses
                  )}`}
                />
              </div>
              <span className="mt-2 truncate text-center text-xs text-muted-foreground">
                {point.label.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
