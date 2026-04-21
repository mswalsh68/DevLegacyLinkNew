'use server'

// ─── Alumni Server Actions ────────────────────────────────────────────────────
//
// Cross-database coordination:
//
//   bulkCreateAlumni:
//     1. Global DB → sp_GetOrCreateUser per row that has an email
//     2. App DB    → sp_BulkCreateAlumni with userId injected into each row
//
//   updateAlumni, logInteraction:
//     App DB only — no Global DB call needed.

import {
  sp_GetOrCreateUser,
  sp_UpdateAlumni,
  sp_LogInteraction,
  sp_BulkCreateAlumni,
  type BulkAlumniRow,
} from '@/lib/db/procedures'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BulkCreateAlumniInput {
  alumni:       (Omit<BulkAlumniRow, 'userId'> & { email?: string })[]
  createdBy:    string
  globalTeamId: string
  sportId?:     string
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Bulk-creates alumni records (e.g. from a CSV import).
 * For rows with an email, resolves the Global DB userId first.
 * Rows without an email get a generated userId (historical records).
 */
export async function bulkCreateAlumni(
  input: BulkCreateAlumniInput,
): Promise<{ successCount: number; skippedCount: number; errorJson: string }> {
  // Resolve Global DB userIds for rows that have an email
  const enriched: BulkAlumniRow[] = await Promise.all(
    input.alumni.map(async (row) => {
      if (!row.email) return row

      try {
        const { userId } = await sp_GetOrCreateUser({
          email:     row.email,
          firstName: row.firstName,
          lastName:  row.lastName,
          teamId:    input.globalTeamId,
        })
        return { ...row, userId: userId ?? undefined }
      } catch {
        return row
      }
    }),
  )

  return sp_BulkCreateAlumni({
    alumni:    enriched,
    createdBy: input.createdBy,
    sportId:   input.sportId,
  })
}

/**
 * Updates an alumni profile. Pass only the fields you want to change.
 */
export async function updateAlumni(
  params: Parameters<typeof sp_UpdateAlumni>[0],
): Promise<{ success: boolean; error?: string }> {
  try {
    const { errorCode } = await sp_UpdateAlumni(params)
    if (errorCode) return { success: false, error: errorCode }
    return { success: true }
  } catch (err) {
    console.error('[updateAlumni]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}

/**
 * Logs an outreach interaction for an alumni record.
 */
export async function logInteraction(
  params: Parameters<typeof sp_LogInteraction>[0],
): Promise<{ success: boolean; error?: string }> {
  try {
    await sp_LogInteraction(params)
    return { success: true }
  } catch (err) {
    console.error('[logInteraction]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}
