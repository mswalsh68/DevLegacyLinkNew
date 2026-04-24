import { NextRequest, NextResponse } from 'next/server'
import { guardAppAccess, isResponse } from '@/app/api/_lib/auth'
import { serverErrFrom } from '@/app/api/_lib/response'
import { sp_MarkPostRead } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppAccess('roster')
    if (isResponse(user)) return user

    const { id } = await context.params

    await sp_MarkPostRead({ postId: id, userId: user.sub })

    return NextResponse.json({ success: true }, { status: 202 })
  } catch (err) {
    return serverErrFrom('POST /api/feed/[id]/read', err)
  }
}
