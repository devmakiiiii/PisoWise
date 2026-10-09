import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FinanceCalculations } from './calculations'
import { AppData, Debt, RecurringTransaction, Transaction } from './types'

const baseData: AppData = {
  schemaVersion: 4,
  transactions: [],
  goals: [],
  debts: [],
  recurring: [],
  settings: {
    monthlyIncome: 30000,
    fixedBills: 12000,
    payDay: 15,
    emergencyFundTarget: 50000,
    categoryBudgets: {},
  },
}

const rule = (
  overrides: Partial<RecurringTransaction> = {}
): RecurringTransaction => ({
  id: 'rule-1',
  type: 'expense',
  category: 'rent',
  description: 'Monthly Rent',
  amount: 8000,
  frequency: 'monthly',
  startDate: '2026-01-15',
  endDate: null,
  lastGenerated: null,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const tx = (
  type: 'income' | 'expense',
  amount: number,
  date: string
): Transaction => ({
  id: Math.random().toString(36).slice(2),
  type,
  category: type === 'income' ? 'salary' : 'food',
  description: type === 'income' ? 'Salary' : 'Expense',
  amount,
  date,
  createdAt: `${date}T00:00:00.000Z`,
})

const withTx = (...transactions: Transaction[]): AppData => ({
  ...baseData,
  transactions,
})

describe('getTotalIncome / getTotalExpenses', () => {
  it('sums only income transactions', () => {
    const data = withTx(
      tx('income', 30000, '2026-05-01'),
      tx('income', 5000, '2026-05-02'),
      tx('expense', 1000, '2026-05-03')
    )
    expect(FinanceCalculations.getTotalIncome(data)).toBe(35000)
  })

  it('sums only expense transactions', () => {
    const data = withTx(
      tx('income', 30000, '2026-05-01'),
      tx('expense', 2500, '2026-05-02'),
      tx('expense', 1500, '2026-05-03')
    )
    expect(FinanceCalculations.getTotalExpenses(data)).toBe(4000)
  })

  it('returns 0 for an empty dataset', () => {
    expect(FinanceCalculations.getTotalIncome(baseData)).toBe(0)
    expect(FinanceCalculations.getTotalExpenses(baseData)).toBe(0)
  })
})

describe('getSpendableBalance', () => {
  it('is income minus expenses minus fixed bills', () => {
    const data = withTx(tx('income', 30000, '2026-05-01'), tx('expense', 4000, '2026-05-02'))
    // 30000 - 4000 - 12000 (fixedBills) = 14000
    expect(FinanceCalculations.getSpendableBalance(data)).toBe(14000)
  })

  it('goes negative when spending exceeds income', () => {
    const data = withTx(tx('income', 10000, '2026-05-01'), tx('expense', 8000, '2026-05-02'))
    // 10000 - 8000 - 12000 = -10000
    expect(FinanceCalculations.getSpendableBalance(data)).toBe(-10000)
  })
})

describe('getDaysUntilPayday', () => {
  beforeEach(() => {
    // Sunday 2026-05-10, 10:00 local time
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 10, 10, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts days to payday later this month', () => {
    // May 10 → May 15 (midnight) = 5 days minus 10h → ceil = 5
    expect(FinanceCalculations.getDaysUntilPayday(15)).toBe(5)
  })

  it('rolls over to next month when payday already passed', () => {
    // May 10 → June 5 = 26 days minus 10h → ceil = 26
    expect(FinanceCalculations.getDaysUntilPayday(5)).toBe(26)
  })

  it('returns 0 when today is payday', () => {
    expect(FinanceCalculations.getDaysUntilPayday(10)).toBe(0)
  })
})

describe('getPetsaDePeligroStatus', () => {
  it('is survival with zero balance', () => {
    const result = FinanceCalculations.getPetsaDePeligroStatus(0, 5)
    expect(result.status).toBe('survival')
    expect(result.percentageUsed).toBe(100)
    expect(result.dailyCap).toBe(0)
  })

  it('is survival with negative balance', () => {
    const result = FinanceCalculations.getPetsaDePeligroStatus(-500, 5)
    expect(result.status).toBe('survival')
    expect(result.dailyCap).toBe(0)
    expect(result.percentageUsed).toBe(100)
  })

  it('is caution when the daily cap drops below ₱500', () => {
    // ₱1000 / 5 days = ₱200/day
    const result = FinanceCalculations.getPetsaDePeligroStatus(1000, 5)
    expect(result.status).toBe('caution')
    expect(result.dailyCap).toBe(200)
    // 1000 / (1000 * 5) * 100 = 20%
    expect(result.percentageUsed).toBe(20)
  })

  it('is safe with a comfortable balance', () => {
    // ₱10000 / 5 days = ₱2000/day
    const result = FinanceCalculations.getPetsaDePeligroStatus(10000, 5)
    expect(result.status).toBe('safe')
    expect(result.dailyCap).toBe(2000)
    // 10000 / (5000 * 5) * 100 = 40%
    expect(result.percentageUsed).toBe(40)
  })

  it('caps percentageUsed at 100', () => {
    const result = FinanceCalculations.getPetsaDePeligroStatus(60000, 1)
    expect(result.percentageUsed).toBe(100)
  })

  it('treats 0 days until payday as 1 day (no division by zero)', () => {
    const result = FinanceCalculations.getPetsaDePeligroStatus(10000, 0)
    expect(result.dailyCap).toBe(10000)
    expect(Number.isFinite(result.percentageUsed)).toBe(true)
  })
})

describe('canAfford', () => {
  it('allows small purchases with a minimal-impact message', () => {
    // ₱500 of ₱10000 = 5% impact
    const result = FinanceCalculations.canAfford(500, 10000, 5)
    expect(result.canAfford).toBe(true)
    expect(result.impact).toBeCloseTo(5)
    expect(result.message).toBe('Kaya naman! Minimal lang ang impact sa budget.')
  })

  it('warns about moderate impact', () => {
    // ₱2000 of ₱10000 = 20% impact
    const result = FinanceCalculations.canAfford(2000, 10000, 5)
    expect(result.canAfford).toBe(true)
    expect(result.message).toBe(
      'Kaya naman, pero mababawasan ang daily budget mo by 20%'
    )
  })

  it('warns about large impact', () => {
    // ₱5000 of ₱10000 = 50% impact
    const result = FinanceCalculations.canAfford(5000, 10000, 5)
    expect(result.canAfford).toBe(true)
    expect(result.message).toBe('Kaya naman, pero malaking impact. 50% less per day.')
  })

  it('rejects purchases the user cannot afford and reports the shortfall', () => {
    const result = FinanceCalculations.canAfford(15000, 10000, 5)
    expect(result.canAfford).toBe(false)
    expect(result.message).toBe('Hindi kaya, kulang ng ₱5000')
  })
})

describe('getRecentTransactions', () => {
  it('returns newest transactions first, limited by the requested count', () => {
    const data = withTx(
      tx('expense', 100, '2026-05-01'),
      tx('expense', 200, '2026-05-05'),
      tx('expense', 300, '2026-05-03'),
      tx('expense', 400, '2026-05-07')
    )
    const recent = FinanceCalculations.getRecentTransactions(data, 2)
    expect(recent).toHaveLength(2)
    expect(recent[0].amount).toBe(400)
    expect(recent[1].amount).toBe(200)
  })
})

describe('debt helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const debt = (dueDate: string, status: Debt['status'] = 'pending'): Debt => ({
    id: Math.random().toString(36).slice(2),
    type: 'receivable',
    personName: 'Juan',
    amount: 1000,
    dueDate,
    status,
    createdAt: '2026-05-01T00:00:00.000Z',
  })

  it('getOverdueDebts finds past-due unpaid debts', () => {
    const data: AppData = {
      ...baseData,
      debts: [
        debt('2026-05-09'), // overdue
        debt('2026-05-20'), // not due yet
        debt('2026-05-01', 'paid'), // paid — never overdue
      ],
    }
    const overdue = FinanceCalculations.getOverdueDebts(data)
    expect(overdue).toHaveLength(1)
    expect(overdue[0].dueDate).toBe('2026-05-09')
  })

  it('getUpcomingDebts finds unpaid debts due within the window', () => {
    const data: AppData = {
      ...baseData,
      debts: [
        debt('2026-05-13'), // within 7 days
        debt('2026-05-30'), // too far
        debt('2026-05-09'), // already overdue, not "upcoming"
        debt('2026-05-12', 'paid'), // paid
      ],
    }
    const upcoming = FinanceCalculations.getUpcomingDebts(data, 7)
    expect(upcoming).toHaveLength(1)
    expect(upcoming[0].dueDate).toBe('2026-05-13')
  })
})

