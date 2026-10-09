import { describe, it, expect } from 'vitest'
import {
  BackupError,
  assessPassphrase,
  backupFilename,
  base64ToBytes,
  bytesToBase64,
  countData,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  readBackupMetadata,
  PBKDF2_ITERATIONS,
  type BackupErrorKind,
} from './backup'
import type { AppData } from './types'

const PASSPHRASE = 'TamangBalita2026!'

const makeData = (): AppData => ({
  schemaVersion: 4,
  transactions: [
    {
      id: 't1',
      type: 'income',
      category: 'salary',
      description: 'Monthly Salary',
      amount: 30000,
      date: '2026-05-15',
      createdAt: '2026-05-15T00:00:00.000Z',
    },
    {
      id: 't2',
      type: 'expense',
      category: 'food',
      description: 'Jollibee family paneler',
      amount: 620,
      date: '2026-05-16',
      createdAt: '2026-05-16T00:00:00.000Z',
    },
  ],
  goals: [
    {
      id: 'g1',
      name: 'Emergency Fund',
      emoji: '🆘',
      targetAmount: 50000,
      currentAmount: 18000,
      targetDate: '2026-11-01',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  debts: [
    {
      id: 'd1',
      type: 'payable',
      personName: 'Maria Santos',
      amount: 3000,
      dueDate: '2026-06-01',
      status: 'pending',
      description: 'Birthday gift money',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
  ],
  recurring: [],
  settings: {
    monthlyIncome: 30000,
    fixedBills: 12000,
    payDay: 15,
    emergencyFundTarget: 50000,
    categoryBudgets: { food: 8000 },
  },
})

/**
 * Runs `run`, asserts it rejected with a BackupError of the expected kind, and
 * returns that error so callers can check the human-facing message.
 */
const expectBackupError = async (
  run: () => Promise<unknown>,
  kind: BackupErrorKind
): Promise<BackupError> => {
  try {
    await run()
  } catch (error) {
    expect(error).toBeInstanceOf(BackupError)
    expect((error as BackupError).kind).toBe(kind)
    expect((error as BackupError).message.length).toBeGreaterThan(0)
    return error as BackupError
  }
  throw new Error(`Expected a BackupError of kind '${kind}' but the call succeeded`)
}

describe('base64 helpers', () => {
  it('round-trips arbitrary byte sequences', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 7, 16, 255, 256, 1000]) {
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) bytes[i] = (i * 37 + 11) % 256
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes))
    }
  })

  it('matches known base64 vectors', () => {
    expect(bytesToBase64(new TextEncoder().encode('Mabuhay!'))).toBe('TWFidWhheSE=')
    expect(new TextDecoder().decode(base64ToBytes('TWFidWhheSE='))).toBe('Mabuhay!')
    expect(bytesToBase64(new Uint8Array([0]))).toBe('AA==')
    expect(bytesToBase64(new Uint8Array([0, 0]))).toBe('AAA=')
    expect(bytesToBase64(new Uint8Array([0, 0, 0]))).toBe('AAAA')
    expect(bytesToBase64(new TextEncoder().encode('any carnal pleasure'))).toBe(
      'YW55IGNhcm5hbCBwbGVhc3VyZQ=='
    )
  })

  it('rejects malformed base64 with a friendly error', () => {
    for (const bad of ['A', 'AB', 'ABC', 'A===', '=AAA', 'AB=C', 'A@==', '!!!!']) {
      expect(() => base64ToBytes(bad)).toThrowError(/damaged/i)
    }
  })

  it('treats the empty string as empty bytes so the codec stays symmetric', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('')
    expect(Array.from(base64ToBytes(''))).toEqual([])
  })
})

