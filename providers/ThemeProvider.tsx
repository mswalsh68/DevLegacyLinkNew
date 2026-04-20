'use client'

// Fetches team config on mount and applies CSS custom properties to :root.
// Provides TeamConfig to all children via context.
import { createContext, useContext, useEffect, useState } from 'react'
import type { TeamConfig } from '@/types'

const DEFAULT_CONFIG: TeamConfig = {
  teamName: 'My Team',
  sport: 'Football',
  level: 'College',
  primaryColor: '#1d4ed8',
  secondaryColor: '#64748b',
  accentColor: '#f59e0b',
  positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'],
  academicYears: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
  customLabels: {},
}

const TeamConfigContext = createContext<TeamConfig>(DEFAULT_CONFIG)

export function useTeamConfig() {
  return useContext(TeamConfigContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TeamConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((res: { success: boolean; data: TeamConfig }) => {
        if (!res.success || !res.data) return
        const data = res.data
        setConfig(data)
        const root = document.documentElement
        root.style.setProperty('--color-primary',   data.primaryColor)
        root.style.setProperty('--color-secondary', data.secondaryColor)
        root.style.setProperty('--color-accent',    data.accentColor)
      })
      .catch(() => {
        // Silently fall back to defaults on error
      })
  }, [])

  return (
    <TeamConfigContext.Provider value={config}>
      {children}
    </TeamConfigContext.Provider>
  )
}
