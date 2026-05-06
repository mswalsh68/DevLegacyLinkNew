// Auth utilities — server-side only (no 'use client').
// Reads the httpOnly cookie set at login, verifies the JWT signature,
// and returns the decoded session.

import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { UserSession } from '@/types'

function getAccessKey(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('[auth] JWT_ACCESS_SECRET env var is missing.')
  return new TextEncoder().encode(secret)
}

// Returns the current session or null. Used in server components and layouts.
export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getAccessKey())

    // JWT stores userId as a numeric claim. Parse from sub if absent.
    if (!payload.userId && payload.sub) {
      const parsed = Number(payload.sub)
      if (!isNaN(parsed)) (payload as Record<string, unknown>).userId = parsed
    }
    // Ensure userId is always a number (handles old string-encoded JWTs in flight)
    if (typeof payload.userId === 'string') {
      const parsed = Number(payload.userId)
      if (!isNaN(parsed)) (payload as Record<string, unknown>).userId = parsed
    }
    // Backward-compat: old JWTs (pre-migration 018) used globalRole instead of role.
    if ((payload as Record<string, unknown>).globalRole && !payload.role) {
      (payload as Record<string, unknown>).role = (payload as Record<string, unknown>).globalRole
    }

    return payload as unknown as UserSession
  } catch {
    return null
  }
}

// ─── requireSession ───────────────────────────────────────────────────────────
// Validates the session cookie and returns either a session or a ready-to-return
// error response. Use in API route handlers to eliminate boilerplate:
//
//   const { session, error } = await requireSession()
//   if (error) return error
//
// Options:
//   appDb    — also verify session.appDb is present (default: true)

type UserSessionWithAppDb = UserSession & { appDb: string }
type RequireSessionOk<S extends UserSession = UserSession> = { session: S; error?: never }
type RequireSessionError = { session?: never; error: NextResponse }

export async function requireSession(opts: { appDb: false }): Promise<RequireSessionOk<UserSession> | RequireSessionError>
export async function requireSession(opts?: { appDb?: true }): Promise<RequireSessionOk<UserSessionWithAppDb> | RequireSessionError>
export async function requireSession(opts?: { appDb?: boolean }): Promise<RequireSessionOk<UserSession> | RequireSessionError> {
  const checkAppDb = opts?.appDb !== false

  const session = await getServerSession()
  if (!session) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }

  if (checkAppDb && !session.appDb) {
    return {
      error: NextResponse.json(
        { success: false, error: 'App DB not configured. Please sign out and sign back in.' },
        { status: 503 },
      ),
    }
  }

  return { session }
}

// Check if a user has access to a specific app module.
export function hasAppAccess(session: UserSession, app: string): boolean {
  return session.apps?.includes(app) ?? false
}

export function isGlobalAdmin(session: UserSession): boolean {
  return session.roleId === 1 || session.roleId === 2 || session.role === 'super_admin' || session.role === 'support_admin'
}
