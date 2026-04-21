'use client'

// Fetches team config on mount and applies ALL CSS custom properties to :root.
// Derives dark/light variants from the primaryColor and accentColor returned by
// the DB — the DB only stores three colors, so we compute the rest client-side.
// Exports applyTheme() and triggerThemeRefresh() so AppNav's TeamSwitcher can
// push a config change and have it propagate instantly without a page reload.

import { createContext, useContext, useEffect, useState } from 'react'
import type { TeamConfig } from '@/types'

const DEFAULT_CONFIG: TeamConfig = {
  teamName:      'LegacyLink',
  sport:         'Football',
  level:         'College',
  primaryColor:  '#006747',
  secondaryColor:'#CFC493',
  accentColor:   '#CFC493',
  positions:     ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'],
  academicYears: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
  customLabels:  {},
}

const TeamConfigContext = createContext<TeamConfig>(DEFAULT_CONFIG)

export function useTeamConfig() {
  return useContext(TeamConfigContext)
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padEnd(6, '0')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgb2hex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((n) =>
        Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0'),
      )
      .join('')
  )
}

/** Darken a hex color by multiplying each channel by `factor` (0–1). */
function darken(hex: string, factor = 0.78): string {
  try {
    const [r, g, b] = hex2rgb(hex)
    return rgb2hex(r * factor, g * factor, b * factor)
  } catch {
    return hex
  }
}

/** Lighten a hex color by mixing toward white at `whiteMix` (0–1). */
function lighten(hex: string, whiteMix = 0.88): string {
  try {
    const [r, g, b] = hex2rgb(hex)
    return rgb2hex(
      r + (255 - r) * whiteMix,
      g + (255 - g) * whiteMix,
      b + (255 - b) * whiteMix,
    )
  } catch {
    return hex
  }
}

// ─── Core theme function ──────────────────────────────────────────────────────

// Immediately writes ALL CSS custom properties to :root. Safe to call
// server-side (no-ops when document is unavailable).
export function applyTheme(config: Partial<TeamConfig>) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  if (config.primaryColor) {
    const p = config.primaryColor
    root.style.setProperty('--color-primary',        p)
    root.style.setProperty('--color-primary-dark',   darken(p, 0.78))
    root.style.setProperty('--color-primary-light',  lighten(p, 0.88))
    root.style.setProperty('--color-primary-hover',  darken(p, 0.88))
    // Map primary → success / info so status indicators follow team color
    root.style.setProperty('--color-success',        p)
    root.style.setProperty('--color-success-light',  lighten(p, 0.88))
    root.style.setProperty('--color-info',           darken(p, 0.78))
    root.style.setProperty('--color-info-light',     lighten(p, 0.88))
  }

  const accent = config.accentColor ?? config.secondaryColor
  if (accent) {
    root.style.setProperty('--color-accent',         accent)
    root.style.setProperty('--color-accent-dark',    darken(accent, 0.82))
    root.style.setProperty('--color-accent-light',   lighten(accent, 0.82))
    root.style.setProperty('--color-warning',        darken(accent, 0.82))
    root.style.setProperty('--color-warning-light',  lighten(accent, 0.82))
  }
}

// Fires a custom DOM event so ThemeProvider and any listener can pick up a
// team switch immediately. Call this after applyTheme().
export function triggerThemeRefresh(newConfig: Partial<TeamConfig>) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('team-config-changed', { detail: newConfig }),
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

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
        if (Date.now() - ts < CACHE_TTL) applyData(cached)
      }
    } catch {
      // Corrupt / unavailable storage — ignore
    }

    // 2. Fetch fresh config (auth cookie sent automatically)
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
        // Fall back to defaults silently
      })

    // 3. Listen for team switches pushed by AppNav's TeamSwitcher
    const handleTeamChange = (e: Event) => {
      const newConfig = (e as CustomEvent<Partial<TeamConfig>>).detail
      try { sessionStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
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
