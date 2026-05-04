'use server'

// ─── Alumni Server Actions ────────────────────────────────────────────────────
//
// Schema baseline: post-migration 014
//   Alumni are dbo.users rows with program_role_id = 7.
//   Sport memberships live in dbo.users_sports (one row per user × sport).
//   The primary key for a sport membership is users_sports.id (userSportId).
//
// Cross-database coordination:
//
//   addAlumniRecord:
//     1. Global DB → sp_GetOrCreateUser
//     2. App DB    → sp_UpsertUser
//     3. App DB    → sp_AddUserRole (sets program_role_id + upserts users_sports)
//
//   updateAlumniRole:
//     App DB only → sp_UpdateUserRole (userId + sportId, updates users_sports row)
//
//   logInteraction:
//     App DB only → sp_LogInteraction (@UserId)
//
//   bulkAddAlumni:
//     Steps 1–3 per row, errors collected.

import { randomUUID } from 'crypto'
import {
  sp_GetOrCreateUser,
  sp_UpsertUser,
  sp_AddUserRole,
  sp_UpdateUserRole,
  sp_LogInteraction,
  sp_CreateInviteCode,
} from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { sendTransactionalEmail, buildInviteEmailHtml } from '@/lib/resend'

// ─── Invite helper ────────────────────────────────────────────────────────────

async function sendInvite(params: {
  email:     string
  firstName: string
  teamId:    number
  teamName:  string
  role:      string
  createdBy: number
}): Promise<void> {
  try {
    const token = randomUUID()
    const { inviteCodeId, errorCode } = await sp_CreateInviteCode({
      teamId:    params.teamId,
      role:      params.role,
      token,
      createdBy: params.createdBy,
      expiresAt: null,
      maxUses:   1,
    })
    if (errorCode || !inviteCodeId) {
      console.warn('[sendInvite/alumni] sp_CreateInviteCode error:', errorCode)
      return
    }
    const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const inviteUrl = `${baseUrl}/join?code=${token}`
    await sendTransactionalEmail(
      params.email,
      `You've been added to ${params.teamName} — LegacyLink`,
      buildInviteEmailHtml({ firstName: params.firstName, teamName: params.teamName, inviteUrl, role: params.role }),
    )
  } catch (err) {
    console.error('[sendInvite/alumni] Failed:', err)
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddAlumniInput {
  appDb:         string
  email:         string
  firstName:     string
  lastName:      string
  globalTeamId:  number
  teamName?:     string   // for invite email
  programRoleId: number   // dbo.program_role.id (e.g. 7 = Alumni)
  sportId?:      number | null
  positionId?:   number | null
  classYear?:    number | null
  seasonsPlayed?: number | null
  adminUserId:   number
}

export interface UpdateAlumniRoleInput {
  appDb:          string
  userId:         number   // dbo.users.user_id
  sportId:        number   // dbo.users_sports.sport_id
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
  teamName?:     string
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
 * Steps: Global user → App user sync → program_role_id set + users_sports upsert.
 */
export async function addAlumniRecord(
  input: AddAlumniInput,
): Promise<{ success: boolean; userId?: number; userSportId?: number; error?: string }> {
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

      // 3. App DB — set program role + upsert sport membership
      const { newUserSportId, errorCode } = await sp_AddUserRole({
        userId,
        programRoleId: input.programRoleId,
        sportId:       input.sportId       ?? null,
        positionId:    input.positionId    ?? null,
        seasonsPlayed: input.seasonsPlayed ?? null,
        classYear:     input.classYear     ?? null,
        adminUserId:   input.adminUserId,
      })

      if (errorCode) {
        return { success: false, error: errorCode }
      }

      // 4. Send invite email (fire-and-forget)
      void sendInvite({
        email:     input.email,
        firstName: input.firstName,
        teamId:    input.globalTeamId,
        teamName:  input.teamName ?? 'your program',
        role:      'alumni',
        createdBy: input.adminUserId,
      })

      return { success: true, userId, userSportId: newUserSportId ?? undefined }
    } catch (err) {
      console.error('[addAlumniRecord]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Updates sport-membership fields for an alumni record.
 * Identified by userId + sportId (not a legacy userRoleId).
 */
export async function updateAlumniRole(
  input: UpdateAlumniRoleInput,
): Promise<{ success: boolean; error?: string }> {
  return appDbContext.run(input.appDb, async () => {
    try {
      const { errorCode } = await sp_UpdateUserRole({
        userId:        input.userId,
        sportId:       input.sportId,
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
            void sendInvite({
              email:     row.email!,
              firstName: row.firstName,
              teamId:    input.globalTeamId,
              teamName:  input.teamName ?? 'your program',
              role:      'alumni',
              createdBy: input.adminUserId,
            })
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
