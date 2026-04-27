import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getServerSession } from '@/lib/auth'
import { sp_GetPasswordHash, sp_ChangePassword } from '@/lib/db/procedures'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
})

// PATCH /api/profile/password — change password (requires current password)
// On success: clears auth cookies and returns requireRelogin: true.
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

    const newHash = await bcrypt.hash(p.data.newPassword, 12)
    const { errorCode } = await sp_ChangePassword({
      userId:          session.userId,
      newPasswordHash: newHash,
    })

    if (errorCode) {
      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    }

    // Clear cookies — user must re-login
    const response = NextResponse.json({ success: true, data: { requireRelogin: true } })
    response.cookies.delete('access_token')
    response.cookies.delete('refresh_token')
    return response
  } catch (err) {
    console.error('[PATCH /api/profile/password]', err)
    return NextResponse.json({ success: false, error: 'Failed to update password.' }, { status: 500 })
  }
}
