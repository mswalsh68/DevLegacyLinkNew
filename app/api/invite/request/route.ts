// POST /api/invite/request
// Submits a self-signup access request.
// Handles two sub-flows:
//   mode: 'signup' — creates a new account then submits request
//   mode: 'login'  — verifies existing credentials then submits request
// In both cases the user ends up logged in (JWT cookie set) with a pending request.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import sql from 'mssql'

const requestSchema = z.object({
  token:     z.string().min(1).max(200),
  mode:      z.enum(['signup', 'login', 'claim']).default('signup'),
  email:     z.string().email().max(255),
  password:  z.string().min(8).max(128).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
})

function extractAppNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return (raw as Array<Record<string, unknown>>).map(p => String(p.app)).filter(Boolean)
}
import { getPool, appDbContext } from '@/lib/db/connection'
import {
  sp_RegisterUserViaInvite,
  sp_SubmitAccessRequest,
  sp_ActivatePendingAccount,
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
  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      { status: 422 },
    )
  }

  const token = parsed.data.token.trim()
  const mode  = parsed.data.mode
  const email = parsed.data.email.trim().toLowerCase()

  let cfg: ReturnType<typeof getConfig>
  try { cfg = getConfig() } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  const isProd = process.env.NODE_ENV === 'production'
  const cookieBase = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' }

  // ── Resolve userId and build JWT payload ──────────────────────────────────
  let userId:   number                    = 0
  let userJson: Record<string, unknown>  = {}

  if (mode === 'signup') {
    const password  = parsed.data.password  ?? ''
    const firstName = (parsed.data.firstName ?? '').trim()
    const lastName  = (parsed.data.lastName  ?? '').trim()

    if (!password) {
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
      // Tell the UI whether to switch to claim (INVITE_PENDING) or login (real account)
      const db        = await getPool('global')
      const checkReq  = db.request()
      checkReq.input('Email', sql.NVarChar(255), email)
      const checkRes  = await checkReq.query<{ isPending: number }>(
        `SELECT CASE WHEN password_hash = 'INVITE_PENDING' THEN 1 ELSE 0 END AS isPending
         FROM dbo.users WHERE email = @Email`
      )
      const isPending = (checkRes.recordset[0]?.isPending ?? 0) === 1
      return NextResponse.json({ error: 'EMAIL_EXISTS', isPending }, { status: 409 })
    }
    if (!newId) {
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
    }

    userId = newId
    userJson = { email, firstName, lastName, roleId: 3, role: 'client', appPermissions: [], teams: [] }

  } else if (mode === 'login') {
    // Login flow — call sp_Login directly (same pattern as /api/auth/login)
    const password = parsed.data.password ?? ''
    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
    }

    try {
      const db      = await getPool('global')
      const request = db.request()
      request.input ('Email',       sql.NVarChar(255), email)
      request.input ('IpAddress',   sql.NVarChar(100), req.headers.get('x-forwarded-for') ?? null)
      request.input ('DeviceInfo',  sql.NVarChar(255), req.headers.get('user-agent')      ?? null)
      request.output('UserId',      sql.BigInt)
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

      userId   = output.UserId as number
      userJson = JSON.parse(output.UserJson as string) as Record<string, unknown>
      userJson.apps = extractAppNames(userJson.appPermissions)
    } catch (err) {
      console.error('[POST /api/invite/request] login error', err)
      return NextResponse.json({ error: 'Login failed.' }, { status: 500 })
    }
  }

  // ── Claim mode: activate an INVITE_PENDING account ───────────────────────
  if (mode === 'claim') {
    const password = parsed.data.password ?? ''
    if (!password) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 422 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const { userId: activatedId, errorCode: activateErr } = await sp_ActivatePendingAccount({
      email, newPasswordHash: passwordHash,
    })

    if (activateErr === 'NOT_PENDING') {
      return NextResponse.json(
        { error: 'No pending account found for this email. Please sign in with your existing password.' },
        { status: 409 },
      )
    }
    if (!activatedId) {
      return NextResponse.json({ error: 'Failed to activate account.' }, { status: 500 })
    }

    // Default — overwritten below if login succeeds.
    userId   = activatedId
    userJson = { email, roleId: 3, role: 'client', appPermissions: [], teams: [] }

    // Determine whether to skip the approval queue.
    // Admin-created users already have a user_teams row — they bypass /pending.
    // Self-signup users have no team access yet and need admin approval.
    let skipPending = false
    try {
      const db     = await getPool('global')
      const check  = await db.request()
        .input('UserId', sql.BigInt, activatedId)
        .query<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM dbo.user_teams WHERE user_id = @UserId AND is_active = 1')
      skipPending = (check.recordset[0]?.cnt ?? 0) > 0
    } catch {
      // Non-fatal: default to needing approval if the check fails.
    }

    if (skipPending) {
      // Admin-created user — call sp_Login to populate a proper JWT payload.
      try {
        const db        = await getPool('global')
        const loginReq  = db.request()
        loginReq.input ('Email',         sql.NVarChar(255),     email)
        loginReq.input ('IpAddress',     sql.NVarChar(100),     req.headers.get('x-forwarded-for') ?? null)
        loginReq.input ('DeviceInfo',    sql.NVarChar(255),     req.headers.get('user-agent')      ?? null)
        loginReq.output('UserId',        sql.BigInt)
        loginReq.output('PasswordHash',  sql.NVarChar(sql.MAX))
        loginReq.output('UserJson',      sql.NVarChar(sql.MAX))
        loginReq.output('ErrorCode',     sql.NVarChar(50))
        const { output: loginOut } = await loginReq.execute('dbo.sp_Login')

        if (!loginOut.ErrorCode && loginOut.UserJson) {
          userId   = loginOut.UserId as number
          userJson = JSON.parse(loginOut.UserJson as string) as Record<string, unknown>
          userJson.apps = extractAppNames(userJson.appPermissions)

          // Derive programRoleId from App DB for sport-role-aware session data.
          if (userJson.roleId === 3 && userJson.appDb && userId) {
            try {
              const programRoleId = await appDbContext.run(userJson.appDb as string, async () => {
                const appPool = await getPool('app')
                const r = await appPool
                  .request()
                  .input('UserId', sql.BigInt, userId)
                  .query('SELECT MIN(program_role_id) AS program_role_id FROM dbo.users_sports WHERE user_id = @UserId AND is_active = 1')
                return r.recordset[0]?.program_role_id as number | undefined
              })
              if (programRoleId != null) {
                userJson.programRoleId = programRoleId
                if (programRoleId === 7)      userJson.apps = ['alumni']
                else if (programRoleId === 8) userJson.apps = ['roster']
                else                          userJson.apps = ['roster', 'alumni']
              }
            } catch (appErr) {
              console.warn('[invite/claim] Could not fetch programRoleId:', appErr)
            }
          }
        }
      } catch (loginErr) {
        console.warn('[invite/claim] sp_Login after activation failed:', loginErr)
        // User still has team access — skipPending stays true.
      }
    } else {
      // Self-signup user — submit access request for admin review.
      await sp_SubmitAccessRequest({ userId: activatedId, token }).catch(() => {})
    }

    // Issue JWT and return — redirect field tells the client where to go
    const subStr      = String(userId)
    const accessToken = await new SignJWT({ sub: subStr, userId, ...userJson })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(cfg.accessExpiry)
      .sign(cfg.jwtSecret)

    const refreshToken = await new SignJWT({ sub: subStr })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(cfg.refreshExpiry)
      .sign(cfg.refreshSecret)

    const claimResponse = NextResponse.json({
      success:  true,
      // roleId 3 = client (player/alumni) — land on feed; staff land on dashboard.
      redirect: skipPending ? (userJson.roleId === 3 ? '/feed' : '/dashboard') : '/pending',
      data:     { user: { userId, ...userJson }, accessToken },
    })
    claimResponse.cookies.set('access_token',  accessToken,  { ...cookieBase, maxAge: 15 * 60 })
    claimResponse.cookies.set('refresh_token', refreshToken, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 })
    return claimResponse
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
  const subStr = String(userId)
  const accessToken = await new SignJWT({ sub: subStr, userId, ...userJson })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(cfg.accessExpiry)
    .sign(cfg.jwtSecret)

  const refreshToken = await new SignJWT({ sub: subStr })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(cfg.refreshExpiry)
    .sign(cfg.refreshSecret)

  const response = NextResponse.json({
    success:   true,
    requestId: requestId,
    data:      { user: { userId, ...userJson }, accessToken },
  })

  response.cookies.set('access_token',  accessToken,  { ...cookieBase, maxAge: 15 * 60 })
  response.cookies.set('refresh_token', refreshToken, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 })

  return response
}
