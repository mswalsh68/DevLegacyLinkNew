import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import { appDbContext } from '@/lib/db/connection'
import { sendCampaignEmails } from '@/lib/email'

// ─── POST /api/campaigns/[id]/dispatch ───────────────────────────────────────

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!(await canAsync(session, 'feed:post')).allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  return appDbContext.run(session.appDb, async () => {
    try {
      const { queuedCount, sentCount, errorCode } = await sendCampaignEmails({
        campaignId:   id,
        dispatchedBy: session.userId,
      })

      if (errorCode && errorCode !== 'OK') {
        return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      }

      return NextResponse.json({ success: true, data: { queuedCount, sentCount } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[POST /api/campaigns/[id]/dispatch]', msg)
      return NextResponse.json({ success: false, error: 'Failed to dispatch campaign' }, { status: 500 })
    }
  })
}
