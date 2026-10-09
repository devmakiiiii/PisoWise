'use client'

import { useState } from 'react'
import { Header } from '@/components/Layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { StorageManager } from '@/lib/storage'
import { useAppData, useMonthKey } from '@/lib/hooks'
import { FinanceCalculations } from '@/lib/calculations'
import { CategoryBudgets } from '@/components/Budgets/CategoryBudgets'
import { BudgetEditor } from '@/components/Budgets/BudgetEditor'
import { MonthlyTrendChart } from '@/components/Budgets/MonthlyTrendChart'
import { TransactionCategory } from '@/lib/types'

export default function BudgetsPage() {
  const data = useAppData()
  const currentMonth = useMonthKey()
  // null = follow the live current month; a stored key pins navigation.
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const month = selectedMonth ?? currentMonth

  const goToMonth = (delta: number) => {
    const base = month || currentMonth
    if (!base) return
    setSelectedMonth(FinanceCalculations.shiftMonthKey(base, delta))
  }

  const monthlyIncome = FinanceCalculations.getMonthlyIncome(data, month)
  const monthlyExpenses = FinanceCalculations.getMonthlyExpenses(data, month)
  const net = monthlyIncome - monthlyExpenses
  const budgetStatus = FinanceCalculations.getBudgetStatus(data, month)
  const trend = FinanceCalculations.getMonthlyTrend(data, 6, month)
  const monthLabel = month
    ? FinanceCalculations.getMonthLabel(month)
    : 'This month'

  const handleSaveBudgets = (
    categoryBudgets: Partial<Record<TransactionCategory, number>>
  ) => {
    StorageManager.updateSettings({ categoryBudgets })
  }

  return (
    <main className="min-h-screen">
      <Header />
      <div className="p-4 space-y-6 md:p-6">
        {/* Month navigator */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              disabled={!month}
              aria-label="Previous month"
              className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-36 text-center text-lg font-semibold sm:w-44">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              disabled={!month}
              aria-label="Next month"
              className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {selectedMonth !== null && (
            <Button variant="outline" size="sm" onClick={() => setSelectedMonth(null)}>
              Today
            </Button>
          )}
        </div>

        {/* Monthly summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Income</p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {FinanceCalculations.formatCurrency(monthlyIncome)}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950 p-3">
                <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expenses</p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {FinanceCalculations.formatCurrency(monthlyExpenses)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-100 dark:bg-amber-950 p-3">
                <TrendingDown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </Card>

          <Card className={`p-6 border-2 ${net < 0 ? 'border-red-500' : 'border-primary'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net</p>
                <p
                  className={`mt-2 text-2xl font-bold ${
                    net < 0 ? 'text-red-600 dark:text-red-400' : 'text-primary'
                  }`}
                >
                  {FinanceCalculations.formatCurrency(net)}
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>
        </div>

        <CategoryBudgets status={budgetStatus} />

        <BudgetEditor
          budgets={data.settings.categoryBudgets}
          onSave={handleSaveBudgets}
        />

        <MonthlyTrendChart points={trend} />
      </div>
    </main>
  )
}
