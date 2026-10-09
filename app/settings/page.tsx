'use client'

import { useMemo, useRef, useState } from 'react'
import { Header } from '@/components/Layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, Upload, Trash2, Save, ShieldCheck } from 'lucide-react'
import { StorageManager } from '@/lib/storage'
import { useAppData, useLastBackupAt } from '@/lib/hooks'
import { backupFilename } from '@/lib/backup'
import { BackupPassphraseModal } from '@/components/Settings/BackupPassphraseModal'
import { toast } from '@/lib/toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Feedback = { kind: 'success' | 'error'; message: string } | null

type BudgetFormKey =
  | 'monthlyIncome'
  | 'fixedBills'
  | 'payDay'
  | 'emergencyFundTarget'

/** Which passphrase dialog, if any, is open. */
type BackupModalMode = 'create' | 'restore' | null

export default function SettingsPage() {
  const data = useAppData()
  const lastBackupAt = useLastBackupAt()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const vaultInputRef = useRef<HTMLInputElement>(null)
  /** The file contents awaiting their passphrase, held out of render state. */
  const pendingVault = useRef<{ contents: string } | null>(null)

  // Input values are derived from stored settings with a draft override, so
  // they show real values once the client snapshot replaces the SSR one.
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [backupModal, setBackupModal] = useState<BackupModalMode>(null)
  /** Name of the file awaiting its passphrase — state so it can be rendered. */
  const [pendingVaultName, setPendingVaultName] = useState<string | null>(null)
  /** Whether the destructive "delete all data" confirmation dialog is open. */
  const [resetOpen, setResetOpen] = useState(false)

  const valueFor = (key: BudgetFormKey): string =>
    draft?.[key] ?? String(data.settings[key])

  const handleChange = (key: BudgetFormKey, value: string) => {
    setDraft({ ...(draft ?? {}), [key]: value })
  }

  const showFeedback = (kind: 'success' | 'error', message: string) => {
    setFeedback({ kind, message })
  }

  /**
   * Nags only when it's genuinely useful: never backed up at all, or the last
   * backup is over 30 days old. Stays quiet otherwise so it doesn't train
   * people to ignore it.
   *
   * `now` is passed in (captured once per mount) so the calculation stays pure
   * — React's lint rules forbid impure calls like Date.now() during render.
   */
  const getBackupReminder = (now: number): string | null => {
    const recordCount =
      data.transactions.length + data.goals.length + data.debts.length
    if (recordCount === 0) return null

    if (!lastBackupAt) return "You haven't made an encrypted backup yet."

    const days = Math.floor((now - new Date(lastBackupAt).getTime()) / 86_400_000)
    if (!Number.isFinite(days)) return null
    if (days <= 0) return null
    if (days === 1) return 'Last backup was yesterday — nice. Consider refreshing it.'
    if (days >= 30) return `Last backup was ${days} days ago. Time for a fresh one.`
    return null
  }

  // Captured once per mount rather than read during render, so the reminder
  // above stays a pure function of its inputs.
  const [mountedAt] = useState(() => Date.now())
  const reminder = useMemo(
    () => getBackupReminder(mountedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reminder tracks the backup date, not every render
    [mountedAt, lastBackupAt, data.transactions.length, data.goals.length, data.debts.length]
  )

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()

    const income = Number(valueFor('monthlyIncome'))
    const bills = Number(valueFor('fixedBills'))
    const day = Number(valueFor('payDay'))
    const target = Number(valueFor('emergencyFundTarget'))

    if (
      !Number.isFinite(income) || income < 0 ||
      !Number.isFinite(bills) || bills < 0 ||
      !Number.isFinite(day) || day < 1 || day > 31 ||
      !Number.isFinite(target) || target < 0
    ) {
      showFeedback('error', 'Please enter valid numbers (pay day must be 1–31).')
      return
    }

    StorageManager.updateSettings({
      monthlyIncome: income,
      fixedBills: bills,
      payDay: day,
      emergencyFundTarget: target,
    })
    setDraft(null)
    showFeedback('success', 'Settings saved.')
  }

  /** Downloads a Blob as a file, then releases the object URL. */
  const downloadBlob = (contents: string, filename: string, type: string) => {
    const blob = new Blob([contents], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    try {
      downloadBlob(
        StorageManager.exportJson(),
        `pisowise-backup-${new Date().toISOString().split('T')[0]}.json`,
        'application/json'
      )
      showFeedback('success', 'Backup downloaded. Store it somewhere safe.')
    } catch {
      showFeedback('error', 'Export failed. Please try again.')
    }
  }

  /**
   * Encrypted export: asks for a passphrase, seals the data, downloads a
   * `.pisowise` file. The passphrase is never stored, so the copy the message
   * urges the user to make is the only other copy.
   */
  const handleCreateVault = async (passphrase: string) => {
    // Errors are surfaced inline by the modal, so rethrow after cleanup.
    try {
      const contents = await StorageManager.exportVault(passphrase)
      downloadBlob(contents, backupFilename(), 'application/json')
      setBackupModal(null)
      showFeedback(
        'success',
        'Encrypted backup downloaded. Keep your passphrase — it is not stored anywhere.'
      )
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Could not create the backup.'
      )
    }
  }

  /** Encrypted restore: reads the file, then asks for its passphrase. */
  const handleVaultFile = async (file: File) => {
    const text = await file.text()
    if (!StorageManager.isVaultFile(text)) {
      showFeedback('error', "That file isn't an encrypted PisoWise backup.")
      return
    }
    pendingVault.current = { contents: text }
    setPendingVaultName(file.name)
    setBackupModal('restore')
  }

  const handleRestoreVault = async (passphrase: string) => {
    const pending = pendingVault.current
    if (!pending) return

    try {
      const imported = await StorageManager.importVault(pending.contents, passphrase)
      setBackupModal(null)
      setPendingVaultName(null)
      pendingVault.current = null
      showFeedback(
        'success',
        `Restored ${imported.transactions.length} transactions, ${imported.goals.length} goals, and ${imported.debts.length} utang records.`
      )
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Could not restore this backup.'
      )
    }
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      // Encrypted files get the passphrase flow instead of a plain import.
      if (StorageManager.isVaultFile(text)) {
        await handleVaultFile(file)
        return
      }
      const imported = StorageManager.importJson(text)
      showFeedback(
        'success',
        `Backup imported: ${imported.transactions.length} transactions, ${imported.goals.length} goals, ${imported.debts.length} utang records.`
      )
    } catch (error) {
      showFeedback('error', error instanceof Error ? error.message : 'Import failed.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleReset = () => {
    setResetOpen(false)
    StorageManager.resetData()
    toast.success('All data deleted. Starting fresh!')
  }

  return (
    <main className="min-h-screen">
      <Header />
      <div className="p-4 space-y-6 md:p-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Settings</h1>
          <p className="text-muted-foreground">Budget setup and data backup</p>
        </div>

        {feedback && (
          <div
            role="status"
            className={`rounded-lg border p-4 text-sm ${
              feedback.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Budget Settings */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Budget Settings</h2>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="monthlyIncome">Monthly Income (₱)</Label>
                <Input
                  id="monthlyIncome"
                  type="number"
                  min="0"
                  value={valueFor('monthlyIncome')}
                  onChange={(e) => handleChange('monthlyIncome', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fixedBills">Fixed Bills / Month (₱)</Label>
                <Input
                  id="fixedBills"
                  type="number"
                  min="0"
                  value={valueFor('fixedBills')}
                  onChange={(e) => handleChange('fixedBills', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payDay">Pay Day (day of month)</Label>
                <Input
                  id="payDay"
                  type="number"
                  min="1"
                  max="31"
                  value={valueFor('payDay')}
                  onChange={(e) => handleChange('payDay', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyFundTarget">Emergency Fund Target (₱)</Label>
                <Input
                  id="emergencyFundTarget"
                  type="number"
                  min="0"
                  value={valueFor('emergencyFundTarget')}
                  onChange={(e) => handleChange('emergencyFundTarget', e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="gap-2">
              <Save className="h-4 w-4" />
              Save Settings
            </Button>
          </form>
        </Card>

        {/* Backup & Data */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Backup &amp; Data</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your data lives only in this browser — there is no account and no server.
            Export regularly so you never lose it, and so you can restore on any device.
          </p>

          {/* Encrypted backup — the recommended option */}
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold">Encrypted backup (recommended)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Your backup is scrambled with a passphrase only you know, so the file is safe to
              keep in Google Drive or send to yourself. Nobody — not even us — can read it
              without the passphrase.
            </p>
            {reminder && (
              <p className="mb-3 text-sm text-amber-700 dark:text-amber-400" role="status">
                {reminder}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setBackupModal('create')} className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Create encrypted backup
              </Button>
              <Button
                variant="outline"
                onClick={() => vaultInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Restore encrypted backup
              </Button>
            </div>
            <input
              ref={vaultInputRef}
              type="file"
              accept=".pisowise,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                // Clear first so re-picking the same file fires again.
                if (vaultInputRef.current) vaultInputRef.current.value = ''
                if (file) void handleVaultFile(file)
              }}
            />
          </div>

          {/* Plain JSON — kept for people who already have one */}
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Plain JSON backup (unencrypted)
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Readable by anyone who gets the file. Use this only to work with older
              backups — encrypted backups are the safer choice.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export backup (JSON)
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Import backup
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImportFile(file)
                }}
              />
            </div>
          </details>

          <Button
            variant="outline"
            onClick={() => setResetOpen(true)}
            className="gap-2 text-red-600 hover:text-red-700 hover:border-red-300"
          >
            <Trash2 className="h-4 w-4" />
            Delete all data
          </Button>
        </Card>

        {/* Destructive confirmation — replaces the native window.confirm so the
            choice is clear, keyboard-accessible, and cannot be dismissed by a
            stray Enter key. */}
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all data?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes all your transactions, goals, utang
                records, and settings from this browser. It cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>
                Yes, delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <BackupPassphraseModal
        open={backupModal !== null}
        mode={backupModal ?? 'create'}
        filename={pendingVaultName ?? undefined}
        onOpenChange={(open) => {
          if (open) return
          setBackupModal(null)
          setPendingVaultName(null)
          pendingVault.current = null
        }}
        onSubmit={async (passphrase) => {
          if (backupModal === 'restore') {
            await handleRestoreVault(passphrase)
          } else {
            await handleCreateVault(passphrase)
          }
        }}
      />
    </main>
  )
}

