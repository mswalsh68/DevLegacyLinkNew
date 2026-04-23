'use server'

// ─── Player Server Actions ────────────────────────────────────────────────────
//
// Cross-database coordination lives here (Azure SQL Database does not support
// cross-DB synonyms or linked servers):
//
//   createPlayer:
//     1. Global DB → sp_GetOrCreateUser  (get or create the canonical user ID)
//     2. App DB    → sp_CreatePlayer     (upsert player with that userId)
//
//   graduatePlayers:
//     1. App DB    → sp_GraduatePlayer          (flip status to alumni, returns succeededIds)
//     2. Global DB → sp_TransferPlayerToAlumni  (swap 'roster' → 'alumni' permission per user)
//
//   bulkCreatePlayers:
//     1. Global DB → sp_GetOrCreateUser  per row that has an email
//     2. App DB    → sp_BulkCreatePlayers with userId injected into each row

import {
  sp_GetOrCreateUser,
  sp_TransferPlayerToAlumni,
  sp_CreatePlayer,
  sp_UpdatePlayer,
  sp_RemovePlayer,
  sp_GraduatePlayer,
  sp_BulkCreatePlayers,
  type BulkPlayerRow,
} from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreatePlayerInput {
  appDb:                 string   // tenant App DB name from session.appDb
  email:                 string
  firstName:             string
  lastName:              string
  position:              string
  academicYear:          string
  recruitingClass:       number
  globalTeamId:          string   // team ID in LegacyLinkGlobal for user registration
  createdBy:             string
  sportId?:              string
  jerseyNumber?:         number
  heightInches?:         number
  weightLbs?:            number
  homeTown?:             string
  homeState?:            string
  highSchool?:           string
  major?:                string
  phone?:                string
  instagram?:            string
  twitter?:              string
  snapchat?:             string
  emergencyContactName?:  string
  emergencyContactPhone?: string
  parent1Name?:          string
  parent1Phone?:         string
  parent1Email?:         string
  parent2Name?:          string
  parent2Phone?:         string
  parent2Email?:         string
  notes?:                string
  requestingUserId?:     string
  requestingUserRole?:   string
}

export interface GraduatePlayersInput {
  appDb:          string   // tenant App DB name from session.appDb
  playerIds:      string[]
  graduationYear: number
  semester:       'spring' | 'fall' | 'summer'
  triggeredBy:    string
}

export interface BulkCreatePlayersInput {
  appDb:        string   // tenant App DB name from session.appDb
  players:      (Omit<BulkPlayerRow, 'userId'> & { email?: string })[]
  createdBy:    string
  globalTeamId: string   // used for Global DB user registration
  sportId?:     string
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Creates a single player.
 * Step 1: Global DB — resolve or create the canonical user account.
 * Step 2: App DB   — upsert player record with the resolved userId.
 */
export async function createPlayer(
  input: CreatePlayerInput,
): Promise<{ success: boolean; userId?: string; error?: string }> {
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

    // 2. App DB
    const { errorCode } = await sp_CreatePlayer({
      userId,
      email:                 input.email,
      firstName:             input.firstName,
      lastName:              input.lastName,
      position:              input.position,
      academicYear:          input.academicYear,
      recruitingClass:       input.recruitingClass,
      createdBy:             input.createdBy,
      sportId:               input.sportId,
      jerseyNumber:          input.jerseyNumber,
      heightInches:          input.heightInches,
      weightLbs:             input.weightLbs,
      homeTown:              input.homeTown,
      homeState:             input.homeState,
      highSchool:            input.highSchool,
      major:                 input.major,
      phone:                 input.phone,
      instagram:             input.instagram,
      twitter:               input.twitter,
      snapchat:              input.snapchat,
      emergencyContactName:  input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      parent1Name:           input.parent1Name,
      parent1Phone:          input.parent1Phone,
      parent1Email:          input.parent1Email,
      parent2Name:           input.parent2Name,
      parent2Phone:          input.parent2Phone,
      parent2Email:          input.parent2Email,
      notes:                 input.notes,
      requestingUserId:      input.requestingUserId,
      requestingUserRole:    input.requestingUserRole,
    })

    if (errorCode) {
      return { success: false, error: errorCode }
    }

    return { success: true, userId }
  } catch (err) {
    console.error('[createPlayer]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
  }) // end appDbContext.run
}

