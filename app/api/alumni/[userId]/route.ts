import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetMemberDetails, sp_UpdateUserRole } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/alumni/[userId] ─────────────────────────────────────────────────
// Returns the user's alumni role records + interaction history.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!session.appDb) return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  const { userId } = await params
  const uid = parseInt(userId, 10)

  return appDbContext.run(session.appDb, async () => {
    try {
      const { roles, interactions, errorCode } = await sp_GetMemberDetails({ userId: uid })

      if (errorCode === 'USER_NOT_FOUND' || roles.length === 0) {
        return NextResponse.json({ success: false, error: 'Alumni record not found.' }, { status: 404 })
      }

      const base = roles[0]
      const data = {
        userId:        base.userId,
        email:         base.email,
        firstName:     base.firstName,
        lastName:      base.lastName,
        platformRole:  base.platformRole,
        lastTeamLogin: base.lastTeamLogin,
        roles:         roles.filter(r => r.status === 'alumni'),
      }

      return NextResponse.json({ success: true, data, interactions })
    } catch (err) {
      console.error('[GET /api/alumni/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to load alumni record.' }, { status: 500 })
    }
  })
}

// ─── PATCH /api/alumni/[userId] ───────────────────────────────────────────────
// Body: { userRoleId, positionId?, jerseyNumber?, seasonsPlayed?, classYear? }
// userRoleId is required — returned by GET as roles[n].userRoleId.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!session.appDb) return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  await params   // unused — update is by userRoleId in body

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const userRoleId = body.userRoleId != null ? Number(body.userRoleId) : undefined
  if (!userRoleId) {
    return NextResponse.json({ success: false, error: 'userRoleId is required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode } = await sp_UpdateUserRole({
        userRoleId,
        positionId:    body.positionId    != null ? Number(body.positionId)   : null,
        jerseyNumber:  body.jerseyNumber  != null ? Number(body.jerseyNumber)  : null,
        seasonsPlayed: body.seasonsPlayed != null ? Number(body.seasonsPlayed) : null,
        classYear:     body.classYear     != null ? Number(body.classYear)     : null,
        adminUserId:   session.userId,
      })
      if (errorCode) return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[PATCH /api/alumni/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to update alumni record.' }, { status: 500 })
    }
  })
}
