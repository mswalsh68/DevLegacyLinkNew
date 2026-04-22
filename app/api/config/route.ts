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
import { sp_GetTeamConfig, sp_UpdateTeamConfig } from '@/lib/db/procedures'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
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
  // ── Base colors (try new naming first, then old SP aliases) ──────────────────
  const primaryColor   = pick(row, 'PrimaryColor',  'primaryColor',  'colorPrimary')    ?? defaults.primaryColor
  const accentColor    = pick(row, 'AccentColor',   'accentColor',   'colorAccent')     ?? defaults.accentColor
  const secondaryColor = pick(row, 'SecondaryColor','secondaryColor','colorSecondary',
                                   'AccentColor',   'accentColor',   'colorAccent')     ?? defaults.secondaryColor

  // ── Dark / light variants (raw SP values — used by settings page) ─────────────
  const colorPrimaryDark  = pick(row, 'PrimaryColorDark',  'primaryColorDark',  'colorPrimaryDark')
                            ?? undefined
  const colorPrimaryLight = pick(row, 'PrimaryColorLight', 'primaryColorLight', 'colorPrimaryLight')
                            ?? undefined
  const colorAccentDark   = pick(row, 'AccentColorDark',   'accentColorDark',   'colorAccentDark')
                            ?? undefined
  const colorAccentLight  = pick(row, 'AccentColorLight',  'accentColorLight',  'colorAccentLight')
                            ?? undefined

  return {
    // ── Identity ────────────────────────────────────────────────────────────────
    teamName:         pick(row, 'TeamName',  'teamName')  ?? defaults.teamName,
    teamAbbr:         pick(row, 'TeamAbbr',  'teamAbbr',  'Abbr', 'abbr') ?? undefined,
    logoUrl:          pick(row, 'LogoUrl',   'logoUrl')   ?? undefined,
    sport:            pick(row, 'Sport',     'sport')     ?? defaults.sport,
    level:            pick(row, 'Level',     'level')     ?? defaults.level,
    subscriptionTier: pick(row, 'SubscriptionTier', 'subscriptionTier', 'tier') ?? undefined,

    // ── Normalized colors (ThemeProvider uses these) ─────────────────────────────
    primaryColor,
    secondaryColor,
    accentColor,

    // ── Raw DB color values (settings page uses these to show per-field inputs) ──
    colorPrimary:      primaryColor,
    colorPrimaryDark,
    colorPrimaryLight,
    colorAccent:       accentColor,
    colorAccentDark,
    colorAccentLight,

    // ── Roster / alumni ──────────────────────────────────────────────────────────
    positions:    tryArray(row,  'Positions',        'positions',
                                 'PositionsJson',    'positionsJson')     ?? defaults.positions,
    academicYears: tryArray(row, 'AcademicYears',    'academicYears',
                                 'AcademicYearsJson','academicYearsJson') ?? defaults.academicYears,
    customLabels:  tryObject(row,'CustomLabels',     'customLabels')      ?? defaults.customLabels,

    // ── Terminology labels ────────────────────────────────────────────────────────
    alumniLabel: pick(row, 'AlumniLabel', 'alumniLabel') ?? undefined,
    rosterLabel: pick(row, 'RosterLabel', 'rosterLabel') ?? undefined,
    classLabel:  pick(row, 'ClassLabel',  'classLabel')  ?? undefined,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const defaults = getEnvDefaults()

  // Team resolution priority:
  //   1. ?teamId=<uuid> query param (explicit client request)
  //   2. session.currentTeamId from JWT (set by POST /api/auth/switch-team)
  //   3. No teamId → sp_GetTeamConfig falls back to the default team
  const qsTeamId = req.nextUrl.searchParams.get('teamId') ?? undefined
  let teamId = qsTeamId
  if (!teamId) {
    try {
      const session = await getServerSession()
      teamId = session?.currentTeamId ?? undefined
    } catch { /* session unavailable — continue without teamId */ }
  }

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

// ─── PATCH /api/config — global_admin only ────────────────────────────────────
// Ported from original project's PATCH /api/config handler.
// NULL params = no change (PATCH semantics per sp_UpdateTeamConfig).

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export async function PATCH(req: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isGlobalAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden. Global admin required.' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Basic validation — mirror the original's zod schema logic inline
  const colorFields = ['colorPrimary','colorPrimaryDark','colorPrimaryLight','colorAccent','colorAccentDark','colorAccentLight'] as const
  for (const f of colorFields) {
    const v = body[f]
    if (v !== undefined && v !== null && (typeof v !== 'string' || !HEX_RE.test(v as string))) {
      return NextResponse.json({ error: `${f} must be a valid hex color (#RRGGBB).` }, { status: 422 })
    }
  }

  const str  = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) || null : null)
  const arr  = (k: string) => Array.isArray(body[k]) ? JSON.stringify(body[k]) : null

  try {
    const { errorCode } = await sp_UpdateTeamConfig({
      teamId:            session.currentTeamId ?? null,
      teamName:          str('teamName'),
      teamAbbr:          str('teamAbbr'),
      sport:             str('sport'),
      level:             str('level'),
      logoUrl:           typeof body.logoUrl === 'string' ? body.logoUrl : null,
      colorPrimary:      str('colorPrimary'),
      colorPrimaryDark:  str('colorPrimaryDark'),
      colorPrimaryLight: str('colorPrimaryLight'),
      colorAccent:       str('colorAccent'),
      colorAccentDark:   str('colorAccentDark'),
      colorAccentLight:  str('colorAccentLight'),
      positionsJson:     arr('positions'),
      academicYearsJson: arr('academicYears'),
      alumniLabel:       str('alumniLabel'),
      rosterLabel:       str('rosterLabel'),
      classLabel:        str('classLabel'),
    })

    if (errorCode) {
      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[PATCH /api/config]', err)
    return NextResponse.json({ error: 'Failed to save settings.' }, { status: 500 })
  }
}
