import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_PinPost } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!can(session, 'feed:pin')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured.' }, { status: 503 })
  }

  const { id } = await params

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode } = await sp_PinPost({ postId: id })

      if (errorCode === 'POST_NOT_FOUND') return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
      if (errorCode)                      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })

      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[POST /api/feed/[id]/pin]', err)
      return NextResponse.json({ success: false, error: 'Failed to pin post' }, { status: 500 })
    }
  })
}
