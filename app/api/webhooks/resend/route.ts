// ─── POST /api/webhooks/resend ────────────────────────────────────────────────
//
// Receives email events from Resend (delivered via Svix).
// Handles:
//   email.opened — marks outreach_messages.opened_at for the matched row
//
// Verification uses the Resend SDK's built-in Svix wrapper.
// Configure the webhook endpoint in the Resend dashboard:
//   URL:    https://<your-domain>/api/webhooks/resend
//   Events: email.opened  (enable others as needed in future)
//
// Required env var:
//   RESEND_WEBHOOK_SECRET — signing secret from Resend dashboard (whsec_...)
//
// Routing:
//   When an email is sent, the sending helper (lib/email.ts) embeds the
//   tenant's appDb name as a Resend tag (tag name = "appDb").  The webhook
//   reads that tag to route directly to the correct tenant DB.  If the tag
//   is absent (e.g. older emails), it falls back to querying all tenant DBs.

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { sp_MarkEmailOpened } from '@/lib/db/procedures'
import { appDbContext, getAllAppDbs } from '@/lib/db/connection'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/resend] RESEND_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // ── Read raw body ──────────────────────────────────────────────────────────
  const payload = await req.text()

  // ── Verify Svix signature ──────────────────────────────────────────────────
  const resend = new Resend(process.env.RESEND_API_KEY)

  let event: ReturnType<typeof resend.webhooks.verify>

  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id:        req.headers.get('svix-id')        ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: secret,
    })
  } catch (err) {
    console.error('[webhooks/resend] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── Route by event type ────────────────────────────────────────────────────
  if (event.type === 'email.opened') {
    const resendId = event.data.email_id

    if (!resendId) {
      console.warn('[webhooks/resend] email.opened event missing email_id — skipping')
      return NextResponse.json({ ok: true })
    }

    // Try to route directly to the tenant DB via the appDb tag
    const appDbTag = (event.data as { tags?: Record<string, string> }).tags?.appDb

    if (appDbTag) {
      // Fast path: tag tells us exactly which DB owns this row
      try {
        const { errorCode } = await appDbContext.run(appDbTag, () =>
          sp_MarkEmailOpened({ resendId }),
        )
        if (errorCode && errorCode !== 'MESSAGE_NOT_FOUND') {
          console.warn(`[webhooks/resend] sp_MarkEmailOpened error in ${appDbTag}:`, errorCode)
        }
      } catch (err) {
        console.error(`[webhooks/resend] sp_MarkEmailOpened threw in ${appDbTag}:`, err)
      }
    } else {
      // Slow path: fan out across all tenant DBs (for emails sent before tagging)
      const appDbs = await getAllAppDbs()
      let found = false

      for (const appDb of appDbs) {
        try {
          const { errorCode } = await appDbContext.run(appDb, () =>
            sp_MarkEmailOpened({ resendId }),
          )
          if (!errorCode) {
            found = true
            break   // matched — stop scanning
          }
          // errorCode = 'MESSAGE_NOT_FOUND' → try next tenant
        } catch (err) {
          console.error(`[webhooks/resend] sp_MarkEmailOpened error in ${appDb}:`, err)
        }
      }

      if (!found) {
        // Normal for invite / contact-form emails that aren't campaign messages
        console.info(
          `[webhooks/resend] email.opened — resend_id=${resendId} ` +
          `not matched in any tenant DB (likely non-campaign email)`,
        )
      }
    }
  }

  // Always return 200 so Resend doesn't retry
  return NextResponse.json({ ok: true })
}
