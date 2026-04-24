import { NextRequest } from 'next/server'
import { guardAppAccess, guardAppAdmin, isResponse } from '@/app/api/_lib/auth'
import { ok, created, badReq, serverErrFrom } from '@/app/api/_lib/response'
import { sp_GetCampaigns, sp_CreateCampaign } from '@/lib/db/procedures'

export async function GET(_req: NextRequest) {
  try {
    const user = await guardAppAccess('alumni')
    if (isResponse(user)) return user

    const rows = await sp_GetCampaigns({
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    return ok(rows)
  } catch (err) {
    return serverErrFrom('GET /api/campaigns', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await guardAppAdmin()
    if (isResponse(user)) return user

    const body = await req.json()
    const {
      name,
      targetAudience,
      description,
      audienceFilters,
      scheduledAt,
      subjectLine,
      bodyHtml,
      fromName,
      replyToEmail,
      physicalAddress,
    } = body

    if (!name) return badReq('name is required')
    if (!targetAudience) return badReq('targetAudience is required')

    const { campaignId, errorCode } = await sp_CreateCampaign({
      name,
      createdBy: user.sub,
      targetAudience,
      description,
      audienceFilters: audienceFilters ? JSON.stringify(audienceFilters) : undefined,
      scheduledAt,
      subjectLine,
      bodyHtml,
      fromName,
      replyToEmail,
      physicalAddress,
    })

    if (errorCode) return badReq(errorCode)

    return created({ id: campaignId })
  } catch (err) {
    return serverErrFrom('POST /api/campaigns', err)
  }
}
