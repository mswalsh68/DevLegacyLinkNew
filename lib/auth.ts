// Auth utilities — server-side only (no 'use client').
// Reads the httpOnly cookie set at login and returns the decoded session.

import { cookies } from 'next/headers'
import type { UserSession } from '@/types'

// Returns the current session or null. Used in server components and layouts.
export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) return null

  try {
    // TODO: verify JWT signature with jose or jsonwebtoken
    // Placeholder — decode payload without verification for skeleton
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    )
    // JWT stores userId as a numeric claim. Parse from sub if absent.
    if (!payload.userId && payload.sub) {
      const parsed = Number(payload.sub)
      if (!isNaN(parsed)) payload.userId = parsed
    }
    // Ensure userId is always a number (handles old string-encoded JWTs in flight)
    if (typeof payload.userId === 'string') {
      const parsed = Number(payload.userId)
      if (!isNaN(parsed)) payload.userId = parsed
    }
    // Backward-compat: old JWTs (pre-migration 018) used globalRole instead of role.
    if (payload.globalRole && !payload.role) {
      payload.role = payload.globalRole
    }
    return payload as UserSession
  } catch {
    return null
  }
}

// Check if a user has access to a specific app module.
export function hasAppAccess(session: UserSession, app: string): boolean {
  return session.apps?.includes(app) ?? false
}

export function isGlobalAdmin(session: UserSession): boolean {
  // platform_owner (roleId = 1) is the only truly global admin since migration 018.
  // Keeping 'global_admin' string check as a legacy alias until all old JWTs expire.
  return session.roleId === 1
    || session.role === 'platform_owner'
    || (session as unknown as Record<string, unknown>).globalRole === 'platform_owner'
}
