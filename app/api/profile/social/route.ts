import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { sp_UpsertUserContact } from '@/lib/db/procedures'

const urlOrEmpty = z.string().max(500).optional().nullable()

const patchSchema = z.object({
  twitter:    z.string().max(100).optional().nullable(),
  instagram:  z.string().max(100).optional().nullable(),
  facebook:   z.string().max(100).optional().nullable(),
  linkedIn:   z.string().max(255).optional().nullable(),
  website:    urlOrEmpty,
  otherLink1: urlOrEmpty,
  otherLink2: urlOrEmpty,
  otherLink3: urlOrEmpty,
})

// PATCH /api/profile/social — update social links for the authenticated user
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
      twitter:      p.data.twitter,
      instagram:    p.data.instagram,
      facebook:     p.data.facebook,
      linkedIn:     p.data.linkedIn,
      website:      p.data.website,
      otherLink1:   p.data.otherLink1,
      otherLink2:   p.data.otherLink2,
      otherLink3:   p.data.otherLink3,
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
    console.error('[PATCH /api/profile/social]', err)
    return NextResponse.json({ success: false, error: 'Failed to update social links.' }, { status: 500 })
  }
}
