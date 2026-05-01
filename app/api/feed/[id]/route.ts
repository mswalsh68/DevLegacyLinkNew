import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetFeedPost, sp_SoftDeletePost, sp_EditPost } from '@/lib/db/procedures'
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
        postId:       id,
        viewerUserId: session.userId,
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured.' }, { status: 503 })
  }

  const { id } = await params

  let bodyHtml: string
  try {
    const body = await req.json()
    bodyHtml = body?.bodyHtml
    if (!bodyHtml) throw new Error('bodyHtml required')
  } catch {
    return NextResponse.json({ success: false, error: 'bodyHtml is required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode } = await sp_EditPost({
        postId:   id,
        userId:   session.userId,
        bodyHtml,
      })

      if (errorCode === 'POST_NOT_FOUND')          return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
      if (errorCode === 'FORBIDDEN')               return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      if (errorCode === 'WELCOME_POST_NOT_EDITABLE') return NextResponse.json({ success: false, error: 'Welcome post cannot be edited' }, { status: 400 })
      if (errorCode)                               return NextResponse.json({ success: false, error: errorCode }, { status: 400 })

      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[PATCH /api/feed/[id]]', err)
      return NextResponse.json({ success: false, error: 'Failed to edit post' }, { status: 500 })
    }
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured.' }, { status: 503 })
  }

  const { id } = await params
  const canDeleteAny = can(session, 'feed:delete_any')

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode } = await sp_SoftDeletePost({
        postId:       id,
        userId:       session.userId,
        canDeleteAny,
      })

      if (errorCode === 'POST_NOT_FOUND') return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
      if (errorCode === 'FORBIDDEN')      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      if (errorCode)                      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })

      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[DELETE /api/feed/[id]]', err)
      return NextResponse.json({ success: false, error: 'Failed to delete post' }, { status: 500 })
    }
  })
}
