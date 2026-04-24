import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_MarkPostRead } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!can(session, 'feed:players') && !can(session, 'feed:alumni')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  const { id } = await params

  return appDbContext.run(session.appDb, async () => {
    try {
      await sp_MarkPostRead({ postId: id, userId: session.userId })
      return NextResponse.json({ success: true }, { status: 202 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[POST /api/feed/[id]/read]', msg)
      return NextResponse.json({ success: false, error: 'Failed to mark post as read' }, { status: 500 })
    }
  })
}
