import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetCommunityConsent, sp_UpsertCommunityConsent } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { COMMUNITY_TC_VERSION } from '@/lib/constants'

export async function GET(_req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured.' }, { status: 503 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const record = await sp_GetCommunityConsent({ userId: session.userId })
      return NextResponse.json({ success: true, data: record })
    } catch (err) {
      console.error('[GET /api/community/consent]', err)
      return NextResponse.json({ success: false, error: 'Failed to load consent record' }, { status: 500 })
    }
  })
}

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured.' }, { status: 503 })
  }

  let accepted: boolean
  try {
    const body = await req.json()
    if (typeof body?.accepted !== 'boolean') throw new Error('accepted required')
    accepted = body.accepted
  } catch {
    return NextResponse.json({ success: false, error: 'accepted (boolean) is required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      await sp_UpsertCommunityConsent({
        userId:    session.userId,
        accepted,
        tcVersion: COMMUNITY_TC_VERSION,
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[POST /api/community/consent]', err)
      return NextResponse.json({ success: false, error: 'Failed to save consent' }, { status: 500 })
    }
  })
}
