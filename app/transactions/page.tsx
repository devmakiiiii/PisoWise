'use client'

import { useState } from 'react'
import { Header } from '@/components/Layout/Header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Edit2 } from 'lucide-react'
import { QuickAddModal } from '@/components/Dashboard/QuickAddModal'
import { StorageManager } from '@/lib/storage'
import { useAppData } from '@/lib/hooks'
import { Transaction } from '@/lib/types'
import { FinanceCalculations } from '@/lib/calculations'
import { CATEGORY_EMOJIS as categoryEmojis } from '@/lib/categories'
import { toast } from '@/lib/toast'

export default function TransactionsPage() {
  const data = useAppData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const handleDeleteTransaction = (id: string) => {
    StorageManager.deleteTransaction(id)
    toast.success('Transaction deleted')
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setEditing(transaction)
    setModalOpen(true)
  }

  const handleModalOpenChange = (open: boolean) => {
    setModalOpen(open)
    if (!open) setEditing(null)
  }

  const handleSaveTransaction = (
    id: string,
    transaction: Omit<Transaction, 'id' | 'createdAt'>
  ) => {
    StorageManager.updateTransaction(id, transaction)
  }

  // Sort transactions by date (newest first)
  const sortedTransactions = [...data.transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return (
    <main className="min-h-screen">
      <Header />
      <div className="p-4 space-y-6 md:p-6">
        <div>
          <h1 className="text-2xl font-bold mb-4">All Transactions</h1>
          <p className="text-muted-foreground mb-6">Total: {data.transactions.length} transactions</p>
        </div>

        <Card>
          {sortedTransactions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>No transactions yet. Start adding transactions to track your budget!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 border-b last:border-b-0 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="text-2xl">{categoryEmojis[transaction.category] || '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{transaction.description}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {FinanceCalculations.formatDate(transaction.date)}
                        </p>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {transaction.category}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <p
                      className={`font-semibold whitespace-nowrap ${
                        transaction.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {FinanceCalculations.formatCurrency(transaction.amount)}
                    </p>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTransaction(transaction)}
                        aria-label="Edit transaction"
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        aria-label="Delete transaction"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <QuickAddModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        onAdd={() => {}} /* Add flow is not available from this page */
        transaction={editing}
        onSave={handleSaveTransaction}
      />
    </main>
  )
}
