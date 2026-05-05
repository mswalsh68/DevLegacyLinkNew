import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import { sp_MarkPostRead } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!(await canAsync(session, 'feed:view')).allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  const { id } = await params

  return appDbContext.run(session.appDb, async () => {
    try {
      await sp_MarkPostRead({ postId: id, userId: session.userId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // FK_feed_post_reads_users fires when the staff user hasn't been synced
      // to this App DB's dbo.users table yet (e.g. first visit after schema migration).
      // Read tracking is best-effort — log and continue rather than surfacing a 500.
      console.warn('[POST /api/feed/[id]/read] read tracking skipped:', msg)
    }
    return NextResponse.json({ success: true }, { status: 202 })
  })
}
