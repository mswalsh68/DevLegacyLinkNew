import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { contactSchema } from '@/lib/validations/contact'

const resend = new Resend(process.env.RESEND_API_KEY)

// Destination inbox for all contact form submissions
const TO_EMAIL = process.env.CONTACT_TO_EMAIL ?? 'hello@devlegacylink.com'
// Must match a verified sender domain in your Resend dashboard
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL ?? 'noreply@devlegacylink.com'

export async function POST(request: Request) {
  // Parse body
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Validate with Zod
  const result = contactSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Validation failed.',
        issues: result.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const { name, email, organization, subject, message } = result.data

  // Send via Resend
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    replyTo: email,
    subject: `[DevLegacyLink Contact] ${subject}`,
    text: buildPlainText({ name, email, organization, subject, message }),
    html: buildHtml({ name, email, organization, subject, message }),
  })

  if (error) {
    console.error('[/api/contact] Resend error:', error)
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true }, { status: 200 })
}

// ─── Email templates ─────────────────────────────────────────────────────────

function buildPlainText(data: {
  name: string
  email: string
  organization?: string
  subject: string
  message: string
}): string {
  return [
    `New contact form submission — DevLegacyLink`,
    ``,
    `From:         ${data.name}`,
    `Email:        ${data.email}`,
    `Organization: ${data.organization || '—'}`,
    `Subject:      ${data.subject}`,
    ``,
    `Message:`,
    data.message,
  ].join('\n')
}

function buildHtml(data: {
  name: string
  email: string
  organization?: string
  subject: string
  message: string
}): string {
  const escaped = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;">
  <div style="background:#1d4ed8;border-radius:8px 8px 0 0;padding:20px 24px;">
    <h1 style="color:#fff;margin:0;font-size:18px;">New Contact Form Submission</h1>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;">Name</td>
        <td style="padding:6px 0;font-size:14px;font-weight:600;">${escaped(data.name)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;">Email</td>
        <td style="padding:6px 0;font-size:14px;">
          <a href="mailto:${escaped(data.email)}" style="color:#1d4ed8;">${escaped(data.email)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;">Organization</td>
        <td style="padding:6px 0;font-size:14px;">${escaped(data.organization || '—')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#6b7280;">Subject</td>
        <td style="padding:6px 0;font-size:14px;">${escaped(data.subject)}</td>
      </tr>
    </table>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Message</p>
      <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escaped(data.message)}</p>
    </div>

    <p style="margin-top:20px;font-size:12px;color:#9ca3af;">
      Sent from the DevLegacyLink contact form. Reply directly to this email to respond to ${escaped(data.name)}.
    </p>
  </div>
</body>
</html>`
}
