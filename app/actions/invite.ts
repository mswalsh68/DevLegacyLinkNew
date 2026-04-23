'use server'

// ─── Invite / Access Request Server Actions ───────────────────────────────────
//
// Admin-facing mutations for the access request review flow:
//
//   approveAccessRequest:
//     Global DB → sp_ReviewAccessRequest (approve) — mirrors sp_GetOrCreateUser's
//     user_teams + app_permissions writes. No App DB write (roster record is
//     created separately when the user first accesses the roster module).
//
//   denyAccessRequest:
//     Global DB → sp_ReviewAccessRequest (deny)
//
//   sendRequestReminder:
//     Global DB → sp_SendRequestReminder — throttled to once per 48 hours.
//
// Notifications use Resend (same service as /api/contact) via the shared helper below.

import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import {
  sp_ReviewAccessRequest,
  sp_SendRequestReminder,
} from '@/lib/db/procedures'

// ─── Email helper (Resend — matches existing /api/contact pattern) ────────────

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey   = process.env.RESEND_API_KEY
  const fromAddr = process.env.CONTACT_FROM_EMAIL ?? 'noreply@legacylink.app'

  if (!apiKey) {
    console.warn('[invite/actions] RESEND_API_KEY not set — skipping email to', to)
    return
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr, to, subject, html }),
    })
  } catch (err) {
    console.error('[invite/actions] Email send failed:', err)
    // Non-fatal — log and continue
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Approves an access request.
 * Writes to Global DB: user_teams + app_permissions (same as manual user creation).
 * Sends an approval email to the user.
 */
export async function approveAccessRequest(params: {
  requestId: string
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
  requestId:    string
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
  requestId: string
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
