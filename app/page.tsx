'use client'

import { useState } from 'react'
import { Header } from '@/components/Layout/Header'
import { StatCards } from '@/components/Dashboard/StatCards'
import { PetsaDePeligroBar } from '@/components/Dashboard/PetsaDePeligroBar'
import { PuwedeBaWidget } from '@/components/Dashboard/PuwedeBaWidget'
import { RecentTransactions } from '@/components/Dashboard/RecentTransactions'
import { QuickAddModal } from '@/components/Dashboard/QuickAddModal'
import { WelcomeBanner } from '@/components/Dashboard/WelcomeBanner'
import { StorageManager } from '@/lib/storage'
import { useAppData, useHasSeenWelcome } from '@/lib/hooks'
import { Transaction } from '@/lib/types'
import { nanoid } from 'nanoid'

export default function DashboardPage() {
  const data = useAppData()
  const hasSeenWelcome = useHasSeenWelcome()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const handleDelete = (id: string) => {
    StorageManager.deleteTransaction(id)
  }

  const handleEdit = (transaction: Transaction) => {
    setEditing(transaction)
    setModalOpen(true)
  }

  const handleQuickAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const handleModalOpenChange = (open: boolean) => {
    setModalOpen(open)
    if (!open) setEditing(null)
  }

  const handleAddTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    StorageManager.addTransaction({
      ...transaction,
      id: nanoid(),
      createdAt: new Date().toISOString(),
    })
  }

  const handleSaveTransaction = (
    id: string,
    transaction: Omit<Transaction, 'id' | 'createdAt'>
  ) => {
    StorageManager.updateTransaction(id, transaction)
  }

  const handleStartFresh = () => {
    StorageManager.markWelcomeSeen()
  }

  const handleLoadDemo = () => {
    StorageManager.loadDemoData()
    StorageManager.markWelcomeSeen()
  }

  return (
    <main className="min-h-screen">
      <Header onQuickAdd={handleQuickAdd} />
      <div className="p-4 space-y-6 md:p-6">
        {!hasSeenWelcome && (
          <WelcomeBanner onStartFresh={handleStartFresh} onLoadDemo={handleLoadDemo} />
        )}
        <StatCards data={data} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PetsaDePeligroBar data={data} />
          </div>
          <div>
            <PuwedeBaWidget data={data} />
          </div>
        </div>
        <RecentTransactions data={data} onEdit={handleEdit} onDelete={handleDelete} />
      </div>

      <QuickAddModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        onAdd={handleAddTransaction}
        transaction={editing}
        onSave={handleSaveTransaction}
      />
    </main>
  )
}
