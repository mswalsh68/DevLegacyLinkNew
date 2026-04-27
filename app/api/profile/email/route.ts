import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getServerSession } from '@/lib/auth'
import { sp_GetPasswordHash, sp_ChangeEmail } from '@/lib/db/procedures'

const schema = z.object({
  currentPassword: z.string().min(1),
  newEmail:        z.string().email(),
})

// PATCH /api/profile/email — change email (requires current password)
// On success: clears auth cookies and returns requireRelogin: true so the
// client redirects to /login with the new email address.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const p = schema.safeParse(body)
  if (!p.success) {
    return NextResponse.json(
      { success: false, error: p.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 },
    )
  }

  try {
    const hash = await sp_GetPasswordHash(session.userId)
    if (!hash) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const valid = await bcrypt.compare(p.data.currentPassword, hash)
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 },
      )
    }

    const { errorCode } = await sp_ChangeEmail({
      userId:   session.userId,
      newEmail: p.data.newEmail.toLowerCase().trim(),
    })

    if (errorCode === 'EMAIL_ALREADY_EXISTS') {
      return NextResponse.json(
        { success: false, error: 'That email address is already in use' },
        { status: 409 },
      )
    }
    if (errorCode) {
      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    }

    // Clear cookies — user must re-login with the new email
    const response = NextResponse.json({ success: true, data: { requireRelogin: true } })
    response.cookies.delete('access_token')
    response.cookies.delete('refresh_token')
    return response
  } catch (err) {
    console.error('[PATCH /api/profile/email]', err)
    return NextResponse.json({ success: false, error: 'Failed to update email.' }, { status: 500 })
  }
}
