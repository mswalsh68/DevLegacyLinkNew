import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://devlegacylink.com'),
  title: 'DevLegacyLink — Where Rosters Become Legacies',
  description:
    'The all-in-one CRM platform for managing current rosters and alumni engagement for high school and college athletic programs.',
  openGraph: {
    title: 'DevLegacyLink — Where Rosters Become Legacies',
    description:
      'Roster management and alumni outreach for athletic programs. Built for ADs, coaches, and sport administrators.',
    images: ['/images/logo-full.jpg'],
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
