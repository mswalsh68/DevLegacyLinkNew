// POST /api/invite/request
// Submits a self-signup access request.
// Handles two sub-flows:
//   mode: 'signup' — creates a new account then submits request
//   mode: 'login'  — verifies existing credentials then submits request
// In both cases the user ends up logged in (JWT cookie set) with a pending request.
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import sql from 'mssql'
import { getPool } from '@/lib/db/connection'
import {
  sp_RegisterUserViaInvite,
  sp_SubmitAccessRequest,
} from '@/lib/db/procedures'

function getConfig() {
  const jwtSecret     = process.env.JWT_ACCESS_SECRET
  const refreshSecret = process.env.JWT_REFRESH_SECRET
  if (!jwtSecret || !refreshSecret) {
    throw new Error('[/api/invite/request] Missing JWT secret env vars.')
  }
  return {
    jwtSecret:     new TextEncoder().encode(jwtSecret),
    refreshSecret: new TextEncoder().encode(refreshSecret),
    accessExpiry:  process.env.JWT_EXPIRES_IN           ?? '15m',
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const mode  = body.mode === 'login' ? 'login' : 'signup'
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!token) return NextResponse.json({ error: 'Invite code is required.' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'Email is required.'       }, { status: 400 })

  let cfg: ReturnType<typeof getConfig>
  try { cfg = getConfig() } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  const isProd = process.env.NODE_ENV === 'production'
  const cookieBase = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' }

  // ── Resolve userId and build JWT payload ──────────────────────────────────
  let userId:   string
  let userJson: Record<string, unknown>

  if (mode === 'signup') {
    const password  = typeof body.password  === 'string' ? body.password  : ''
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName  = typeof body.lastName  === 'string' ? body.lastName.trim()  : ''

    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 422 })
    }
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'First and last name are required.' }, { status: 422 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const { userId: newId, errorCode } = await sp_RegisterUserViaInvite({
      email, passwordHash, firstName, lastName,
    })

    if (errorCode === 'EMAIL_EXISTS') {
      return NextResponse.json(
        { error: 'An account with that email already exists. Please sign in instead.' },
        { status: 409 },
      )
    }
    if (!newId) {
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
    }

    userId   = newId
    userJson = { email, firstName, lastName, roleId: 7, role: 'alumni', appPermissions: [], teams: [] }

  } else {
    // Login flow — call sp_Login directly (same pattern as /api/auth/login)
    const password = typeof body.password === 'string' ? body.password : ''
    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
    }

    try {
      const db      = await getPool('global')
      const request = db.request()
      request.input ('Email',       sql.NVarChar(255), email)
      request.input ('IpAddress',   sql.NVarChar(100), req.headers.get('x-forwarded-for') ?? null)
      request.input ('DeviceInfo',  sql.NVarChar(255), req.headers.get('user-agent')      ?? null)
      request.output('UserId',      sql.UniqueIdentifier)
      request.output('PasswordHash',sql.NVarChar(sql.MAX))
      request.output('UserJson',    sql.NVarChar(sql.MAX))
      request.output('ErrorCode',   sql.NVarChar(50))

      const { output } = await request.execute('dbo.sp_Login')

      if (output.ErrorCode) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
      }

      const passwordOk = await bcrypt.compare(password, output.PasswordHash as string)
      if (!passwordOk) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
      }

      userId   = output.UserId as string
      userJson = JSON.parse(output.UserJson as string) as Record<string, unknown>
    } catch (err) {
      console.error('[POST /api/invite/request] login error', err)
      return NextResponse.json({ error: 'Login failed.' }, { status: 500 })
    }
  }

  // ── Submit access request ─────────────────────────────────────────────────
  const { requestId, errorCode: reqErr } = await sp_SubmitAccessRequest({ userId, token })

  if (reqErr === 'INVALID_CODE') {
    return NextResponse.json({ error: 'Invalid invite code.' }, { status: 404 })
  }
  if (reqErr && reqErr !== 'ALREADY_PENDING') {
    const messages: Record<string, string> = {
      INACTIVE:        'This invite code has been deactivated.',
      EXPIRED:         'This invite code has expired.',
      MAX_USES_REACHED:'This invite code has reached its maximum number of uses.',
    }
    return NextResponse.json(
      { error: messages[reqErr] ?? 'Could not submit request.' },
      { status: 410 },
    )
  }

  // ── Issue JWT so user is logged in ────────────────────────────────────────
  const accessToken = await new SignJWT({ sub: userId, ...userJson })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(cfg.accessExpiry)
    .sign(cfg.jwtSecret)

  const refreshToken = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(cfg.refreshExpiry)
    .sign(cfg.refreshSecret)

  const response = NextResponse.json({
    success:   true,
    requestId: requestId,
    data:      { user: { id: userId, ...userJson }, accessToken },
  })

  response.cookies.set('access_token',  accessToken,  { ...cookieBase, maxAge: 15 * 60 })
  response.cookies.set('refresh_token', refreshToken, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 })

  return response
}
