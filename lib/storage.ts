'use client'

import {
  AppData,
  Transaction,
  Goal,
  Debt,
  BudgetSettings,
  RecurringTransaction,
  TransactionCategory,
} from './types'
import { FinanceCalculations } from './calculations'
import { decryptBackup, encryptBackup, isEncryptedBackup } from './backup'

const STORAGE_KEY = 'finance_tracker_data'
const WELCOME_SEEN_KEY = 'pisowise_welcome_seen'
/**
 * ISO timestamp of the last successful backup. Used only to nudge the user
 * ("you haven't backed up in a while") — never part of AppData itself.
 */
const LAST_BACKUP_KEY = 'pisowise_last_backup'

/**
 * Version of the stored data shape. Bump this whenever AppData changes and
 * add a migration case in migrateData() below.
 * v2: added schemaVersion
 * v3: added settings.categoryBudgets (missing key defaults to {})
 * v4: added recurring rules (missing key defaults to [])
 */
const SCHEMA_VERSION = 4

const defaultSettings: BudgetSettings = {
  monthlyIncome: 30000,
  fixedBills: 12000,
  payDay: 15,
  emergencyFundTarget: 50000,
  categoryBudgets: {},
}

/** Fresh, empty data for first-time users. No sample/demo data. */
const createEmptyData = (): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  transactions: [],
  goals: [],
  debts: [],
  recurring: [],
  settings: { ...defaultSettings, categoryBudgets: {} },
})

/** Demo recurring rules, only loaded via the explicit welcome action. */
const demoRecurring: RecurringTransaction[] = [
  {
    id: '1',
    type: 'income',
    category: 'salary',
    description: 'Monthly Salary',
    amount: 30000,
    frequency: 'monthly',
    // Two months before "today" (module load) → 3 occurrences waiting on load.
    startDate: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    endDate: null,
    lastGenerated: null,
    active: true,
    createdAt: new Date().toISOString(),
  },
]

/** Demo data, only loaded when the user explicitly asks for it. */
const demoTransactions: Transaction[] = [
  {
    id: '1',
    type: 'income',
    category: 'salary',
    description: 'Monthly Salary',
    amount: 30000,
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'expense',
    category: 'food',
    description: 'Grocery Shopping',
    amount: 2500,
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    type: 'expense',
    category: 'utilities',
    description: 'Electric Bill',
    amount: 1500,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    type: 'expense',
    category: 'transport',
    description: 'Gas',
    amount: 800,
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
]

const demoGoals: Goal[] = [
  {
    id: '1',
    name: 'Emergency Fund',
    emoji: '🆘',
    targetAmount: 50000,
    currentAmount: 18000,
    targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Boracay Trip',
    emoji: '🏝️',
    targetAmount: 15000,
    currentAmount: 8500,
    targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'New Laptop',
    emoji: '💻',
    targetAmount: 40000,
    currentAmount: 12000,
    targetDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  },
]

const demoDebts: Debt[] = [
  {
    id: '1',
    type: 'receivable',
    personName: 'Juan Dela Cruz',
    amount: 5000,
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'pending',
    description: 'Borrowed for movie night',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'payable',
    personName: 'Maria Santos',
    amount: 3000,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'pending',
    description: 'Birthday gift money',
    createdAt: new Date().toISOString(),
  },
]

const createDemoData = (): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  transactions: demoTransactions.map((t) => ({ ...t })),
  goals: demoGoals.map((g) => ({ ...g })),
  debts: demoDebts.map((d) => ({ ...d })),
  recurring: demoRecurring.map((r) => ({ ...r })),
  settings: {
    ...defaultSettings,
    categoryBudgets: {
      food: 8000,
      transport: 3000,
      utilities: 2500,
      entertainment: 2000,
    },
  },
})

/** Guard against corrupted or partially-shaped stored data. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeSettings = (raw: unknown): BudgetSettings => {
  if (!isRecord(raw)) {
    return { ...defaultSettings, categoryBudgets: {} }
  }
  type NumericSettingKey =
    | 'monthlyIncome'
    | 'fixedBills'
    | 'payDay'
    | 'emergencyFundTarget'
  const num = (key: NumericSettingKey): number => {
    const value = raw[key]
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : defaultSettings[key]
  }
  // categoryBudgets: keep only non-negative finite numeric entries.
  const categoryBudgets: BudgetSettings['categoryBudgets'] = {}
  const rawBudgets = raw.categoryBudgets
  if (isRecord(rawBudgets)) {
    for (const [key, value] of Object.entries(rawBudgets)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        categoryBudgets[key as TransactionCategory] = value
      }
    }
  }
  return {
    monthlyIncome: num('monthlyIncome'),
    fixedBills: num('fixedBills'),
    payDay: Math.min(31, Math.max(1, num('payDay'))),
    emergencyFundTarget: num('emergencyFundTarget'),
    categoryBudgets,
  }
}

/**
 * Validates and normalizes any parsed value into a complete AppData.
 * Never throws — malformed collections fall back to empty arrays.
 */
