// GET  /api/invite/codes?teamId=<int>   — list codes for a team (global_admin only)
// POST /api/invite/codes               — create a new invite code (global_admin only)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireSession, isGlobalAdmin } from '@/lib/auth'
import { sp_ListInviteCodes, sp_CreateInviteCode } from '@/lib/db/procedures'

const createCodeSchema = z.object({
  teamId:    z.union([z.number().int().positive(), z.string()]).optional().nullable(),
  role:      z.enum(['roster', 'alumni', 'staff']).default('roster'),
  maxUses:   z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession({ appDb: false })
  if (error) return error
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const teamIdStr = req.nextUrl.searchParams.get('teamId')
  const teamId = teamIdStr ? parseInt(teamIdStr, 10) : session.currentTeamId
  if (!teamId || (typeof teamId === 'number' && isNaN(teamId))) return NextResponse.json({ error: 'teamId is required.' }, { status: 400 })

  try {
    const rows = await sp_ListInviteCodes({ teamId })
    return NextResponse.json({ success: true, data: Array.from(rows) })
  } catch (err) {
    console.error('[GET /api/invite/codes]', err)
    return NextResponse.json({ error: 'Failed to fetch invite codes.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { session, error: authErr } = await requireSession({ appDb: false })
  if (authErr) return authErr
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = createCodeSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      { status: 422 },
    )
  }

  const teamIdRaw = parsed.data.teamId
  const teamId = teamIdRaw != null
    ? parseInt(String(teamIdRaw), 10)
    : (session.currentTeamId ?? 0)
  const role      = parsed.data.role
  const maxUses   = parsed.data.maxUses   ?? null
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null

  if (!teamId || isNaN(teamId)) return NextResponse.json({ error: 'teamId is required.' }, { status: 400 })

  const token = randomUUID()

  try {
    const { inviteCodeId, errorCode } = await sp_CreateInviteCode({
      teamId,
      role,
      token,
      createdBy: session.userId,
      expiresAt,
      maxUses,
    })

    if (errorCode) {
      const messages: Record<string, string> = {
        TEAM_NOT_FOUND: 'Team not found.',
        FORBIDDEN:      'You do not have access to this team.',
      }
      return NextResponse.json(
        { error: messages[errorCode] ?? errorCode },
        { status: 400 },
      )
    }

    // Return the shareable URL
    const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const inviteUrl = `${baseUrl}/join?code=${token}`

    return NextResponse.json({
      success: true,
      data: { inviteCodeId, token, inviteUrl },
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/invite/codes]', err)
    return NextResponse.json({ error: 'Failed to create invite code.' }, { status: 500 })
  }
}
