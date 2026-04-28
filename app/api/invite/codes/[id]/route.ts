// PATCH /api/invite/codes/[id] — deactivate an invite code (global_admin only)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_DeactivateInviteCode } from '@/lib/db/procedures'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session)              return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  try {
    const { errorCode } = await sp_DeactivateInviteCode({
      inviteCodeId:  parseInt(id, 10),
      deactivatedBy: session.userId,
    })

    if (errorCode === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Invite code not found.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/invite/codes/[id]]', err)
    return NextResponse.json({ error: 'Failed to deactivate invite code.' }, { status: 500 })
  }
}
