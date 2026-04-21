// GET /api/config
// Returns team config for ThemeProvider. No auth required — public.
// Reads from sp_GetTeamConfig in the Global DB; falls back to env-var
// defaults if the DB is unreachable (e.g. local dev without DB running).
//
// Column name resilience: sp_GetTeamConfig returns camelCase aliases
// (colorPrimary, colorAccent, teamName, positionsJson…) that differ from
// the property names expected by TeamConfig (primaryColor, accentColor, etc.).
// The pick() / tryArray() helpers handle all known naming conventions so this
// route works whether the SP is from the old project or a future refactor.
import { NextRequest, NextResponse } from 'next/server'
import { sp_GetTeamConfig } from '@/lib/db/procedures'
import type { TeamConfig } from '@/types'

// ─── Flexible column pickers ──────────────────────────────────────────────────
// Each call lists all known aliases so we handle SP naming changes without
// touching this file again.

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
    if (typeof v === 'string' && v.trim().startsWith('[')) {
      try {
        const p = JSON.parse(v)
        if (Array.isArray(p)) return p as string[]
      } catch { /* ignore malformed JSON */ }
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
    teamName:      process.env.TEAM_NAME       ?? 'LegacyLink',
    sport:         process.env.TEAM_SPORT      ?? 'Football',
    level:         process.env.TEAM_LEVEL      ?? 'College',
    primaryColor:  process.env.COLOR_PRIMARY   ?? '#006747',
    secondaryColor:process.env.COLOR_SECONDARY ?? '#CFC493',
    accentColor:   process.env.COLOR_ACCENT    ?? '#CFC493',
    positions: [
      'QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'OG', 'C',
      'DT', 'DE', 'LB', 'CB', 'S', 'K', 'P', 'LS',
    ],
    academicYears: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
    customLabels:  {},
  }
}

// ─── Row normalizer ───────────────────────────────────────────────────────────
// Maps sp_GetTeamConfig output to TeamConfig regardless of column naming.
// Old SP alias  → New TeamConfig field:
//   teamName / TeamName                → teamName
//   colorPrimary / PrimaryColor        → primaryColor
//   colorPrimaryDark / PrimaryColorDark → (used by ThemeProvider to derive CSS var)
//   colorAccent / AccentColor          → accentColor
//   positionsJson / positions          → positions[]
//   academicYearsJson / academicYears  → academicYears[]

function normalizeConfigRow(row: Record<string, unknown>, defaults: TeamConfig): TeamConfig {
  // Primary: try new naming first, then old SP aliases, then env defaults
  const primaryColor  = pick(row, 'PrimaryColor',  'primaryColor',  'colorPrimary')      ?? defaults.primaryColor
  const accentColor   = pick(row, 'AccentColor',   'accentColor',   'colorAccent')       ?? defaults.accentColor
  const secondaryColor= pick(row, 'SecondaryColor','secondaryColor','colorSecondary',
                                  'AccentColor',   'accentColor',   'colorAccent')       ?? defaults.secondaryColor

  return {
    teamName:      pick(row,  'TeamName',      'teamName')                                  ?? defaults.teamName,
    sport:         pick(row,  'Sport',         'sport')                                     ?? defaults.sport,
    level:         pick(row,  'Level',         'level')                                     ?? defaults.level,
    primaryColor,
    secondaryColor,
    accentColor,
    positions:     tryArray(row,  'Positions',     'positions',
                                  'PositionsJson',  'positionsJson')                        ?? defaults.positions,
    academicYears: tryArray(row,  'AcademicYears',  'academicYears',
                                  'AcademicYearsJson','academicYearsJson')                 ?? defaults.academicYears,
    customLabels:  tryObject(row, 'CustomLabels',   'customLabels')                        ?? defaults.customLabels,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const defaults = getEnvDefaults()

  // Optional ?teamId=<uuid> — lets the client request config for a specific team
  const teamId = req.nextUrl.searchParams.get('teamId') ?? undefined

  try {
    const row = await sp_GetTeamConfig(teamId ? { teamId } : undefined)
    if (row) {
      const data = normalizeConfigRow(row, defaults)
      return NextResponse.json({ success: true, data }, { status: 200 })
    }
  } catch (err) {
    // DB unreachable — fall through to env-var defaults
    console.warn('[/api/config] DB unavailable, using env defaults:', (err as Error).message)
  }

  return NextResponse.json({ success: true, data: defaults }, { status: 200 })
}
