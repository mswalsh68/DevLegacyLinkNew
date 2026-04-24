// GET /api/setup/[token]
// Validates a setup token and returns the user's name + email.
// Unauthenticated — used by the /setup page to pre-fill the form.
import { NextRequest, NextResponse } from 'next/server'
import { sp_ValidateInviteToken } from '@/lib/db/procedures'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 })
  }

  try {
    const user = await sp_ValidateInviteToken({ tokenHash: token })

    if (!user) {
      return NextResponse.json(
        { error: 'This setup link is invalid or has expired.' },
        { status: 410 },
      )
    }

    return NextResponse.json({ success: true, data: user })
  } catch (err) {
    console.error('[GET /api/setup/[token]]', err)
    return NextResponse.json({ error: 'Failed to validate setup link.' }, { status: 500 })
  }
}
