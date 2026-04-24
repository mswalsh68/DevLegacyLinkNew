import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetFeed, sp_CreatePost, sp_DispatchCampaign } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

const CAN_POST_ROLES = ['platform_owner', 'app_admin', 'head_coach', 'position_coach', 'alumni_director']

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!can(session, 'feed:players') && !can(session, 'feed:alumni')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const page     = parseInt(searchParams.get('page')     ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20')

  return appDbContext.run(session.appDb, async () => {
    try {
      const { posts, totalCount } = await sp_GetFeed({
        viewerUserId:       session.userId,
        page,
        pageSize,
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })
      return NextResponse.json({ success: true, data: posts, total: totalCount })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/feed]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load feed' }, { status: 500 })
    }
  })
}

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!CAN_POST_ROLES.includes(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  let body: {
    bodyHtml:     string
    audience:     string
    title?:       string | null
    audienceJson?: string | null
    isPinned?:    boolean
    alsoEmail?:   boolean
    emailSubject?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { bodyHtml, audience, title, audienceJson, isPinned, alsoEmail, emailSubject } = body

  if (!bodyHtml || !audience) {
    return NextResponse.json({ success: false, error: 'bodyHtml and audience are required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { postId, campaignId, errorCode } = await sp_CreatePost({
        createdBy:          session.userId,
        bodyHtml,
        audience,
        title:              title ?? null,
        audienceJson:       audienceJson ?? null,
        isPinned:           isPinned ?? false,
        alsoEmail:          alsoEmail ?? false,
        emailSubject:       emailSubject ?? null,
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })

      if (errorCode && errorCode !== 'OK') {
        return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      }

      // Fire-and-forget email dispatch
      if (alsoEmail && campaignId) {
        sp_DispatchCampaign({ campaignId, dispatchedBy: session.userId }).catch((err) => {
          console.error('[POST /api/feed] dispatchCampaign failed:', err)
        })
      }

      return NextResponse.json({ success: true, data: { postId } }, { status: 201 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[POST /api/feed]', msg)
      return NextResponse.json({ success: false, error: 'Failed to create post' }, { status: 500 })
    }
  })
}
