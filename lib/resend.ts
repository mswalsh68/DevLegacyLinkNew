/**
 * Shared transactional email helper (Resend).
 * Fire-and-forget: logs on failure, never throws.
 * For campaign (bulk) emails use lib/email.ts instead.
 */
export async function sendTransactionalEmail(
  to:       string,
  subject:  string,
  html:     string,
  options?: { fromName?: string; replyTo?: string },
): Promise<void> {
  const apiKey    = process.env.RESEND_API_KEY
  const fromDomain = process.env.CONTACT_FROM_EMAIL ?? 'noreply@legacylinkhq.app'

  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not set — skipping email to', to)
    return
  }

  const fromLabel = options?.fromName
    ? `"${options.fromName}" <${fromDomain}>`
    : fromDomain

  const body: Record<string, unknown> = { from: fromLabel, to, subject, html }
  if (options?.replyTo) body.reply_to = options.replyTo

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('[resend] Non-OK response', res.status, await res.text())
    }
  } catch (err) {
    console.error('[resend] Email send failed:', err)
  }
}

/**
 * Builds the HTML for a member invite email.
 */
export function buildInviteEmailHtml(params: {
  firstName: string
  teamName:  string
  inviteUrl: string
  role:      string   // 'player' | 'alumni' | 'head_coach' etc.
}): string {
  const { firstName, teamName, inviteUrl, role } = params
  const roleLabel = role === 'player'  ? 'player'
                  : role === 'alumni'  ? 'alumni'
                  : role.replace(/_/g, ' ')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:32px 24px">
  <p style="font-size:18px;font-weight:700;margin:0 0 16px">${teamName} — LegacyLink</p>

  <p>Hi ${firstName},</p>

  <p>
    You've been added to <strong>${teamName}</strong> on LegacyLink as a
    <strong>${roleLabel}</strong>.
  </p>

  <p>Click the link below to set up your account and access the platform:</p>

  <p style="margin:24px 0">
    <a
      href="${inviteUrl}"
      style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block"
    >Set up my account</a>
  </p>

  <p style="font-size:13px;color:#6b7280">
    Or copy this link into your browser:<br>
    <span style="word-break:break-all">${inviteUrl}</span>
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">

  <p style="font-size:12px;color:#9ca3af;margin:0">
    You're receiving this because a program administrator added you to ${teamName}.
    If you weren't expecting this, you can ignore this email.
  </p>
</body>
</html>`
}
