import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import { sp_GetCampaigns, sp_CreateCampaign } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/campaigns ───────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!(await canAsync(session, 'feed:view')).allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const sportIdParam = searchParams.get('sportId')
  const sportId      = sportIdParam ? parseInt(sportIdParam, 10) || null : null

  return appDbContext.run(session.appDb, async () => {
    try {
      const rows = await sp_GetCampaigns({ sportId })
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
  const { session, error: authErr } = await requireSession()
  if (authErr) return authErr

  if (!(await canAsync(session, 'feed:post')).allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    name:           string
    targetAudience: string
    subjectLine?:   string | null
    bodyHtml?:      string | null
    description?:   string | null
    fromName?:      string | null
    replyToEmail?:  string | null
    sportId?:       number | string | null   // accept both INT and "1"
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.targetAudience) {
    return NextResponse.json({ success: false, error: 'name and targetAudience are required' }, { status: 400 })
  }

  const sportId = body.sportId != null
    ? parseInt(String(body.sportId), 10) || null
    : null

  return appDbContext.run(session.appDb, async () => {
    try {
      const { campaignId, errorCode } = await sp_CreateCampaign({
        name:           body.name,
        createdBy:      session.userId,
        targetAudience: body.targetAudience,
        subjectLine:    body.subjectLine  ?? null,
        bodyHtml:       body.bodyHtml     ?? null,
        description:    body.description  ?? null,
        fromName:       body.fromName     ?? null,
        replyToEmail:   body.replyToEmail ?? null,
        sportId,
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
