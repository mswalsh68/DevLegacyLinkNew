'use client'

import { usePathname } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { useTeamConfig } from '@/providers/ThemeProvider'

// Maps route prefixes to human-readable page titles shown in the header breadcrumb.
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':       'Dashboard',
  '/roster':          'Roster',
  '/alumni':          'Alumni',
  '/settings':        'Settings',
  '/roster/transfer': 'Transfer to Alumni',
  '/roster/add':      'Add Player',
  '/alumni/add':      'Add Alumni',
}

function getPageTitle(pathname: string): string {
  // Try longest match first so /roster/transfer beats /roster
  const match = Object.keys(PAGE_TITLES)
    .sort((a, b) => b.length - a.length)
    .find((key) => pathname === key || pathname.startsWith(key + '/'))
  return match ? PAGE_TITLES[match] : 'App'
}

export function AppHeader() {
  const pathname = usePathname()
  const { user }  = useAuth()
  const config    = useTeamConfig()

  const pageTitle  = getPageTitle(pathname)
  const displayName = user?.username ?? 'User'
  const initials    = displayName[0]?.toUpperCase() ?? 'U'

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-[#111111] border-b border-white/[0.06] flex-shrink-0">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">{config.teamName}</span>
        <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-300 font-medium">{pageTitle}</span>
      </div>

      {/* User info */}
      <div className="flex items-center gap-3">
        {/* Online indicator + team name pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/[0.06]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-gray-400">{displayName}</span>
        </div>

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0 select-none"
          style={{ backgroundColor: 'var(--color-accent)' }}
          title={displayName}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
