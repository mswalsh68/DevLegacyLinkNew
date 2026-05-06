import { NextResponse } from 'next/server'
import { requireSession, isGlobalAdmin } from '@/lib/auth'
import { sp_GetUserSports } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/sports ──────────────────────────────────────────────────────────
// Returns the sports accessible to the current user within their active team.
// Global admins get all active sports; regular staff get only their linked sports.

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error

  if (!session.currentTeamId) {
    return NextResponse.json({ success: false, error: 'No active team. Please switch teams and try again.' }, { status: 400 })
  }

  // Admins see all sports; regular staff see only their linked sports
  const userId = isGlobalAdmin(session) ? null : session.userId

  return appDbContext.run(session.appDb, async () => {
    try {
      const sports = await sp_GetUserSports({ userId })
      return NextResponse.json({ success: true, data: sports })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/sports]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load sports' }, { status: 500 })
    }
  })
}
