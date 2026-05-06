// POST /api/auth/refresh
// Verifies the refresh_token httpOnly cookie, issues a new access_token.
// The browser sends refresh_token automatically (credentials: 'include').
// On success: sets a new access_token cookie and returns 200.
// On failure: returns 401 — the client clears state and redirects to /login.

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'
import { getPool, appDbContext } from '@/lib/db/connection'
import sql from 'mssql'

function extractAppNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return (raw as Array<Record<string, unknown>>).map(p => String(p.app)).filter(Boolean)
}

function getSecrets() {
  const accessSecret  = process.env.JWT_ACCESS_SECRET
  const refreshSecret = process.env.JWT_REFRESH_SECRET
  if (!accessSecret || !refreshSecret) {
    throw new Error('[/api/auth/refresh] Missing JWT secrets in env vars.')
  }
  return {
    accessKey:   new TextEncoder().encode(accessSecret),
    refreshKey:  new TextEncoder().encode(refreshSecret),
    accessExpiry: process.env.JWT_EXPIRES_IN ?? '15m',
  }
}

export async function POST(req: NextRequest) {
  let secrets: ReturnType<typeof getSecrets>
  try {
    secrets = getSecrets()
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  // ── Read refresh token from httpOnly cookie ────────────────────────────────
  const refreshToken = req.cookies.get('refresh_token')?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token.' }, { status: 401 })
  }

  // ── Verify refresh token ───────────────────────────────────────────────────
  let userId: number
  try {
    const { payload } = await jwtVerify(refreshToken, secrets.refreshKey)
    const raw = payload.userId ?? (payload.sub ? Number(payload.sub) : undefined)
    userId = Number(raw)
    if (!userId || isNaN(userId)) throw new Error('Missing userId in refresh token payload.')
  } catch {
    return NextResponse.json({ error: 'Invalid or expired refresh token.' }, { status: 401 })
  }

  // ── Fetch fresh user data from DB ──────────────────────────────────────────
  let userJson: Record<string, unknown> = { userId }

  // Read currentTeamId from body so sp_GetUserSession resolves the right team.
  let currentTeamId: number | undefined
  try {
    const body = await req.json() as { currentTeamId?: number }
    if (body?.currentTeamId) currentTeamId = body.currentTeamId
  } catch { /* no body / not JSON — ignore */ }

  try {
    const db   = await getPool('global')
    const req2 = db.request()
    req2.input ('UserId',        sql.BigInt,            userId)
    req2.input ('CurrentTeamId', sql.Int,               currentTeamId ?? null)
    req2.output('UserJson',      sql.NVarChar(sql.MAX))
    req2.output('ErrorCode',     sql.NVarChar(50))

    const { output } = await req2.execute('dbo.sp_GetUserSession')
    if (!output.ErrorCode && output.UserJson) {
      userJson = JSON.parse(output.UserJson as string) as Record<string, unknown>
      userJson.apps = extractAppNames(userJson.appPermissions)
    }
  } catch (err) {
    console.warn('[/api/auth/refresh] DB unavailable, issuing minimal token:', err)
  }

  // ── Override apps from App DB programRoleId (client users only) ────────────
  if (userJson.roleId === 3 && userJson.appDb && userId) {
    try {
      const appDb = userJson.appDb as string
      const programRoleId = await appDbContext.run(appDb, async () => {
        const appPool = await getPool('app')
        const result  = await appPool
          .request()
          .input('UserId', sql.BigInt, userId)
          .query('SELECT MIN(program_role_id) AS program_role_id FROM dbo.users_sports WHERE user_id = @UserId AND is_active = 1')
        return result.recordset[0]?.program_role_id as number | undefined
      })
      if (programRoleId != null) {
        userJson.programRoleId = programRoleId
        if (programRoleId === 7)      userJson.apps = ['alumni']
        else if (programRoleId === 8) userJson.apps = ['roster']
        else                          userJson.apps = ['roster', 'alumni']
      }
    } catch (err) {
      console.warn('[/api/auth/refresh] Could not fetch programRoleId:', (err as Error).message)
    }
  }

  if (currentTeamId) userJson.currentTeamId = currentTeamId

  // ── Sign new access token ──────────────────────────────────────────────────
  const accessToken = await new SignJWT({ sub: String(userId), userId, ...userJson })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(secrets.accessExpiry)
    .sign(secrets.accessKey)

  const isProd   = process.env.NODE_ENV === 'production'
  const response = NextResponse.json({ success: true }, { status: 200 })

  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    path:     '/',
    maxAge:   15 * 60,
  })

  return response
}
