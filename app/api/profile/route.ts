import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from '@/lib/auth'
import { sp_GetUserProfile, sp_UpdateUserProfile } from '@/lib/db/procedures'

const patchSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
})

// GET /api/profile — returns full profile for the authenticated user
export async function GET() {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const profile = await sp_GetUserProfile(session.userId)
    if (!profile) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: profile })
  } catch (err) {
    console.error('[GET /api/profile]', err)
    return NextResponse.json({ success: false, error: 'Failed to load profile.' }, { status: 500 })
  }
}

// PATCH /api/profile — update display name
export async function PATCH(req: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const p = patchSchema.safeParse(body)
  if (!p.success) {
    return NextResponse.json(
      { success: false, error: p.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 },
    )
  }

  try {
    const { errorCode } = await sp_UpdateUserProfile({
      targetUserId: session.userId,
      actorId:      session.userId,
      firstName:    p.data.firstName,
      lastName:     p.data.lastName,
    })

    if (errorCode === 'USER_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }
    if (errorCode === 'ACCOUNT_CLAIMED_EDIT_DENIED') {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 })
    }
    if (errorCode) {
      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: { firstName: p.data.firstName, lastName: p.data.lastName },
    })
  } catch (err) {
    console.error('[PATCH /api/profile]', err)
    return NextResponse.json({ success: false, error: 'Failed to update profile.' }, { status: 500 })
  }
}
