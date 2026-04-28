import { NextResponse } from 'next/server'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_GetUserSports } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/sports ──────────────────────────────────────────────────────────
// Returns the sports accessible to the current user within their active team.
// Global admins get all active sports; regular staff get only their linked sports.

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  if (!session.currentTeamId) {
    return NextResponse.json({ success: false, error: 'No active team. Please switch teams and try again.' }, { status: 400 })
  }

  // Admins see all sports; regular staff see only their linked sports
  const userId = isGlobalAdmin(session) ? null : session.userId

  return appDbContext.run(session.appDb, async () => {
    try {
      const sports = await sp_GetUserSports({
        tenantId: session.currentTeamId!,
        userId,
      })
      return NextResponse.json({ success: true, data: sports })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/sports]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load sports' }, { status: 500 })
    }
  })
}
