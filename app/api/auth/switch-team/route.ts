// POST /api/auth/switch-team
// Validates the user has access to the requested team, re-issues the JWT
// with currentTeamId updated, and sets a new access_token cookie.
//
// After a successful response the client does window.location.href = '/dashboard'
// so ThemeProvider re-mounts fresh and /api/config returns the correct team.
//
// Copied from the original project's switch-team pattern.
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_SwitchTeam, sp_UpsertUser } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

function getConfig() {
  const jwtSecret = process.env.JWT_ACCESS_SECRET
  if (!jwtSecret) throw new Error('[switch-team] Missing JWT_ACCESS_SECRET')
  return {
    jwtSecret:    new TextEncoder().encode(jwtSecret),
    accessExpiry: process.env.JWT_EXPIRES_IN ?? '15m',
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let teamId: number | undefined
  try {
    const body = await req.json()
    const raw = body?.teamId
    teamId = typeof raw === 'number' ? raw : (typeof raw === 'string' ? parseInt(raw, 10) : undefined)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!teamId || isNaN(teamId)) {
    return NextResponse.json({ error: 'teamId required.' }, { status: 400 })
  }

  // Non-platform-owners are scoped to a single team. They may only switch to
  // the team already embedded in their JWT (e.g. refreshing after a team setup),
  // not to arbitrary other clients.
  if (!isGlobalAdmin(session) && session.currentTeamId && session.currentTeamId !== teamId) {
    return NextResponse.json({ success: false, error: 'ACCESS_DENIED' }, { status: 403 })
  }

  let cfg: ReturnType<typeof getConfig>
  try {
    cfg = getConfig()
  } catch (err) {
    console.error('[switch-team] Config error:', err)
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  try {
    const { teamJson, errorCode } = await sp_SwitchTeam({
      userId:    session.userId,
      newTeamId: teamId,
    })

    if (errorCode) {
      const status = errorCode === 'ACCESS_DENIED' ? 403 : 404
      return NextResponse.json({ success: false, error: errorCode }, { status })
    }

    const teamData = teamJson ? (JSON.parse(teamJson) as Record<string, unknown>) : {}

    // ── Sync this staff user into the App DB ──────────────────────────────────
    // Players/alumni are synced via addPlayerToRoster/addAlumniRecord, but staff
    // users (coaches, admins, etc.) only pass through login + switch-team and are
    // never otherwise inserted into the App DB's dbo.users. Without a row there,
    // any FK to dbo.users (e.g. feed_post_reads) fails for staff.
    // The appDb name lives on teamData (returned by sp_SwitchTeam) or falls back
    // to the current session's appDb.
    const appDb = (teamData.appDb as string | undefined) ?? session.appDb
    if (appDb) {
      const sess = session as unknown as Record<string, unknown>
      const firstName = String(sess.firstName ?? sess.username ?? session.email.split('@')[0])
      const lastName  = String(sess.lastName  ?? '')
      try {
        await appDbContext.run(appDb, () =>
          sp_UpsertUser({
            userId:       session.userId,
            email:        session.email,
            firstName,
            lastName,
            platformRole: session.role,
            globalRoleId: session.roleId,
          })
        )
      } catch (upsertErr) {
        // Non-fatal — log and continue. The switch will succeed; read tracking
        // may still warn until the DB is reachable.
        console.warn('[switch-team] sp_UpsertUser skipped:', (upsertErr as Error).message)
      }
    }

    // Re-issue the access token with currentTeamId and tierId updated.
    // Spread the existing session claims so username, role, apps etc. are preserved.
    const { userId: _uid, exp: _exp, iat: _iat, ...restClaims } = session
    const newAccessToken = await new SignJWT({
      sub:           String(session.userId),
      userId:        session.userId,
      ...restClaims,
      currentTeamId: teamId,
      tierId:        (teamData.tierId as number | undefined) ?? session.tierId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(cfg.accessExpiry)
      .sign(cfg.jwtSecret)

    const isProd = process.env.NODE_ENV === 'production'
    const response = NextResponse.json({
      success: true,
      data: { accessToken: newAccessToken, teamData },
    })
    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure:   isProd,
      sameSite: 'lax',
      path:     '/',
      maxAge:   15 * 60,
    })
    return response

  } catch (err) {
    console.error('[switch-team] Error:', err)
    return NextResponse.json({ error: 'Failed to switch team.' }, { status: 500 })
  }
}
