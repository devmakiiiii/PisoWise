/**
 * Encrypted backups — PisoWise's answer to "no account, but please don't let me
 * lose my data".
 *
 * A backup file (`.pisowise`) is a small JSON envelope. The user's passphrase is
 * stretched with PBKDF2-SHA256 into an AES-256-GCM key, and the entire AppData
 * blob is sealed under it. Only ciphertext ever leaves the device, so the file
 * can safely live in Google Drive, an email attachment, or a flash drive without
 * exposing anyone's salary, utang, or spending habits to whoever holds it.
 *
 * There is still no server, no account, and no PII — the passphrase is the only
 * key and it is never stored anywhere. That trade-off is real: forget the
 * passphrase and the backup is unrecoverable. The UI says so out loud.
 *
 * Deliberately dependency-free and DOM-free so it runs identically in the
 * browser, in Node (tests), and anywhere WebCrypto is available.
 */

import type { AppData } from './types'

/** Discriminates every failure mode the UI needs to explain to a human. */
export type BackupErrorKind =
  | 'crypto-unavailable'
  | 'weak-passphrase'
  | 'corrupt'
  | 'unsupported-version'
  | 'wrong-passphrase'
  | 'not-a-backup'

export class BackupError extends Error {
  readonly kind: BackupErrorKind

  constructor(kind: BackupErrorKind, message: string) {
    super(message)
    this.name = 'BackupError'
    this.kind = kind
  }
}

/** Envelope format tag — lets us recognise our own files years from now. */
export const BACKUP_FORMAT = 'pisowise-backup'

/** Current envelope version. Bump only for breaking changes to the envelope. */
export const BACKUP_VERSION = 1

/** Cost parameter this build was tuned for. */
export const PBKDF2_ITERATIONS = 310_000

/**
 * Iterations are stored in the envelope so we can raise the cost later without
 * breaking existing files. On read we reject absurdly low or high values: low
 * would silently weaken a user's backup, high would hang the tab.
 */
const MIN_ITERATIONS = 100_000
const MAX_ITERATIONS = 20_000_000

/** Below this we refuse to create a backup at all. */
export const MIN_PASSPHRASE_LENGTH = 8

const SALT_BYTES = 16
const IV_BYTES = 12 // 96-bit nonce, the standard size for AES-GCM
const KEY_BITS = 256
/** AES-GCM authentication tag length appended to every ciphertext. */
const GCM_TAG_BYTES = 16

/** Non-sensitive preview data, readable without the passphrase. */
export interface BackupCounts {
  transactions: number
  goals: number
  debts: number
  recurring: number
}

export interface BackupMetadata {
  createdAt: string
  counts: BackupCounts
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT
  version: number
  createdAt: string
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number }
  /** base64 — random per backup, never derived from the passphrase. */
  salt: string
  /** base64 — random per backup. */
  iv: string
  /** base64 — AES-256-GCM ciphertext (auth tag included). */
  ciphertext: string
  counts: BackupCounts
}

export interface PassphraseStrength {
  /** 0 = unusable, 1 = weak, 2 = good, 3 = strong. */
  score: 0 | 1 | 2 | 3
  label: string
  /** False blocks backup creation — the passphrase is too easy to guess. */
  acceptable: boolean
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Bytes → standard base64 with `=` padding (hand-rolled: no `btoa` needed). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]

    out += BASE64_ALPHABET[b0 >> 2]
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)]
    out += b1 === undefined ? '=' : BASE64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)]
    out += b2 === undefined ? '=' : BASE64_ALPHABET[b2 & 0x3f]
  }
  return out
}

/**
 * base64 → bytes. Symmetric with `bytesToBase64` (empty string in, empty bytes
 * out) so it is safe to use as a general codec. Throws a friendly BackupError on
 * anything malformed.
 *
 * Callers that must reject missing fields should validate the decoded length
 * themselves — see `assertByteField`.
 */
