'use server'

// ─── Alumni Server Actions ────────────────────────────────────────────────────
//
// Schema baseline: post-migration 008
//   dbo.alumni is DROPPED. Alumni are users_roles records with
//   status = 'alumni'. The primary key is users_roles.user_role_id.
//
// Cross-database coordination:
//
//   addAlumniRecord:
//     1. Global DB → sp_GetOrCreateUser
//     2. App DB    → sp_UpsertUser
//     3. App DB    → sp_AddUserRole (status='alumni')
//
//   updateAlumniRole:
//     App DB only → sp_UpdateUserRole (positionId, jerseyNumber, classYear, etc.)
//     NOTE: Rich CRM fields (isDonor, employer, city, etc.) were on dbo.alumni
//     which was dropped in migration 008. Those fields no longer exist.
//
//   logInteraction:
//     App DB only → sp_LogInteraction (@UserId — not @AlumniId)
//
//   bulkAddAlumni:
//     Steps 1–3 per row, errors collected.

import {
  sp_GetOrCreateUser,
  sp_UpsertUser,
  sp_AddUserRole,
  sp_UpdateUserRole,
  sp_LogInteraction,
} from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddAlumniInput {
  appDb:         string
  email:         string
  firstName:     string
  lastName:      string
  globalTeamId:  number
  programRoleId: number   // dbo.program_role.id (e.g. "Alumni" role)
  sportId?:      number | null
  positionId?:   number | null
  classYear?:    number | null
  seasonsPlayed?: number | null
  adminUserId:   number
}

export interface UpdateAlumniRoleInput {
  appDb:          string
  userRoleId:     number
  positionId?:    number | null
  jerseyNumber?:  number | null
  seasonsPlayed?: number | null
  classYear?:     number | null
  adminUserId:    number
}

export interface LogInteractionInput {
  appDb:      string
  userId:     number   // dbo.users.user_id of the member
  loggedBy:   number   // dbo.users.user_id of the staff member
  channel:    string
  summary:    string
  outcome?:   string | null
  followUpAt?: string | null
}

export interface BulkAddAlumniInput {
  appDb:         string
  globalTeamId:  number
  programRoleId: number
  sportId?:      number | null
  adminUserId:   number
  alumni: {
    email?:        string
    firstName:     string
    lastName:      string
    positionId?:   number | null
    classYear?:    number | null
    seasonsPlayed?: number | null
  }[]
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Adds a single alumni record.
 * Steps: Global user → App user sync → App role row (status='alumni').
 */
export async function addAlumniRecord(
  input: AddAlumniInput,
): Promise<{ success: boolean; userId?: number; userRoleId?: number; error?: string }> {
  return appDbContext.run(input.appDb, async () => {
    try {
      // 1. Global DB
      const { userId, errorCode: globalErr } = await sp_GetOrCreateUser({
        email:     input.email,
        firstName: input.firstName,
        lastName:  input.lastName,
        teamId:    input.globalTeamId,
      })
      if (!userId) {
        return { success: false, error: globalErr ?? 'GLOBAL_USER_CREATE_FAILED' }
      }

      // 2. App DB — sync user
      await sp_UpsertUser({
        userId,
        email:     input.email,
        firstName: input.firstName,
        lastName:  input.lastName,
      })

      // 3. App DB — add alumni role
      const { newUserRoleId, errorCode } = await sp_AddUserRole({
        userId,
        programRoleId: input.programRoleId,
        sportId:       input.sportId       ?? null,
        status:        'alumni',
        positionId:    input.positionId    ?? null,
        seasonsPlayed: input.seasonsPlayed ?? null,
        classYear:     input.classYear     ?? null,
        adminUserId:   input.adminUserId,
      })

      if (errorCode) {
        return { success: false, error: errorCode }
      }

      return { success: true, userId, userRoleId: newUserRoleId ?? undefined }
    } catch (err) {
      console.error('[addAlumniRecord]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Updates role-level fields for an alumni record.
 * (Rich CRM fields like isDonor, employer, etc. were on dbo.alumni
 *  which was dropped in migration 008 — they no longer exist in the schema.)
 */
export async function updateAlumniRole(
  input: UpdateAlumniRoleInput,
): Promise<{ success: boolean; error?: string }> {
  return appDbContext.run(input.appDb, async () => {
    try {
      const { errorCode } = await sp_UpdateUserRole({
        userRoleId:    input.userRoleId,
        positionId:    input.positionId    ?? null,
        jerseyNumber:  input.jerseyNumber  ?? null,
        seasonsPlayed: input.seasonsPlayed ?? null,
        classYear:     input.classYear     ?? null,
        adminUserId:   input.adminUserId,
      })
      if (errorCode) return { success: false, error: errorCode }
      return { success: true }
    } catch (err) {
      console.error('[updateAlumniRole]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Logs a staff interaction with a user (alumni or player).
 */
export async function logInteraction(
  input: LogInteractionInput,
): Promise<{ success: boolean; error?: string }> {
  return appDbContext.run(input.appDb, async () => {
    try {
      const { errorCode } = await sp_LogInteraction({
        userId:     input.userId,
        loggedBy:   input.loggedBy,
        channel:    input.channel,
        summary:    input.summary,
        outcome:    input.outcome    ?? null,
        followUpAt: input.followUpAt ?? null,
      })
      if (errorCode) return { success: false, error: errorCode }
      return { success: true }
    } catch (err) {
      console.error('[logInteraction]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Bulk-adds alumni records.
 * For rows with an email, resolves or creates the Global DB user first.
 */
export async function bulkAddAlumni(
  input: BulkAddAlumniInput,
): Promise<{
  successCount: number
  skippedCount: number
  errors:       { index: number; reason: string }[]
}> {
  return appDbContext.run(input.appDb, async () => {
    let successCount = 0
    let skippedCount = 0
    const errors: { index: number; reason: string }[] = []

    await Promise.allSettled(
      input.alumni.map(async (row, i) => {
        try {
          if (!row.email) {
            errors.push({ index: i, reason: 'EMAIL_REQUIRED' })
            skippedCount++
            return
          }

          const { userId, errorCode: globalErr } = await sp_GetOrCreateUser({
            email:     row.email,
            firstName: row.firstName,
            lastName:  row.lastName,
            teamId:    input.globalTeamId,
          })
          if (!userId) {
            errors.push({ index: i, reason: globalErr ?? 'GLOBAL_USER_CREATE_FAILED' })
            skippedCount++
            return
          }

          await sp_UpsertUser({
            userId,
            email:     row.email,
            firstName: row.firstName,
            lastName:  row.lastName,
          })

          const { errorCode } = await sp_AddUserRole({
            userId,
            programRoleId: input.programRoleId,
            sportId:       input.sportId       ?? null,
            status:        'alumni',
            positionId:    row.positionId    ?? null,
            seasonsPlayed: row.seasonsPlayed ?? null,
            classYear:     row.classYear     ?? null,
            adminUserId:   input.adminUserId,
          })

          if (errorCode && errorCode !== 'ROLE_ALREADY_EXISTS') {
            errors.push({ index: i, reason: errorCode })
            skippedCount++
          } else {
            successCount++
          }
        } catch (err) {
          errors.push({ index: i, reason: 'INTERNAL_ERROR' })
          skippedCount++
          console.error(`[bulkAddAlumni] row ${i}:`, err)
        }
      }),
    )

    return { successCount, skippedCount, errors }
  })
}
