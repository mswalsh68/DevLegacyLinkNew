// POST /api/setup/redeem
// Redeems a setup token: bcrypt-hashes the supplied password and activates
// the account. The user can then log in normally.
// Unauthenticated — this IS the account-activation endpoint.
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sp_RedeemInviteToken } from '@/lib/db/procedures'

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { token, password } = body as { token?: string; password?: string }

  if (!token || !password) {
    return NextResponse.json({ error: 'token and password are required.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 422 })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)

    const { userId, email, errorCode } = await sp_RedeemInviteToken({
      tokenHash: token,
      passwordHash,
    })

    if (errorCode) {
      const messages: Record<string, string> = {
        INVALID_OR_EXPIRED: 'This setup link is invalid or has already been used.',
        TRANSACTION_FAILED:  'Something went wrong. Please try again.',
      }
      return NextResponse.json(
        { error: messages[errorCode] ?? 'Failed to activate account.' },
        { status: 410 },
      )
    }

    return NextResponse.json({ success: true, data: { userId, email } })
  } catch (err) {
    console.error('[POST /api/setup/redeem]', err)
    return NextResponse.json({ error: 'Failed to activate account.' }, { status: 500 })
  }
}