export function base64ToBytes(value: string): Uint8Array {
  const corrupt = () =>
    new BackupError('corrupt', "This backup file is damaged and can't be read.")

  if (value.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(value)) {
    throw corrupt()
  }
  if (value.length === 0) return new Uint8Array(0)

  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  const firstPad = value.indexOf('=')
  // Padding may only ever be the final run of characters.
  if (firstPad !== -1 && firstPad !== value.length - padding) throw corrupt()

  const body = padding ? value.slice(0, -padding) : value
  const bytes = new Uint8Array((value.length / 4) * 3 - padding)

  const lookup = new Int16Array(128).fill(-1)
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    lookup[BASE64_ALPHABET.charCodeAt(i)] = i
  }

  let offset = 0
  for (let i = 0; i < body.length; i += 4) {
    const c0 = lookup[body.charCodeAt(i)]
    const c1 = lookup[body.charCodeAt(i + 1)]
    const c2 = i + 2 < body.length ? lookup[body.charCodeAt(i + 2)] : 0
    const c3 = i + 3 < body.length ? lookup[body.charCodeAt(i + 3)] : 0
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) throw corrupt()

    bytes[offset++] = (c0 << 2) | (c1 >> 4)
    if (offset < bytes.length) bytes[offset++] = ((c1 & 0x0f) << 4) | (c2 >> 2)
    if (offset < bytes.length) bytes[offset++] = ((c2 & 0x03) << 6) | c3
  }

  return bytes
}

const encodeText = (text: string): Uint8Array => new TextEncoder().encode(text)

const decodeText = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const cryptoUnavailable = () =>
  new BackupError(
    'crypto-unavailable',
    'Encryption needs a secure connection (https://) or a newer browser.'
  )

/** WebCrypto only exists in secure contexts (https/localhost). Fail clearly. */
const getSubtle = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw cryptoUnavailable()
  return subtle
}

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length)
  const webcrypto = globalThis.crypto
  if (!webcrypto?.getRandomValues) throw cryptoUnavailable()
  webcrypto.getRandomValues(bytes)
  return bytes
}

const deriveKey = async (
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> => {
  const subtle = getSubtle()
  const material = await subtle.importKey(
    'raw',
    encodeText(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  )
}

const countOf = (value: unknown): number => (Array.isArray(value) ? value.length : 0)

/** Non-sensitive counts so the restore screen can preview a file safely. */
export function countData(data: AppData): BackupCounts {
  return {
    transactions: countOf(data.transactions),
    goals: countOf(data.goals),
    debts: countOf(data.debts),
    recurring: countOf(data.recurring),
  }
}

/**
 * Rough, deliberately local passphrase check. It cannot measure true entropy —
 * but it can stop "password" and "12345678", which is the failure mode that
 * matters most here.
 */
export function assessPassphrase(passphrase: string): PassphraseStrength {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return {
      score: 0,
      label: `Too short — use at least ${MIN_PASSPHRASE_LENGTH} characters`,
      acceptable: false,
    }
  }

  // A passphrase made of one or two repeated characters has length but no
  // real entropy, so it never counts as acceptable.
  if (new Set(passphrase).size <= 2) {
    return { score: 1, label: 'Too repetitive — mix it up', acceptable: false }
  }

  const classes =
    Number(/[a-z]/.test(passphrase)) +
    Number(/[A-Z]/.test(passphrase)) +
    Number(/[0-9]/.test(passphrase)) +
    Number(/[^A-Za-z0-9]/.test(passphrase))

  if (passphrase.length >= 16 && classes >= 3) {
    return { score: 3, label: 'Strong passphrase', acceptable: true }
  }
  if (passphrase.length >= 12 && classes >= 2) {
    return { score: 2, label: 'Good passphrase', acceptable: true }
  }
  return {
    score: 1,
    label: 'Weak — 12+ characters with mixed types is better',
    acceptable: true,
  }
}

/** Structural check only — tells us whether to ask for a passphrase at all. */
export function isEncryptedBackup(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<BackupEnvelope>
  return (
    candidate.format === BACKUP_FORMAT &&
    typeof candidate.ciphertext === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.salt === 'string'
  )
}

/**
 * Decodes a required byte field and enforces its exact length. Decoding happens
 * up front — before any crypto call — so malformed base64 is reported as
 * 'corrupt' rather than being misread as a wrong passphrase.
 */
function assertByteField(value: unknown, expectedLength: number, field: string): Uint8Array {
  if (typeof value !== 'string') {
    throw new BackupError('corrupt', `This backup file is damaged (bad ${field}).`)
  }
  const bytes = base64ToBytes(value)
  if (bytes.length !== expectedLength) {
    throw new BackupError('corrupt', `This backup file is damaged (bad ${field}).`)
  }
  return bytes
}

function assertEnvelope(value: unknown): BackupEnvelope {
  if (!isEncryptedBackup(value)) {
    throw new BackupError('not-a-backup', "This file isn't a PisoWise encrypted backup.")
  }
  const envelope = value as BackupEnvelope

  if (typeof envelope.version !== 'number' || !Number.isInteger(envelope.version)) {
    throw new BackupError('corrupt', "This backup file is damaged and can't be read.")
  }
  if (envelope.version > BACKUP_VERSION) {
    throw new BackupError(
      'unsupported-version',
      'This backup was made by a newer version of PisoWise. Please update the app and try again.'
    )
  }

  const { kdf } = envelope
  const iterations = kdf?.iterations
  if (
    !kdf ||
    kdf.name !== 'PBKDF2' ||
    kdf.hash !== 'SHA-256' ||
    typeof iterations !== 'number' ||
    !Number.isInteger(iterations) ||
    iterations < MIN_ITERATIONS ||
    iterations > MAX_ITERATIONS
  ) {
    throw new BackupError('corrupt', "This backup file is damaged and can't be read.")
  }

  // Validate the fixed-size fields now so failures are attributed correctly.
  assertByteField(envelope.salt, SALT_BYTES, 'salt')
  assertByteField(envelope.iv, IV_BYTES, 'nonce')

  const ciphertext = base64ToBytes(envelope.ciphertext)
  // AES-GCM appends a 16-byte auth tag, so anything shorter cannot be valid.
  if (ciphertext.length < GCM_TAG_BYTES + 1) {
    throw new BackupError('corrupt', "This backup file is damaged (bad ciphertext).")
  }

  return envelope
}

/**
 * Seals `data` under `passphrase` and returns the envelope as pretty JSON.
 * AES-GCM authenticates the ciphertext, so tampering is detected on restore
 * without needing a separate checksum.
 */
export async function encryptBackup(data: AppData, passphrase: string): Promise<string> {
  const strength = assessPassphrase(passphrase)
  if (!strength.acceptable) {
    throw new BackupError('weak-passphrase', strength.label)
  }

  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS)

  const plaintext = encodeText(JSON.stringify(data))
  const cipherBuffer = await getSubtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  )

  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS },
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)),
    counts: countData(data),
  }

  return JSON.stringify(envelope, null, 2)
}

