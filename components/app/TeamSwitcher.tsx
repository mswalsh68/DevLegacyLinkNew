'use client'

// Dropdown that lets a user switch the active team at runtime.
// Fetches the team list from /api/teams (Global DB) on mount.
// Displays a skeleton while loading and a friendly error if the fetch fails.
//
// On switch: CSS vars are updated immediately (applyTheme), the
// ThemeProvider context is refreshed (triggerThemeRefresh), and the
// selected team id is persisted to localStorage so it survives a reload.

import { useRef, useState, useEffect } from 'react'
import { useTeamConfig, applyTheme, triggerThemeRefresh } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'
import type { TeamConfig } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamItem = TeamConfig & { teamId: number }

// ─── Component ────────────────────────────────────────────────────────────────

export function TeamSwitcher() {
  const config = useTeamConfig()
  const [open, setOpen]         = useState(false)
  const [teams, setTeams]       = useState<TeamItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // ── Fetch teams on mount ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    fetch('/api/teams')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((res: { success: boolean; data: TeamItem[] }) => {
        if (cancelled) return
        if (res.success && Array.isArray(res.data)) {
          setTeams(res.data)
          // Restore last selected team from localStorage
          try {
            const lastId = localStorage.getItem('dll_selected_team_id')
            if (lastId) {
              const saved = res.data.find((t) => t.teamId === Number(lastId))
              if (saved) {
                const { teamId: _id, ...configData } = saved
                applyTheme(configData)
                triggerThemeRefresh(configData)
              }
            }
          } catch {
            // Private browsing — ignore
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFetchError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── Switch to a team ───────────────────────────────────────────────────────
  const switchTeam = (team: TeamItem) => {
    const { teamId, ...configData } = team
    applyTheme(configData)
    triggerThemeRefresh(configData)
    try {
      localStorage.setItem('dll_selected_team_id', String(teamId))
    } catch {
      // Private browsing / quota — ignore
    }
    setOpen(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading || fetchError}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border text-sm transition-colors',
          loading || fetchError
            ? 'bg-white/[0.03] border-white/[0.05] text-gray-600 cursor-default'
            : 'bg-white/5 border-white/10 text-white hover:bg-white/10',
        )}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 rounded flex-shrink-0 bg-white/10 animate-pulse" />
            <span className="flex-1 text-left text-gray-600">Loading…</span>
          </>
        ) : fetchError ? (
          <>
            <span className="w-4 h-4 rounded flex-shrink-0 bg-red-900/40" />
            <span className="flex-1 text-left text-red-500/70 text-xs">Teams unavailable</span>
          </>
        ) : (
          <>
            <span
              className="w-4 h-4 rounded flex-shrink-0"
              style={{ backgroundColor: config.primaryColor }}
            />
            <span className="flex-1 text-left font-medium truncate">{config.teamName}</span>
            <svg
              className={cn(
                'w-3.5 h-3.5 text-gray-500 transition-transform duration-200',
                open && 'rotate-180',
              )}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && teams.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-white/10 bg-[#141414] py-1.5 shadow-2xl z-50">
          <p className="px-3 pb-1.5 pt-0.5 text-[10px] uppercase tracking-widest text-gray-600">
            Switch Team
          </p>
          {teams.map((team) => {
            const active = config.teamName === team.teamName
            return (
              <button
                key={team.teamId}
                onClick={() => switchTeam(team)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors',
                  active
                    ? 'text-white bg-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5',
                )}
              >
                <span
                  className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: team.primaryColor }}
                />
                <span className="flex-1 truncate">{team.teamName}</span>
                <span className="text-[10px] text-gray-600 flex-shrink-0">{team.sport}</span>
                {active && (
                  <svg className="w-3.5 h-3.5 text-[#B8962E] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Empty state when open but no teams loaded */}
      {open && !loading && teams.length === 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-white/10 bg-[#141414] py-3 shadow-2xl z-50 text-center">
          <p className="text-xs text-gray-600">No teams found.</p>
          <p className="text-[10px] text-gray-700 mt-1">
            Run <code className="font-mono">sp_Global_AllProcedures.sql</code> in your Global DB.
          </p>
        </div>
      )}
    </div>
  )
}
