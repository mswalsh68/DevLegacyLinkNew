import { NextResponse } from 'next/server'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_UpdateSportsPosition, sp_DeleteSportsPosition } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── PATCH /api/settings/positions/[id] ──────────────────────────────────────
// Updates a position.  Body: { positionName?, abbreviation?, isActive? }

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session)                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden' },   { status: 403 })
  if (!session.appDb)          return NextResponse.json({ error: 'App DB not configured.' }, { status: 503 })

  const { id } = await params
  const positionId = parseInt(id, 10)
  if (isNaN(positionId)) return NextResponse.json({ error: 'Invalid position id.' }, { status: 400 })

  let body: { positionName?: string; abbreviation?: string; isActive?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      await sp_UpdateSportsPosition({
        positionId,
        positionName: body.positionName?.trim() ?? null,
        abbreviation: body.abbreviation?.trim().toUpperCase() ?? null,
        isActive:     body.isActive ?? null,
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[PATCH /api/settings/positions/[id]]', err)
      return NextResponse.json({ error: 'Failed to update position.' }, { status: 500 })
    }
  })
}

// ─── DELETE /api/settings/positions/[id] ─────────────────────────────────────
// Hard-deletes a position.

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession()
  if (!session)                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden' },   { status: 403 })
  if (!session.appDb)          return NextResponse.json({ error: 'App DB not configured.' }, { status: 503 })

  const { id } = await params
  const positionId = parseInt(id, 10)
  if (isNaN(positionId)) return NextResponse.json({ error: 'Invalid position id.' }, { status: 400 })

  return appDbContext.run(session.appDb, async () => {
    try {
      await sp_DeleteSportsPosition({ positionId })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[DELETE /api/settings/positions/[id]]', err)
      return NextResponse.json({ error: 'Failed to delete position.' }, { status: 500 })
    }
  })
}
