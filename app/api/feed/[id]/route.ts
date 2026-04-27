import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetFeedPost } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function GET(
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
      const { post, errorCode } = await sp_GetFeedPost({
        postId:             id,
        viewerUserId:       session.userIntId!,
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })

      if (errorCode === 'NOT_FOUND' || !post) {
        return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, data: post })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/feed/[id]]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load post' }, { status: 500 })
    }
  })
}
