import { NextRequest } from 'next/server'
import { guardGlobalAdmin, isResponse } from '@/app/api/_lib/auth'
import { ok, created, badReq, serverErrFrom } from '@/app/api/_lib/response'
import { sp_GetUserPermissions, sp_GrantPermission } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ userId: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await guardGlobalAdmin()
    if (isResponse(user)) return user

    const { userId } = await context.params

    const rows = await sp_GetUserPermissions({ userId })

    return ok(rows)
  } catch (err) {
    return serverErrFrom('GET /api/permissions/[userId]', err)
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await guardGlobalAdmin()
    if (isResponse(user)) return user

    const { userId } = await context.params
    const body = await req.json()
    const { appName, role } = body

    if (!appName) return badReq('appName is required')
    if (!role) return badReq('role is required')

    const { errorCode } = await sp_GrantPermission({
      userId,
      appName,
      role,
      grantedBy: user.sub,
    })

    if (errorCode) return badReq(errorCode)

    return created({ message: 'Permission granted' })
  } catch (err) {
    return serverErrFrom('POST /api/permissions/[userId]', err)
  }
}
