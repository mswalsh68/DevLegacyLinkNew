import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { sp_UpsertUserContact } from '@/lib/db/procedures'

const patchSchema = z.object({
  phone:   z.string().max(20).optional(),
  address: z.string().max(255).optional(),
  city:    z.string().max(100).optional(),
  state:   z.string().max(100).optional(),
  zipcode: z.string().max(20).optional(),
})

// PATCH /api/profile/contact — update contact info for the authenticated user
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireSession({ appDb: false })
  if (error) return error

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
    const { errorCode } = await sp_UpsertUserContact({
      targetUserId: session.userId,
      actorId:      session.userId,
      // Send trimmed value; '' tells the SP to clear the field
      phone:   p.data.phone,
      address: p.data.address,
      city:    p.data.city,
      state:   p.data.state,
      zipcode: p.data.zipcode,
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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/profile/contact]', err)
    return NextResponse.json({ success: false, error: 'Failed to update contact info.' }, { status: 500 })
  }
}
