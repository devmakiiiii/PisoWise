import {
  AppData,
  BudgetStatus,
  MonthlyTrendPoint,
  RecurringFrequency,
  RecurringTransaction,
  Transaction,
  TransactionCategory,
} from './types'

/**
 * Recurring scheduling constants.
 * Monthly/yearly occurrences use anchor math on the START date (not chained
 * offsets), so Jan-31 monthly lands on the last day of shorter months:
 * Feb-28/29, Mar-31, … without drifting when backfilling is late.
 */
/**
 * Maximum days any single period of the frequency can span. Kept in sync
 * with the occurrence math: weekly/biweekly exact; monthly clamped to the
 * last day of 28–31-day months; yearly 365/366-day years.
 */
const clampDay = (year: number, month: number, day: number): number => {
  const lastDay = new Date(year, month, 0).getDate()
  return Math.min(day, lastDay)
}

/** 'YYYY-MM-DD' shape check (values like 2026-13-99 pass; occurrence math rolls them). */
const isDateString = (value: string | null | undefined): boolean =>
  typeof value === 'string' && MONTH_DAY_RE.test(value)

/** 'YYYY-MM-DD' → whole days since epoch (local midnight); NaN if malformed. */
const daysSinceEpoch = (dateString: string): number => {
  const match = MONTH_DAY_RE.exec(dateString)
  if (!match) return NaN
  const [, year, month, day] = match
  return Math.round(
    new Date(Number(year), Number(month) - 1, Number(day)).getTime() /
      (24 * 60 * 60 * 1000)
  )
}

/** b - a in whole days; callers must ensure valid inputs. */
const daysBetweenStrings = (a: string, b: string): number =>
  daysSinceEpoch(b) - daysSinceEpoch(a)

/** 'YYYY-MM-DD' + n days; null for malformed input. */
const shiftDays = (dateString: string, days: number): string | null => {
  const match = MONTH_DAY_RE.exec(dateString)
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  date.setDate(date.getDate() + days)
  return toDateString(date)
}

const MONTH_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Hard cap on occurrences *emitted* per rule per run (memory bound). A rule
 * untouched for years backfills at most this many transactions.
 */
const MAX_GENERATE_PER_RULE = 100

/**
 * Hard cap on the period *index* the locator may search. Deliberately much
 * looser than MAX_GENERATE_PER_RULE: locating a long-skipped rule must be able
 * to reach far back in time (a weekly rule untouched for 20 years sits at
 * index ~1040) without that distance implying we emit thousands of rows. The
 * gallop + binary search below costs ~log2(index) evaluations either way.
 */
const MAX_LOCATE_PERIODS = 20000

/** Local-timezone-safe 'YYYY-MM-DD' formatting. */
const toDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Anchor occurrence math: occurrence N is computed directly from the START
 * date (never chained), so backfilling is drift-free.
 * weekly/biweekly: exact day offsets; monthly: same day-of-month, last-day
 * clamped (Jan-31 → Feb-28/29 → Mar-31); yearly: same month/day, Feb-29 →
 * Feb-28 in non-leap years.
 */
const addPeriods = (
  year: number,
  month: number, // 1-based
  day: number,
  frequency: RecurringFrequency,
  n: number
): string => {
  switch (frequency) {
    case 'weekly':
    case 'biweekly': {
      const step = frequency === 'weekly' ? 7 : 14
      return toDateString(new Date(year, month - 1, day + step * n))
    }
    case 'monthly': {
      const totalMonths = month - 1 + n
      const y = year + Math.floor(totalMonths / 12)
      const m = (((totalMonths % 12) + 12) % 12) + 1
      return toDateString(new Date(y, m - 1, clampDay(y, m, day)))
    }
    case 'yearly': {
      const y = year + n
      return toDateString(new Date(y, month - 1, clampDay(y, month, day)))
    }
  }
}

/**
 * Smallest n ≥ 0 with addPeriods(...n) >= target, or null if none ≤ limit.
 *
 * Occurrences are strictly increasing in n (every period strictly advances the
 * date), so the predicate `addPeriods(n) >= target` is monotonic and a binary
 * search is exact. A galloping probe (1, 2, 4, 8 …) brackets the answer first,
 * so locating a decade-old monthly occurrence costs ~log2(190) ≈ 8 evaluations
 * instead of walking one period at a time.
 */
const findFirstPeriodAtOrAfter = (
  year: number,
  month: number,
  day: number,
  frequency: RecurringFrequency,
  target: string,
  limit: number
): number | null => {
  if (addPeriods(year, month, day, frequency, 0) >= target) return 0

  // Gallop until the date passes the target (or we exceed the limit).
  let hi = 1
  while (addPeriods(year, month, day, frequency, hi) < target) {
    hi *= 2
    if (hi > limit) return null
  }

  // Invariant: lo fails, hi passes. Binary search for the first passing index.
  let lo = Math.floor(hi / 2)
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2)
    if (addPeriods(year, month, day, frequency, mid) >= target) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return hi
}

