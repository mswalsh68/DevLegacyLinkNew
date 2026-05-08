// Route-level access control.
// Define which roles can access each named feature, then call can() in page components.
// Server pages use getServerSession(); client pages use useAuth().
//
// Global roles (migration 028):
//   super_admin   — internal, full access
//   support_admin — internal, support access
//   client        — external; app access scoped by session.apps (e.g. ['roster'], ['alumni'])
//
// Client virtual roles derived from session.apps:
//   client:roster — player (approved via roster invite)
//   client:alumni — alumni (approved via alumni invite)
//
//   Feature             super_admin  support_admin  client:roster  client:alumni
//   roster:view         ✓            ✓              ✓              ✗
//   roster:edit         ✓            ✓              ✗              ✗
//   roster:transfer     ✓            ✓              ✗              ✗
//   alumni:view         ✓            ✓              ✗              ✓
//   alumni:edit         ✓            ✓              ✗              ✗
//   message:players     ✓            ✓              ✗              ✗
//   message:alumni      ✓            ✓              ✗              ✗
//   feed:players        ✓            ✓              ✓              ✗
//   feed:alumni         ✓            ✓              ✗              ✓
//   feed:post           ✓            ✓              ✗              ✗  (read-only for clients for now)
//   feed:delete_any     ✓            ✓              ✗              ✗
//   feed:pin            ✓            ✓              ✗              ✗
//   settings:view       ✓            ✓              ✗              ✗
//   settings:requests   ✓            ✓              ✗              ✗

import type { UserSession } from '@/types'

// ─── Role groups ──────────────────────────────────────────────────────────────

const SUPER_ADMIN     = ['super_admin']                        as const
const INTERNAL        = [...SUPER_ADMIN, 'support_admin']      as const
const CLIENT_ROSTER   = 'client:roster'
const CLIENT_ALUMNI   = 'client:alumni'

// ─── Feature map ──────────────────────────────────────────────────────────────

export type Feature =
  | 'roster:view'
  | 'roster:edit'
  | 'roster:transfer'
  | 'roster:manage'
  | 'roster:player_accounts'
  | 'roster:promote_to_alumni'
  | 'alumni:view'
  | 'alumni:edit'
  | 'staff:view'
  | 'staff:manage'
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
  'roster:view':              [...INTERNAL, CLIENT_ROSTER],
  'roster:edit':              [...INTERNAL],
  'roster:transfer':          [...INTERNAL],
  'roster:manage':            [...INTERNAL],
  'roster:player_accounts':   [...INTERNAL],
  'roster:promote_to_alumni': [...INTERNAL],
  'alumni:view':              [...INTERNAL, CLIENT_ALUMNI],
  'alumni:edit':              [...INTERNAL],
  'staff:view':               [...INTERNAL, CLIENT_ROSTER, CLIENT_ALUMNI],
  'staff:manage':             [...INTERNAL],
  'message:players':          [...INTERNAL],
  'message:alumni':           [...INTERNAL],
  'feed:view':                [...INTERNAL],
  'feed:like':                [...INTERNAL],
  'feed:sport_filter':        [...INTERNAL],
  'feed:players':             [...INTERNAL, CLIENT_ROSTER],
  'feed:alumni':              [...INTERNAL, CLIENT_ALUMNI],
  'feed:post':          [...INTERNAL],
  'feed:delete_any':          [...INTERNAL],
  'feed:pin':                 [...INTERNAL],
  'community:directory_view': [...INTERNAL],
  'community:email_alumni':   [...INTERNAL],
  'settings:view':            [...INTERNAL],
  'settings:requests':        [...INTERNAL],
}

// ─── Effective roles ──────────────────────────────────────────────────────────
// Derives virtual client sub-roles from session.apps so FEATURE_ROLES can stay
// as a simple string-array lookup without bespoke logic per feature.
//
// Preview mode: when previewActive is true the admin is rendered as a client
// with the previewed program role. The admin's real roleId/role is preserved in
// the JWT so isGlobalAdmin() still returns true for the global settings shell,
// but every feature-permission check here sees only the preview role's access.

function effectiveRoles(session: UserSession): string[] {
  if (session.previewActive) {
    const roles = ['client']
    for (const app of (session.apps ?? [])) {
      roles.push(`client:${app}`)
    }
    return roles
  }

  const roles: string[] = [session.role as string]
  if (session.role === 'client') {
    for (const app of (session.apps ?? [])) {
      roles.push(`client:${app}`)
    }
  }
  return roles
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if the session is allowed to access the given feature.
 * Safe to call with a null/undefined session (returns false).
 */
export function can(
  session: UserSession | null | undefined,
  feature: Feature,
): boolean {
  if (!session) return false
  const allowed = FEATURE_ROLES[feature] as string[]
  return effectiveRoles(session).some(r => allowed.includes(r))
}

/**
 * Human-readable label for a global role.
 */
export function roleLabel(role: string | undefined): string {
  switch (role) {
    case 'super_admin':   return 'Super Admin'
    case 'support_admin': return 'Support Admin'
    case 'client':        return 'Client'
    default:              return role ?? 'Unknown'
  }
}

/**
 * Minimum role required to access a feature — shown in the AccessDenied message.
 */
export function requiredRoleLabel(feature: Feature): string {
  const allowed = FEATURE_ROLES[feature] as string[]
  if (allowed.includes(CLIENT_ROSTER) || allowed.includes(CLIENT_ALUMNI)) {
    return 'Program member access required'
  }
  return 'Support Admin or higher'
}
