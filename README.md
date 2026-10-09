# PisoWise 🇵🇭💰

**PisoWise** is a personal finance tracker built for Filipino budgeters — with a twist.
Instead of boring charts, it answers the questions you actually ask yourself before every
purchase:

- **Petsa de Peligro** — how many days until payday, and what's your safe daily spending cap?
- **Puwede Ba My Budget?** — "kaya pa ba?" Enter an item and a price, and it tells you the
  real impact on your daily budget before you buy.

All data stays **on your device** (localStorage) — no account, no server, no tracking.

## Features

| Feature | Description |
| --- | --- |
| 📊 Dashboard | Stat cards, Petsa de Peligro bar, Puwede Ba affordability checker, recent transactions |
| 🧾 Transactions | Add / edit / delete income & expenses, with date and category |
| 📊 Budgets | Monthly income/expense summary, per-category budget limits with progress bars, over-budget alerts, 6-month trend chart — with a month navigator to review any month |
| 🤝 Utang Tracker | Receivables & payables with due dates and paid/overdue status |
| 🎯 Goals | Savings goals (sinking funds) with progress bars |
| ⚙️ Settings | Budget settings (income, fixed bills, pay day, emergency fund) + **JSON backup export/import** |
| 📱 Mobile-ready | Responsive layout with an off-canvas navigation drawer |
| 🎭 Demo data | First-run welcome lets you start empty or load sample data |
| 🌙 Dark mode | Light / dark / **system** toggle — no flash on load, follows OS changes |

## Tech stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** (strict type checking in CI)
- **Tailwind CSS v4** + **shadcn/ui**-style components on **@base-ui/react**
- **ESLint** (`eslint-config-next`, flat config)
- **Vitest** unit tests (63 tests across calculations, storage, and theme logic)
- **Vercel Analytics** (production only)
- State: React `useSyncExternalStore` over `localStorage` (with cross-tab sync)

## Getting started

### Prerequisites

- Node.js 20.9+ (22 LTS recommended)
- pnpm 11+ (`npm install -g pnpm`)

### Development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run `tsc --noEmit` |
| `pnpm test` | Run unit tests once (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |

## Deployment

### Vercel (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/PisoWise/PisoWise)

1. Push this repo to GitHub.
2. Import it on [vercel.com](https://vercel.com/new) — framework preset is auto-detected.
3. Deploy. Optional environment variable:

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL used for OG/meta tags | `https://<vercel-url>` (auto), else `http://localhost:3000` |

### Any Node host

```bash
pnpm install
pnpm build
pnpm start   # serves on :3000
```

## Project structure

```
app/                  # App Router pages (dashboard, transactions, budgets, tracker, goals, settings)
components/
  Budgets/            # Category budget bars, budget editor, CSS trend chart
  Dashboard/          # Stat cards, widgets, modals, welcome banner
  Layout/             # AppShell (responsive chrome), Sidebar, Header, ThemeToggle
  ui/                 # shadcn-style primitives (button, card, input, select, …)
lib/
  storage.ts          # localStorage layer: validation, migrations, backup, pub/sub
  hooks.ts            # useAppData / useHasSeenWelcome / useTheme / useMonthKey
  calculations.ts     # Pure finance math (payday, budgets, trends, can-afford)
  categories.ts       # Category labels, emojis, colors, budgetable list
  types.ts            # Shared TypeScript types
public/               # Icons and static assets
```

## Data & privacy

- Everything lives in `localStorage` under the `finance_tracker_data` key.
- Data is versioned (`schemaVersion`) with migrations run on read.
- Corrupted or partially-written data falls back safely instead of crashing.

### Encrypted backups

PisoWise has **no account and no server**, so a lost browser profile means lost data.
_Encrypted backups_ solve that without changing that promise:

- _Settings → Create encrypted backup_ seals your entire dataset into a
  `pisowise-backup-YYYY-MM-DD.pisowise` file.
- The file is encrypted locally with **AES-256-GCM**, keyed by a passphrase
  stretched with **PBKDF2-SHA256 (310,000 iterations)** via WebCrypto.
- Only ciphertext is written to disk, so the file is safe to keep in Google
  Drive, email to yourself, or copy to a flash drive.
- Restoring needs the passphrase. The Settings page also nudges you when you've
  never backed up or your last backup is over 30 days old.
- **The passphrase is never stored and cannot be recovered** — by you or by us.
  Forget it and the backup cannot be opened. The UI says this out loud.
- A legacy unencrypted JSON export is still available (under "Plain JSON backup")
  for interoperability with older backups, and importing either one works.

## Roadmap

- [ ] Cloud sync / accounts
- [ ] Recurring transactions (salary, bills)
- [ ] Push/local notifications for utang due dates
- [ ] PWA install prompts + offline service worker

## License

[MIT](./LICENSE)
