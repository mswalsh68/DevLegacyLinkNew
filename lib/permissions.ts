// Route-level access control.
// Define which roles can access each named feature, then call can() in page components.
// Server pages use getServerSession(); client pages use useAuth().
//
// One role per user. The role defines what the user can do.
// Sport scope (head_coach / position_coach see only their sport's records) is
// enforced by the App DB stored procedures via dbo.users_sports — not here.
// These checks only gate route/feature access (can they reach the page at all).

import type { UserSession } from '@/types'

// ─── Role groups ──────────────────────────────────────────────────────────────

/** Platform-level — unrestricted across all teams. */
const PLATFORM      = ['platform_owner'] as const

/** Full client access — platform owners plus team administrators. */
const ADMINS        = [...PLATFORM, 'app_admin'] as const

/** Coaching staff — admins plus head coaches. */
const HEAD_COACHES  = [...ADMINS, 'head_coach'] as const

/** All staff with any roster visibility. */
const ALL_STAFF     = [...HEAD_COACHES, 'position_coach', 'alumni_director'] as const

/** Players — their own profile and player feed/messaging. */
const PLAYERS       = ['player'] as const

/** Alumni — their own profile and alumni feed/messaging. */
const ALUMNI_ROLE   = ['alumni'] as const

// ─── Feature map ──────────────────────────────────────────────────────────────
//
// Access matrix summary:
//
//   Feature             platform  app_admin  head_coach  position_coach  alumni_director  player  alumni
//   roster:view         ✓         ✓           ✓ (sport)   ✓ (sport/curr)  ✓                –       –
//   roster:edit         ✓         ✓           ✓ (sport)   ✓ (sport/curr)  –                –       –
//   roster:transfer     ✓         ✓           ✓           –               ✓                –       –
//   alumni:view         ✓         ✓           ✓ (sport)   –               ✓                –       –
//   alumni:edit         ✓         ✓           ✓ (sport)   –               ✓                –       –
//   message:players     ✓         ✓           ✓           ✓ (sport/curr)  –                ✓       –
//   message:alumni      ✓         ✓           ✓           –               ✓                –       ✓
//   feed:players        ✓         ✓           ✓           ✓               ✓                ✓       –
//   feed:alumni         ✓         ✓           ✓           –               ✓                –       ✓
//   settings:view       ✓         ✓           –           –               –                –       –
//   settings:requests   ✓         ✓           –           –               –                –       –
//
// ✓ (sport) = access is granted here; row-level sport filtering is enforced by the SP.

type Feature =
  | 'roster:view'
  | 'roster:edit'
  | 'roster:transfer'
  | 'alumni:view'
  | 'alumni:edit'
  | 'message:players'
  | 'message:alumni'
  | 'feed:players'
  | 'feed:alumni'
  | 'settings:view'
  | 'settings:requests'

const FEATURE_ROLES: Record<Feature, readonly string[]> = {
  'roster:view':        [...ALL_STAFF],
  'roster:edit':        [...HEAD_COACHES, 'position_coach'],
  'roster:transfer':    [...HEAD_COACHES, 'alumni_director'],
  'alumni:view':        [...HEAD_COACHES, 'alumni_director'],
  'alumni:edit':        [...HEAD_COACHES, 'alumni_director'],
  'message:players':    [...HEAD_COACHES, 'position_coach', ...PLAYERS],
  'message:alumni':     [...HEAD_COACHES, 'alumni_director', ...ALUMNI_ROLE],
  'feed:players':       [...ALL_STAFF, ...PLAYERS],
  'feed:alumni':        [...HEAD_COACHES, 'alumni_director', ...ALUMNI_ROLE],
  'settings:view':      [...ADMINS],
  'settings:requests':  [...ADMINS],
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
 * Human-readable label for a role.
 */
export function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'platform_owner':  return 'Platform Owner'
    case 'app_admin':       return 'App Admin'
    case 'head_coach':      return 'Head Coach'
    case 'position_coach':  return 'Position Coach'
    case 'alumni_director': return 'Alumni Director'
    case 'player':          return 'Player'
    case 'alumni':          return 'Alumni'
    // Legacy aliases (kept until SP migration is complete)
    case 'global_admin':    return 'Global Admin'
    case 'coach_staff':     return 'Coach / Staff'
    case 'readonly':
    case 'read_only':       return 'Read Only'
    default:                return role ?? 'Unknown'
  }
}

/**
 * Minimum role required to access a feature — shown in the AccessDenied message.
 */
export function requiredRoleLabel(feature: Feature): string {
  switch (feature) {
    case 'settings:view':
    case 'settings:requests':
      return 'App Admin or higher'
    case 'roster:transfer':
    case 'alumni:view':
    case 'alumni:edit':
      return 'Head Coach or higher'
    case 'roster:edit':
      return 'Position Coach or higher'
    case 'roster:view':
      return 'Coach or Alumni Director'
    case 'message:players':
      return 'Coach or Player'
    case 'message:alumni':
      return 'Head Coach, Alumni Director, or Alumni'
    case 'feed:players':
      return 'Staff or Player'
    case 'feed:alumni':
      return 'Head Coach, Alumni Director, or Alumni'
    default:
      return 'a higher permission level'
  }
}
