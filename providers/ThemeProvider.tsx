'use client'

// Fetches team config on mount and applies CSS custom properties to :root.
// Provides TeamConfig to all children via context.
// Exports applyTheme() and triggerThemeRefresh() so any component (e.g. TeamSwitcher)
// can push a config change and have it propagate instantly without a page reload.
import { createContext, useContext, useEffect, useState } from 'react'
import type { TeamConfig } from '@/types'

const DEFAULT_CONFIG: TeamConfig = {
  teamName: 'LegacyLink',
  sport: 'Football',
  level: 'College',
  primaryColor: '#006747',
  secondaryColor: '#CFC493',
  accentColor: '#CFC493',
  positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'],
  academicYears: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
  customLabels: {},
}

const TeamConfigContext = createContext<TeamConfig>(DEFAULT_CONFIG)

export function useTeamConfig() {
  return useContext(TeamConfigContext)
}

// Immediately writes CSS custom properties to :root. Safe to call server-side
// (no-ops when document is unavailable).
export function applyTheme(config: Partial<TeamConfig>) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (config.primaryColor)   root.style.setProperty('--color-primary',   config.primaryColor)
  if (config.secondaryColor) root.style.setProperty('--color-secondary', config.secondaryColor)
  if (config.accentColor)    root.style.setProperty('--color-accent',    config.accentColor)
}

// Fires a custom DOM event so any ThemeProvider instance (or other listener)
// can pick up a team switch immediately. Call this after applyTheme().
export function triggerThemeRefresh(newConfig: Partial<TeamConfig>) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('team-config-changed', { detail: newConfig }),
  )
}

const CACHE_KEY = 'dll_team_config'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TeamConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    const applyData = (data: Partial<TeamConfig>) => {
      const merged: TeamConfig = { ...DEFAULT_CONFIG, ...data }
      setConfig(merged)
      applyTheme(merged)
    }

    // 1. Serve from sessionStorage immediately for fast paint
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const { data: cached, ts } = JSON.parse(raw) as {
          data: Partial<TeamConfig>
          ts: number
        }
        if (Date.now() - ts < CACHE_TTL) {
          applyData(cached)
        }
      }
    } catch {
      // Corrupt / unavailable storage — ignore
    }

    // 2. Fetch fresh config from API (auth cookie sent automatically)
    fetch('/api/config', { credentials: 'include' })
      .then((r) => r.json())
      .then((res: { success: boolean; data: TeamConfig }) => {
        if (res.success && res.data) {
          applyData(res.data)
          try {
            sessionStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ data: res.data, ts: Date.now() }),
            )
          } catch {
            // Storage quota exceeded — ignore
          }
        }
      })
      .catch(() => {
        // Fall back to defaults silently — API may not be running in dev
      })

    // 3. Listen for team switches triggered by TeamSwitcher / other components
    const handleTeamChange = (e: Event) => {
      const newConfig = (e as CustomEvent<Partial<TeamConfig>>).detail
      try {
        sessionStorage.removeItem(CACHE_KEY) // bust the cache on switch
      } catch {
        // ignore
      }
      setConfig((prev) => {
        const merged = { ...prev, ...newConfig }
        applyTheme(merged)
        return merged
      })
    }

    window.addEventListener('team-config-changed', handleTeamChange)
    return () => window.removeEventListener('team-config-changed', handleTeamChange)
  }, [])

  return (
    <TeamConfigContext.Provider value={config}>
      {children}
    </TeamConfigContext.Provider>
  )
}
