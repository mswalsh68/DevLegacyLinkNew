import { NextRequest } from 'next/server'
import { guardAppAccess, isResponse } from '@/app/api/_lib/auth'
import { ok, notFound, serverErrFrom } from '@/app/api/_lib/response'
import { sp_GetFeedPost } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppAccess('roster')
    if (isResponse(user)) return user

    const { id } = await context.params

    const { post, errorCode } = await sp_GetFeedPost({
      postId: id,
      viewerUserId: user.sub,
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    if (errorCode || !post) return notFound(errorCode ?? 'Post not found')

    return ok(post)
  } catch (err) {
    return serverErrFrom('GET /api/feed/[id]', err)
  }
}
