import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_SetContactVisible } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function PATCH(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured.' }, { status: 503 })
  }

  let visible: boolean
  try {
    const body = await req.json()
    if (typeof body?.visible !== 'boolean') throw new Error('visible required')
    visible = body.visible
  } catch {
    return NextResponse.json({ success: false, error: 'visible (boolean) is required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      await sp_SetContactVisible({ userId: session.userId, visible })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[PATCH /api/profile/visibility]', err)
      return NextResponse.json({ success: false, error: 'Failed to update visibility' }, { status: 500 })
    }
  })
}