describe('assessPassphrase', () => {
  it('rejects passphrases below the minimum length', () => {
    const result = assessPassphrase('short1!')
    expect(result.score).toBe(0)
    expect(result.acceptable).toBe(false)
    expect(result.label).toMatch(/at least 8/i)
  })

  it('rejects repetitive passphrases that have length but no entropy', () => {
    expect(assessPassphrase('aaaaaaaa').acceptable).toBe(false)
    expect(assessPassphrase('ababababab').acceptable).toBe(false)
    expect(assessPassphrase('aaaaaaaaaaaaaaaa').label).toMatch(/repetitive/i)
  })

  it('rates longer, more varied passphrases higher', () => {
    expect(assessPassphrase('kaldereta1').score).toBe(1)
    expect(assessPassphrase('kaldereta2026').score).toBe(2)
    expect(assessPassphrase('Kaldereta2026!').score).toBe(2)
    expect(assessPassphrase('Kaldereta2026!Puso').score).toBe(3)
  })

  it('accepts anything non-repetitive at or above the minimum length', () => {
    expect(assessPassphrase('kaldereta1').acceptable).toBe(true)
    expect(assessPassphrase('Kaldereta2026!Puso').acceptable).toBe(true)
  })
})

describe('isEncryptedBackup', () => {
  it('recognises an encrypted envelope', () => {
    expect(
      isEncryptedBackup({ format: 'pisowise-backup', salt: 'a', iv: 'b', ciphertext: 'c' })
    ).toBe(true)
  })

  it('rejects plain data, legacy JSON backups, and non-objects', () => {
    expect(isEncryptedBackup(makeData())).toBe(false)
    expect(isEncryptedBackup(null)).toBe(false)
    expect(isEncryptedBackup(undefined)).toBe(false)
    expect(isEncryptedBackup('pisowise-backup')).toBe(false)
    expect(isEncryptedBackup([1, 2, 3])).toBe(false)
    expect(isEncryptedBackup({ format: 'pisowise-backup' })).toBe(false)
    expect(isEncryptedBackup({ format: 'other', salt: 'a', iv: 'b', ciphertext: 'c' })).toBe(false)
  })
})

describe('countData', () => {
  it('counts each collection and defaults missing ones to zero', () => {
    expect(countData(makeData())).toEqual({
      transactions: 2,
      goals: 1,
      debts: 1,
      recurring: 0,
    })
    expect(countData({} as AppData)).toEqual({
      transactions: 0,
      goals: 0,
      debts: 0,
      recurring: 0,
    })
  })
})

describe('encryptBackup', () => {
  it('produces a versioned envelope with the tuned KDF parameters', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    expect(envelope.format).toBe('pisowise-backup')
    expect(envelope.version).toBe(1)
    expect(envelope.kdf).toEqual({
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
    })
    expect(typeof envelope.salt).toBe('string')
    expect(typeof envelope.iv).toBe('string')
    expect(Number.isNaN(Date.parse(envelope.createdAt))).toBe(false)
  })

  it('stores safe preview counts alongside the ciphertext', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    expect(envelope.counts).toEqual({ transactions: 2, goals: 1, debts: 1, recurring: 0 })
  })

  it('never leaks plaintext data into the envelope', async () => {
    const contents = await encryptBackup(makeData(), PASSPHRASE)
    expect(contents).not.toContain('Maria Santos')
    expect(contents).not.toContain('30000')
    expect(contents).not.toContain('salary')
  })

  it('uses a fresh salt and nonce for every backup', async () => {
    const a = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    const b = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    expect(a.salt).not.toBe(b.salt)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('refuses weak passphrases', async () => {
    await expectBackupError(() => encryptBackup(makeData(), 'abc'), 'weak-passphrase')
    await expectBackupError(() => encryptBackup(makeData(), ''), 'weak-passphrase')
  })
})

describe('decryptBackup round-trip', () => {
  it('restores data exactly as it was sealed', async () => {
    const original = makeData()
    const restored = await decryptBackup(await encryptBackup(original, PASSPHRASE), PASSPHRASE)
    expect(restored).toEqual(original)
  })

  it('preserves unicode, emoji, peso signs, and Tagalog text', async () => {
    const data = makeData()
    data.transactions[0].description = '₱1,500 — sarap! 🇵🇭 "utang" <pa> & \n tabs\t'
    data.goals[0].name = 'Pangarap ni Iná 🏝️'
    data.debts[0].personName = 'Ñoño José'
    const restored = await decryptBackup(await encryptBackup(data, PASSPHRASE), PASSPHRASE)
    expect(restored.transactions[0].description).toBe(data.transactions[0].description)
    expect(restored.goals[0].name).toBe(data.goals[0].name)
    expect(restored.debts[0].personName).toBe('Ñoño José')
  })

  it('round-trips an empty dataset', async () => {
    const empty: AppData = {
      schemaVersion: 4,
      transactions: [],
      goals: [],
      debts: [],
      recurring: [],
      settings: makeData().settings,
    }
    const restored = await decryptBackup(await encryptBackup(empty, PASSPHRASE), PASSPHRASE)
    expect(restored).toEqual(empty)
  })

  it('round-trips a large dataset', async () => {
    const data = makeData()
    data.transactions = Array.from({ length: 500 }, (_, i) => ({
      id: `t${i}`,
      type: 'expense',
      category: 'food',
      description: `Transaction ${i} — kape`,
      amount: 100 + i,
      date: '2026-05-01',
      createdAt: '2026-05-01T00:00:00.000Z',
    }))
    const restored = await decryptBackup(await encryptBackup(data, PASSPHRASE), PASSPHRASE)
    expect(restored.transactions).toHaveLength(500)
    expect(restored.transactions[499]).toEqual(data.transactions[499])
  })
})

