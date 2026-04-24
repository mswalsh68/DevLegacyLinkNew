/**
 * Auth helpers for Route Handlers.
 *
 * Usage:
 *   const user = await guardAppAccess('roster')
 *   if (isResponse(user)) return user
 *   // user.sub, user.globalRole, user.apps, user.currentTeamId
 */

import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'

// ─── Decoded JWT payload for route handlers ───────────────────────────────────

export interface RouteUser {
  sub:           string
  globalRole:    string
  apps:          string[]
  currentTeamId?: string
  tokenVersion?:  number
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function accessSecret(): Uint8Array {
  const s = process.env.JWT_ACCESS_SECRET
  if (!s) throw new Error('[auth] JWT_ACCESS_SECRET is not set')
  return new TextEncoder().encode(s)
}

function unauth(msg = 'Authentication required') {
  return NextResponse.json({ success: false, error: msg }, { status: 401 })
}

function forbidden(msg = 'Forbidden') {
  return NextResponse.json({ success: false, error: msg }, { status: 403 })
}

// ─── Base: verify + decode ────────────────────────────────────────────────────

export async function requireAuth(): Promise<RouteUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, accessSecret())
    return {
      sub:           (payload.sub               as string)          ?? '',
      globalRole:    (payload.globalRole         as string)          ?? 'readonly',
      apps:          (payload.apps               as string[] | undefined) ?? [],
      currentTeamId: (payload.currentTeamId      as string | undefined),
      tokenVersion:  (payload.tokenVersion       as number | undefined),
    }
  } catch {
    return null
  }
}

// ─── Type-guard ───────────────────────────────────────────────────────────────

/** True when the guard returned early with an error response. */
export function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse
}

// ─── Role helpers ──────────────────────────────────────────────────────────────

const ADMIN_ROLES    = ['global_admin', 'platform_owner']
const WRITE_ROLES    = ['global_admin', 'platform_owner', 'app_admin', 'coach_staff']

// ─── Guards ────────────────────────────────────────────────────────────────────

/** Any authenticated user. */
export async function guardAuth(): Promise<RouteUser | NextResponse> {
  const user = await requireAuth()
  return user ?? unauth()
}

/** Must be global_admin or platform_owner. */
export async function guardGlobalAdmin(): Promise<RouteUser | NextResponse> {
  const user = await requireAuth()
  if (!user) return unauth()
  if (!ADMIN_ROLES.includes(user.globalRole)) return forbidden('Global admin access required')
  return user
}

/**
 * Must have access to `app`.
 * Global admins bypass the app membership check.
 */
export async function guardAppAccess(app: string): Promise<RouteUser | NextResponse> {
  const user = await requireAuth()
  if (!user) return unauth()
  const isGlobal = ADMIN_ROLES.includes(user.globalRole)
  if (!isGlobal && !user.apps.includes(app))
    return forbidden(`Access to ${app} not permitted`)
  return user
}

/**
 * Must have access to `app` AND have a write-capable globalRole
 * (global_admin / platform_owner / app_admin / coach_staff).
 */
export async function guardAppWrite(app: string): Promise<RouteUser | NextResponse> {
  const user = await requireAuth()
  if (!user) return unauth()
  const isGlobal = ADMIN_ROLES.includes(user.globalRole)
  if (!isGlobal && !user.apps.includes(app))
    return forbidden(`Access to ${app} not permitted`)
  if (!WRITE_ROLES.includes(user.globalRole))
    return forbidden('Write access required')
  return user
}

/**
 * Must be global_admin or platform_owner (regardless of app).
 * Use for destructive / privileged operations (campaign dispatch, bulk ops).
 */
export async function guardAppAdmin(_app?: string): Promise<RouteUser | NextResponse> {
  const user = await requireAuth()
  if (!user) return unauth()
  if (!ADMIN_ROLES.includes(user.globalRole))
    return forbidden('Admin access required')
  return user
}