describe('calculateGoalProgress', () => {
  it('returns 0 when the target is zero or negative', () => {
    expect(FinanceCalculations.calculateGoalProgress(100, 0)).toBe(0)
    expect(FinanceCalculations.calculateGoalProgress(100, -5)).toBe(0)
  })

  it('computes the percentage', () => {
    expect(FinanceCalculations.calculateGoalProgress(2500, 10000)).toBe(25)
    expect(FinanceCalculations.calculateGoalProgress(5000, 10000)).toBe(50)
  })

  it('caps at 100%', () => {
    expect(FinanceCalculations.calculateGoalProgress(15000, 10000)).toBe(100)
  })
})

describe('recurring occurrence math', () => {
  it('lists weekly occurrences in the window, excluding the cursor', () => {
    const r = rule({ frequency: 'weekly', startDate: '2026-05-04' }) // Monday
    expect(FinanceCalculations.dueDates(r, '2026-05-04', '2026-05-20')).toEqual([
      '2026-05-04',
      '2026-05-11',
      '2026-05-18',
    ])
    expect(
      FinanceCalculations.dueDates(
        { ...r, lastGenerated: '2026-05-11' },
        '2026-05-12',
        '2026-05-20'
      )
    ).toEqual(['2026-05-18'])
  })

  it('computes biweekly (14-day) steps', () => {
    const r = rule({
      frequency: 'biweekly',
      startDate: '2026-05-01',
      lastGenerated: '2026-05-01',
    })
    expect(FinanceCalculations.dueDates(r, '2026-05-02', '2026-05-29')).toEqual([
      '2026-05-15',
      '2026-05-29',
    ])
  })

  it('clamps monthly occurrences to short months without drifting', () => {
    const r = rule({ frequency: 'monthly', startDate: '2026-01-31' })
    expect(FinanceCalculations.dueDates(r, '2026-01-31', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('rolls Feb-29 yearly to Feb-28 in non-leap years', () => {
    const r = rule({ frequency: 'yearly', startDate: '2024-02-29' })
    expect(FinanceCalculations.dueDates(r, '2026-01-01', '2026-12-31')).toEqual([
      '2026-02-28',
    ])
    expect(FinanceCalculations.dueDates(r, '2024-02-01', '2025-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
    ])
  })

  it('skips decade-long gaps with arithmetic (no per-day walk)', () => {
    const r = rule({ frequency: 'monthly', startDate: '2010-06-15' })
    const dates = FinanceCalculations.dueDates(r, '2026-05-01', '2026-06-30')
    expect(dates).toEqual(['2026-05-15', '2026-06-15'])
  })

  it('locates long-skipped rules well past the emit cap', () => {
    // A weekly rule untouched for ~30 years sits at period index ~1560, far
    // beyond MAX_GENERATE_PER_RULE (100). Locating must reach back that far
    // even though emitting stays capped.
    const r = rule({ frequency: 'weekly', startDate: '1996-01-01' })
    const dates = FinanceCalculations.dueDates(r, '2026-05-04', '2026-05-18')
    expect(dates).toEqual(['2026-05-04', '2026-05-11', '2026-05-18'])
  })

  it('caps emitted backfill without capping the search index', () => {
    // Same shape, but the window is huge: still exactly MAX_GENERATE_PER_RULE
    // rows, and the newest one is the last due date — no silent truncation of
    // the whole window just because the starting index is large.
    const r = rule({ frequency: 'monthly', startDate: '2000-01-01' })
    const dates = FinanceCalculations.dueDates(r, '2026-01-01', '2100-01-01')
    expect(dates).toHaveLength(100)
    expect(dates[0]).toBe('2026-01-01')
    expect(dates[dates.length - 1]).toBe('2034-04-01')
  })

  it('respects inactive rules, end dates, and windows', () => {
    const start = rule({ startDate: '2026-05-01' })
    expect(
      FinanceCalculations.dueDates(
        { ...start, active: false },
        '2026-05-01',
        '2026-06-30'
      )
    ).toEqual([])
    expect(
      FinanceCalculations.dueDates(
        { ...start, endDate: '2026-05-10' },
        '2026-05-01',
        '2026-06-30'
      )
    ).toEqual(['2026-05-01'])
  })

  it('never materializes on/before the cursor', () => {
    const r = rule({ startDate: '2026-05-01', lastGenerated: '2026-06-01' })
    expect(FinanceCalculations.dueDates(r, '2026-05-15', '2026-06-30')).toEqual([])
    const r2 = rule({ startDate: '2026-05-01', lastGenerated: '2026-05-01' })
    expect(FinanceCalculations.dueDates(r2, '2026-05-01', '2026-06-30')).toEqual([
      '2026-06-01',
    ])
  })

  it('rejects malformed rule dates and future starts without throwing', () => {
    expect(
      FinanceCalculations.dueDates(rule({ startDate: 'nope' }), '2026-01-01', '2026-12-31')
    ).toEqual([])
    expect(
      FinanceCalculations.dueDates(
        rule({ startDate: '2026-05-01', endDate: 'later' }),
        '2026-01-01',
        '2026-12-31'
      )
    ).toEqual([])
    expect(
      FinanceCalculations.dueDates(
        rule({ startDate: '2027-01-01' }),
        '2026-01-01',
        '2026-12-31'
      )
    ).toEqual([])
  })
})

describe('nextOccurrenceDate', () => {
  it('returns the next occurrence strictly after the cursor', () => {
    const r = rule({ startDate: '2026-05-01', lastGenerated: '2026-05-01' })
    expect(FinanceCalculations.nextOccurrenceDate(r, '2026-05-01')).toBe('2026-06-01')
    expect(FinanceCalculations.nextOccurrenceDate(r, '2026-06-02')).toBe('2026-07-01')
  })

  it('returns the first occurrence when the rule never ran', () => {
    expect(
      FinanceCalculations.nextOccurrenceDate(rule({ startDate: '2026-05-01' }), '2026-01-01')
    ).toBe('2026-05-01')
  })

  it('returns null for inactive, ended, or malformed rules', () => {
    expect(
      FinanceCalculations.nextOccurrenceDate(
        rule({ active: false, startDate: '2026-05-01' }),
        '2026-01-01'
      )
    ).toBeNull()
    expect(
      FinanceCalculations.nextOccurrenceDate(
        rule({ startDate: '2026-05-01', endDate: '2026-05-01' }),
        '2026-06-01'
      )
    ).toBeNull()
    expect(
      FinanceCalculations.nextOccurrenceDate(rule({ startDate: 'nope' }), '2026-01-01')
    ).toBeNull()
  })
})

describe('generateDueTransactions', () => {
  it('simulates rules across the data set and advances cursors', () => {
    const data: AppData = {
      ...baseData,
      recurring: [
        rule({ id: 'a', startDate: '2026-05-01', lastGenerated: null }),
        rule({
          id: 'b',
          type: 'income',
          category: 'salary',
          description: 'Salary',
          amount: 30000,
          startDate: '2026-05-20',
          lastGenerated: null,
        }),
        rule({ id: 'c', startDate: '2026-05-01', active: false }),
      ],
    }
    const result = FinanceCalculations.generateDueTransactions(data, '2026-05-31')
    expect(result.transactions.map((t) => t.date)).toEqual(['2026-05-01', '2026-05-20'])
    expect(result.transactions[0]).toMatchObject({ amount: 8000, recurringId: 'a' })
    expect(result.transactions[1]).toMatchObject({ type: 'income', recurringId: 'b' })
    expect(result.createdCounts).toEqual({ a: 1, b: 1 })
    expect(result.rules.map((r) => r.lastGenerated)).toEqual([
      '2026-05-01',
      '2026-05-20',
      null,
    ])
    // Deterministic ids: rerunning on the same state gives the same ids.
    expect(
      FinanceCalculations.generateDueTransactions(data, '2026-05-31').transactions.map(
        (t) => t.id
      )
    ).toEqual(result.transactions.map((t) => t.id))
  })

  it('creates nothing when nothing is due and leaves cursors untouched', () => {
    const data: AppData = {
      ...baseData,
      recurring: [rule({ startDate: '2026-06-01' })],
    }
    const result = FinanceCalculations.generateDueTransactions(data, '2026-05-31')
    expect(result.transactions).toEqual([])
    expect(result.createdCounts).toEqual({})
    expect(result.rules[0].lastGenerated).toBeNull()
  })
})

describe('formatting', () => {
  it('formats whole pesos with grouping and no decimals', () => {
    expect(FinanceCalculations.formatCurrency(0)).toBe('₱0')
    expect(FinanceCalculations.formatCurrency(1234)).toBe('₱1,234')
    expect(FinanceCalculations.formatCurrency(30000)).toBe('₱30,000')
  })

  it('formats a round-tripped ISO date in en-PH style', () => {
    // Construct the ISO string from a local date so the result is
    // independent of the machine timezone.
    const iso = new Date(2026, 4, 10).toISOString()
    expect(FinanceCalculations.formatDate(iso)).toBe('May 10, 2026')
  })
})

describe('month helpers', () => {
  it('derives the month key from a date string (timezone-independent)', () => {
    expect(FinanceCalculations.getMonthKey('2026-05-10')).toBe('2026-05')
    expect(FinanceCalculations.getMonthKey('2026-12-31')).toBe('2026-12')
  })

  it('shifts month keys across year boundaries', () => {
    expect(FinanceCalculations.shiftMonthKey('2026-05', -3)).toBe('2026-02')
    expect(FinanceCalculations.shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(FinanceCalculations.shiftMonthKey('2026-12', 1)).toBe('2027-01')
    expect(FinanceCalculations.shiftMonthKey('2026-05', 0)).toBe('2026-05')
  })

  it('labels months for display', () => {
    expect(FinanceCalculations.getMonthLabel('2026-05')).toBe('May 2026')
    expect(FinanceCalculations.getMonthLabel('')).toBe('')
    expect(FinanceCalculations.getMonthLabel('garbage')).toBe('')
  })
})

describe('monthly aggregation', () => {
  const monthData: AppData = {
    ...baseData,
    transactions: [
      tx('income', 30000, '2026-05-01'),
      tx('income', 5000, '2026-04-30'), // previous month
      tx('expense', 2500, '2026-05-03'),
      tx('expense', 1500, '2026-05-20'),
      tx('expense', 999, '2026-06-01'), // next month
    ],
  }

  it('sums income and expenses only within the month', () => {
    expect(FinanceCalculations.getMonthlyIncome(monthData, '2026-05')).toBe(30000)
    expect(FinanceCalculations.getMonthlyExpenses(monthData, '2026-05')).toBe(4000)
  })

  it('excludes other months', () => {
    expect(FinanceCalculations.getMonthlyIncome(monthData, '2026-04')).toBe(5000)
    expect(FinanceCalculations.getMonthlyExpenses(monthData, '2026-04')).toBe(0)
    expect(FinanceCalculations.getMonthlyExpenses(monthData, '2026-06')).toBe(999)
  })

  it('returns zero for an empty month key or an empty month', () => {
    expect(FinanceCalculations.getMonthlyIncome(monthData, '')).toBe(0)
    expect(FinanceCalculations.getMonthlyExpenses(monthData, '')).toBe(0)
    expect(FinanceCalculations.getMonthlyExpenses(monthData, '2025-01')).toBe(0)
  })

  it('groups expenses by category', () => {
    const data: AppData = {
      ...baseData,
      transactions: [
        tx('expense', 100, '2026-05-01'), // food (default category)
        tx('expense', 200, '2026-05-02'), // food
        tx('expense', 300, '2026-05-03'), // food
        tx('expense', 75, '2026-04-15'), // food, other month
        tx('income', 5000, '2026-05-01'), // income ignored
        { ...tx('expense', 150, '2026-05-04'), category: 'transport' },
      ],
    }
    expect(FinanceCalculations.getExpensesByCategory(data, '2026-05')).toEqual({
      food: 600, // 100 + 200 + 300
      transport: 150,
    })
    expect(FinanceCalculations.getExpensesByCategory(data, '')).toEqual({})
  })
})

describe('getBudgetStatus', () => {
  const data: AppData = {
    ...baseData,
    transactions: [
      { ...tx('expense', 700, '2026-05-02'), category: 'food' },
      { ...tx('expense', 1300, '2026-05-05'), category: 'transport' },
      { ...tx('expense', 50, '2026-04-01'), category: 'food' }, // other month
    ],
    settings: {
      ...baseData.settings,
      categoryBudgets: { food: 1000, entertainment: 2000 },
    },
  }

  const find = (
    rows: ReturnType<typeof FinanceCalculations.getBudgetStatus>,
    cat: string
  ) => rows.find((r) => r.category === cat)

  it('combines budgets and spending for the month', () => {
    const rows = FinanceCalculations.getBudgetStatus(data, '2026-05')

    const food = find(rows, 'food')
    expect(food).toMatchObject({
      budget: 1000,
      spent: 700,
      remaining: 300,
      percentUsed: 70,
      overBudget: false,
    })

    // Spent but no budget set
    const transport = find(rows, 'transport')
    expect(transport).toMatchObject({
      budget: null,
      spent: 1300,
      remaining: null,
      percentUsed: null,
      overBudget: false,
    })

    // Budget set but not spent this month
    const entertainment = find(rows, 'entertainment')
    expect(entertainment).toMatchObject({
      budget: 2000,
      spent: 0,
      remaining: 2000,
      percentUsed: 0,
      overBudget: false,
    })
  })

  it('flags categories that exceed their budget', () => {
    const over: AppData = {
      ...data,
      settings: {
        ...data.settings,
        categoryBudgets: { ...data.settings.categoryBudgets, transport: 1000 },
      },
    }
    const overTransport = find(
      FinanceCalculations.getBudgetStatus(over, '2026-05'),
      'transport'
    )
    expect(overTransport?.overBudget).toBe(true)
    expect(overTransport?.remaining).toBe(-300)
    expect(overTransport?.percentUsed).toBe(130)
  })

  it('omits categories with no budget and no spending', () => {
    const rows = FinanceCalculations.getBudgetStatus(data, '2026-05')
    expect(find(rows, 'rent')).toBeUndefined()
    expect(find(rows, 'shopping')).toBeUndefined()
  })
})

describe('getMonthlyTrend', () => {
  it('returns months oldest-first, ending at the given month', () => {
    const data: AppData = {
      ...baseData,
      transactions: [
        tx('income', 1000, '2026-03-10'),
        tx('expense', 400, '2026-04-10'),
        tx('income', 2000, '2026-05-01'),
        tx('expense', 500, '2026-05-15'),
      ],
    }
    const points = FinanceCalculations.getMonthlyTrend(data, 3, '2026-05')
    expect(points.map((p) => p.monthKey)).toEqual(['2026-03', '2026-04', '2026-05'])
    expect(points[0]).toMatchObject({ label: 'Mar 2026', income: 1000, expenses: 0 })
    expect(points[1]).toMatchObject({ income: 0, expenses: 400 })
    expect(points[2]).toMatchObject({ label: 'May 2026', income: 2000, expenses: 500 })
  })

  it('includes empty months so the chart keeps its columns', () => {
    const points = FinanceCalculations.getMonthlyTrend(baseData, 6, '2026-05')
    expect(points).toHaveLength(6)
    expect(points.every((p) => p.income === 0 && p.expenses === 0)).toBe(true)
  })

  it('returns nothing for an empty month key', () => {
    expect(FinanceCalculations.getMonthlyTrend(baseData, 6, '')).toEqual([])
  })
})
