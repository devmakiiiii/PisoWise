import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppShell } from '@/components/Layout/AppShell'
import { Toaster } from '@/components/ui/toaster'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'PisoWise',
  description: 'Track your budget, expenses, and savings goals with Petsa de Peligro and Puwede Ba widgets',
  generator: 'v0.app',
  openGraph: {
    title: 'PisoWise — Personal Finance Tracker',
    description:
      'Track your budget, expenses, and savings goals with Petsa de Peligro and Puwede Ba widgets',
    url: siteUrl,
    siteName: 'PisoWise',
    type: 'website',
    locale: 'en_PH',
  },
  twitter: {
    card: 'summary',
    title: 'PisoWise — Personal Finance Tracker',
    description:
      'Track your budget, expenses, and savings goals with Petsa de Peligro and Puwede Ba widgets',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#10b981' },
    { media: '(prefers-color-scheme: dark)', color: '#10b981' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        {/* Apply the stored theme before first paint to avoid a flash of the
            wrong theme. Mirrors applyTheme() in lib/theme.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('pisowise_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('light',!d);}catch(e){}})();",
          }}
        />
        <AppShell>{children}</AppShell>
        <Toaster />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