describe('decryptBackup failures', () => {
  it('rejects the wrong passphrase', async () => {
    const contents = await encryptBackup(makeData(), PASSPHRASE)
    const error = await expectBackupError(
      () => decryptBackup(contents, 'MaliAngPassphrase1'),
      'wrong-passphrase'
    )
    expect(error.message).toMatch(/wrong passphrase/i)
  })

  it('rejects a passphrase that differs only by case', async () => {
    const contents = await encryptBackup(makeData(), PASSPHRASE)
    await expectBackupError(
      () => decryptBackup(contents, PASSPHRASE.toLowerCase()),
      'wrong-passphrase'
    )
  })

  it('rejects an empty passphrase on restore', async () => {
    const contents = await encryptBackup(makeData(), PASSPHRASE)
    await expectBackupError(() => decryptBackup(contents, ''), 'wrong-passphrase')
  })

  it('detects tampered ciphertext via the GCM auth tag', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    const bytes = base64ToBytes(envelope.ciphertext)
    bytes[0] ^= 0xff // flip bits in the first byte
    envelope.ciphertext = bytesToBase64(bytes)
    await expectBackupError(
      () => decryptBackup(JSON.stringify(envelope), PASSPHRASE),
      'wrong-passphrase'
    )
  })

  it('detects a swapped salt or nonce', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    envelope.salt = bytesToBase64(new Uint8Array(16).fill(7))
    await expectBackupError(
      () => decryptBackup(JSON.stringify(envelope), PASSPHRASE),
      'wrong-passphrase'
    )

    const other = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    other.iv = bytesToBase64(new Uint8Array(12).fill(3))
    await expectBackupError(
      () => decryptBackup(JSON.stringify(other), PASSPHRASE),
      'wrong-passphrase'
    )
  })

  it('detects a truncated file', async () => {
    const contents = await encryptBackup(makeData(), PASSPHRASE)
    await expectBackupError(
      () => decryptBackup(contents.slice(0, Math.floor(contents.length / 2)), PASSPHRASE),
      'corrupt'
    )
  })

  it('rejects non-JSON input', async () => {
    await expectBackupError(() => decryptBackup('not json at all', PASSPHRASE), 'corrupt')
    await expectBackupError(() => decryptBackup('', PASSPHRASE), 'corrupt')
  })

  it('rejects a plain (unencrypted) legacy JSON backup', async () => {
    await expectBackupError(
      () => decryptBackup(JSON.stringify(makeData()), PASSPHRASE),
      'not-a-backup'
    )
  })

  it('rejects envelopes from a newer app version', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    envelope.version = 99
    await expectBackupError(
      () => decryptBackup(JSON.stringify(envelope), PASSPHRASE),
      'unsupported-version'
    )
  })

  it('rejects envelopes with a missing or non-integer version', async () => {
    const missing = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    delete missing.version
    await expectBackupError(
      () => decryptBackup(JSON.stringify(missing), PASSPHRASE),
      'corrupt'
    )

    const fractional = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    fractional.version = 1.5
    await expectBackupError(
      () => decryptBackup(JSON.stringify(fractional), PASSPHRASE),
      'corrupt'
    )
  })

  it('rejects a weakened KDF cost so a file cannot silently downgrade security', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    envelope.kdf.iterations = 1
    await expectBackupError(
      () => decryptBackup(JSON.stringify(envelope), PASSPHRASE),
      'corrupt'
    )
  })

  it('rejects an absurd KDF cost that would hang the tab', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    envelope.kdf.iterations = 999_999_999
    await expectBackupError(
      () => decryptBackup(JSON.stringify(envelope), PASSPHRASE),
      'corrupt'
    )
  })

  it('rejects a mismatched KDF algorithm name', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    envelope.kdf.hash = 'MD5'
    await expectBackupError(
      () => decryptBackup(JSON.stringify(envelope), PASSPHRASE),
      'corrupt'
    )
  })

  it('rejects invalid base64 in the envelope fields as corruption, not a bad passphrase', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    envelope.ciphertext = 'not!valid!base64'
    await expectBackupError(
      () => decryptBackup(JSON.stringify(envelope), PASSPHRASE),
      'corrupt'
    )
  })

  it('rejects envelope fields of the wrong decoded length', async () => {
    const wrongSalt = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    wrongSalt.salt = bytesToBase64(new Uint8Array(8)) // must be 16 bytes
    await expectBackupError(
      () => decryptBackup(JSON.stringify(wrongSalt), PASSPHRASE),
      'corrupt'
    )

    const wrongIv = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    wrongIv.iv = bytesToBase64(new Uint8Array(8)) // must be 12 bytes
    await expectBackupError(
      () => decryptBackup(JSON.stringify(wrongIv), PASSPHRASE),
      'corrupt'
    )

    const emptySalt = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    emptySalt.salt = ''
    await expectBackupError(
      () => decryptBackup(JSON.stringify(emptySalt), PASSPHRASE),
      'corrupt'
    )
  })

  it('rejects a ciphertext too short to hold the GCM auth tag', async () => {
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    envelope.ciphertext = bytesToBase64(new Uint8Array(8))
    await expectBackupError(
      () => decryptBackup(JSON.stringify(envelope), PASSPHRASE),
      'corrupt'
    )
  })

  it('rejects a non-string byte field as unrecognised rather than readable', async () => {
    // A non-string `iv` fails the structural envelope check, so this is
    // reported as "not a backup" — the honest answer for a garbled file.
    const envelope = JSON.parse(await encryptBackup(makeData(), PASSPHRASE))
    envelope.iv = 12345
    await expectBackupError(
      () => decryptBackup(JSON.stringify(envelope), PASSPHRASE),
      'not-a-backup'
    )
  })
})

