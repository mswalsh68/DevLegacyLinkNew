import { NextRequest } from 'next/server'
import { guardAppAccess, isResponse } from '@/app/api/_lib/auth'
import { ok, notFound, serverErrFrom } from '@/app/api/_lib/response'
import { sp_GetCampaignDetail } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppAccess('alumni')
    if (isResponse(user)) return user

    const { id } = await context.params

    const { campaign, errorCode } = await sp_GetCampaignDetail({
      campaignId: id,
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    if (errorCode || !campaign) return notFound(errorCode ?? 'Campaign not found')

    return ok(campaign)
  } catch (err) {
    return serverErrFrom('GET /api/campaigns/[id]', err)
  }
}
