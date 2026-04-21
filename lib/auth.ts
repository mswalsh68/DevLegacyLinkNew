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
    // JWT stores userId in the 'sub' claim (UUID). Map it to userId if absent.
    if (payload.sub && !payload.userId) {
      payload.userId = payload.sub
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
  return session.role === 'global_admin'
}
