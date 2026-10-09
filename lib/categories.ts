import { RecurringFrequency, TransactionCategory, TransactionType } from './types'

/** All categories, in display order. */
export const TRANSACTION_CATEGORIES = [
  'salary',
  'freelance',
  'bonus',
  'food',
  'utilities',
  'rent',
  'transport',
  'entertainment',
  'health',
  'shopping',
  'other',
] as const satisfies readonly TransactionCategory[]

/** Expense categories only — these are the budgetable ones. */
export const EXPENSE_CATEGORIES = [
  'food',
  'utilities',
  'rent',
  'transport',
  'entertainment',
  'health',
  'shopping',
  'other',
] as const satisfies readonly TransactionCategory[]

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  salary: 'Salary',
  freelance: 'Freelance',
  bonus: 'Bonus',
  food: 'Food & Groceries',
  utilities: 'Utilities',
  rent: 'Rent',
  transport: 'Transport',
  entertainment: 'Entertainment',
  health: 'Health',
  shopping: 'Shopping',
  other: 'Other',
}

export const CATEGORY_EMOJIS: Record<TransactionCategory, string> = {
  salary: '💼',
  freelance: '💻',
  bonus: '🎁',
  food: '🍽️',
  utilities: '💡',
  rent: '🏠',
  transport: '🚗',
  entertainment: '🎬',
  health: '⚕️',
  shopping: '🛍️',
  other: '📌',
}

/** Tailwind background classes for chart bars (static strings, scan-safe). */
export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  food: 'bg-emerald-500',
  utilities: 'bg-blue-500',
  rent: 'bg-violet-500',
  transport: 'bg-amber-500',
  entertainment: 'bg-rose-500',
  health: 'bg-cyan-500',
  shopping: 'bg-orange-500',
  other: 'bg-slate-500',
}

/** Income categories only. */
export const INCOME_CATEGORIES = [
  'salary',
  'freelance',
  'bonus',
  'other',
] as const satisfies readonly TransactionCategory[]

export interface CategoryOption {
  value: TransactionCategory
  label: string
}

/** Type-grouped select options built from the shared labels (single source). */
export const CATEGORY_OPTIONS: Record<TransactionType, CategoryOption[]> = {
  income: INCOME_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
  expense: EXPENSE_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
}

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  yearly: 'Yearly',
}
