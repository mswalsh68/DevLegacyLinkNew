import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import { sp_GetFeed, sp_CreatePost } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { sendCampaignEmailsBackground } from '@/lib/email'
import { sanitizePostHtml } from '@/lib/sanitize'

export async function GET(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const viewPerm = await canAsync(session, 'feed:view')
  if (!viewPerm.allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page              = parseInt(searchParams.get('page')            ?? '1')
  const pageSize          = parseInt(searchParams.get('pageSize')        ?? '20')
  const mySport           = searchParams.get('mySport') === 'true'
  const targetGroupFilter = searchParams.get('targetGroupFilter')
    ? parseInt(searchParams.get('targetGroupFilter')!)
    : null

  // Effective program role: use preview role when View As is active
  const effectiveProgramRoleId = session.previewActive
    ? (session.previewProgramRoleId ?? null)
    : (session.programRoleId        ?? null)

  return appDbContext.run(session.appDb, async () => {
    try {
      const { posts, totalCount } = await sp_GetFeed({
        viewerUserId:        session.userId,
        mySport,
        page,
        pageSize,
        viewerTierId:        session.tierId        ?? null,
        viewerGlobalRoleId:  session.roleId,
        viewerProgramRoleId: effectiveProgramRoleId,
        targetGroupFilter,
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
  const { session, error } = await requireSession()
  if (error) return error

  const postPerm = await canAsync(session, 'feed:post')
  if (!postPerm.allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    bodyHtml:             string
    audience:             string
    title?:               string | null
    audienceJson?:        string | null
    sportId?:             number | string | null
    sportIds?:            (number | string)[]
    isPinned?:            boolean
    alsoEmail?:           boolean
    emailSubject?:        string | null
    targetProgramRoleId?: number | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { audience, title, isPinned, alsoEmail, emailSubject } = body
  const bodyHtml = body.bodyHtml ? sanitizePostHtml(body.bodyHtml) : body.bodyHtml

  if (!bodyHtml || !audience) {
    return NextResponse.json({ success: false, error: 'bodyHtml and audience are required' }, { status: 400 })
  }

  if (!['all_sports', 'sport_specific', 'multi_sport'].includes(audience)) {
    return NextResponse.json(
      { success: false, error: 'Invalid audience. Must be all_sports, sport_specific, or multi_sport.' },
      { status: 400 },
    )
  }

  const targetProgramRoleId = body.targetProgramRoleId ?? null
  if (targetProgramRoleId !== null && ![7, 8].includes(targetProgramRoleId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid targetProgramRoleId. Must be 7 (alumni) or 8 (roster).' },
      { status: 400 },
    )
  }

  // Sport ID handling
  const sportId = body.sportId != null
    ? parseInt(String(body.sportId), 10) || null
    : null

  // Multi-sport: build audienceJson from sportIds array
  let audienceJson: string | null = body.audienceJson ?? null
  if (audience === 'multi_sport') {
    const sportIds = (body.sportIds ?? []).map(id => parseInt(String(id), 10)).filter(n => !isNaN(n))
    if (sportIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'sportIds must be a non-empty array for multi_sport audience.' },
        { status: 400 },
      )
    }
    audienceJson = JSON.stringify(sportIds)
  }

  const effectiveProgramRoleId = session.previewActive
    ? (session.previewProgramRoleId ?? null)
    : (session.programRoleId        ?? null)

  return appDbContext.run(session.appDb, async () => {
    try {
      const { postId, campaignId, errorCode } = await sp_CreatePost({
        createdBy:            session.userId,
        bodyHtml,
        audience:             audience as 'all_sports' | 'sport_specific' | 'multi_sport',
        title:                title        ?? null,
        audienceJson,
        sportId,
        isPinned:             isPinned     ?? false,
        alsoEmail:            alsoEmail    ?? false,
        emailSubject:         emailSubject ?? null,
        posterProgramRoleId:  effectiveProgramRoleId,
        targetProgramRoleId,
      })

      if (errorCode && errorCode !== 'OK') {
        return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      }

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
