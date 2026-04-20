// GET /api/config
// Returns team config for ThemeProvider. No auth required — public defaults.
// Phase 2: returns static defaults. Phase 3: swap the body of getConfig()
// to read from the DB via sp_GetTeamConfig().
import { NextResponse } from 'next/server'
import type { TeamConfig } from '@/types'

function getConfig(): TeamConfig {
  return {
    teamName:     process.env.TEAM_NAME   ?? 'LegacyLink',
    sport:        process.env.TEAM_SPORT  ?? 'Football',
    level:        process.env.TEAM_LEVEL  ?? 'College',

    // Brand colors — match the dark/gold theme from globals.css
    primaryColor:   process.env.COLOR_PRIMARY   ?? '#006747',  // USF Green
    secondaryColor: process.env.COLOR_SECONDARY ?? '#CFC493',  // USF Gold
    accentColor:    process.env.COLOR_ACCENT    ?? '#CFC493',  // USF Gold

    positions: [
      'QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'OG', 'C',
      'DT', 'DE', 'LB', 'CB', 'S', 'K', 'P', 'LS',
    ],
    academicYears: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
    customLabels:  {},
  }
}

export async function GET() {
  try {
    const data = getConfig()
    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (err) {
    console.error('[/api/config] Failed to build config:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to load team config.' },
      { status: 500 },
    )
  }
}