const normalizeData = (raw: unknown): AppData => {
  const empty = createEmptyData()
  if (!isRecord(raw)) return empty
  return {
    schemaVersion: SCHEMA_VERSION,
    transactions: Array.isArray(raw.transactions) ? (raw.transactions as Transaction[]) : [],
    goals: Array.isArray(raw.goals) ? (raw.goals as Goal[]) : [],
    debts: Array.isArray(raw.debts) ? (raw.debts as Debt[]) : [],
    recurring: Array.isArray(raw.recurring)
      ? (raw.recurring as RecurringTransaction[])
      : [],
    settings: normalizeSettings(raw.settings),
  }
}

/**
 * Migration hook for future schema changes. Data written before
 * schemaVersion existed (v1, legacy) already matches the current shape,
 * so it only needs to be stamped with the current version.
 */
const migrateData = (raw: unknown): AppData => {
  const normalized = normalizeData(raw)
  // Future versions: switch (normalized.schemaVersion) { case 1: ... }
  return { ...normalized, schemaVersion: SCHEMA_VERSION }
}

const readRaw = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private browsing, disabled cookies, etc.)
    return null
  }
}

/** Fired (same-tab) whenever data or the welcome flag changes. */
const DATA_EVENT = 'pisowise:changed'

const notify = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DATA_EVENT))
}

/**
 * Snapshot cache for useSyncExternalStore: getSnapshot() must return the
 * same object reference until the underlying stored string changes.
 */
let cachedRaw: string | null = null
let cachedData: AppData | null = null

const parseRaw = (raw: string | null): AppData => {
  if (!raw) return createEmptyData()
  try {
    return migrateData(JSON.parse(raw))
  } catch {
    // Corrupted JSON — fall back to empty data instead of crashing.
    return createEmptyData()
  }
}

const getSnapshot = (): AppData => {
  const raw = readRaw()
  if (cachedData === null || raw !== cachedRaw) {
    cachedRaw = raw
    cachedData = parseRaw(raw)
  }
  return cachedData
}

/** Stable server-side snapshot (prerendered HTML shows the empty state). */
const SERVER_SNAPSHOT: AppData = createEmptyData()

const subscribe = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  // Other tabs / storage-level changes.
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === STORAGE_KEY ||
      event.key === WELCOME_SEEN_KEY ||
      event.key === LAST_BACKUP_KEY ||
      event.key === null
    ) {
      callback()
    }
  }
  // Same-tab changes (storage events don't fire in the originating tab).
  window.addEventListener('storage', onStorage)
  window.addEventListener(DATA_EVENT, callback)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(DATA_EVENT, callback)
  }
}

