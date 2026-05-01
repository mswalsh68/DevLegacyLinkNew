import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetFeed, sp_CreatePost } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { sendCampaignEmailsBackground } from '@/lib/email'

const CAN_POST_ROLES = ['platform_owner', 'app_admin', 'head_coach', 'position_coach', 'alumni_director']

function getRoleGroup(roleId: number): string {
  if (roleId <= 2) return 'admin'   // platform_owner, app_admin
  if (roleId <= 5) return 'staff'   // head_coach, position_coach, alumni_director
  return 'player'                    // player, alumni
}

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
  const page         = parseInt(searchParams.get('page')     ?? '1')
  const pageSize     = parseInt(searchParams.get('pageSize') ?? '20')
  const sportIdParam = searchParams.get('sportId')
  const sportId      = sportIdParam ? parseInt(sportIdParam, 10) || null : null

  const VALID_TIERS = ['starter', 'pro', 'enterprise']
  const tierParam   = searchParams.get('tier') ?? ''
  const tierGroup   = VALID_TIERS.includes(tierParam) ? tierParam : null
  const roleGroup   = getRoleGroup(session.roleId)

  return appDbContext.run(session.appDb, async () => {
    try {
      const { posts, totalCount } = await sp_GetFeed({
        viewerUserId: session.userId,
        sportId,
        page,
        pageSize,
        tierGroup,
        roleGroup,
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
    bodyHtml:      string
    audience:      string
    title?:        string | null
    audienceJson?: string | null
    sportId?:      number | string | null   // accept both INT and string "1"
    isPinned?:     boolean
    alsoEmail?:    boolean
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

  // Normalise sportId to INT or null
  const sportId = body.sportId != null
    ? parseInt(String(body.sportId), 10) || null
    : null

  return appDbContext.run(session.appDb, async () => {
    try {
      const { postId, campaignId, errorCode } = await sp_CreatePost({
        createdBy:    session.userId,
        bodyHtml,
        audience,
        title:        title        ?? null,
        audienceJson: audienceJson ?? null,
        sportId,
        isPinned:     isPinned     ?? false,
        alsoEmail:    alsoEmail    ?? false,
        emailSubject: emailSubject ?? null,
      })

      if (errorCode && errorCode !== 'OK') {
        return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      }

      // Fire-and-forget email dispatch (queue + send in background)
      if (alsoEmail && campaignId && session.appDb) {
        sendCampaignEmailsBackground({
          campaignId,
          dispatchedBy: session.userId,
          appDb:        session.appDb,
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
