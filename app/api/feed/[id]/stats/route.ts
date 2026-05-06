import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { sp_GetPostReadStats } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

const CAN_POST_ROLES = ['platform_owner', 'app_admin', 'head_coach', 'position_coach', 'alumni_director']

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  // Stats are only visible to staff who can post
  if (!CAN_POST_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  return appDbContext.run(session.appDb, async () => {
    try {
      const { stats, errorCode } = await sp_GetPostReadStats({ postId: id })

      if (errorCode === 'NOT_FOUND' || !stats) {
        return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true, data: stats })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/feed/[id]/stats]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load read stats' }, { status: 500 })
    }
  })
}