export const StorageManager = {
  /** Current data snapshot (cached; re-parsed only when storage changes). */
  getSnapshot,

  /** Stable snapshot for SSR/prerender — never reads localStorage. */
  getServerSnapshot: (): AppData => SERVER_SNAPSHOT,

  /** Subscribe to same-tab and cross-tab storage changes. */
  subscribe,

  getData: (): AppData => {
    return getSnapshot()
  },

  setData: (data: AppData): void => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...data, schemaVersion: SCHEMA_VERSION })
      )
      notify()
    } catch (error) {
      // Most likely quota exceeded — surface it without crashing the app.
      console.error('Failed to save data to localStorage:', error)
    }
  },

  /** Replaces all data with a fresh empty state. */
  resetData: (): void => {
    StorageManager.setData(createEmptyData())
  },

  /** JSON export for user backups (download as file). */
  exportJson: (): string => {
    return JSON.stringify(StorageManager.getData(), null, 2)
  },

  /**
   * Encrypts the current data under `passphrase` and returns the `.pisowise`
   * envelope as JSON. The passphrase is never stored — losing it means losing
   * the backup. Rejects weak passphrases via BackupError('weak-passphrase').
   */
  exportVault: async (passphrase: string): Promise<string> => {
    const contents = await encryptBackup(StorageManager.getData(), passphrase)
    StorageManager.markBackupTaken()
    return contents
  },

  /**
   * Decrypts a `.pisowise` file and replaces all current data with it.
   * The decrypted payload still goes through the same validation/migration as
   * a plain import, so an old or partial backup can never break the app.
   */
  importVault: async (contents: string, passphrase: string): Promise<AppData> => {
    const decrypted = await decryptBackup(contents, passphrase)
    const migrated = migrateData(decrypted)
    StorageManager.setData(migrated)
    return migrated
  },

  /** True when `contents` looks like an encrypted `.pisowise` file. */
  isVaultFile: (contents: string): boolean => {
    try {
      return isEncryptedBackup(JSON.parse(contents))
    } catch {
      return false
    }
  },

  /** ISO timestamp of the last successful backup, or null if never. */
  getLastBackupAt: (): string | null => {
    if (typeof window === 'undefined') return null
    try {
      const value = window.localStorage.getItem(LAST_BACKUP_KEY)
      // Guard against a hand-edited or corrupt value reaching the UI.
      return value && !Number.isNaN(Date.parse(value)) ? value : null
    } catch {
      return null
    }
  },

  /** Records that a backup was just taken. */
  markBackupTaken: (): void => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
      notify()
    } catch {
      // Non-critical bookkeeping — ignore storage failures.
    }
  },

  /**
   * Imports a previously exported JSON backup.
   * Throws with a user-friendly message on invalid input.
   */
  importJson: (json: string): AppData => {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error('Invalid file: could not parse JSON.')
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.transactions)) {
      throw new Error('Invalid file: not a PisoWise backup.')
    }
    const migrated = migrateData(parsed)
    StorageManager.setData(migrated)
    return migrated
  },

  /** Loads the demo dataset (explicit user action from the welcome banner). */
  loadDemoData: (): AppData => {
    const demo = createDemoData()
    StorageManager.setData(demo)
    return demo
  },

  hasSeenWelcome: (): boolean => {
    if (typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem(WELCOME_SEEN_KEY) === 'true'
    } catch {
      return true
    }
  },

  markWelcomeSeen: (): void => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(WELCOME_SEEN_KEY, 'true')
      notify()
    } catch {
      // Non-critical flag — ignore storage failures.
    }
  },

  addTransaction: (transaction: Transaction): void => {
    const data = StorageManager.getData()
    data.transactions.push(transaction)
    StorageManager.setData(data)
  },

  updateTransaction: (id: string, transaction: Partial<Transaction>): void => {
    const data = StorageManager.getData()
    const index = data.transactions.findIndex((t) => t.id === id)
    if (index !== -1) {
      data.transactions[index] = { ...data.transactions[index], ...transaction }
      StorageManager.setData(data)
    }
  },

  deleteTransaction: (id: string): void => {
    const data = StorageManager.getData()
    data.transactions = data.transactions.filter((t) => t.id !== id)
    StorageManager.setData(data)
  },

  addGoal: (goal: Goal): void => {
    const data = StorageManager.getData()
    data.goals.push(goal)
    StorageManager.setData(data)
  },

  updateGoal: (id: string, goal: Partial<Goal>): void => {
    const data = StorageManager.getData()
    const index = data.goals.findIndex((g) => g.id === id)
    if (index !== -1) {
      data.goals[index] = { ...data.goals[index], ...goal }
      StorageManager.setData(data)
    }
  },

  deleteGoal: (id: string): void => {
    const data = StorageManager.getData()
    data.goals = data.goals.filter((g) => g.id !== id)
    StorageManager.setData(data)
  },

  addDebt: (debt: Debt): void => {
    const data = StorageManager.getData()
    data.debts.push(debt)
    StorageManager.setData(data)
  },

  updateDebt: (id: string, debt: Partial<Debt>): void => {
    const data = StorageManager.getData()
    const index = data.debts.findIndex((d) => d.id === id)
    if (index !== -1) {
      data.debts[index] = { ...data.debts[index], ...debt }
      StorageManager.setData(data)
    }
  },

  deleteDebt: (id: string): void => {
    const data = StorageManager.getData()
    data.debts = data.debts.filter((d) => d.id !== id)
    StorageManager.setData(data)
  },

  addRecurring: (rule: RecurringTransaction): void => {
    const data = StorageManager.getData()
    data.recurring.push(rule)
    StorageManager.setData(data)
  },

  updateRecurring: (id: string, rule: Partial<RecurringTransaction>): void => {
    const data = StorageManager.getData()
    const index = data.recurring.findIndex((r) => r.id === id)
    if (index !== -1) {
      data.recurring[index] = { ...data.recurring[index], ...rule }
      StorageManager.setData(data)
    }
  },

  deleteRecurring: (id: string): void => {
    const data = StorageManager.getData()
    data.recurring = data.recurring.filter((r) => r.id !== id)
    StorageManager.setData(data)
  },

  /**
   * Materializes due recurring transactions up to `today` ('YYYY-MM-DD').
   * Same-tab subscribers refresh automatically via the write path — this
   * function is intentionally a pure command: it mutates storage only when
   * something is actually due and returns the count created.
   */
  applyRecurring: (today: string): number => {
    const data = StorageManager.getData()
    const result = FinanceCalculations.generateDueTransactions(data, today)
    if (result.transactions.length === 0) return 0
    const existingIds = new Set(data.transactions.map((t) => t.id))
    const fresh = result.transactions.filter((t) => !existingIds.has(t.id))
    StorageManager.setData({
      ...data,
      transactions: [...data.transactions, ...fresh],
      recurring: result.rules,
    })
    return fresh.length
  },

  updateSettings: (settings: Partial<BudgetSettings>): void => {
    const data = StorageManager.getData()
    data.settings = { ...data.settings, ...settings }
    StorageManager.setData(data)
  },
}
