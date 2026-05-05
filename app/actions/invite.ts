'use server'

// ─── Invite / Access Request Server Actions ───────────────────────────────────
//
// Admin-facing mutations for the access request review flow:
//
//   approveAccessRequest:
//     Global DB → sp_ReviewAccessRequest (approve) — mirrors sp_GetOrCreateUser's
//     user_teams + app_permissions writes.
//     App DB → sp_UpsertUser — syncs the user into the tenant App DB on approval.
//
//   denyAccessRequest:
//     Global DB → sp_ReviewAccessRequest (deny)
//
//   sendRequestReminder:
//     Global DB → sp_SendRequestReminder — throttled to once per 48 hours.
//
// Notifications use Resend (same service as /api/contact) via the shared helper below.

import sql from 'mssql'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import {
  sp_ReviewAccessRequest,
  sp_SendRequestReminder,
  sp_UpsertUser,
  sp_AddUserRole,
} from '@/lib/db/procedures'
import { getPool, appDbContext } from '@/lib/db/connection'
import { sendTransactionalEmail as sendEmail } from '@/lib/resend'

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Approves an access request.
 * Writes to Global DB: user_teams + app_permissions (same as manual user creation).
 * Sends an approval email to the user.
 */
export async function approveAccessRequest(params: {
  requestId: number
  role?:     string   // optional override; defaults to role on the request
  userEmail: string   // for notification
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session)              return { success: false, error: 'Unauthorized' }
    if (!isGlobalAdmin(session)) return { success: false, error: 'Forbidden' }

    const { userId, teamId, finalRole, errorCode } = await sp_ReviewAccessRequest({
      requestId:  params.requestId,
      reviewedBy: session.userId,
      action:     'approve',
      role:       params.role ?? null,
    })

    if (errorCode) {
      const messages: Record<string, string> = {
        NOT_FOUND:       'Request not found.',
        ALREADY_REVIEWED:'This request has already been reviewed.',
        INVALID_ACTION:  'Invalid action.',
      }
      return { success: false, error: messages[errorCode] ?? errorCode }
    }

    // Sync approved user into tenant App DB and create sport membership
    try {
      const db      = await getPool('global')
      const infoReq = db.request()
      infoReq.input('UserId',    sql.BigInt, userId)
      infoReq.input('TeamId',    sql.Int,    teamId)
      infoReq.input('RequestId', sql.BigInt, params.requestId)
      const infoRes = await infoReq.query<{
        email:      string
        firstName:  string
        lastName:   string
        appDb:      string | null
        sportId:    number | null
        inviteRole: string | null
      }>(
        `SELECT
           u.email          AS email,
           u.first_name     AS firstName,
           u.last_name      AS lastName,
           t.app_db         AS appDb,
           ic.sport_id      AS sportId,
           ic.role          AS inviteRole
         FROM dbo.users u
         CROSS JOIN dbo.teams t
         LEFT JOIN dbo.access_requests ar ON ar.id = @RequestId
         LEFT JOIN dbo.invite_codes    ic ON ic.id  = ar.invite_code_id
         WHERE u.user_id = @UserId AND t.id = @TeamId`
      )
      const info = infoRes.recordset[0]
      if (info?.appDb) {
        await appDbContext.run(info.appDb, async () => {
          await sp_UpsertUser({
            userId:       userId!,
            email:        info.email,
            firstName:    info.firstName,
            lastName:     info.lastName,
            platformRole: info.inviteRole ?? 'client',
            globalRoleId: 3,
          })

          // Look up programRoleId from the invite code's role name
          if (info.inviteRole) {
            const appDb   = await getPool('app')
            const roleReq = appDb.request()
            roleReq.input('RoleName', sql.NVarChar(50), info.inviteRole)
            const roleRes = await roleReq.query<{ id: number }>(
              `SELECT id FROM dbo.program_role WHERE role_name = @RoleName`
            )
            const programRoleId = roleRes.recordset[0]?.id ?? null
            if (programRoleId) {
              await sp_AddUserRole({
                userId:       userId!,
                programRoleId,
                sportId:      info.sportId ?? null,
                adminUserId:  session.userId,
              })
            }
          }
        })
      }
    } catch (upsertErr) {
      console.warn('[approveAccessRequest] App DB sync failed:', (upsertErr as Error).message)
    }

    // Notify user
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    await sendEmail(
      params.userEmail,
      'Your access request has been approved — LegacyLink',
      `<p>Your request has been approved with role <strong>${finalRole}</strong>.</p>
       <p><a href="${appUrl}/dashboard">Sign in to LegacyLink</a></p>`,
    )

    console.log(`[approveAccessRequest] request=${params.requestId} user=${userId} team=${teamId} role=${finalRole}`)
    return { success: true }
  } catch (err) {
    console.error('[approveAccessRequest]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}

/**
 * Denies an access request with an optional reason.
 * Sends a denial email to the user.
 */
export async function denyAccessRequest(params: {
  requestId:    number
  denialReason?: string
  userEmail:    string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session)              return { success: false, error: 'Unauthorized' }
    if (!isGlobalAdmin(session)) return { success: false, error: 'Forbidden' }

    const { errorCode } = await sp_ReviewAccessRequest({
      requestId:    params.requestId,
      reviewedBy:   session.userId,
      action:       'deny',
      denialReason: params.denialReason ?? null,
    })

    if (errorCode) {
      const messages: Record<string, string> = {
        NOT_FOUND:       'Request not found.',
        ALREADY_REVIEWED:'This request has already been reviewed.',
      }
      return { success: false, error: messages[errorCode] ?? errorCode }
    }

    const reason = params.denialReason
      ? `<p>Reason: ${params.denialReason}</p>`
      : ''

    await sendEmail(
      params.userEmail,
      'Your access request was not approved — LegacyLink',
      `<p>Unfortunately your access request was not approved at this time.</p>
       ${reason}
       <p>Contact your program administrator if you believe this was a mistake.</p>`,
    )

    return { success: true }
  } catch (err) {
    console.error('[denyAccessRequest]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}

/**
 * Sends an admin reminder for a pending request.
 * Caller is the requesting user (not an admin).
 * Throttled to once per 48 hours by sp_SendRequestReminder.
 */
export async function sendRequestReminder(params: {
  requestId: number
  teamName:  string
  adminEmail?: string  // optional — falls back to CONTACT_TO_EMAIL
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session) return { success: false, error: 'Unauthorized' }

    const { errorCode } = await sp_SendRequestReminder({
      requestId: params.requestId,
      userId:    session.userId,
    })

    if (errorCode) {
      const messages: Record<string, string> = {
        NOT_FOUND:       'Request not found.',
        FORBIDDEN:       'You can only send reminders for your own requests.',
        NOT_PENDING:     'This request is no longer pending.',
        REMINDER_TOO_SOON: 'You can only send a reminder once every 48 hours.',
      }
      return { success: false, error: messages[errorCode] ?? errorCode }
    }

    const adminTo = params.adminEmail ?? process.env.CONTACT_TO_EMAIL
    if (adminTo) {
      const userName = session.username ?? session.email
      await sendEmail(
        adminTo,
        `Reminder: pending access request for ${params.teamName} — LegacyLink`,
        `<p>${userName} is waiting for approval to join <strong>${params.teamName}</strong>.</p>
         <p>Request ID: ${params.requestId}</p>`,
      )
    }

    return { success: true }
  } catch (err) {
    console.error('[sendRequestReminder]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}
