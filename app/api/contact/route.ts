import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { accessRequestSchema, contactSchema } from '@/lib/validations/contact'

// ─── Config validation ────────────────────────────────────────────────────────
// Called once per request so missing vars surface immediately in Vercel logs
// rather than as a silent Resend auth failure.

function getConfig() {
  const apiKey  = process.env.RESEND_API_KEY
  const toEmail = process.env.CONTACT_TO_EMAIL
  const from    = process.env.CONTACT_FROM_EMAIL

  const missing: string[] = []
  if (!apiKey)  missing.push('RESEND_API_KEY')
  if (!toEmail) missing.push('CONTACT_TO_EMAIL')
  if (!from)    missing.push('CONTACT_FROM_EMAIL')

  if (missing.length > 0) {
    throw new Error(
      `[/api/contact] Missing required environment variables: ${missing.join(', ')}. ` +
      'Add them in your Vercel project settings (or .env.local for local dev).',
    )
  }

  return {
    resend:     new Resend(apiKey),
    adminEmail: toEmail!,
    fromEmail:  from!,
    ccEmail:    'legacylinkhqapp@gmail.com' as const,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Validate config up front — throws with a clear message if env vars are missing
  let cfg: ReturnType<typeof getConfig>
  try {
    cfg = getConfig()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/contact] Config error:', msg)
    return NextResponse.json(
      { error: 'Server misconfiguration. Please contact support.' },
      { status: 500 },
    )
  }

  // Parse body
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Route to the right handler based on which form submitted
  const isFullContact = typeof (raw as Record<string, unknown>).message === 'string'

  if (isFullContact) {
    return handleContactForm(raw, cfg)
  } else {
    return handleAccessRequest(raw, cfg)
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Config = ReturnType<typeof getConfig>

// ─── Access Request handler (landing page CTA) ───────────────────────────────

async function handleAccessRequest(raw: unknown, cfg: Config) {
  const result = accessRequestSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed.', issues: result.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { name, email, role, program } = result.data
  const timestamp = new Date().toISOString()

  console.log(`[/api/contact] Access request from ${email} at ${timestamp}`)

  const { data, error } = await cfg.resend.emails.send({
    from:    cfg.fromEmail,
    to:      cfg.adminEmail,
    cc:      [cfg.ccEmail],           // always CC — no conditional
    replyTo: email,
    subject: `[LegacyLink] Access Request — ${role ?? 'No role specified'}`,
    text:    accessRequestPlainText({ name, email, role, program }),
    html:    accessRequestHtml({ name, email, role, program }),
  })

  if (error) {
    console.error('[/api/contact] Access request — admin email failed:', {
      error,
      submitter: email,
      timestamp,
    })
    return NextResponse.json(
      { error: 'Failed to send message. Please try again.' },
      { status: 500 },
    )
  }

  console.log(`[/api/contact] Access request sent. Resend ID: ${data?.id}`)

  // Confirmation to submitter — fire-and-forget, never blocks the success response
  cfg.resend.emails.send({
    from:    cfg.fromEmail,
    to:      email,
    subject: `You're on the list — LegacyLink`,
    text:    confirmPlainText(name),
    html:    confirmHtml(name),
  }).then(({ data: d, error: err }) => {
    if (err) {
      console.error('[/api/contact] Access request — confirmation email failed:', {
        error: err,
        submitter: email,
        timestamp,
      })
    } else {
      console.log(`[/api/contact] Confirmation sent. Resend ID: ${d?.id}`)
    }
  })

  return NextResponse.json({ success: true, timestamp }, { status: 200 })
}

// ─── Full Contact Form handler (/contact page) ───────────────────────────────

async function handleContactForm(raw: unknown, cfg: Config) {
  const result = contactSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed.', issues: result.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { name, email, organization, subject, message } = result.data
  const timestamp = new Date().toISOString()

  console.log(`[/api/contact] Contact form from ${email} at ${timestamp}`)

  const { data, error } = await cfg.resend.emails.send({
    from:    cfg.fromEmail,
    to:      cfg.adminEmail,
    cc:      [cfg.ccEmail],           // always CC — no conditional
    replyTo: email,
    subject: `[LegacyLink] ${subject}`,
    text:    contactPlainText({ name, email, organization, subject, message }),
    html:    contactHtml({ name, email, organization, subject, message }),
  })

  if (error) {
    console.error('[/api/contact] Contact form — admin email failed:', {
      error,
      submitter: email,
      timestamp,
    })
    return NextResponse.json(
      { error: 'Failed to send message. Please try again.' },
      { status: 500 },
    )
  }

  console.log(`[/api/contact] Contact form sent. Resend ID: ${data?.id}`)

  cfg.resend.emails.send({
    from:    cfg.fromEmail,
    to:      email,
    subject: `We received your message — LegacyLink`,
    text:    confirmPlainText(name),
    html:    confirmHtml(name),
  }).then(({ data: d, error: err }) => {
    if (err) {
      console.error('[/api/contact] Contact form — confirmation email failed:', {
        error: err,
        submitter: email,
        timestamp,
      })
    } else {
      console.log(`[/api/contact] Confirmation sent. Resend ID: ${d?.id}`)
    }
  })

  return NextResponse.json({ success: true, timestamp }, { status: 200 })
}

// ─── Email templates (unchanged) ─────────────────────────────────────────────

const e = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const emailShell = (content: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        ${content}
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
            LegacyLink &mdash; <em>Where Rosters Become Legacies</em>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

const headerBlock = (title: string) => `
<tr>
  <td style="background:linear-gradient(135deg,#B8962E,#8B6E1E);padding:24px 32px;border-radius:8px 8px 0 0;">
    <p style="margin:0;color:#000;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">LegacyLink</p>
    <h1 style="margin:4px 0 0;color:#000;font-size:20px;font-weight:800;">${title}</h1>
  </td>
</tr>`

const bodyOpen  = `<tr><td style="background:#1A1A1A;border:1px solid rgba(255,255,255,0.08);border-top:none;padding:32px;border-radius:0 0 8px 8px;">`
const bodyClose = `</td></tr>`

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:7px 0;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.08em;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:7px 0;font-size:14px;color:rgba(255,255,255,0.85);">${value}</td>
  </tr>`
}

function accessRequestHtml(d: { name: string; email: string; role?: string; program?: string }) {
  return emailShell(`
    ${headerBlock('New Access Request')}
    ${bodyOpen}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${row('From',    e(d.name))}
      ${row('Email',   `<a href="mailto:${e(d.email)}" style="color:#D4AF5A;text-decoration:none;">${e(d.email)}</a>`)}
      ${row('Role',    e(d.role    ?? '—'))}
      ${row('Program', e(d.program ?? '—'))}
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.25);text-align:center;">
      Reply to respond directly to ${e(d.name)}
    </p>
    ${bodyClose}
  `)
}

function accessRequestPlainText(d: { name: string; email: string; role?: string; program?: string }) {
  return [
    'New Access Request — LegacyLink',
    '',
    `From:    ${d.name}`,
    `Email:   ${d.email}`,
    `Role:    ${d.role    ?? '—'}`,
    `Program: ${d.program ?? '—'}`,
  ].join('\n')
}

function contactHtml(d: { name: string; email: string; organization?: string; subject: string; message: string }) {
  return emailShell(`
    ${headerBlock('New Contact Form Submission')}
    ${bodyOpen}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${row('From',    e(d.name))}
      ${row('Email',   `<a href="mailto:${e(d.email)}" style="color:#D4AF5A;text-decoration:none;">${e(d.email)}</a>`)}
      ${row('Org',     e(d.organization ?? '—'))}
      ${row('Subject', e(d.subject))}
    </table>
    <div style="background:#0D0D0D;border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:18px;">
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,0.3);">Message</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.7);white-space:pre-wrap;">${e(d.message)}</p>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.25);text-align:center;">
      Reply to respond directly to ${e(d.name)}
    </p>
    ${bodyClose}
  `)
}

function contactPlainText(d: { name: string; email: string; organization?: string; subject: string; message: string }) {
  return [
    'New Contact Form Submission — LegacyLink',
    '',
    `From:    ${d.name}`,
    `Email:   ${d.email}`,
    `Org:     ${d.organization ?? '—'}`,
    `Subject: ${d.subject}`,
    '',
    'Message:',
    d.message,
  ].join('\n')
}

function confirmHtml(name: string) {
  const first = name.split(' ')[0]
  return emailShell(`
    ${headerBlock('We got your message.')}
    ${bodyOpen}
    <p style="margin:0 0 14px;font-size:16px;color:rgba(255,255,255,0.8);">Hi ${e(first)},</p>
    <p style="margin:0 0 14px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;">
      Thanks for reaching out. We&rsquo;ve received your message and will get back to you within
      <strong style="color:rgba(255,255,255,0.85);">1 business day</strong>.
    </p>
    <p style="margin:28px 0 0;font-size:13px;color:rgba(255,255,255,0.3);">&mdash; The LegacyLink Team</p>
    ${bodyClose}
  `)
}

function confirmPlainText(name: string) {
  const first = name.split(' ')[0]
  return [
    `Hi ${first},`,
    '',
    "Thanks for reaching out. We've received your message and will get back to you within 1 business day.",
    '',
    '— The LegacyLink Team',
  ].join('\n')
}
