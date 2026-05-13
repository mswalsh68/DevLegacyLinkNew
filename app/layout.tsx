// Root layout — server component. Keep this minimal.
// All client-side providers live in providers.tsx behind a 'use client' boundary.
import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Legacy Link HQ',
    template: '%s | Legacy Link HQ',
  },
  description: 'Alumni & roster management platform',
  icons: {
    icon: '/logo-icon.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
