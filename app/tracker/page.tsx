'use client'

import { Header } from '@/components/Layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trash2, Check } from 'lucide-react'
import { StorageManager } from '@/lib/storage'
import { useAppData } from '@/lib/hooks'
import { Debt } from '@/lib/types'
import { FinanceCalculations } from '@/lib/calculations'
import { nanoid } from 'nanoid'

export default function TrackerPage() {
  const data = useAppData()

  const handleDeleteDebt = (id: string) => {
    StorageManager.deleteDebt(id)
  }

  const handleMarkAsPaid = (id: string) => {
    StorageManager.updateDebt(id, { status: 'paid' })
  }

  const handleAddDebt = (type: 'receivable' | 'payable') => {
    const newDebt: Debt = {
      id: nanoid(),
      type,
      personName: `Person ${data.debts.length + 1}`,
      amount: 1000,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    StorageManager.addDebt(newDebt)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">Paid</Badge>
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100">Overdue</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100">Pending</Badge>
    }
  }

  const receivables = data.debts.filter((d) => d.type === 'receivable')
  const payables = data.debts.filter((d) => d.type === 'payable')

  const totalReceivables = receivables.reduce((sum, d) => (d.status !== 'paid' ? sum + d.amount : sum), 0)
  const totalPayables = payables.reduce((sum, d) => (d.status !== 'paid' ? sum + d.amount : sum), 0)

  return (
    <main className="min-h-screen">
      <Header />
      <div className="p-4 space-y-6 md:p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Card className="p-6 border-2 border-emerald-200 dark:border-emerald-800">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">May Utang Sa Akin</h3>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {FinanceCalculations.formatCurrency(totalReceivables)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{receivables.length} people owe you</p>
          </Card>

          <Card className="p-6 border-2 border-red-200 dark:border-red-800">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Utang Ko</h3>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {FinanceCalculations.formatCurrency(totalPayables)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">You owe {payables.length} people</p>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="p-6">
          <Tabs defaultValue="receivable" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="receivable">May Utang Sa Akin ({receivables.length})</TabsTrigger>
              <TabsTrigger value="payable">Utang Ko ({payables.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="receivable" className="space-y-4">
              {receivables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No receivables yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {receivables.map((debt) => (
                    <div
                      key={debt.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-card/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{debt.personName}</p>
                        <p className="text-xs text-muted-foreground">{FinanceCalculations.formatDate(debt.dueDate)}</p>
                        {debt.description && <p className="text-sm text-muted-foreground">{debt.description}</p>}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {FinanceCalculations.formatCurrency(debt.amount)}
                          </p>
                          {getStatusBadge(debt.status)}
                        </div>

                        <div className="flex gap-1">
                          {debt.status !== 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(debt.id)}
                              className="h-8 w-8 p-0 text-emerald-600"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDebt(debt.id)}
                            className="h-8 w-8 p-0 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={() => handleAddDebt('receivable')} className="w-full mt-4">
                Add Receivable
              </Button>
            </TabsContent>

            <TabsContent value="payable" className="space-y-4">
              {payables.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No payables yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payables.map((debt) => (
                    <div
                      key={debt.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-card/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{debt.personName}</p>
                        <p className="text-xs text-muted-foreground">{FinanceCalculations.formatDate(debt.dueDate)}</p>
                        {debt.description && <p className="text-sm text-muted-foreground">{debt.description}</p>}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold text-red-600 dark:text-red-400">
                            {FinanceCalculations.formatCurrency(debt.amount)}
                          </p>
                          {getStatusBadge(debt.status)}
                        </div>

                        <div className="flex gap-1">
                          {debt.status !== 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(debt.id)}
                              className="h-8 w-8 p-0 text-emerald-600"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDebt(debt.id)}
                            className="h-8 w-8 p-0 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={() => handleAddDebt('payable')} className="w-full mt-4">
                Add Payable
              </Button>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </main>
  )
}