/**
 * Opens an envelope and returns the decrypted payload. Throws BackupError with
 * kind 'wrong-passphrase' when the passphrase doesn't match — AES-GCM rejects
 * the auth tag, which is also what a modified file does, so one message
 * honestly covers both cases.
 *
 * Validation and migration of the payload are intentionally left to the caller
 * (lib/storage.ts) so this module stays free of storage concerns.
 */
export async function decryptBackup(contents: string, passphrase: string): Promise<AppData> {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new BackupError('corrupt', "This file isn't valid JSON — it may be truncated.")
  }

  // assertEnvelope already decoded and length-checked salt, nonce, and
  // ciphertext, so the only thing left to fail here is the passphrase itself.
  const envelope = assertEnvelope(parsed)
  const iv = base64ToBytes(envelope.iv)
  const salt = base64ToBytes(envelope.salt)
  const ciphertext = base64ToBytes(envelope.ciphertext)

  let decrypted: ArrayBuffer
  try {
    decrypted = await getSubtle().decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      await deriveKey(passphrase, salt, envelope.kdf.iterations),
      ciphertext as BufferSource
    )
  } catch {
    throw new BackupError(
      'wrong-passphrase',
      'Wrong passphrase, or the file was modified. Please try again.'
    )
  }

  let payload: unknown
  try {
    payload = JSON.parse(decodeText(new Uint8Array(decrypted)))
  } catch {
    throw new BackupError('corrupt', 'The backup opened, but its contents are unreadable.')
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new BackupError('not-a-backup', "This file doesn't contain a PisoWise backup.")
  }

  return payload as AppData
}

/** Reads the unencrypted preview fields, or null if this isn't our format. */
export function readBackupMetadata(contents: string): BackupMetadata | null {
  try {
    const parsed: unknown = JSON.parse(contents)
    if (!isEncryptedBackup(parsed)) return null
    const envelope = parsed as BackupEnvelope
    // `counts` already holds numbers, so coerce defensively rather than
    // measuring array length.
    const num = (value: unknown): number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
    return {
      createdAt:
        typeof envelope.createdAt === 'string' ? envelope.createdAt : new Date(0).toISOString(),
      counts: {
        transactions: num(envelope.counts?.transactions),
        goals: num(envelope.counts?.goals),
        debts: num(envelope.counts?.debts),
        recurring: num(envelope.counts?.recurring),
      },
    }
  } catch {
    return null
  }
}

/** Suggested download filename, e.g. `pisowise-backup-2026-10-09.pisowise`. */
export function backupFilename(createdAt: Date = new Date()): string {
  return `pisowise-backup-${createdAt.toISOString().split('T')[0]}.pisowise`
}
