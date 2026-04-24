import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetCampaigns, sp_CreateCampaign } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/campaigns ───────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  // Any staff who can see alumni or player feeds can see campaigns
  if (!can(session, 'feed:alumni') && !can(session, 'feed:players')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const rows = await sp_GetCampaigns({
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })
      return NextResponse.json({ success: true, data: rows })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/campaigns]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load campaigns' }, { status: 500 })
    }
  })
}

// ─── POST /api/campaigns ──────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!can(session, 'feed:alumni') && !can(session, 'feed:players')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  let body: {
    name:           string
    targetAudience: string
    subjectLine?:   string | null
    bodyHtml?:      string | null
    description?:   string | null
    fromName?:      string | null
    replyToEmail?:  string | null
    sportId?:       string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.targetAudience) {
    return NextResponse.json({ success: false, error: 'name and targetAudience are required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { campaignId, errorCode } = await sp_CreateCampaign({
        name:           body.name,
        createdBy:      session.userId,
        targetAudience: body.targetAudience,
        subjectLine:    body.subjectLine  ?? undefined,
        bodyHtml:       body.bodyHtml     ?? undefined,
        description:    body.description  ?? undefined,
        fromName:       body.fromName     ?? undefined,
        replyToEmail:   body.replyToEmail ?? undefined,
        sportId:        body.sportId      ?? undefined,
      })

      if (errorCode && errorCode !== 'OK') {
        return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      }

      return NextResponse.json({ success: true, data: { id: campaignId } }, { status: 201 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[POST /api/campaigns]', msg)
      return NextResponse.json({ success: false, error: 'Failed to create campaign' }, { status: 500 })
    }
  })
}
