import { NextRequest, NextResponse } from 'next/server'
import { guardAppAccess, guardAppWrite, isResponse } from '@/app/api/_lib/auth'
import { badReq, serverErrFrom } from '@/app/api/_lib/response'
import { sp_GetFeed, sp_CreatePost, sp_DispatchCampaign } from '@/lib/db/procedures'

export async function GET(req: NextRequest) {
  try {
    const user = await guardAppAccess('roster')
    if (isResponse(user)) return user

    const sp = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '20', 10) || 20))

    const { posts, totalCount } = await sp_GetFeed({
      viewerUserId: user.sub,
      sportId: sp.get('sportId') ?? undefined,
      page,
      pageSize,
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    return NextResponse.json({ success: true, data: posts, total: totalCount, page, pageSize })
  } catch (err) {
    return serverErrFrom('GET /api/feed', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await guardAppWrite('roster')
    if (isResponse(user)) return user

    const body = await req.json()
    const {
      bodyHtml,
      audience,
      title,
      audienceJson,
      sportId,
      isPinned,
      alsoEmail,
      emailSubject,
    } = body

    if (!bodyHtml) return badReq('bodyHtml is required')
    if (!audience) return badReq('audience is required')

    const { postId, campaignId, errorCode } = await sp_CreatePost({
      createdBy: user.sub,
      bodyHtml,
      audience,
      title,
      audienceJson: audienceJson ? JSON.stringify(audienceJson) : null,
      sportId,
      isPinned: isPinned ?? false,
      alsoEmail: alsoEmail ?? false,
      emailSubject,
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    if (errorCode) return badReq(errorCode)

    if (alsoEmail && campaignId) {
      try {
        await sp_DispatchCampaign({ campaignId, dispatchedBy: user.sub })
      } catch (dispatchErr) {
        console.error('Non-fatal: failed to dispatch campaign for feed post', dispatchErr)
      }
    }

    return NextResponse.json({ success: true, data: { postId, campaignId } }, { status: 201 })
  } catch (err) {
    return serverErrFrom('POST /api/feed', err)
  }
}
