import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import { sp_GetCampaigns, sp_CreateCampaign } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { sanitizePostHtml } from '@/lib/sanitize'

const createCampaignSchema = z.object({
  name:           z.string().min(1).max(200),
  targetAudience: z.string().min(1).max(50),
  subjectLine:    z.string().max(200).optional().nullable(),
  bodyHtml:       z.string().max(100_000).optional().nullable(),
  description:    z.string().max(500).optional().nullable(),
  fromName:       z.string().max(100).optional().nullable(),
  replyToEmail:   z.union([z.literal(''), z.string().email().max(255)]).optional().nullable(),
  sportId:        z.union([z.number().int().positive(), z.string()]).optional().nullable(),
})

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

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createCampaignSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 422 },
    )
  }

  const body = parsed.data
  const sportId = body.sportId != null
    ? parseInt(String(body.sportId), 10) || null
    : null

  return appDbContext.run(session.appDb, async () => {
    try {
      const { campaignId, errorCode } = await sp_CreateCampaign({
        name:           body.name,
        createdBy:      session.userId,
        targetAudience: body.targetAudience,
        subjectLine:    body.subjectLine                                   ?? null,
        bodyHtml:       body.bodyHtml ? sanitizePostHtml(body.bodyHtml)   : null,
        description:    body.description                                   ?? null,
        fromName:       body.fromName                                      ?? null,
        replyToEmail:   body.replyToEmail                                  ?? null,
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
