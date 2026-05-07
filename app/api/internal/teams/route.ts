import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_GetTeams, sp_CreateTeam } from '@/lib/db/procedures'

// ─── GET /api/internal/teams ──────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession()
  if (!session || !isGlobalAdmin(session)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const teams = await sp_GetTeams({ includeInactive: true })
    return NextResponse.json({ success: true, data: teams })
  } catch (err) {
    console.error('[GET /api/internal/teams]', err)
    return NextResponse.json({ success: false, error: 'Failed to load teams.' }, { status: 500 })
  }
}

// ─── POST /api/internal/teams ─────────────────────────────────────────────────

const createSchema = z.object({
  name:    z.string().min(1).max(100),
  abbr:    z.string().min(1).max(20),
  appDb:   z.string().min(1).max(150),
  tierId:  z.number().int().min(1).default(1),
  levelId: z.number().int().min(1).default(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session || !isGlobalAdmin(session)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 })
  }

  const p = createSchema.safeParse(body)
  if (!p.success) {
    return NextResponse.json({ success: false, error: p.error.issues[0]?.message ?? 'Validation failed' }, { status: 400 })
  }

  try {
    const { teamId, errorCode } = await sp_CreateTeam({
      name:      p.data.name,
      abbr:      p.data.abbr,
      appDb:     p.data.appDb,
      tierId:    p.data.tierId,
      levelId:   p.data.levelId,
      createdBy: session.userId,
    })

    if (errorCode) return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    return NextResponse.json({ success: true, data: { teamId } }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/internal/teams]', err)
    return NextResponse.json({ success: false, error: 'Failed to create team.' }, { status: 500 })
  }
}
