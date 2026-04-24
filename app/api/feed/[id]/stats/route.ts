import { NextRequest } from 'next/server'
import { guardAppWrite, isResponse } from '@/app/api/_lib/auth'
import { ok, notFound, serverErrFrom } from '@/app/api/_lib/response'
import { sp_GetPostReadStats } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppWrite('roster')
    if (isResponse(user)) return user

    const { id } = await context.params

    const { stats, errorCode } = await sp_GetPostReadStats({
      postId: id,
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    if (errorCode || !stats) return notFound(errorCode ?? 'Stats not found')

    return ok(stats)
  } catch (err) {
    return serverErrFrom('GET /api/feed/[id]/stats', err)
  }
}
