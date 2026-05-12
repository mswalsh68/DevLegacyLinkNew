import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetDashboardMetrics_Players } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { featuresForTier } from '@/lib/features'

// ─── GET /api/dashboard/player-metrics ───────────────────────────────────────
// Optional query param: ?sportId=<int>

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'roster:view')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.currentTeamId) {
    return NextResponse.json({ success: false, error: 'No active team. Please switch teams and try again.' }, { status: 400 })
  }

  const sportIdParam = req.nextUrl.searchParams.get('sportId')
  const sportId      = sportIdParam ? parseInt(sportIdParam, 10) || null : null

  return appDbContext.run(session.appDb, async () => {
    try {
      const metrics = await sp_GetDashboardMetrics_Players({ sportId })
      return NextResponse.json({
        success:            true,
        data:               metrics,
        features_available: featuresForTier(session.tierId),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/dashboard/player-metrics]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load player metrics' }, { status: 500 })
    }
  })
}
