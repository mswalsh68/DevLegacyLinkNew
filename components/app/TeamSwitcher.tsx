'use client'

// Dropdown that lets a user switch the active team at runtime.
// Phase 2: teams are hardcoded. Phase 3: replace DEMO_TEAMS with a
// fetch('/api/teams') call and let the backend drive the list.
//
// On switch: CSS vars are updated immediately (applyTheme), the
// ThemeProvider context is refreshed (triggerThemeRefresh), and the
// selected team id is persisted to localStorage so it survives a reload.

import { useRef, useState, useEffect } from 'react'
import { useTeamConfig, applyTheme, triggerThemeRefresh } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'
import type { TeamConfig } from '@/types'

type DemoTeam = Pick<TeamConfig, 'teamName' | 'sport' | 'level' | 'primaryColor' | 'secondaryColor' | 'accentColor' | 'positions' | 'academicYears' | 'customLabels'> & {
  id: number
}

const DEMO_TEAMS: DemoTeam[] = [
  {
    id: 1,
    teamName: 'USF Bulls',
    sport: 'Football',
    level: 'College',
    primaryColor: '#006747',
    secondaryColor: '#CFC493',
    accentColor: '#CFC493',
    positions: ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'OG', 'C', 'DT', 'DE', 'LB', 'CB', 'S', 'K', 'P'],
    academicYears: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
    customLabels: {},
  },
  {
    id: 2,
    teamName: 'Tampa Tigers',
    sport: 'Football',
    level: 'College',
    primaryColor: '#CC5500',
    secondaryColor: '#FFD700',
    accentColor: '#FFD700',
    positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'],
    academicYears: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
    customLabels: {},
  },
  {
    id: 3,
    teamName: 'Bay Sharks',
    sport: 'Football',
    level: 'College',
    primaryColor: '#003087',
    secondaryColor: '#B0B7BC',
    accentColor: '#B0B7BC',
    positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'],
    academicYears: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
    customLabels: {},
  },
]

export function TeamSwitcher() {
  const config     = useTeamConfig()
  const [open, setOpen] = useState(false)
  const ref        = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const switchTeam = (team: DemoTeam) => {
    const { id, ...configData } = team
    applyTheme(configData)
    triggerThemeRefresh(configData)
    try {
      localStorage.setItem('dll_selected_team_id', String(id))
    } catch {
      // Private browsing / quota — ignore
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-colors"
      >
        <span
          className="w-4 h-4 rounded flex-shrink-0"
          style={{ backgroundColor: config.primaryColor }}
        />
        <span className="flex-1 text-left font-medium truncate">{config.teamName}</span>
        <svg
          className={cn('w-3.5 h-3.5 text-gray-500 transition-transform duration-200', open && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-white/10 bg-[#141414] py-1.5 shadow-2xl z-50">
          <p className="px-3 pb-1.5 pt-0.5 text-[10px] uppercase tracking-widest text-gray-600">
            Switch Team
          </p>
          {DEMO_TEAMS.map((team) => {
            const active = config.teamName === team.teamName
            return (
              <button
                key={team.id}
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
                <span className="flex-1">{team.teamName}</span>
                {active && (
                  <svg className="w-3.5 h-3.5 text-[#B8962E]" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
