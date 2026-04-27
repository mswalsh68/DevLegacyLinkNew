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
import { getServerSession } from '@/lib/auth'
import { sp_SwitchTeam } from '@/lib/db/procedures'

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

    // Re-issue the access token with currentTeamId updated.
    // Spread the existing session claims so username, role, apps etc. are preserved.
    const { userId: _uid, sub: _sub, exp: _exp, iat: _iat, ...restClaims } = session
    const newAccessToken = await new SignJWT({
      sub:           session.userId,
      ...restClaims,
      currentTeamId: teamId,
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
