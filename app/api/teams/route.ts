// GET /api/teams
// Returns the teams accessible to the current user from the Global DB.
// - If a valid session cookie is present → calls sp_GetUserTeams (per-user list)
// - Otherwise (or if that SP fails) → falls back to sp_GetTeams (all active teams)
//
// Used by TeamSwitcher to populate the dropdown with real data.
// Handles both PascalCase (TeamId, PrimaryColor…) and camelCase column names.
import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetTeams, sp_GetUserTeams } from '@/lib/db/procedures'
import type { TeamConfig } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    if (row[k] != null && typeof row[k] === 'string') return row[k] as string
  }
  return null
}

function tryArray(row: Record<string, unknown>, ...keys: string[]): string[] | null {
  for (const k of keys) {
    const v = row[k]
    if (v == null) continue
    if (Array.isArray(v)) return v as string[]
    if (typeof v === 'string') {
      try {
        const p = JSON.parse(v)
        if (Array.isArray(p)) return p as string[]
      } catch { /* ignore */ }
    }
  }
  return null
}

function tryObject(
  row: Record<string, unknown>,
  ...keys: string[]
): Record<string, string> | null {
  for (const k of keys) {
    const v = row[k]
    if (v == null) continue
    if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, string>
    if (typeof v === 'string') {
      try {
        const p = JSON.parse(v)
        if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, string>
      } catch { /* ignore */ }
    }
  }
  return null
}

function normalizeRows(rows: Record<string, unknown>[]): TeamListItem[] {
  const DEFAULT_POSITIONS      = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']
  const DEFAULT_ACADEMIC_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']

  return rows.map((row) => {
    // Pick with old SP aliases: PascalCase → camelCase → old colorXxx naming → 'name' alias
    const primaryColor   = pick(row, 'PrimaryColor',   'primaryColor',   'colorPrimary')   ?? '#006747'
    const accentColor    = pick(row, 'AccentColor',    'accentColor',    'colorAccent')    ?? '#CFC493'
    const secondaryColor = pick(row, 'SecondaryColor', 'secondaryColor', 'colorSecondary',
                                     'AccentColor',    'accentColor',    'colorAccent')    ?? '#CFC493'

    return {
      teamId:   pick(row, 'TeamId',  'teamId',  'id',    'Id')    ?? '',
      teamName: pick(row, 'TeamName','teamName', 'name',  'Name')  ?? 'Unknown Team',
      sport:    pick(row, 'Sport',   'sport')                      ?? 'Football',
      level:    pick(row, 'Level',   'level')                      ?? 'College',
      primaryColor,
      secondaryColor,
      accentColor,
      positions:     tryArray(row,  'Positions',        'positions',
                                    'PositionsJson',    'positionsJson')    ?? DEFAULT_POSITIONS,
      academicYears: tryArray(row,  'AcademicYears',    'academicYears',
                                    'AcademicYearsJson','academicYearsJson') ?? DEFAULT_ACADEMIC_YEARS,
      customLabels:  tryObject(row, 'CustomLabels',     'customLabels')     ?? {},
    }
  })
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TeamListItem extends TeamConfig {
  teamId: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  // Try to get the logged-in user's team list first
  try {
    const session = await getServerSession()

    if (session?.userId) {
      const rows = await sp_GetUserTeams({ userId: String(session.userId) })
      if (rows.length > 0) {
        return NextResponse.json(
          { success: true, data: normalizeRows(rows) },
          { status: 200 },
        )
      }
    }
  } catch {
    // Session invalid or sp_GetUserTeams failed — fall through to sp_GetTeams
  }

  // Fallback: all active teams
  try {
    const rows = await sp_GetTeams()
    return NextResponse.json(
      { success: true, data: normalizeRows(rows) },
      { status: 200 },
    )
  } catch (err) {
    console.error('[/api/teams] DB error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to load teams.' },
      { status: 500 },
    )
  }
}
