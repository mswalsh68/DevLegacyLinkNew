import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from '@/lib/auth'
import { sp_SetPreferredTeam } from '@/lib/db/procedures'

const schema = z.object({
  teamId: z.number().int().positive(),
})

// PATCH /api/auth/preferred-team — save the user's default landing team
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
    const { errorCode } = await sp_SetPreferredTeam({
      userId: session.userId,
      teamId: p.data.teamId,
    })

    if (errorCode === 'TEAM_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 400 })
    }
    if (errorCode === 'ACCESS_DENIED') {
      return NextResponse.json({ success: false, error: 'You do not have access to that team' }, { status: 403 })
    }
    if (errorCode) {
      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: { preferredTeamId: p.data.teamId } })
  } catch (err) {
    console.error('[PATCH /api/auth/preferred-team]', err)
    return NextResponse.json({ success: false, error: 'Failed to save preferred team.' }, { status: 500 })
  }
}
