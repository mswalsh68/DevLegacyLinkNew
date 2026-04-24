import { NextRequest } from 'next/server'
import { guardAppAdmin, isResponse } from '@/app/api/_lib/auth'
import { ok, badReq, serverErrFrom } from '@/app/api/_lib/response'
import { sp_DispatchCampaign } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ id: string }> }

const DISPATCH_400_CODES = new Set([
  'CAMPAIGN_NOT_FOUND',
  'INVALID_CAMPAIGN_STATUS',
  'NO_ELIGIBLE_RECIPIENTS',
  'DAILY_LIMIT_EXCEEDED',
  'MONTHLY_LIMIT_EXCEEDED',
])

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppAdmin()
    if (isResponse(user)) return user

    const { id } = await context.params

    const { errorCode } = await sp_DispatchCampaign({
      campaignId: id,
      dispatchedBy: user.sub,
    })

    if (errorCode) {
      if (DISPATCH_400_CODES.has(errorCode)) return badReq(errorCode)
      return badReq(errorCode)
    }

    return ok({ message: 'Campaign dispatched' })
  } catch (err) {
    return serverErrFrom('POST /api/campaigns/[id]/dispatch', err)
  }
}
