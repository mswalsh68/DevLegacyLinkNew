// Route-level access control.
// Define which roles can access each named feature, then call can() in page components.
// Server pages use getServerSession(); client pages use useAuth().

import type { UserSession } from '@/types'

// ─── Role groups ──────────────────────────────────────────────────────────────

/** Full platform administrators — unrestricted access. */
const PLATFORM_ADMINS = ['platform_owner', 'global_admin'] as const

/** Team-level administrators (e.g. Athletic Director). */
const APP_ADMINS = [...PLATFORM_ADMINS, 'app_admin'] as const

/** Coaches and staff — view access to roster and alumni, no admin actions. */
const COACHES = [...APP_ADMINS, 'coach_staff', 'coach', 'staff'] as const

/** All authenticated roles, including read-only observers. */
const ALL_ROLES = [...COACHES, 'readonly', 'read_only'] as const

// ─── Feature map ──────────────────────────────────────────────────────────────

type Feature =
  | 'roster:view'
  | 'roster:transfer'
  | 'alumni:view'
  | 'settings:view'
  | 'settings:requests'

const FEATURE_ROLES: Record<Feature, readonly string[]> = {
  'roster:view':       ALL_ROLES,
  'roster:transfer':   APP_ADMINS,
  'alumni:view':       COACHES,
  'settings:view':     PLATFORM_ADMINS,
  'settings:requests': PLATFORM_ADMINS,
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if the session's role is allowed to access the given feature.
 * Safe to call with a null session (returns false).
 */
export function can(
  session: UserSession | null | undefined,
  feature: Feature,
): boolean {
  if (!session) return false
  const role = (session.role as string | undefined) ?? ''
  return (FEATURE_ROLES[feature] as string[]).includes(role)
}

/**
 * Human-readable label for a role — used in the AccessDenied message.
 */
export function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'platform_owner': return 'Platform Owner'
    case 'global_admin':   return 'Global Admin'
    case 'app_admin':      return 'App Admin'
    case 'coach_staff':
    case 'coach':
    case 'staff':          return 'Coach / Staff'
    case 'readonly':
    case 'read_only':      return 'Read Only'
    default:               return role ?? 'Unknown'
  }
}

/**
 * Minimum role required to access a feature — shown in the AccessDenied message.
 */
export function requiredRoleLabel(feature: Feature): string {
  switch (feature) {
    case 'roster:transfer':
    case 'settings:view':
    case 'settings:requests':
      return 'App Admin or higher'
    case 'alumni:view':
      return 'Coach / Staff or higher'
    case 'roster:view':
      return 'any authenticated role'
    default:
      return 'a higher permission level'
  }
}
