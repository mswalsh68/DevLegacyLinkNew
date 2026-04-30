import { NextResponse } from 'next/server'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_SetSportActive } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── PATCH /api/settings/sports/[id] ─────────────────────────────────────────
// Toggles is_active on a sport.  Body: { isActive: boolean }

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession()
  if (!session)                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden' },   { status: 403 })
  if (!session.appDb)          return NextResponse.json({ error: 'App DB not configured.' }, { status: 503 })

  const sportId = parseInt(params.id, 10)
  if (isNaN(sportId)) return NextResponse.json({ error: 'Invalid sport id.' }, { status: 400 })

  let body: { isActive?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive (boolean) is required.' }, { status: 422 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      await sp_SetSportActive({ sportId, isActive: body.isActive! })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[PATCH /api/settings/sports/[id]]', err)
      return NextResponse.json({ error: 'Failed to update sport.' }, { status: 500 })
    }
  })
}
