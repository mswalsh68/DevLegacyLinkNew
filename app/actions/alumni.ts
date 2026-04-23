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
import { appDbContext } from '@/lib/db/connection'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateAlumniInput {
  appDb:          string   // tenant App DB name from session.appDb
  email:          string
  firstName:      string
  lastName:       string
  position?:      string
  graduationYear?: number
  city?:          string
  state?:         string
  currentEmployer?: string
  currentJobTitle?: string
  notes?:         string
  globalTeamId:   string
  createdBy:      string
  sportId?:       string
}

export interface BulkCreateAlumniInput {
  appDb:        string   // tenant App DB name from session.appDb
  alumni:       (Omit<BulkAlumniRow, 'userId'> & { email?: string })[]
  createdBy:    string
  globalTeamId: string
  sportId?:     string
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Creates a single alumni record.
 * Step 1: Global DB — resolve or create the canonical user account.
 * Step 2: App DB   — upsert alumni record via sp_BulkCreateAlumni (single row).
 */
export async function createAlumni(
  input: CreateAlumniInput,
): Promise<{ success: boolean; userId?: string; error?: string }> {
  return appDbContext.run(input.appDb, async () => {
    try {
      const { userId, errorCode: globalErr } = await sp_GetOrCreateUser({
        email:     input.email,
        firstName: input.firstName,
        lastName:  input.lastName,
        teamId:    input.globalTeamId,
      })

      if (!userId) {
        return { success: false, error: globalErr ?? 'GLOBAL_USER_CREATE_FAILED' }
      }

      const row: BulkAlumniRow = {
        userId,
        email:            input.email,
        firstName:        input.firstName,
        lastName:         input.lastName,
        graduationYear:   input.graduationYear,
        currentCity:      input.city,
        currentState:     input.state,
        currentEmployer:  input.currentEmployer,
        currentJobTitle:  input.currentJobTitle,
        notes:            input.notes,
      }

      const result = await sp_BulkCreateAlumni({
        alumni:    [row],
        createdBy: input.createdBy,
        sportId:   input.sportId,
      })

      if (result.successCount === 0) {
        return { success: false, error: result.errorJson || 'ALUMNI_CREATE_FAILED' }
      }

      return { success: true, userId }
    } catch (err) {
      console.error('[createAlumni]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Bulk-creates alumni records (e.g. from a CSV import).
 * For rows with an email, resolves the Global DB userId first.
 * Rows without an email get a generated userId (historical records).
 */
export async function bulkCreateAlumni(
  input: BulkCreateAlumniInput,
): Promise<{ successCount: number; skippedCount: number; errorJson: string }> {
  return appDbContext.run(input.appDb, async () => {
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
  })
}

/**
 * Updates an alumni profile. Pass only the fields you want to change.
 */
export async function updateAlumni(
  appDb: string,
  params: Parameters<typeof sp_UpdateAlumni>[0],
): Promise<{ success: boolean; error?: string }> {
  return appDbContext.run(appDb, async () => {
    try {
      const { errorCode } = await sp_UpdateAlumni(params)
      if (errorCode) return { success: false, error: errorCode }
      return { success: true }
    } catch (err) {
      console.error('[updateAlumni]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Logs an outreach interaction for an alumni record.
 */
export async function logInteraction(
  appDb: string,
  params: Parameters<typeof sp_LogInteraction>[0],
): Promise<{ success: boolean; error?: string }> {
  return appDbContext.run(appDb, async () => {
    try {
      await sp_LogInteraction(params)
      return { success: true }
    } catch (err) {
      console.error('[logInteraction]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}
