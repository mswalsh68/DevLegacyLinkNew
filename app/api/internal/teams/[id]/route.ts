import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_UpdateTeam } from '@/lib/db/procedures'

// ─── PATCH /api/internal/teams/[id] ──────────────────────────────────────────

const patchSchema = z.object({
  name:     z.string().min(1).max(100).optional(),
  tierId:   z.number().int().min(1).optional(),
  levelId:  z.number().int().min(1).optional(),
  appDb:    z.string().min(1).max(150).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session || !isGlobalAdmin(session)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const teamId = parseInt(id, 10)
  if (!teamId) return NextResponse.json({ success: false, error: 'Invalid team ID.' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 })
  }

  const p = patchSchema.safeParse(body)
  if (!p.success) {
    return NextResponse.json({ success: false, error: p.error.issues[0]?.message ?? 'Validation failed' }, { status: 400 })
  }

  try {
    const { errorCode } = await sp_UpdateTeam({
      teamId,
      name:     p.data.name     ?? null,
      tierId:   p.data.tierId   ?? null,
      levelId:  p.data.levelId  ?? null,
      appDb:    p.data.appDb    ?? null,
      isActive: p.data.isActive ?? null,
      actorId:  session.userId,
    })

    if (errorCode === 'TEAM_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Team not found.' }, { status: 404 })
    }
    if (errorCode) return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/internal/teams/[id]]', err)
    return NextResponse.json({ success: false, error: 'Failed to update team.' }, { status: 500 })
  }
}
