// GET /api/config
// Returns team config for ThemeProvider. No auth required — public.
// Reads from sp_GetTeamConfig in the Global DB; falls back to env-var
// defaults if the DB is unreachable (e.g. local dev without DB running).
import { NextResponse } from 'next/server'
import { sp_GetTeamConfig } from '@/lib/db/procedures'
import type { TeamConfig } from '@/types'

// ─── Row normalizer ───────────────────────────────────────────────────────────
// sp_GetTeamConfig may return PascalCase (TeamName, PrimaryColor…) or
// camelCase (teamName, primaryColor…) columns depending on how the SP was
// written. This helper reads whichever is present.

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

// ─── Env-var defaults ─────────────────────────────────────────────────────────

function getEnvDefaults(): TeamConfig {
  return {
    teamName:       process.env.TEAM_NAME        ?? 'LegacyLink',
    sport:          process.env.TEAM_SPORT       ?? 'Football',
    level:          process.env.TEAM_LEVEL       ?? 'College',
    primaryColor:   process.env.COLOR_PRIMARY    ?? '#006747',
    secondaryColor: process.env.COLOR_SECONDARY  ?? '#CFC493',
    accentColor:    process.env.COLOR_ACCENT     ?? '#CFC493',
    positions: [
      'QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'OG', 'C',
      'DT', 'DE', 'LB', 'CB', 'S', 'K', 'P', 'LS',
    ],
    academicYears: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
    customLabels:  {},
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const defaults = getEnvDefaults()

  try {
    const row = await sp_GetTeamConfig()

    if (row) {
      const data: TeamConfig = {
        teamName:       pick(row, 'TeamName',       'teamName')       ?? defaults.teamName,
        sport:          pick(row, 'Sport',           'sport')          ?? defaults.sport,
        level:          pick(row, 'Level',           'level')          ?? defaults.level,
        primaryColor:   pick(row, 'PrimaryColor',   'primaryColor')   ?? defaults.primaryColor,
        secondaryColor: pick(row, 'SecondaryColor', 'secondaryColor') ?? defaults.secondaryColor,
        accentColor:    pick(row, 'AccentColor',    'accentColor')    ?? defaults.accentColor,
        positions:      tryArray(row,  'Positions',     'positions')     ?? defaults.positions,
        academicYears:  tryArray(row,  'AcademicYears', 'academicYears') ?? defaults.academicYears,
        customLabels:   tryObject(row, 'CustomLabels',  'customLabels')  ?? defaults.customLabels,
      }
      return NextResponse.json({ success: true, data }, { status: 200 })
    }
  } catch (err) {
    // DB unreachable — fall through to env-var defaults
    console.warn('[/api/config] DB unavailable, using env defaults:', (err as Error).message)
  }

  return NextResponse.json({ success: true, data: defaults }, { status: 200 })
}
