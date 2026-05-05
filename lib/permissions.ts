// Route-level access control.
// Define which roles can access each named feature, then call can() in page components.
// Server pages use getServerSession(); client pages use useAuth().
//
// Global roles (migration 028):
//   super_admin   — internal, full access
//   support_admin — internal, support access
//   client        — external; program-level category stored in App DB users_roles.program_role_id
//
// NOTE: client-role feature permissions are not yet spec'd.
// They will be defined once the program_role permission model is designed.

import type { UserSession } from '@/types'

// ─── Role groups ──────────────────────────────────────────────────────────────

/** Internal — unrestricted across all teams. */
const SUPER_ADMIN    = ['super_admin'] as const

/** Internal — super admin plus support staff. */
const INTERNAL       = [...SUPER_ADMIN, 'support_admin'] as const

// ─── Feature map ──────────────────────────────────────────────────────────────
//
// Internal roles have full access to all features.
// Client permissions will be added here once the program_role permission model is spec'd.
//
//   Feature             super_admin  support_admin  client
//   roster:view         ✓            ✓              TBD
//   roster:edit         ✓            ✓              TBD
//   roster:transfer     ✓            ✓              TBD
//   alumni:view         ✓            ✓              TBD
//   alumni:edit         ✓            ✓              TBD
//   message:players     ✓            ✓              TBD
//   message:alumni      ✓            ✓              TBD
//   feed:players        ✓            ✓              TBD
//   feed:alumni         ✓            ✓              TBD
//   feed:post           ✓            ✓              TBD
//   feed:delete_any     ✓            ✓              TBD
//   feed:pin            ✓            ✓              TBD
//   settings:view       ✓            ✓              TBD
//   settings:requests   ✓            ✓              TBD

export type Feature =
  | 'roster:view'
  | 'roster:edit'
  | 'roster:transfer'
  | 'roster:manage'
  | 'roster:player_accounts'
  | 'roster:promote_to_alumni'
  | 'alumni:view'
  | 'alumni:edit'
  | 'message:players'
  | 'message:alumni'
  | 'feed:view'
  | 'feed:like'
  | 'feed:sport_filter'
  | 'feed:players'
  | 'feed:alumni'
  | 'feed:post'
  | 'feed:delete_any'
  | 'feed:pin'
  | 'community:directory_view'
  | 'community:email_alumni'
  | 'settings:view'
  | 'settings:requests'

const FEATURE_ROLES: Record<Feature, readonly string[]> = {
  'roster:view':              [...INTERNAL],
  'roster:edit':              [...INTERNAL],
  'roster:transfer':          [...INTERNAL],
  'roster:manage':            [...INTERNAL],
  'roster:player_accounts':   [...INTERNAL],
  'roster:promote_to_alumni': [...INTERNAL],
  'alumni:view':              [...INTERNAL],
  'alumni:edit':        [...INTERNAL],
  'message:players':    [...INTERNAL],
  'message:alumni':     [...INTERNAL],
  'feed:view':          [...INTERNAL],
  'feed:like':          [...INTERNAL],
  'feed:sport_filter':  [...INTERNAL],
  'feed:players':       [...INTERNAL],
  'feed:alumni':        [...INTERNAL],
  'feed:post':          [...INTERNAL],
  'feed:delete_any':          [...INTERNAL],
  'feed:pin':                 [...INTERNAL],
  'community:directory_view': [...INTERNAL],
  'community:email_alumni':   [...INTERNAL],
  'settings:view':            [...INTERNAL],
  'settings:requests':        [...INTERNAL],
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
    case 'super_admin':    return 'Super Admin'
    case 'support_admin':  return 'Support Admin'
    case 'client':         return 'Client'
    default:               return role ?? 'Unknown'
  }
}

/**
 * Minimum role required to access a feature — shown in the AccessDenied message.
 */
export function requiredRoleLabel(_feature: Feature): string {
  return 'Support Admin or higher'
}
