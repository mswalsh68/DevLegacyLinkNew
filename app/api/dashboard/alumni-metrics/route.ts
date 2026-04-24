import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetDashboardMetrics_Alumni } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { featuresForTier, normalizeTier } from '@/lib/features'

// ─── GET /api/dashboard/alumni-metrics ───────────────────────────────────────

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!can(session, 'alumni:view')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const metrics = await sp_GetDashboardMetrics_Alumni({
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })
      // features_available drives which MetricCards the AlumniTab renders
      const tier = normalizeTier(null) // will be overridden by ThemeProvider at client
      return NextResponse.json({
        success:            true,
        data:               metrics,
        features_available: featuresForTier(tier),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/dashboard/alumni-metrics]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load alumni metrics' }, { status: 500 })
    }
  })
}
