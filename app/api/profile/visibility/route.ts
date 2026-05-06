import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { sp_SetContactVisible } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function PATCH(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

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
