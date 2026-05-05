import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import { sp_GetMemberDetails, sp_UpdateUserRole } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/players/[userId] ────────────────────────────────────────────────
// Returns the user's profile, sport membership rows, and interaction history.
// Allowed if: roster:manage (staff) OR roster:player_accounts (player viewing any record)

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!session.appDb) return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  const { userId } = await params
  const uid = parseInt(userId, 10)

  const [managePerm, accountsPerm] = await Promise.all([
    canAsync(session, 'roster:manage'),
    canAsync(session, 'roster:player_accounts'),
  ])

  if (!managePerm.allowed && !accountsPerm.allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { sportRows, interactions, errorCode } = await sp_GetMemberDetails({ userId: uid })

      if (errorCode === 'USER_NOT_FOUND' || sportRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Player not found.' }, { status: 404 })
      }

      const base = sportRows[0]
      const data = {
        userId:             base.userId,
        email:              base.email,
        firstName:          base.firstName,
        lastName:           base.lastName,
        platformRole:       base.platformRole,
        programRoleId:      base.programRoleId,
        programRoleDisplay: base.programRoleDisplay,
        lastTeamLogin:      base.lastTeamLogin,
        sportRows:          sportRows.filter(r => r.sportIsActive !== false),
      }

      return NextResponse.json({ success: true, data, interactions })
    } catch (err) {
      console.error('[GET /api/players/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to load player.' }, { status: 500 })
    }
  })
}

// ─── PATCH /api/players/[userId] ─────────────────────────────────────────────
// Body: { sportId, positionId?, jerseyNumber?, seasonsPlayed?, classYear? }
// Allowed if: roster:manage (staff editing anyone) OR
//             roster:player_accounts AND uid === session.userId (player editing self)

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!session.appDb) return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  const { userId } = await params
  const uid = parseInt(userId, 10)

  const [managePerm, accountsPerm] = await Promise.all([
    canAsync(session, 'roster:manage'),
    canAsync(session, 'roster:player_accounts'),
  ])

  const isSelf  = uid === session.userId
  const canEdit = managePerm.allowed || (accountsPerm.allowed && isSelf)

  if (!canEdit) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const sportId = body.sportId != null ? Number(body.sportId) : undefined
  if (!sportId) {
    return NextResponse.json({ success: false, error: 'sportId is required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode } = await sp_UpdateUserRole({
        userId:        uid,
        sportId,
        positionId:    body.positionId    != null ? Number(body.positionId)   : null,
        jerseyNumber:  body.jerseyNumber  != null ? Number(body.jerseyNumber)  : null,
        seasonsPlayed: body.seasonsPlayed != null ? Number(body.seasonsPlayed) : null,
        classYear:     body.classYear     != null ? Number(body.classYear)     : null,
        adminUserId:   session.userId,
      })
      if (errorCode) return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[PATCH /api/players/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to update player.' }, { status: 500 })
    }
  })
}
