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
 * Builds the HTML for a "you've been added to [team]" notification email.
 * Sent to existing users (account already claimed) when added to a new team.
 */
export function buildTeamAddedEmailHtml(params: {
  firstName: string
  teamName:  string
  loginUrl:  string
}): string {
  const { firstName, teamName, loginUrl } = params
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:32px 24px">
  <p style="font-size:18px;font-weight:700;margin:0 0 16px">${teamName} — LegacyLink</p>

  <p>Hi ${firstName},</p>

  <p>
    You've been added to <strong>${teamName}</strong> on LegacyLink.
  </p>

  <p>Log in to your account to access your team:</p>

  <p style="margin:24px 0">
    <a
      href="${loginUrl}"
      style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block"
    >Log in to LegacyLink</a>
  </p>

  <p style="font-size:13px;color:#6b7280">
    Or copy this link into your browser:<br>
    <span style="word-break:break-all">${loginUrl}</span>
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">

  <p style="font-size:12px;color:#9ca3af;margin:0">
    You're receiving this because a program administrator added you to ${teamName}.
    If you weren't expecting this, you can ignore this email.
  </p>
</body>
</html>`
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

// ─── Mentor Program Emails ─────────────────────────────────────────────────────

export function buildMentorRequestEmailHtml(params: {
  alumniFirstName: string
  playerFirstName: string
  playerLastName:  string
  playerPosition:  string | null
  playerClassYear: number | null
  teamName:        string
  coachName:       string
  dashboardUrl:    string
}): string {
  const { alumniFirstName, playerFirstName, playerLastName, playerPosition, playerClassYear, teamName, coachName, dashboardUrl } = params
  const playerDesc = [playerPosition, playerClassYear ? `Class of ${playerClassYear}` : null].filter(Boolean).join(' · ')
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Mentor Request</title></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111827">
  <p>Hi ${alumniFirstName},</p>
  <p><strong>${coachName}</strong> at <strong>${teamName}</strong> has selected you as a potential mentor for a current player — a recognition of your experience and the impact you had during your time in the program.</p>
  <div style="background:#f3f4f6;border-radius:8px;padding:16px 20px;margin:24px 0">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Player</p>
    <p style="margin:0;font-size:16px;font-weight:700;color:#111827">${playerFirstName} ${playerLastName}</p>
    ${playerDesc ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280">${playerDesc}</p>` : ''}
  </div>
  <p>Log in to your LegacyLink dashboard to accept or decline. There is no obligation — only your genuine interest matters.</p>
  <p style="margin:24px 0">
    <a href="${dashboardUrl}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">View Request</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af;margin:0">Sent on behalf of ${teamName} via LegacyLink.</p>
</body>
</html>`
}

export function buildMentorAcceptedEmailHtml(params: {
  playerFirstName: string
  alumniFirstName: string
  alumniLastName:  string
  alumniPosition:  string | null
  alumniClassYear: number | null
  teamName:        string
  dashboardUrl:    string
}): string {
  const { playerFirstName, alumniFirstName, alumniLastName, alumniPosition, alumniClassYear, teamName, dashboardUrl } = params
  const alumniDesc = [alumniPosition, alumniClassYear ? `Class of ${alumniClassYear}` : null].filter(Boolean).join(' · ')
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Mentor Assigned</title></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111827">
  <p>Hi ${playerFirstName},</p>
  <p>Your coaching staff at <strong>${teamName}</strong> has connected you with a mentor from the program's alumni network.</p>
  <div style="background:#f3f4f6;border-radius:8px;padding:16px 20px;margin:24px 0">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Your Mentor</p>
    <p style="margin:0;font-size:16px;font-weight:700;color:#111827">${alumniFirstName} ${alumniLastName}</p>
    ${alumniDesc ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280">${alumniDesc}</p>` : ''}
  </div>
  <p>Their contact information is available in your Mentor section on LegacyLink.</p>
  <p style="margin:24px 0">
    <a href="${dashboardUrl}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">View My Mentor</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af;margin:0">Sent on behalf of ${teamName} via LegacyLink.</p>
</body>
</html>`
}

export function buildMentorDeclinedEmailHtml(params: {
  adminFirstName:  string
  alumniFirstName: string
  alumniLastName:  string
  playerFirstName: string
  playerLastName:  string
  teamName:        string
  dashboardUrl:    string
}): string {
  const { adminFirstName, alumniFirstName, alumniLastName, playerFirstName, playerLastName, teamName, dashboardUrl } = params
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Mentor Request Unavailable</title></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111827">
  <p>Hi ${adminFirstName},</p>
  <p><strong>${alumniFirstName} ${alumniLastName}</strong> was unable to take on a mentorship at this time for <strong>${playerFirstName} ${playerLastName}</strong>.</p>
  <p>You can create a new pairing for ${playerFirstName} with a different alumni from the Mentor Program dashboard.</p>
  <p style="margin:24px 0">
    <a href="${dashboardUrl}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Mentor Program Dashboard</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af;margin:0">${teamName} · LegacyLink</p>
</body>
</html>`
}

export function buildMentorCancelledEmailHtml(params: {
  alumniFirstName: string
  playerFirstName: string
  playerLastName:  string
  teamName:        string
}): string {
  const { alumniFirstName, playerFirstName, playerLastName, teamName } = params
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Mentor Request Withdrawn</title></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#111827">
  <p>Hi ${alumniFirstName},</p>
  <p>The mentorship request from <strong>${teamName}</strong> for <strong>${playerFirstName} ${playerLastName}</strong> has been withdrawn by the coaching staff. No action is needed on your part.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
  <p style="font-size:12px;color:#9ca3af;margin:0">${teamName} · LegacyLink</p>
</body>
</html>`
}
