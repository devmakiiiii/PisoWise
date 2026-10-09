'use client'

import { Card } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Target, Wallet } from 'lucide-react'
import { AppData } from '@/lib/types'
import { FinanceCalculations } from '@/lib/calculations'

interface StatCardsProps {
  data: AppData
}

export function StatCards({ data }: StatCardsProps) {
  const totalIncome = FinanceCalculations.getTotalIncome(data)
  const fixedBills = data.settings.fixedBills
  const totalSavings = FinanceCalculations.getTotalSavingsGoals(data)
  const spendableBalance = FinanceCalculations.getSpendableBalance(data)

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Income */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Income</p>
            <p className="text-2xl font-bold text-foreground mt-2">
              {FinanceCalculations.formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950 p-3">
            <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </Card>

      {/* Fixed Bills Reserved */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Fixed Bills</p>
            <p className="text-2xl font-bold text-foreground mt-2">
              {FinanceCalculations.formatCurrency(fixedBills)}
            </p>
          </div>
          <div className="rounded-lg bg-amber-100 dark:bg-amber-950 p-3">
            <TrendingDown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
      </Card>

      {/* Total Savings Goals */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Savings Goals</p>
            <p className="text-2xl font-bold text-foreground mt-2">
              {FinanceCalculations.formatCurrency(totalSavings)}
            </p>
          </div>
          <div className="rounded-lg bg-blue-100 dark:bg-blue-950 p-3">
            <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </Card>

      {/* Safe-to-Spend Balance (Primary) */}
      <Card className="p-6 border-2 border-primary">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary font-semibold">Safe-to-Spend</p>
            <p className="text-2xl font-bold text-primary mt-2">
              {FinanceCalculations.formatCurrency(Math.max(0, spendableBalance))}
            </p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
        </div>
      </Card>
    </div>
  )
}
