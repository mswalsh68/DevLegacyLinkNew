import { NextRequest } from 'next/server'
import { guardGlobalAdmin, isResponse } from '@/app/api/_lib/auth'
import { ok, badReq, serverErrFrom } from '@/app/api/_lib/response'
import { sp_UpdateUser } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await guardGlobalAdmin()
    if (isResponse(user)) return user

    const { id } = await context.params
    const body = await req.json()
    const { globalRole, isActive } = body

    if (globalRole === undefined && isActive === undefined) {
      return badReq('At least one of globalRole or isActive is required')
    }

    const { errorCode } = await sp_UpdateUser({
      targetUserId: id,
      globalRole: globalRole ?? null,
      isActive: isActive ?? null,
      actorId: user.sub,
    })

    if (errorCode) return badReq(errorCode)

    return ok({ message: 'User updated' })
  } catch (err) {
    return serverErrFrom('PATCH /api/users/[id]', err)
  }
}
