import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetMemberDetails, sp_UpdateUserRole } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/alumni/[userId] ─────────────────────────────────────────────────
// Returns the user's profile, sport membership rows, and interaction history.
// sportRows: one entry per users_sports row (user may have multiple sports).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'alumni:view')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await params
  const uid = parseInt(userId, 10)

  return appDbContext.run(session.appDb, async () => {
    try {
      const { sportRows, interactions, errorCode } = await sp_GetMemberDetails({ userId: uid })

      if (errorCode === 'USER_NOT_FOUND' || sportRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Alumni record not found.' }, { status: 404 })
      }

      const base = sportRows[0]
      const data = {
        userId:        base.userId,
        email:         base.email,
        firstName:     base.firstName,
        lastName:      base.lastName,
        lastTeamLogin: base.lastTeamLogin,
        sportRows:     sportRows.filter(r => r.sportIsActive !== false),
      }

      return NextResponse.json({ success: true, data, interactions })
    } catch (err) {
      console.error('[GET /api/alumni/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to load alumni record.' }, { status: 500 })
    }
  })
}

// ─── PATCH /api/alumni/[userId] ───────────────────────────────────────────────
// Body: { sportId, positionId?, jerseyNumber?, seasonsPlayed?, classYear? }
// userId comes from the URL; sportId identifies which sport membership to update.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'alumni:edit')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await params
  const uid = parseInt(userId, 10)

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
      console.error('[PATCH /api/alumni/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to update alumni record.' }, { status: 500 })
    }
  })
}