export const FinanceCalculations = {
  // ---------------------------------------------------------------
  // Month helpers (monthKey = 'YYYY-MM', derived from the transaction's
  // 'YYYY-MM-DD' date string so results are timezone-independent)
  // ---------------------------------------------------------------

  getMonthKey: (dateString: string): string => dateString.slice(0, 7),

  getCurrentMonthKey: (): string => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  },

  /** Shifts a 'YYYY-MM' key by n months (n may be negative). */
  shiftMonthKey: (monthKey: string, delta: number): string => {
    const [year, month] = monthKey.split('-').map(Number)
    if (!year || !month) return monthKey
    const date = new Date(year, month - 1 + delta, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  },

  /** Human label like 'May 2026' (empty key → empty label). */
  getMonthLabel: (monthKey: string): string => {
    const [year, month] = monthKey.split('-').map(Number)
    if (!year || !month) return ''
    return new Date(year, month - 1, 1).toLocaleDateString('en-PH', {
      month: 'short',
      year: 'numeric',
    })
  },

  /** Transactions with date inside the given month; empty key → []. */
  getTransactionsForMonth: (data: AppData, monthKey: string): Transaction[] => {
    if (!monthKey) return []
    return data.transactions.filter((t) => t.date.startsWith(monthKey))
  },

  getMonthlyIncome: (data: AppData, monthKey: string): number => {
    return FinanceCalculations.getTransactionsForMonth(data, monthKey)
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  },

  getMonthlyExpenses: (data: AppData, monthKey: string): number => {
    return FinanceCalculations.getTransactionsForMonth(data, monthKey)
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  },

  /** Expense totals grouped by category for one month. */
  getExpensesByCategory: (
    data: AppData,
    monthKey: string
  ): Partial<Record<TransactionCategory, number>> => {
    const totals: Partial<Record<TransactionCategory, number>> = {}
    for (const t of FinanceCalculations.getTransactionsForMonth(data, monthKey)) {
      if (t.type !== 'expense') continue
      totals[t.category] = (totals[t.category] ?? 0) + t.amount
    }
    return totals
  },

  /**
   * Budget usage per category for one month. Includes every category that
   * has either a budget set or spending in the month (or both).
   */
  getBudgetStatus: (data: AppData, monthKey: string): BudgetStatus[] => {
    const spentByCategory = FinanceCalculations.getExpensesByCategory(data, monthKey)
    const categories = new Set<TransactionCategory>([
      ...(Object.keys(data.settings.categoryBudgets) as TransactionCategory[]),
      ...(Object.keys(spentByCategory) as TransactionCategory[]),
    ])

    const result: BudgetStatus[] = []
    for (const category of categories) {
      const budget = data.settings.categoryBudgets[category] ?? null
      const spent = spentByCategory[category] ?? 0
      if (budget === null && spent === 0) continue

      const remaining = budget !== null ? budget - spent : null
      result.push({
        category,
        budget,
        spent,
        remaining,
        percentUsed:
          budget !== null && budget > 0 ? (spent / budget) * 100 : null,
        overBudget: budget !== null && spent > budget,
      })
    }
    return result
  },

  /** Last `months` points ending at (and including) `endMonthKey`, oldest first. */
  getMonthlyTrend: (
    data: AppData,
    months: number,
    endMonthKey: string
  ): MonthlyTrendPoint[] => {
    if (!endMonthKey) return []
    const points: MonthlyTrendPoint[] = []
    let key = endMonthKey
    for (let i = 0; i < months; i++) {
      points.unshift({
        monthKey: key,
        label: FinanceCalculations.getMonthLabel(key),
        income: FinanceCalculations.getMonthlyIncome(data, key),
        expenses: FinanceCalculations.getMonthlyExpenses(data, key),
      })
      key = FinanceCalculations.shiftMonthKey(key, -1)
    }
    return points
  },

  // ---------------------------------------------------------------
  // Recurring transactions — all occurrence dates are 'YYYY-MM-DD' strings
  // computed with anchor math, so results are timezone-independent and
  // missed runs never shift future occurrences.
  // ---------------------------------------------------------------

  /** First occurrence on/after `fromDate` and after `lastGenerated`; null if none. */
  nextOccurrenceDate: (
    rule: RecurringTransaction,
    fromDate: string
  ): string | null => {
    if (!rule.active) return null
    if (!isDateString(rule.startDate)) return null
    if (rule.endDate && !isDateString(rule.endDate)) return null
    const farFuture = toDateString(
      (() => {
        const anchor = new Date()
        anchor.setFullYear(anchor.getFullYear() + 200)
        return anchor
      })()
    )
    const dates = FinanceCalculations.dueDates(rule, fromDate, farFuture)
    return dates.length > 0 ? dates[0] : null
  },

  /**
   * Occurrence dates `[dueFrom, today]` (inclusive), ascending, excluding
   * anything at/before `lastGenerated`, trimmed by `endDate`.
   * Empty array = nothing due. Always capped — never generates unbounded
   * backfill when a rule hasn't run in years.
   */
  dueDates: (
    rule: RecurringTransaction,
    dueFrom: string,
    today: string
  ): string[] => {
    if (!rule.active) return []
    if (!isDateString(rule.startDate)) return []
    if (rule.endDate && !isDateString(rule.endDate)) return []
    if (dueFrom > today) return []

    const parsed = FinanceCalculations.parseDateString(rule.startDate)
    if (!parsed) return []
    const [year, month, day] = parsed
    const windowEnd =
      rule.endDate && rule.endDate < today ? rule.endDate : today

    // Locate the first occurrence inside the due window with an exact binary
    // search over the period index (see findFirstPeriodAtOrAfter). Pure
    // arithmetic: no walking period by period, no per-frequency day-step
    // constants to drift, and correct across arbitrarily long gaps. Beyond the
    // generation cap we bail out rather than backfill unbounded history.
    const located = findFirstPeriodAtOrAfter(
      year,
      month,
      day,
      rule.frequency,
      dueFrom,
      MAX_LOCATE_PERIODS
    )
    if (located === null) return []
    let n = located
    let date = addPeriods(year, month, day, rule.frequency, n)
    // Collect the in-window occurrences. Bounded by EMITTED COUNT, not by
    // period index: `n` legitimately starts high for a rule that skipped years,
    // and capping the index here would silently drop its entire due window.
    const dates: string[] = []
    while (dates.length < MAX_GENERATE_PER_RULE && date <= windowEnd) {
      if (date >= dueFrom && date > (rule.lastGenerated ?? '')) {
        dates.push(date)
      }
      n++
      date = addPeriods(year, month, day, rule.frequency, n)
    }
    return dates
  },

  /**
   * Simulates EVERY rule across the FULL data set from each rule's own last
   * cursor to `today`. Creates zero/few/many transactions per rule; updates
   * each touched rule's cursor to the newest generated occurrence. Pure.
   */
  generateDueTransactions: (
    data: AppData,
    today: string
  ): {
    transactions: Transaction[]
    rules: RecurringTransaction[]
    createdCounts: Record<string, number>
  } => {
    const newTransactions: Transaction[] = []
    const updatedRules: RecurringTransaction[] = []
    const createdCounts: Record<string, number> = {}

    for (const rule of data.recurring) {
      if (!rule.active) {
        updatedRules.push(rule)
        continue
      }
      const dueFrom = rule.lastGenerated
        ? shiftDays(rule.lastGenerated, 1)
        : rule.startDate
      if (dueFrom === null || !isDateString(dueFrom)) {
        updatedRules.push(rule)
        continue
      }
      const dates = FinanceCalculations.dueDates(rule, dueFrom, today)
      if (dates.length === 0) {
        updatedRules.push(rule)
        continue
      }
      const nowIso = new Date().toISOString()
      for (const date of dates) {
        newTransactions.push({
          id: FinanceCalculations.recurringTransactionId(rule, date),
          type: rule.type,
          category: rule.category,
          description: rule.description,
          amount: rule.amount,
          date,
          createdAt: nowIso,
          recurringId: rule.id,
        })
      }
      createdCounts[rule.id] = dates.length
      updatedRules.push({ ...rule, lastGenerated: dates[dates.length - 1] })
    }

    return {
      transactions: newTransactions,
      rules: updatedRules,
      createdCounts,
    }
  },

  // ---------------------------------------------------------------
  // Recurring scheduling primitives (public for reuse and unit tests).
  // ---------------------------------------------------------------

  /** 'YYYY-MM-DD' shape check (values like 2026-13-99 pass; math rolls them). */
  isDateString: (value: string | null | undefined): boolean =>
    isDateString(value),

  /** 'YYYY-MM-DD' + n days; null for malformed input. */
  addDays: (dateString: string, days: number): string | null =>
    shiftDays(dateString, days),

  /** Whole-day difference (b - a); assumes valid 'YYYY-MM-DD' inputs. */
  daysBetween: (a: string, b: string): number => daysBetweenStrings(a, b),

  /** Parse into [year, month, day]; null for malformed input. */
  parseDateString: (dateString: string): [number, number, number] | null => {
    const match = MONTH_DAY_RE.exec(dateString)
    if (!match) return null
    return [Number(match[1]), Number(match[2]), Number(match[3])]
  },

  /** Local-timezone-safe Date → 'YYYY-MM-DD'. */
  toDateString: (date: Date): string => toDateString(date),

  /**
   * Stable id for a generated transaction — rerunning the generator on the
   * same state produces the same id, so double-application can never create
   * duplicates even if the cursor write is bypassed.
   */
  recurringTransactionId: (rule: RecurringTransaction, date: string): string =>
    `rec-${rule.id}-${date}`,

  getTotalIncome: (data: AppData): number => {
    return data.transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  },

  getTotalExpenses: (data: AppData): number => {
    return data.transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  },

  getSpendableBalance: (data: AppData): number => {
    const income = FinanceCalculations.getTotalIncome(data)
    const expenses = FinanceCalculations.getTotalExpenses(data)
    const fixedBills = data.settings.fixedBills
    return income - expenses - fixedBills
  },

  getTotalSavingsGoals: (data: AppData): number => {
    return data.goals.reduce((sum, goal) => sum + goal.currentAmount, 0)
  },

  getDaysUntilPayday: (payDayOfMonth: number): number => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    const currentDay = today.getDate()

    let payDay = new Date(currentYear, currentMonth, payDayOfMonth)

    if (currentDay > payDayOfMonth) {
      payDay = new Date(currentYear, currentMonth + 1, payDayOfMonth)
    }

    const diff = payDay.getTime() - today.getTime()
    // Math.max normalizes -0 (possible when payday is today) to 0.
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  },

  getPetsaDePeligroStatus: (spendableBalance: number, daysUntilPayday: number): {
    status: 'safe' | 'caution' | 'survival'
    dailyCap: number
    percentageUsed: number
  } => {
    const dailyCap = spendableBalance / Math.max(daysUntilPayday, 1)

    let status: 'safe' | 'caution' | 'survival' = 'safe'
    let percentageUsed = 0

    if (spendableBalance <= 0) {
      status = 'survival'
      percentageUsed = 100
    } else if (dailyCap < 500) {
      status = 'caution'
      percentageUsed = (spendableBalance / (1000 * Math.max(daysUntilPayday, 1))) * 100
    } else {
      status = 'safe'
      percentageUsed = (spendableBalance / (5000 * Math.max(daysUntilPayday, 1))) * 100
    }

    return {
      status,
      dailyCap: Math.max(0, dailyCap),
      percentageUsed: Math.min(100, percentageUsed),
    }
  },

  canAfford: (
    itemPrice: number,
    spendableBalance: number,
    daysUntilPayday: number
  ): {
    canAfford: boolean
    impact: number
    message: string
  } => {
    const currentDailyCap = spendableBalance / Math.max(daysUntilPayday, 1)
    const newBalance = spendableBalance - itemPrice
    const newDailyCap = newBalance / Math.max(daysUntilPayday, 1)
    const impactPercentage = ((currentDailyCap - newDailyCap) / currentDailyCap) * 100

    const canAfford = newBalance >= 0

    let message = ''
    if (canAfford) {
      if (impactPercentage < 10) {
        message = 'Kaya naman! Minimal lang ang impact sa budget.'
      } else if (impactPercentage < 30) {
        message = `Kaya naman, pero mababawasan ang daily budget mo by ${impactPercentage.toFixed(0)}%`
      } else {
        message = `Kaya naman, pero malaking impact. ${impactPercentage.toFixed(0)}% less per day.`
      }
    } else {
      message = `Hindi kaya, kulang ng ₱${Math.abs(newBalance).toFixed(0)}`
    }

    return {
      canAfford,
      impact: impactPercentage,
      message,
    }
  },

  getRecentTransactions: (data: AppData, limit: number = 5) => {
    return [...data.transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
  },

  getOverdueDebts: (data: AppData) => {
    const today = new Date()
    return data.debts.filter((debt) => {
      if (debt.status === 'paid') return false
      return new Date(debt.dueDate) < today
    })
  },

  getUpcomingDebts: (data: AppData, daysAhead: number = 7) => {
    const today = new Date()
    const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000)

    return data.debts.filter((debt) => {
      if (debt.status === 'paid') return false
      const debtDate = new Date(debt.dueDate)
      return debtDate >= today && debtDate <= futureDate
    })
  },

  calculateGoalProgress: (currentAmount: number, targetAmount: number): number => {
    if (targetAmount <= 0) return 0
    return Math.min(100, (currentAmount / targetAmount) * 100)
  },

  formatCurrency: (amount: number): string => {
    return `₱${amount.toLocaleString('en-PH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`
  },

  formatDate: (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  },
}
