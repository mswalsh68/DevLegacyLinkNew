// Server-side permission checks — DO NOT import in client components.
// Uses the Global DB feature_permissions table for client users (roleId === 3).
// Internal users (roleId 1/2) bypass the table and always return allowed.
//
// Usage in server components and API routes:
//   const perm = await canAsync(session, 'feed:post')
//   if (!perm.allowed) redirect('/login')
//   // perm.scope === 'own_sport' | 'any_sport' | null

import sql from 'mssql'
import { getPool } from '@/lib/db/connection'
import type { UserSession } from '@/types'
import type { Feature } from '@/lib/permissions'

export interface PermissionResult {
  allowed: boolean
  scope:   'own_sport' | 'any_sport' | null
}

const DENIED: PermissionResult = { allowed: false, scope: null }

export async function canAsync(
  session: UserSession | null | undefined,
  feature: Feature,
): Promise<PermissionResult> {
  if (!session) return DENIED

  // Internal roles bypass the permission matrix entirely
  if (session.roleId === 1 || session.roleId === 2) {
    return { allowed: true, scope: null }
  }

  // Client users without a programRoleId have no program role yet — deny
  if (!session.programRoleId || !session.tierId) return DENIED

  try {
    const pool   = await getPool('global')
    const result = await pool
      .request()
      .input('FeatureKey',    sql.NVarChar(100), feature)
      .input('ProgramRoleId', sql.Int,           session.programRoleId)
      .input('TierId',        sql.Int,           session.tierId)
      .input('LevelId',       sql.Int,           session.levelId ?? null)
      .query(`
        SELECT TOP 1
            fp.is_allowed,
            fp.scope
        FROM   dbo.feature_permissions fp
        WHERE  fp.feature_key     = @FeatureKey
          AND  fp.program_role_id = @ProgramRoleId
          AND  fp.tier_id         = @TierId
          AND  (fp.level_id IS NULL OR fp.level_id = @LevelId)
        ORDER BY fp.level_id DESC
      `)

    const row = result.recordset[0]
    if (!row) return DENIED

    return {
      allowed: row.is_allowed === true || row.is_allowed === 1,
      scope:   (row.scope as PermissionResult['scope']) ?? null,
    }
  } catch {
    return DENIED
  }
}
