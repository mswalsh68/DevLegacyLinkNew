import { NextRequest } from 'next/server'
import { guardAppWrite, isResponse } from '@/app/api/_lib/auth'
import { created, badReq, serverErrFrom } from '@/app/api/_lib/response'
import { sp_LogInteraction } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppWrite('alumni')
    if (isResponse(user)) return user

    const { id } = await context.params
    const body = await req.json()
    const { channel, summary, outcome, followUpAt } = body

    if (!channel) return badReq('channel is required')
    if (!summary) return badReq('summary is required')

    await sp_LogInteraction({
      userId: id,
      loggedBy: user.sub,
      channel,
      summary,
      outcome,
      followUpAt,
    })

    return created({ message: 'Interaction logged' })
  } catch (err) {
    return serverErrFrom('POST /api/alumni/[id]/interactions', err)
  }
}
