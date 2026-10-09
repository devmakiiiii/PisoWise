'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from '@/lib/toast'
import { Transaction, TransactionType, TransactionCategory } from '@/lib/types'

interface QuickAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void
  /** When set, the modal operates in edit mode for this transaction. */
  transaction?: Transaction | null
  /** Called on submit in edit mode. */
  onSave?: (id: string, transaction: Omit<Transaction, 'id' | 'createdAt'>) => void
}

const todayIso = () => new Date().toISOString().split('T')[0]

const categoryOptions: Record<TransactionType, { value: TransactionCategory; label: string }[]> = {
  income: [
    { value: 'salary', label: 'Salary' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'other', label: 'Other Income' },
  ],
  expense: [
    { value: 'food', label: 'Food & Groceries' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'rent', label: 'Rent' },
    { value: 'transport', label: 'Transport' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'health', label: 'Health' },
    { value: 'shopping', label: 'Shopping' },
    { value: 'other', label: 'Other Expense' },
  ],
}

/**
 * Modal shell. Returns null when closed so the inner form remounts on every
 * open — the form then seeds its state lazily from props (no effects needed).
 */
export function QuickAddModal({ open, ...formProps }: QuickAddModalProps) {
  if (!open) return null
  return (
    <TransactionForm key={formProps.transaction?.id ?? 'new'} open={open} {...formProps} />
  )
}

function TransactionForm({
  open,
  onOpenChange,
  onAdd,
  transaction,
  onSave,
}: QuickAddModalProps) {
  const isEdit = Boolean(transaction)
  const [type, setType] = useState<TransactionType>(() => transaction?.type ?? 'expense')
  const [category, setCategory] = useState<TransactionCategory>(
    () => transaction?.category ?? 'food'
  )
  const [description, setDescription] = useState(() => transaction?.description ?? '')
  const [amount, setAmount] = useState(() => (transaction ? String(transaction.amount) : ''))
  const [date, setDate] = useState(() => transaction?.date ?? todayIso())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!description || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return
    }

    const payload = {
      type,
      category,
      description,
      amount: Number(amount),
      date,
    }

    if (transaction && onSave) {
      onSave(transaction.id, payload)
      toast.success('Transaction updated')
    } else {
      // The form remounts fresh on the next open, so no manual reset needed.
      onAdd(payload)
      toast.success(
        type === 'income' ? 'Income added' : 'Expense added',
        `${description} · ₱${Number(amount).toLocaleString('en-PH')}`
      )
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Transaction' : 'Quick Add Transaction'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details of this transaction'
              : 'Add a new transaction to your budget'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={(value) => {
                  setType(value as TransactionType)
                  // Reset category when type changes
                  const defaultCategory = value === 'income' ? 'salary' : 'food'
                  setCategory(defaultCategory as TransactionCategory)
                }}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as TransactionCategory)}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions[type].map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Grocery shopping"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₱)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground">₱</span>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!description || !amount || Number(amount) <= 0}
                className="gap-2"
              >
                {isEdit ? 'Save Changes' : 'Add Transaction'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }
