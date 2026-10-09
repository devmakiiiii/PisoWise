import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const STORAGE_KEY = 'finance_tracker_data'

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

type MockWindow = EventTarget & { localStorage: MemoryStorage }

const globalScope = globalThis as unknown as {
  window?: MockWindow
}

let win: MockWindow
let storage: typeof import('./storage')

beforeEach(async () => {
  // Fresh module registry per test so the snapshot cache resets.
  vi.resetModules()
  win = Object.assign(new EventTarget(), {
    localStorage: new MemoryStorage(),
  }) as MockWindow
  globalScope.window = win
  storage = await import('./storage')
})

afterEach(() => {
  delete globalScope.window
  vi.restoreAllMocks()
})

describe('getData', () => {
  it('returns empty data with the current schema version on first run', () => {
    const data = storage.StorageManager.getData()
    expect(data.transactions).toEqual([])
    expect(data.goals).toEqual([])
    expect(data.debts).toEqual([])
    expect(data.schemaVersion).toBe(4)
    expect(data.recurring).toEqual([])
    expect(data.settings.monthlyIncome).toBe(30000)
    expect(data.settings.payDay).toBe(15)
    expect(data.settings.categoryBudgets).toEqual({})
  })

  it('falls back to empty data when stored JSON is corrupted', () => {
    win.localStorage.setItem(STORAGE_KEY, '{definitely-not-json')
    expect(() => storage.StorageManager.getData()).not.toThrow()
    const data = storage.StorageManager.getData()
    expect(data.transactions).toEqual([])
    expect(data.schemaVersion).toBe(4)
  })

  it('normalizes partial or malformed stored data', () => {
    win.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        transactions: null,
        goals: 'oops',
        settings: { payDay: 99, monthlyIncome: 'nope' },
      })
    )
    const data = storage.StorageManager.getData()
    expect(data.transactions).toEqual([])
    expect(data.goals).toEqual([])
    expect(data.debts).toEqual([])
    expect(data.settings.payDay).toBe(31) // clamped
    expect(data.settings.monthlyIncome).toBe(30000) // invalid → default
    expect(data.settings.fixedBills).toBe(12000) // missing → default
    expect(data.settings.categoryBudgets).toEqual({}) // missing → default
  })

  it('keeps valid category budgets and drops invalid entries', () => {
    win.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        settings: {
          categoryBudgets: { food: 8000, transport: -5, utilities: 'lots', other: null },
        },
      })
    )
    const data = storage.StorageManager.getData()
    expect(data.settings.categoryBudgets).toEqual({ food: 8000 })
  })

  it('keeps valid legacy data (pre-schemaVersion) through migration', () => {
    win.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        transactions: [
          {
            id: 'a',
            type: 'income',
            category: 'salary',
            description: 'Old salary',
            amount: 12345,
            date: '2026-01-15',
            createdAt: '2026-01-15T00:00:00.000Z',
          },
        ],
        settings: { monthlyIncome: 20000, fixedBills: 5000, payDay: 30, emergencyFundTarget: 10000 },
      })
    )
    const data = storage.StorageManager.getData()
    expect(data.transactions).toHaveLength(1)
    expect(data.transactions[0].amount).toBe(12345)
    expect(data.settings.monthlyIncome).toBe(20000)
    expect(data.schemaVersion).toBe(4) // stamped on read
    expect(data.recurring).toEqual([]) // v3 data → default
    expect(data.settings.categoryBudgets).toEqual({}) // v2 data → default
  })
})

describe('setData', () => {
  it('persists data with the schema version and reads it back', () => {
    const before = storage.StorageManager.getData()
    before.settings.monthlyIncome = 45000
    storage.StorageManager.setData(before)

    const raw = win.localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).schemaVersion).toBe(4)
    expect(storage.StorageManager.getData().settings.monthlyIncome).toBe(45000)
  })

  it('does not throw when storage writes fail (quota exceeded)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    win.localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(() =>
      storage.StorageManager.setData(storage.StorageManager.getData())
    ).not.toThrow()
    expect(errorSpy).toHaveBeenCalled()
  })
})

describe('export / import', () => {
  it('round-trips data through exportJson → importJson', () => {
    const data = storage.StorageManager.getData()
    data.transactions.push({
      id: 't1',
      type: 'expense',
      category: 'food',
      description: 'Lunch',
      amount: 150,
      date: '2026-05-10',
      createdAt: '2026-05-10T00:00:00.000Z',
    })
    storage.StorageManager.setData(data)

    const json = storage.StorageManager.exportJson()
    storage.StorageManager.resetData()
    expect(storage.StorageManager.getData().transactions).toHaveLength(0)

    const imported = storage.StorageManager.importJson(json)
    expect(imported.transactions).toHaveLength(1)
    expect(imported.transactions[0].description).toBe('Lunch')
    expect(storage.StorageManager.getData().transactions).toHaveLength(1)
  })

  it('rejects invalid JSON with a friendly message', () => {
    expect(() => storage.StorageManager.importJson('not json at all')).toThrow(
      'could not parse JSON'
    )
  })

  it('rejects JSON that is not a PisoWise backup', () => {
    expect(() => storage.StorageManager.importJson('{"foo": 1}')).toThrow(
      'not a PisoWise backup'
    )
  })

  it('imports a legacy backup (no schemaVersion) and normalizes it', () => {
    const legacy = JSON.stringify({
      transactions: [
        {
          id: 'x',
          type: 'expense',
          category: 'food',
          description: 'Old expense',
          amount: 99,
          date: '2026-01-01',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      settings: { monthlyIncome: 11111, fixedBills: 2222, payDay: 20, emergencyFundTarget: 4444 },
    })
    const imported = storage.StorageManager.importJson(legacy)
    expect(imported.schemaVersion).toBe(4)
    expect(imported.settings.monthlyIncome).toBe(11111)
    expect(imported.goals).toEqual([])
    expect(imported.debts).toEqual([])
  })
})

describe('recurring rules', () => {
  it('round-trips rules through add / update / delete', () => {
    expect(storage.StorageManager.getData().recurring).toEqual([])

    storage.StorageManager.addRecurring({
      id: 'r1',
      type: 'expense',
      category: 'rent',
      description: 'Rent',
      amount: 8000,
      frequency: 'monthly',
      startDate: '2026-01-15',
      endDate: null,
      lastGenerated: null,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(storage.StorageManager.getData().recurring).toHaveLength(1)

    storage.StorageManager.updateRecurring('r1', { active: false })
    expect(storage.StorageManager.getData().recurring[0].active).toBe(false)

    storage.StorageManager.deleteRecurring('r1')
    expect(storage.StorageManager.getData().recurring).toEqual([])
  })

  it('applyRecurring materializes due transactions, cursors, and is idempotent', () => {
    storage.StorageManager.addRecurring({
      id: 'r1',
      type: 'expense',
      category: 'utilities',
      description: 'Electric Bill',
      amount: 1500,
      frequency: 'monthly',
      startDate: '2026-04-10',
      endDate: null,
      lastGenerated: null,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    const created = storage.StorageManager.applyRecurring('2026-06-15')
    expect(created).toBe(3)
    const after = storage.StorageManager.getData()
    expect(after.transactions.map((t) => t.date)).toEqual([
      '2026-04-10',
      '2026-05-10',
      '2026-06-10',
    ])
    expect(
      after.transactions.every((t) => t.recurringId === 'r1')
    ).toBe(true)
    expect(after.recurring[0].lastGenerated).toBe('2026-06-10')

    // Second run: pure no-op, no write, no duplicates.
    expect(storage.StorageManager.applyRecurring('2026-06-15')).toBe(0)
    expect(storage.StorageManager.getData().transactions).toHaveLength(3)
  })

  it('applyRecurring skips ids that already exist (double-apply safety)', () => {
    storage.StorageManager.addRecurring({
      id: 'r1',
      type: 'expense',
      category: 'rent',
      description: 'Rent',
      amount: 8000,
      frequency: 'monthly',
      startDate: '2026-05-01',
      endDate: null,
      lastGenerated: null,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(storage.StorageManager.applyRecurring('2026-05-31')).toBe(1)
    // Cursor write dropped (simulated); the same generated id must not duplicate.
    const data = storage.StorageManager.getData()
    storage.StorageManager.setData({
      ...data,
      recurring: [{ ...data.recurring[0], lastGenerated: null }],
    })
    expect(storage.StorageManager.applyRecurring('2026-05-31')).toBe(0)
    expect(storage.StorageManager.getData().transactions).toHaveLength(1)
  })

  it('applyRecurring ignores inactive and malformed rules', () => {
    storage.StorageManager.addRecurring({
      id: 'r1',
      type: 'expense',
      category: 'rent',
      description: 'Paused',
      amount: 8000,
      frequency: 'monthly',
      startDate: '2026-01-01',
      endDate: null,
      lastGenerated: null,
      active: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    storage.StorageManager.addRecurring({
      id: 'r2',
      type: 'expense',
      category: 'rent',
      description: 'Broken',
      amount: 8000,
      frequency: 'monthly',
      startDate: 'not-a-date',
      endDate: null,
      lastGenerated: null,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(storage.StorageManager.applyRecurring('2026-12-31')).toBe(0)
  })
})

describe('demo data and recurring', () => {
  it('loadDemoData only runs when explicitly called', () => {
    expect(storage.StorageManager.getData().transactions).toHaveLength(0)
    const demo = storage.StorageManager.loadDemoData()
    expect(demo.transactions).toHaveLength(4)
    expect(demo.goals).toHaveLength(3)
    expect(demo.debts).toHaveLength(2)
    expect(demo.recurring).toHaveLength(1)
    expect(storage.StorageManager.getData().recurring).toHaveLength(1)
  })
})

describe('demo data and welcome flag', () => {
  it('welcome flag starts unset and can be marked as seen', () => {
    expect(storage.StorageManager.hasSeenWelcome()).toBe(false)
    storage.StorageManager.markWelcomeSeen()
    expect(storage.StorageManager.hasSeenWelcome()).toBe(true)
  })
})

const PASSPHRASE = 'TamangBalita2026!'

const seedData = () => {
  storage.StorageManager.addTransaction({
    id: 't1',
    type: 'income',
    category: 'salary',
    description: 'Monthly Salary',
    amount: 30000,
    date: '2026-05-15',
    createdAt: '2026-05-15T00:00:00.000Z',
  })
  storage.StorageManager.addTransaction({
    id: 't2',
    type: 'expense',
    category: 'food',
    description: 'Jollibee family paneler',
    amount: 620,
    date: '2026-05-16',
    createdAt: '2026-05-16T00:00:00.000Z',
  })
}

describe('encrypted vault export and import', () => {
  it('exports an encrypted envelope that carries no readable data', async () => {
    seedData()
    const contents = await storage.StorageManager.exportVault(PASSPHRASE)

    expect(storage.StorageManager.isVaultFile(contents)).toBe(true)
    expect(contents).toContain('"format": "pisowise-backup"')
    expect(contents).not.toContain('Monthly Salary')
    expect(contents).not.toContain('30000')
  })

  it('refuses to export a weak passphrase', async () => {
    await expect(storage.StorageManager.exportVault('abc')).rejects.toThrow(/at least 8/i)
  })

  it('restores data exactly, including after a full reset', async () => {
    seedData()
    const before = storage.StorageManager.getData()
    const contents = await storage.StorageManager.exportVault(PASSPHRASE)

    storage.StorageManager.resetData()
    expect(storage.StorageManager.getData().transactions).toEqual([])

    const restored = await storage.StorageManager.importVault(contents, PASSPHRASE)
    expect(restored.transactions).toEqual(before.transactions)
    expect(storage.StorageManager.getData().transactions).toEqual(before.transactions)
  })

  it('restores goals, debts, and settings too', async () => {
    storage.StorageManager.addGoal({
      id: 'g1',
      name: 'Emergency Fund',
      emoji: '🆘',
      targetAmount: 50000,
      currentAmount: 18000,
      targetDate: '2026-11-01',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    storage.StorageManager.addDebt({
      id: 'd1',
      type: 'payable',
      personName: 'Maria Santos',
      amount: 3000,
      dueDate: '2026-06-01',
      status: 'pending',
      description: 'Birthday gift money',
      createdAt: '2026-05-01T00:00:00.000Z',
    })
    storage.StorageManager.updateSettings({ monthlyIncome: 42000 })
    const before = storage.StorageManager.getData()

    const contents = await storage.StorageManager.exportVault(PASSPHRASE)
    storage.StorageManager.resetData()
    const restored = await storage.StorageManager.importVault(contents, PASSPHRASE)

    expect(restored.goals).toEqual(before.goals)
    expect(restored.debts).toEqual(before.debts)
    expect(restored.settings.monthlyIncome).toBe(42000)
  })

  it('rejects the wrong passphrase and leaves existing data untouched', async () => {
    seedData()
    const before = storage.StorageManager.getData()
    const contents = await storage.StorageManager.exportVault(PASSPHRASE)

    await expect(
      storage.StorageManager.importVault(contents, 'MaliAngPassphrase1')
    ).rejects.toThrow(/wrong passphrase/i)

    // A failed restore must never destroy what the user already has.
    expect(storage.StorageManager.getData().transactions).toEqual(before.transactions)
  })

  it('rejects a tampered backup without changing data', async () => {
    seedData()
    const before = storage.StorageManager.getData()
    const envelope = JSON.parse(await storage.StorageManager.exportVault(PASSPHRASE))

    // Flip a bit inside the sealed ciphertext — AES-GCM must reject this.
    // (The plaintext `counts` field is a preview only and is not sealed.)
    const sealed = new Uint8Array(
      atob(envelope.ciphertext).split('').map((c) => c.charCodeAt(0))
    )
    sealed[0] ^= 0xff
    envelope.ciphertext = btoa(String.fromCharCode(...sealed))

    await expect(
      storage.StorageManager.importVault(JSON.stringify(envelope), PASSPHRASE)
    ).rejects.toThrow(/wrong passphrase|modified/i)
    expect(storage.StorageManager.getData().transactions).toEqual(before.transactions)
  })

  it('accepts a file whose plaintext preview counts were edited', async () => {
    // Preview counts are informational; a wrong count must not break a restore.
    seedData()
    const envelope = JSON.parse(await storage.StorageManager.exportVault(PASSPHRASE))
    envelope.counts.transactions = 999

    const restored = await storage.StorageManager.importVault(
      JSON.stringify(envelope),
      PASSPHRASE
    )
    expect(restored.transactions).toHaveLength(2)
  })

  it('rejects a plain unencrypted JSON export as a vault file', async () => {
    await expect(
      storage.StorageManager.importVault(storage.StorageManager.exportJson(), PASSPHRASE)
    ).rejects.toThrow(/isn't a PisoWise encrypted backup/i)
  })

  it('detects vault files and rejects non-JSON input', () => {
    expect(storage.StorageManager.isVaultFile('garbage')).toBe(false)
    expect(storage.StorageManager.isVaultFile(JSON.stringify([]))).toBe(false)
    expect(storage.StorageManager.isVaultFile(storage.StorageManager.exportJson())).toBe(false)
  })

  it('survives an export/import round-trip of an empty dataset', async () => {
    const empty = storage.StorageManager.getData()
    const contents = await storage.StorageManager.exportVault(PASSPHRASE)
    const restored = await storage.StorageManager.importVault(contents, PASSPHRASE)
    expect(restored.transactions).toEqual(empty.transactions)
    expect(restored.goals).toEqual([])
    expect(restored.debts).toEqual([])
  })
})

describe('last backup tracking', () => {
  it('starts unset', () => {
    expect(storage.StorageManager.getLastBackupAt()).toBeNull()
  })

  it('records a timestamp after a successful export', async () => {
    seedData()
    expect(storage.StorageManager.getLastBackupAt()).toBeNull()
    await storage.StorageManager.exportVault(PASSPHRASE)

    const stamp = storage.StorageManager.getLastBackupAt()
    expect(stamp).not.toBeNull()
    expect(Number.isNaN(Date.parse(stamp as string))).toBe(false)
  })

  it('does not record a timestamp when the export is refused', async () => {
    await expect(storage.StorageManager.exportVault('weak')).rejects.toThrow()
    expect(storage.StorageManager.getLastBackupAt()).toBeNull()
  })

  it('ignores a corrupt stored timestamp instead of surfacing it', () => {
    win.localStorage.setItem('pisowise_last_backup', 'not-a-date')
    expect(storage.StorageManager.getLastBackupAt()).toBeNull()
  })

  it('notifies subscribers so the reminder updates live', async () => {
    const listener = vi.fn()
    storage.StorageManager.subscribe(listener)
    seedData()
    listener.mockClear()

    await storage.StorageManager.exportVault(PASSPHRASE)
    expect(listener).toHaveBeenCalled()
  })
})

describe('subscription and snapshot caching', () => {
  it('getSnapshot returns a stable reference until storage changes', () => {
    const first = storage.StorageManager.getSnapshot()
    expect(storage.StorageManager.getSnapshot()).toBe(first)

    const next = storage.StorageManager.getData()
    next.settings.fixedBills = 9999
    storage.StorageManager.setData(next)

    const after = storage.StorageManager.getSnapshot()
    expect(after).not.toBe(first)
    expect(after.settings.fixedBills).toBe(9999)
  })

  it('notifies subscribers on same-tab writes', () => {
    const listener = vi.fn()
    const unsubscribe = storage.StorageManager.subscribe(listener)

    const data = storage.StorageManager.getData()
    data.transactions.push({
      id: 'new',
      type: 'income',
      category: 'bonus',
      description: 'Bonus',
      amount: 5000,
      date: '2026-05-10',
      createdAt: '2026-05-10T00:00:00.000Z',
    })
    storage.StorageManager.setData(data)

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()

    storage.StorageManager.resetData()
    expect(listener).toHaveBeenCalledTimes(1) // unsubscribed — no more calls
  })

  it('exposes a stable server snapshot for prerendering', () => {
    const a = storage.StorageManager.getServerSnapshot()
    const b = storage.StorageManager.getServerSnapshot()
    expect(a).toBe(b) // must be identical for useSyncExternalStore
    expect(a.transactions).toEqual([])
  })
})
