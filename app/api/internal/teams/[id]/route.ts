import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { execFull } from '@/lib/db/connection'
import * as sql from 'mssql'

// ─── PATCH /api/internal/teams/[id] ──────────────────────────────────────────
// Admin-only: update tier, level, appDb, isActive for a team.

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
    const { output } = await execFull('global', 'sp_UpdateTeam', (r) => {
      r.input ('TeamId',    sql.Int,           teamId)
      r.input ('Name',      sql.NVarChar(100), p.data.name      ?? null)
      r.input ('TierId',    sql.Int,           p.data.tierId    ?? null)
      r.input ('LevelId',   sql.Int,           p.data.levelId   ?? null)
      r.input ('AppDb',     sql.NVarChar(150), p.data.appDb     ?? null)
      r.input ('IsActive',  sql.Bit,           p.data.isActive  ?? null)
      r.input ('ActorId',   sql.BigInt,        session.userId)
      r.output('ErrorCode', sql.NVarChar(50))
    })

    const errorCode = output.ErrorCode as string | null
    if (errorCode === 'TEAM_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Team not found.' }, { status: 404 })
    }
    if (errorCode) {
      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/internal/teams/[id]]', err)
    return NextResponse.json({ success: false, error: 'Failed to update team.' }, { status: 500 })
  }
}
