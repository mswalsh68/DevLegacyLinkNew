'use server'

// ─── Player Server Actions ────────────────────────────────────────────────────
//
// Schema baseline: post-migration 008
//   dbo.players is DROPPED. Players are users_roles records with
//   status = 'current_player'. The primary key for a player's
//   roster entry is users_roles.user_role_id (referred to as userRoleId).
//
// Cross-database coordination:
//
//   addPlayerToRoster:
//     1. Global DB → sp_GetOrCreateUser  (get/create canonical user ID)
//     2. App DB    → sp_UpsertUser       (sync user record locally)
//     3. App DB    → sp_AddUserRole      (create users_roles row)
//
//   transferToAlumni:
//     App DB only → sp_TransferUserRole (current_player → alumni), runs
//     per-userRoleId; Global DB permission swap handled separately if needed.
//
//   updatePlayerRole:
//     App DB only → sp_UpdateUserRole (positionId, jerseyNumber, etc.)
//
//   removeFromRoster:
//     App DB only → sp_TransferUserRole with status='removed'
//
//   bulkAddPlayersToRoster:
//     Steps 1–3 per row, errors collected per row.

import { randomUUID } from 'crypto'
import {
  sp_GetOrCreateUser,
  sp_UpsertUser,
  sp_AddUserRole,
  sp_UpdateUserRole,
  sp_TransferUserRole,
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
      maxUses:   1,  // single-use — this is a personal invite
    })
    if (errorCode || !inviteCodeId) {
      console.warn('[sendInvite] sp_CreateInviteCode error:', errorCode)
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
    // Non-fatal — roster row was created successfully
    console.error('[sendInvite] Failed:', err)
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddPlayerInput {
  appDb:         string   // tenant App DB name from session.appDb
  email:         string
  firstName:     string
  lastName:      string
  globalTeamId:  number   // for Global DB user registration
  teamName?:     string   // for invite email subject/body
  programRoleId: number   // dbo.program_role.id (e.g. "Player" role)
  sportId?:      number | null
  positionId?:   number | null
  jerseyNumber?: number | null
  classYear?:    number | null
  seasonsPlayed?: number | null
  adminUserId:   number   // acting staff user_id
}

export interface TransferPlayersInput {
  appDb:         string
  userRoleIds:   number[]   // users_roles.user_role_id values to transfer
  classYear?:    number | null
  notes?:        string | null
  adminUserId:   number
}

export interface UpdatePlayerRoleInput {
  appDb:          string
  userRoleId:     number
  positionId?:    number | null
  jerseyNumber?:  number | null
  seasonsPlayed?: number | null
  classYear?:     number | null
  adminUserId:    number
}

export interface RemovePlayerInput {
  appDb:       string
  userRoleId:  number
  notes?:      string | null
  adminUserId: number
}

export interface BulkAddPlayersInput {
  appDb:         string
  globalTeamId:  number
  teamName?:     string
  programRoleId: number
  sportId?:      number | null
  adminUserId:   number
  players: {
    email?:        string
    firstName:     string
    lastName:      string
    positionId?:   number | null
    jerseyNumber?: number | null
    classYear?:    number | null
    seasonsPlayed?: number | null
  }[]
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Adds a single user to the current-player roster.
 * Steps: Global user → App user sync → App role row.
 */
export async function addPlayerToRoster(
  input: AddPlayerInput,
): Promise<{ success: boolean; userId?: number; userRoleId?: number; error?: string }> {
  return appDbContext.run(input.appDb, async () => {
    try {
      // 1. Global DB — get or create canonical user account
      const { userId, errorCode: globalErr } = await sp_GetOrCreateUser({
        email:     input.email,
        firstName: input.firstName,
        lastName:  input.lastName,
        teamId:    input.globalTeamId,
      })
      if (!userId) {
        return { success: false, error: globalErr ?? 'GLOBAL_USER_CREATE_FAILED' }
      }

      // 2. App DB — sync user record
      await sp_UpsertUser({
        userId,
        email:     input.email,
        firstName: input.firstName,
        lastName:  input.lastName,
      })

      // 3. App DB — add users_roles entry
      const { newUserRoleId, errorCode } = await sp_AddUserRole({
        userId,
        programRoleId: input.programRoleId,
        sportId:       input.sportId       ?? null,
        status:        'current_player',
        positionId:    input.positionId    ?? null,
        jerseyNumber:  input.jerseyNumber  ?? null,
        seasonsPlayed: input.seasonsPlayed ?? null,
        classYear:     input.classYear     ?? null,
        adminUserId:   input.adminUserId,
      })

      if (errorCode) {
        return { success: false, error: errorCode }
      }

      // 4. Send invite email (fire-and-forget — roster row already committed)
      void sendInvite({
        email:     input.email,
        firstName: input.firstName,
        teamId:    input.globalTeamId,
        teamName:  input.teamName ?? 'your program',
        role:      'player',
        createdBy: input.adminUserId,
      })

      return { success: true, userId, userRoleId: newUserRoleId ?? undefined }
    } catch (err) {
      console.error('[addPlayerToRoster]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Transfers players from current_player → alumni status.
 * Runs each transfer individually so partial failures are captured.
 */
export async function transferToAlumni(
  input: TransferPlayersInput,
): Promise<{
  success:      boolean
  successCount: number
  failures:     { userRoleId: number; reason: string }[]
  error?:       string
}> {
  return appDbContext.run(input.appDb, async () => {
    try {
      const results = await Promise.allSettled(
        input.userRoleIds.map((userRoleId) =>
          sp_TransferUserRole({
            userRoleId,
            newStatus:          'alumni',
            classYear:          input.classYear ?? null,
            adminUserId:        input.adminUserId,
            adminAcknowledged:  true,
            notes:              input.notes ?? null,
          }),
        ),
      )

      const failures: { userRoleId: number; reason: string }[] = []
      let successCount = 0

      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          if (r.value.errorCode) {
            failures.push({ userRoleId: input.userRoleIds[i], reason: r.value.errorCode })
          } else {
            successCount++
          }
        } else {
          failures.push({ userRoleId: input.userRoleIds[i], reason: 'INTERNAL_ERROR' })
        }
      })

      return { success: true, successCount, failures }
    } catch (err) {
      console.error('[transferToAlumni]', err)
      return { success: false, successCount: 0, failures: [], error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Updates role-level fields for a player (position, jersey, class year, etc.).
 */
export async function updatePlayerRole(
  input: UpdatePlayerRoleInput,
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
      console.error('[updatePlayerRole]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Removes a player from the roster (sets status to 'removed').
 */
export async function removeFromRoster(
  input: RemovePlayerInput,
): Promise<{ success: boolean; error?: string }> {
  return appDbContext.run(input.appDb, async () => {
    try {
      const { errorCode } = await sp_TransferUserRole({
        userRoleId:        input.userRoleId,
        newStatus:         'removed',
        adminUserId:       input.adminUserId,
        adminAcknowledged: true,
        notes:             input.notes ?? null,
      })
      if (errorCode) return { success: false, error: errorCode }
      return { success: true }
    } catch (err) {
      console.error('[removeFromRoster]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Bulk-adds players from a roster upload.
 * For rows with an email, resolves or creates Global DB user first.
 * Per-row errors are collected without aborting the rest.
 */
export async function bulkAddPlayersToRoster(
  input: BulkAddPlayersInput,
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
      input.players.map(async (row, i) => {
        try {
          let userId: number | null = null

          if (row.email) {
            const globalResult = await sp_GetOrCreateUser({
              email:     row.email,
              firstName: row.firstName,
              lastName:  row.lastName,
              teamId:    input.globalTeamId,
            })
            if (!globalResult.userId) {
              errors.push({ index: i, reason: globalResult.errorCode ?? 'GLOBAL_USER_CREATE_FAILED' })
              skippedCount++
              return
            }
            userId = globalResult.userId

            await sp_UpsertUser({
              userId,
              email:     row.email,
              firstName: row.firstName,
              lastName:  row.lastName,
            })
          } else {
            // No email — cannot create global user; skip this row
            errors.push({ index: i, reason: 'EMAIL_REQUIRED' })
            skippedCount++
            return
          }

          const { errorCode } = await sp_AddUserRole({
            userId,
            programRoleId: input.programRoleId,
            sportId:       input.sportId       ?? null,
            status:        'current_player',
            positionId:    row.positionId    ?? null,
            jerseyNumber:  row.jerseyNumber  ?? null,
            seasonsPlayed: row.seasonsPlayed ?? null,
            classYear:     row.classYear     ?? null,
            adminUserId:   input.adminUserId,
          })

          if (errorCode && errorCode !== 'ROLE_ALREADY_EXISTS') {
            errors.push({ index: i, reason: errorCode })
            skippedCount++
          } else {
            successCount++
            // Fire-and-forget invite per successfully added player
            void sendInvite({
              email:     row.email!,
              firstName: row.firstName,
              teamId:    input.globalTeamId,
              teamName:  input.teamName ?? 'your program',
              role:      'player',
              createdBy: input.adminUserId,
            })
          }
        } catch (err) {
          errors.push({ index: i, reason: 'INTERNAL_ERROR' })
          skippedCount++
          console.error(`[bulkAddPlayersToRoster] row ${i}:`, err)
        }
      }),
    )

    return { successCount, skippedCount, errors }
  })
}
