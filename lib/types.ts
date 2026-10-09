export type TransactionType = 'income' | 'expense'
export type TransactionCategory =
  | 'salary'
  | 'freelance'
  | 'bonus'
  | 'food'
  | 'utilities'
  | 'rent'
  | 'transport'
  | 'entertainment'
  | 'health'
  | 'shopping'
  | 'other'

export interface Transaction {
  id: string
  type: TransactionType
  category: TransactionCategory
  description: string
  amount: number
  date: string // ISO date string
  createdAt: string
  /** ID of the recurring rule that generated this transaction (if any). */
  recurringId?: string
}

export interface Goal {
  id: string
  name: string
  emoji: string
  targetAmount: number
  currentAmount: number
  targetDate: string // ISO date string
  createdAt: string
}

export type DebtType = 'receivable' | 'payable'

export interface Debt {
  id: string
  type: DebtType
  personName: string
  amount: number
  dueDate: string // ISO date string
  status: 'pending' | 'paid' | 'overdue'
  description?: string
  createdAt: string
}

export interface BudgetSettings {
  monthlyIncome: number
  fixedBills: number
  payDay: number // day of month (1-31)
  emergencyFundTarget: number
  /** Optional per-category monthly budgets (expense categories only). */
  categoryBudgets: Partial<Record<TransactionCategory, number>>
}

/** Per-category budget usage for one month. */
export interface BudgetStatus {
  category: TransactionCategory
  /** null = no budget set for this category. */
  budget: number | null
  spent: number
  /** null when no budget is set. */
  remaining: number | null
  /** 0–∞ (uncapped) percentage of the budget used; null when no budget. */
  percentUsed: number | null
  overBudget: boolean
}

/** One column of the monthly income/expense trend chart. */
export interface MonthlyTrendPoint {
  monthKey: string // 'YYYY-MM'
  label: string // e.g. 'May 2026'
  income: number
  expenses: number
}

export interface AppData {
  /** Bump when the shape of AppData changes; migrations run in lib/storage.ts */
  schemaVersion: number
  transactions: Transaction[]
  goals: Goal[]
  debts: Debt[]
  recurring: RecurringTransaction[]
  settings: BudgetSettings
}

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export interface RecurringTransaction {
  id: string
  type: TransactionType
  category: TransactionCategory
  description: string
  amount: number
  frequency: RecurringFrequency
  startDate: string // 'YYYY-MM-DD' of the first occurrence
  endDate: string | null // 'YYYY-MM-DD' of the last allowed occurrence, or null
  /** Last occurrence date already materialized (null = never run). */
  lastGenerated: string | null
  active: boolean
  createdAt: string
}
