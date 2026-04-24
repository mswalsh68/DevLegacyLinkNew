import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_DispatchCampaign } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── POST /api/campaigns/[id]/dispatch ───────────────────────────────────────

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!can(session, 'feed:alumni') && !can(session, 'feed:players')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  const { id } = await params

  return appDbContext.run(session.appDb, async () => {
    try {
      const { queuedCount, errorCode } = await sp_DispatchCampaign({
        campaignId:   id,
        dispatchedBy: session.userId,
      })

      if (errorCode && errorCode !== 'OK') {
        return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      }

      return NextResponse.json({ success: true, data: { queuedCount } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[POST /api/campaigns/[id]/dispatch]', msg)
      return NextResponse.json({ success: false, error: 'Failed to dispatch campaign' }, { status: 500 })
    }
  })
}
