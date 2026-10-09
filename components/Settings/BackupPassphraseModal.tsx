'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { X } from 'lucide-react'
import { assessPassphrase, type PassphraseStrength } from '@/lib/backup'

interface BackupPassphraseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Receives the entered passphrase. Return a promise — the modal stays open
   * and shows a spinner until it resolves, and surfaces any thrown error
   * message inline (e.g. "wrong passphrase") without closing.
   */
  onSubmit: (passphrase: string) => Promise<void>
  /** 'create' asks for a passphrase + confirmation; 'restore' asks once. */
  mode: 'create' | 'restore'
  /** Name of the file being restored, shown so the user knows what they opened. */
  filename?: string
}

const COPY = {
  create: {
    title: 'Protect your backup',
    intro:
      'Choose a passphrase to encrypt this file. Only the encrypted copy leaves your device.',
    confirmLabel: 'Confirm passphrase',
    submit: 'Create encrypted backup',
    pending: 'Encrypting…',
    warning:
      'There is no account and no recovery. If you forget this passphrase, the backup cannot be opened — by anyone, including us.',
  },
  restore: {
    title: 'Enter your passphrase',
    intro: 'Enter the passphrase you used when creating this backup file.',
    confirmLabel: null,
    submit: 'Restore backup',
    pending: 'Decrypting…',
    warning:
      'Restoring replaces everything currently in PisoWise on this device. It cannot be undone.',
  },
} as const

/** Colors per strength score, so the bar and its label never disagree. */
const STRENGTH_STYLES: Record<PassphraseStrength['score'], { bar: string; text: string }> = {
  0: { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  1: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  2: { bar: 'bg-lime-500', text: 'text-lime-700 dark:text-lime-400' },
  3: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
}

/**
 * Live passphrase feedback while creating a backup. The check is local and
 * advisory — the passphrase itself never leaves the device.
 */
function StrengthMeter({ passphrase }: { passphrase: string }) {
  if (!passphrase) return null

  const strength = assessPassphrase(passphrase)
  const style = STRENGTH_STYLES[strength.score]

  return (
    <div className="space-y-1">
      <div
        className="flex gap-1"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={strength.score}
        aria-label="Passphrase strength"
      >
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={`h-1 flex-1 rounded-full ${
              step <= strength.score ? style.bar : 'bg-secondary'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${style.text}`}>{strength.label}</p>
    </div>
  )
}

/** Modal shell — returns null when closed so the form remounts on each open. */
export function BackupPassphraseModal({ open, ...props }: BackupPassphraseModalProps) {
  if (!open) return null
  // Keyed on mode so switching between create/restore never carries over
  // typed values, matching QuickAddModal's remount-on-open approach.
  return <PassphraseForm key={props.mode} {...props} />
}

function PassphraseForm({
  onSubmit,
  mode,
  onOpenChange,
  filename,
}: Omit<BackupPassphraseModalProps, 'open'>) {
  const copy = COPY[mode]
  const isCreate = mode === 'create'
  const [passphrase, setPassphrase] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const mismatched = isCreate && confirmation.length > 0 && passphrase !== confirmation

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!passphrase) {
      setError('Enter a passphrase.')
      return
    }
    if (isCreate && passphrase !== confirmation) {
      setError('The two passphrases do not match.')
      return
    }

    setPending(true)
    try {
      await onSubmit(passphrase)
      // Success: the caller closes the modal, but clear secrets regardless.
      setPassphrase('')
      setConfirmation('')
    } catch (caught) {
      // Keep the passphrase so the user can fix a typo without retyping it.
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={() => onOpenChange(false)} />

      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{copy.title}</h2>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close dialog"
              className="p-1 hover:bg-secondary rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">{copy.intro}</p>

          {/* Naming the file confirms the user picked the right one to overwrite. */}
          {!isCreate && filename && (
            <p className="mb-4 truncate rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              {filename}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="backup-passphrase">Passphrase</Label>
              <Input
                id="backup-passphrase"
                type="password"
                autoComplete={isCreate ? 'new-password' : 'off'}
                autoFocus
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
              {isCreate && <StrengthMeter passphrase={passphrase} />}
            </div>

            {copy.confirmLabel && (
              <div className="space-y-2">
                <Label htmlFor="backup-passphrase-confirm">{copy.confirmLabel}</Label>
                <Input
                  id="backup-passphrase-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
                {mismatched && (
                  <p className="text-xs text-destructive">The passphrases do not match.</p>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-md p-3">
              {copy.warning}
            </p>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={pending || !passphrase || mismatched}
              >
                {pending ? copy.pending : copy.submit}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
