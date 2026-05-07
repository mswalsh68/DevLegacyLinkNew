import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { exec, execFull } from '@/lib/db/connection'
import * as sql from 'mssql'

// ─── GET /api/internal/teams ──────────────────────────────────────────────────
// Returns all teams (active + inactive) for the global admin UI.

export async function GET() {
  const session = await getServerSession()
  if (!session || !isGlobalAdmin(session)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('global', 'sp_GetTeams', (r) => {
      r.input('IncludeInactive', sql.Bit, 1)
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (err) {
    console.error('[GET /api/internal/teams]', err)
    return NextResponse.json({ success: false, error: 'Failed to load teams.' }, { status: 500 })
  }
}

// ─── POST /api/internal/teams ─────────────────────────────────────────────────
// Provisions a new team. team_config auto-seeds on first sp_GetTeamConfig call.

const createSchema = z.object({
  name:    z.string().min(1).max(100),
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
    const { output } = await execFull('global', 'sp_CreateTeam', (r) => {
      r.input ('Name',      sql.NVarChar(100), p.data.name)
      r.input ('AppDb',     sql.NVarChar(150), p.data.appDb)
      r.input ('TierId',    sql.Int,           p.data.tierId)
      r.input ('LevelId',   sql.Int,           p.data.levelId)
      r.input ('CreatedBy', sql.BigInt,        session.userId)
      r.output('NewTeamId', sql.Int)
      r.output('ErrorCode', sql.NVarChar(50))
    })

    const errorCode = output.ErrorCode as string | null
    if (errorCode) {
      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: { teamId: output.NewTeamId as number } }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/internal/teams]', err)
    return NextResponse.json({ success: false, error: 'Failed to create team.' }, { status: 500 })
  }
}
