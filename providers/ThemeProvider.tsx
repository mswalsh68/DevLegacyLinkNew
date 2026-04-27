'use client'

// Fetches team config on mount and applies ALL CSS custom properties to :root.
// Derives dark/light variants from the primaryColor and accentColor returned by
// the DB — the DB only stores three colors, so we compute the rest client-side.
//
// Race-condition protection: every call to fetchAndApplyConfig() increments a
// generation counter. If a newer fetch starts before an older one resolves, the
// older result is discarded. This prevents a slow default-team fetch from
// overwriting a team the user already switched to.
//
// On every team switch AppNav calls switchTeam(), which:
//   1. Applies the theme instantly from the local teams-list data
//   2. Re-fetches /api/config?teamId=<id> to confirm colors from the DB
//   3. Re-applies and caches the authoritative server response

import { createContext, useContext, useEffect, useRef, useState } from 'react'
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

// Backward-compat shim — fires the new event format (includes teamId: undefined).
// Kept so components that haven't been updated yet don't break TypeScript.
export function triggerThemeRefresh(config: Partial<TeamConfig>) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('team-config-changed', { detail: { config, teamId: undefined } }),
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const CACHE_KEY = 'dll_team_config'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TeamConfig>(DEFAULT_CONFIG)

  // Generation counter — incremented on every fetch. A fetch result is only
  // applied if its generation matches the current value at resolution time.
  // This prevents a slow initial fetch from stomping over a team switch.
  const fetchGen = useRef(0)

  const fetchAndApply = (teamId?: number | null) => {
    const gen = ++fetchGen.current
    const url = teamId ? `/api/config?teamId=${teamId}` : '/api/config'

    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((res: { success: boolean; data: TeamConfig }) => {
        if (gen !== fetchGen.current) return // superseded by a newer fetch
        if (res.success && res.data) {
          const merged: TeamConfig = { ...DEFAULT_CONFIG, ...res.data }
          setConfig(merged)
          applyTheme(merged)
          try {
            sessionStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ data: merged, ts: Date.now(), teamId: teamId ?? null }),
            )
          } catch { /* Storage quota exceeded */ }
        }
      })
      .catch(() => { /* fall back to whatever is already applied */ })
  }

  useEffect(() => {
    // 1. Serve from sessionStorage immediately for fast paint (only if team hasn't changed)
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const { data: cached, ts } = JSON.parse(raw) as {
          data: Partial<TeamConfig>
          ts: number
          teamId?: number | null
        }
        if (Date.now() - ts < CACHE_TTL) {
          const merged: TeamConfig = { ...DEFAULT_CONFIG, ...cached }
          setConfig(merged)
          applyTheme(merged)
        }
      }
    } catch { /* Corrupt / unavailable storage — ignore */ }

    // 2. Fetch authoritative config from server (respects the stored teamId if any)
    let initialTeamId: number | null | undefined
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const { teamId } = JSON.parse(raw) as { teamId?: number | null }
        if (teamId) initialTeamId = teamId
      }
    } catch { /* ignore */ }
    fetchAndApply(initialTeamId)

    // 3. Listen for team switches pushed by AppNav's TeamSwitcher
    const handleTeamChange = (e: Event) => {
      const { config: newConfig, teamId } = (
        e as CustomEvent<{ config: Partial<TeamConfig>; teamId?: number }>
      ).detail

      // Apply immediately from local data for instant visual feedback
      setConfig((prev) => {
        const merged = { ...prev, ...newConfig }
        applyTheme(merged)
        return merged
      })

      // Then confirm with the server (invalidates any inflight default fetch)
      try { sessionStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
      fetchAndApply(teamId)
    }

    window.addEventListener('team-config-changed', handleTeamChange)
    return () => window.removeEventListener('team-config-changed', handleTeamChange)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <TeamConfigContext.Provider value={config}>
      {children}
    </TeamConfigContext.Provider>
  )
}
