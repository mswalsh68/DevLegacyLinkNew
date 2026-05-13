import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://legacylinkhq.app'),
  title: 'LegacyLink — Where Rosters Become Legacies',
  description:
    'The athletic CRM platform built to manage your roster, engage your alumni, and keep your network connected — at every level.',
  openGraph: {
    title:       'LegacyLink — Where Rosters Become Legacies',
    description: 'The athletic CRM platform built to manage your roster, engage your alumni, and keep your network connected — at every level.',
    images:      ['/images/logo-full.jpg'],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'LegacyLink — Where Rosters Become Legacies',
    description: 'The athletic CRM platform built to manage your roster, engage your alumni, and keep your network connected — at every level.',
    images:      ['/images/logo-full.jpg'],
  },
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${inter.className} bg-brand-black`}>
      {children}
    </div>
  )
}
