// Root layout — server component. Keep this minimal.
// All client-side providers live in providers.tsx behind a 'use client' boundary.
import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'DevLegacyLink',
    template: '%s | DevLegacyLink',
  },
  description: 'Alumni & roster management platform',
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
