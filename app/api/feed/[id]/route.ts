import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import { sp_GetFeedPost, sp_SoftDeletePost, sp_EditPost } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { sanitizePostHtml } from '@/lib/sanitize'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!(await canAsync(session, 'feed:view')).allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
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
  const { session, error: authErr } = await requireSession()
  if (authErr) return authErr

  const { id } = await params

  let bodyHtml: string
  try {
    const body = await req.json()
    const raw = body?.bodyHtml
    if (!raw) throw new Error('bodyHtml required')
    bodyHtml = sanitizePostHtml(raw)
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
  const { session, error: authErr2 } = await requireSession()
  if (authErr2) return authErr2

  const { id } = await params
  const canDeleteAny = (await canAsync(session, 'feed:delete_any')).allowed

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
