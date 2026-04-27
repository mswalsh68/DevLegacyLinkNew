// GET  /api/invite/codes?teamId=<int>   — list codes for a team (global_admin only)
// POST /api/invite/codes               — create a new invite code (global_admin only)
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_ListInviteCodes, sp_CreateInviteCode } from '@/lib/db/procedures'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session)         return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
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
  const session = await getServerSession()
  if (!session)         return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const teamIdRaw = body.teamId
  const teamId = typeof teamIdRaw === 'number' ? teamIdRaw
               : typeof teamIdRaw === 'string' ? parseInt(teamIdRaw, 10)
               : (session.currentTeamId ?? 0)
  const role     = typeof body.role     === 'string' ? body.role     : 'roster'
  const maxUses  = typeof body.maxUses  === 'number' ? body.maxUses  : null
  const expiresAt= body.expiresAt ? new Date(body.expiresAt as string) : null

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
