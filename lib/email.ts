// ─── Campaign email dispatch helper ───────────────────────────────────────────
//
// sendCampaignEmails:
//   1. Calls sp_DispatchCampaign to queue messages and get the recipient list
//   2. For each recipient, sends an email via the Resend SDK
//   3. Calls sp_MarkEmailSent with {messageId, resendId} pairs so the DB stays
//      in sync and the open-tracking webhook can correlate events back to rows
//
// Used by:
//   - POST /api/campaigns/[id]/dispatch  (manual dispatch)
//   - POST /api/feed                     (fire-and-forget when alsoEmail=true)

import { Resend } from 'resend'
import { sp_DispatchCampaign, sp_MarkEmailSent } from './db/procedures'
import { appDbContext } from './db/connection'

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'https://legacylink.app'

// Build the plain-text unsubscribe footer that goes at the bottom of every
// outreach email.  physicalAddress is required by CAN-SPAM.
function unsubscribeFooter(unsubToken: string, physicalAddress: string | null): string {
  const unsubUrl = `${WEB_BASE_URL}/unsubscribe?token=${unsubToken}`
  const address  = physicalAddress ?? 'Revenue Management Solutions, LLC'
  return `
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
  <p style="margin:0 0 4px 0;">${address}</p>
  <p style="margin:0;">
    <a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a> from these emails.
  </p>
</div>
`
}

interface SendResult {
  queuedCount: number
  sentCount:   number
  errorCode:   string | null
}

/**
 * Queue + send all emails for a campaign.
 * Must be called inside an active appDbContext.run() for the right tenant.
 */
export async function sendCampaignEmails(params: {
  campaignId:   string
  dispatchedBy: number
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[sendCampaignEmails] RESEND_API_KEY not set — aborting')
    return { queuedCount: 0, sentCount: 0, errorCode: 'RESEND_API_KEY_MISSING' }
  }

  // Step 1 — queue messages in DB + get recipient list
  const { queuedCount, errorCode, header, recipients } = await sp_DispatchCampaign({
    campaignId:   params.campaignId,
    dispatchedBy: params.dispatchedBy,
  })

  if (errorCode && errorCode !== 'OK') {
    return { queuedCount: 0, sentCount: 0, errorCode }
  }

  if (!header || recipients.length === 0) {
    return { queuedCount, sentCount: 0, errorCode: errorCode ?? null }
  }

  const resend = new Resend(apiKey)

  const fromAddr = header.fromName
    ? `${header.fromName} <${process.env.CONTACT_FROM_EMAIL ?? 'noreply@legacylink.app'}>`
    : (process.env.CONTACT_FROM_EMAIL ?? 'noreply@legacylink.app')

  const subject  = header.subjectLine ?? header.campaignName ?? '(No subject)'
  const bodyHtml = header.bodyHtml    ?? ''

  // Step 2 — send via Resend, collect {messageId, resendId} pairs
  const sent: Array<{ messageId: string; resendId: string }> = []

  await Promise.allSettled(
    recipients.map(async (rec) => {
      const html = bodyHtml + unsubscribeFooter(rec.unsubscribeToken, header.physicalAddress)
      try {
        // Embed appDb as a tag so the webhook can route to the correct tenant DB
        // without fanning out across all tenants.
        const currentAppDb = appDbContext.getStore()
        const { data, error } = await resend.emails.send({
          from:    fromAddr,
          to:      rec.emailAddress,
          replyTo: header.replyToEmail ?? undefined,
          subject,
          html,
          tags: currentAppDb
            ? [{ name: 'appDb', value: currentAppDb }]
            : undefined,
        })
        if (error || !data?.id) {
          console.error('[sendCampaignEmails] Resend send error:', error, 'to:', rec.emailAddress)
          return
        }
        sent.push({ messageId: rec.messageId, resendId: data.id })
      } catch (err) {
        console.error('[sendCampaignEmails] Unexpected send error:', err, 'to:', rec.emailAddress)
      }
    }),
  )

  // Step 3 — mark successfully-sent messages in DB
  if (sent.length > 0) {
    try {
      await sp_MarkEmailSent({ messages: sent })
    } catch (err) {
      console.error('[sendCampaignEmails] sp_MarkEmailSent failed:', err)
      // Non-fatal — emails were already sent; DB will reconcile on next webhook event
    }
  }

  return { queuedCount, sentCount: sent.length, errorCode: null }
}

/**
 * Fire-and-forget wrapper — swallows all errors.
 * For use in places where email dispatch is a side-effect (e.g. feed post creation).
 * Must be called with an already-active appDbContext (it does NOT wrap itself).
 */
export function sendCampaignEmailsBackground(params: {
  campaignId:   string
  dispatchedBy: number
  appDb:        string
}): void {
  appDbContext.run(params.appDb, () =>
    sendCampaignEmails({ campaignId: params.campaignId, dispatchedBy: params.dispatchedBy }),
  ).catch((err) => {
    console.error('[sendCampaignEmailsBackground] Unhandled error:', err)
  })
}