describe('readBackupMetadata', () => {
  it('reads preview counts without needing the passphrase', async () => {
    const metadata = readBackupMetadata(await encryptBackup(makeData(), PASSPHRASE))
    expect(metadata?.counts).toEqual({ transactions: 2, goals: 1, debts: 1, recurring: 0 })
    expect(Number.isNaN(Date.parse(metadata?.createdAt ?? ''))).toBe(false)
  })

  it('defaults missing counts and timestamps', () => {
    const metadata = readBackupMetadata(
      JSON.stringify({ format: 'pisowise-backup', salt: 'a', iv: 'b', ciphertext: 'c' })
    )
    expect(metadata?.counts).toEqual({
      transactions: 0,
      goals: 0,
      debts: 0,
      recurring: 0,
    })
    expect(metadata?.createdAt).toBe(new Date(0).toISOString())
  })

  it('ignores nonsense count values instead of trusting them', () => {
    const metadata = readBackupMetadata(
      JSON.stringify({
        format: 'pisowise-backup',
        salt: 'a',
        iv: 'b',
        ciphertext: 'c',
        counts: { transactions: 'many', goals: -3, debts: 2.7, recurring: null },
      })
    )
    expect(metadata?.counts).toEqual({
      transactions: 0,
      goals: 0,
      debts: 2,
      recurring: 0,
    })
  })

  it('returns null for anything that is not an encrypted backup', () => {
    expect(readBackupMetadata('garbage')).toBeNull()
    expect(readBackupMetadata('')).toBeNull()
    expect(readBackupMetadata(JSON.stringify(makeData()))).toBeNull()
  })
})

describe('backupFilename', () => {
  it('builds a dated .pisowise filename', () => {
    expect(backupFilename(new Date('2026-10-09T08:00:00.000Z'))).toBe(
      'pisowise-backup-2026-10-09.pisowise'
    )
  })
})
