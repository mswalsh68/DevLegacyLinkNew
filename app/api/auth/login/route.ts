import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import sql from 'mssql'
import { getPool } from '@/lib/db/connection'
import { loginSchema } from '@/lib/validations/auth'

// ─── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  const jwtSecret    = process.env.JWT_ACCESS_SECRET
  const refreshSecret = process.env.JWT_REFRESH_SECRET

  if (!jwtSecret || !refreshSecret) {
    throw new Error('[/api/auth/login] Missing JWT_ACCESS_SECRET or JWT_REFRESH_SECRET env vars.')
  }

  return {
    jwtSecret:     new TextEncoder().encode(jwtSecret),
    refreshSecret: new TextEncoder().encode(refreshSecret),
    accessExpiry:  process.env.JWT_EXPIRES_IN      ?? '15m',
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString()

  // Validate config
  let cfg: ReturnType<typeof getConfig>
  try {
    cfg = getConfig()
  } catch (err) {
    console.error('[/api/auth/login] Config error:', err)
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  // Parse + validate body
  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const result = loginSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 422 },
    )
  }

  const { email, password } = result.data
  console.log(`[/api/auth/login] Attempt: ${email} at ${timestamp}`)

  // ── Call sp_Login ────────────────────────────────────────────────────────
  let userId: number
  let passwordHash: string
  let userJson: Record<string, unknown>

  try {
    const db      = await getPool('global')
    const request = db.request()

    request.input('Email',      sql.NVarChar(255), email)
    request.input('IpAddress',  sql.NVarChar(100), req.headers.get('x-forwarded-for') ?? null)
    request.input('DeviceInfo', sql.NVarChar(255), req.headers.get('user-agent') ?? null)
    request.output('UserId',       sql.BigInt)
    request.output('PasswordHash', sql.NVarChar(sql.MAX))
    request.output('UserJson',     sql.NVarChar(sql.MAX))
    request.output('ErrorCode',    sql.NVarChar(50))

    const { output } = await request.execute('dbo.sp_Login')

    if (output.ErrorCode) {
      console.warn(`[/api/auth/login] sp_Login ErrorCode: ${output.ErrorCode} for ${email}`)
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    userId       = output.UserId       as number
    passwordHash = output.PasswordHash as string
    userJson     = JSON.parse(output.UserJson as string) as Record<string, unknown>

  } catch (err) {
    console.error('[/api/auth/login] DB error:', { err, email, timestamp })
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
  }

  // ── Verify password ──────────────────────────────────────────────────────
  const passwordOk = await bcrypt.compare(password, passwordHash)
  if (!passwordOk) {
    console.warn(`[/api/auth/login] Bad password for ${email} at ${timestamp}`)
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  // ── Sign tokens ──────────────────────────────────────────────────────────
  // sub is stored as a string per JWT spec; userId numeric claim is primary
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

  // ── Build response with httpOnly cookies ─────────────────────────────────
  const isProd = process.env.NODE_ENV === 'production'

  const cookieBase = {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax' as const,
    path:     '/',
  }

  const response = NextResponse.json({
    success: true,
    timestamp,
    data: {
      // sp_Login now returns `role` (role_name) + `roleId` (INT) directly.
      // Keeping `globalRole` fallback for any old tokens still in circulation.
      user: { userId, ...userJson, role: userJson.role ?? userJson.globalRole },
      accessToken,
      refreshToken,
    },
  })

  response.cookies.set('access_token',  accessToken,  { ...cookieBase, maxAge: 15 * 60 })
  response.cookies.set('refresh_token', refreshToken, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 })

  console.log(`[/api/auth/login] Success: ${email} (${userId}) at ${timestamp}`)
  return response
}
