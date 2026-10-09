'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Edit2 } from 'lucide-react'
import { AppData, Transaction } from '@/lib/types'
import { FinanceCalculations } from '@/lib/calculations'
import { CATEGORY_EMOJIS } from '@/lib/categories'

interface RecentTransactionsProps {
  data: AppData
  onEdit?: (transaction: Transaction) => void
  onDelete?: (id: string) => void
}

const categoryEmojis = CATEGORY_EMOJIS

export function RecentTransactions({ data, onEdit, onDelete }: RecentTransactionsProps) {
  const recentTransactions = FinanceCalculations.getRecentTransactions(data, 8)

  if (recentTransactions.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p>No transactions yet. Start by adding your first transaction!</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
      <div className="space-y-3">
        {recentTransactions.map((transaction) => (
          <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-card/50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-2xl">{categoryEmojis[transaction.category] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{transaction.description}</p>
                <p className="text-xs text-muted-foreground">
                  {FinanceCalculations.formatDate(transaction.date)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right mr-2">
                <p
                  className={`font-semibold ${
                    transaction.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {FinanceCalculations.formatCurrency(transaction.amount)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit?.(transaction)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete?.(transaction.id)}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