/**
 * Graduates one or more players.
 * Step 1: App DB   — flip status_id to 2 (alumni), log in graduation_log.
 *                    Returns list of userIds that succeeded.
 * Step 2: Global DB — call sp_TransferPlayerToAlumni for each succeeded userId
 *                    to swap 'roster' → 'alumni' app-permission.
 *
 * Global DB failures are logged but do NOT roll back the App DB status flip —
 * the player is already an alumni; the permission swap can be retried manually.
 */
export async function graduatePlayers(
  input: GraduatePlayersInput,
): Promise<{
  success:        boolean
  transactionId:  string
  successCount:   number
  failureJson:    string
  transferErrors: string[]   // userIds where Global DB permission swap failed
  error?:         string
}> {
  return appDbContext.run(input.appDb, async () => {
  try {
    // 1. App DB — flip statuses
    const result = await sp_GraduatePlayer({
      playerIds:      input.playerIds,
      graduationYear: input.graduationYear,
      semester:       input.semester,
      triggeredBy:    input.triggeredBy,
    })

    // 2. Global DB — transfer permissions for each successfully graduated user
    type SucceededRow = { userId: string }
    const succeededIds: string[] = (
      JSON.parse(result.succeededJson ?? '[]') as SucceededRow[]
    ).map((r) => r.userId)

    const transferErrors: string[] = []

    for (const userId of succeededIds) {
      try {
        await sp_TransferPlayerToAlumni({
          userId,
          grantedBy: input.triggeredBy,
        })
      } catch (err) {
        console.error(`[graduatePlayers] sp_TransferPlayerToAlumni failed for ${userId}:`, err)
        transferErrors.push(userId)
      }
    }

    return {
      success:        true,
      transactionId:  result.transactionId,
      successCount:   result.successCount,
      failureJson:    result.failureJson,
      transferErrors,
    }
  } catch (err) {
    console.error('[graduatePlayers]', err)
    return {
      success:        false,
      transactionId:  '',
      successCount:   0,
      failureJson:    '[]',
      transferErrors: [],
      error:          'INTERNAL_ERROR',
    }
  }
  }) // end appDbContext.run
}

/**
 * Updates a player's profile fields. Pass only the fields you want to change —
 * null / undefined fields are left unchanged by the stored procedure.
 */
export async function updatePlayer(
  appDb: string,
  params: Parameters<typeof sp_UpdatePlayer>[0],
): Promise<{ success: boolean; error?: string }> {
  return appDbContext.run(appDb, async () => {
    try {
      const { errorCode } = await sp_UpdatePlayer(params)
      if (errorCode) return { success: false, error: errorCode }
      return { success: true }
    } catch (err) {
      console.error('[updatePlayer]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Removes a player (sets status_id = 3).
 */
export async function removePlayer(
  appDb: string,
  params: Parameters<typeof sp_RemovePlayer>[0],
): Promise<{ success: boolean; error?: string }> {
  return appDbContext.run(appDb, async () => {
    try {
      const { errorCode } = await sp_RemovePlayer(params)
      if (errorCode) return { success: false, error: errorCode }
      return { success: true }
    } catch (err) {
      console.error('[removePlayer]', err)
      return { success: false, error: 'INTERNAL_ERROR' }
    }
  })
}

/**
 * Bulk-creates players from a CSV/form upload.
 * For rows with an email, resolves the Global DB userId first.
 * Rows without an email get a generated userId (historical/provisional records).
 */
export async function bulkCreatePlayers(
  input: BulkCreatePlayersInput,
): Promise<{ successCount: number; skippedCount: number; errorJson: string }> {
  return appDbContext.run(input.appDb, async () => {
    // Resolve Global DB userIds for rows that have an email
    const enriched: BulkPlayerRow[] = await Promise.all(
      input.players.map(async (row) => {
        if (!row.email) return row  // no email → SP will generate a userId

        try {
          const { userId } = await sp_GetOrCreateUser({
            email:     row.email,
            firstName: row.firstName,
            lastName:  row.lastName,
            teamId:    input.globalTeamId,
          })
          return { ...row, userId: userId ?? undefined }
        } catch {
          // If Global DB lookup fails for one row, pass without userId —
          // the SP will generate a provisional one so the row isn't silently lost.
          return row
        }
      }),
    )

    return sp_BulkCreatePlayers({
      players:   enriched,
      createdBy: input.createdBy,
      sportId:   input.sportId,
    })
  })
}
