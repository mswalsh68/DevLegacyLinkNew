import { NextResponse } from 'next/server'
import { requireSession, isGlobalAdmin } from '@/lib/auth'
import { sp_GetSportsPositions, sp_AddSportsPosition } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/settings/positions?sportId=N ────────────────────────────────────
// Returns positions for a given sport (or all sports if sportId omitted).
// Global admin only.

export async function GET(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const sportIdParam = searchParams.get('sportId')
  const sportId      = sportIdParam ? (parseInt(sportIdParam, 10) || null) : null

  return appDbContext.run(session.appDb, async () => {
    try {
      const positions = await sp_GetSportsPositions({ sportId })
      return NextResponse.json({ success: true, data: positions })
    } catch (err) {
      console.error('[GET /api/settings/positions]', err)
      return NextResponse.json({ error: 'Failed to load positions.' }, { status: 500 })
    }
  })
}

// ─── POST /api/settings/positions ─────────────────────────────────────────────
// Adds a new position to a sport.  Body: { sportId, positionName, abbreviation }

export async function POST(req: Request) {
  const { session, error: authErr } = await requireSession()
  if (authErr) return authErr
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { sportId?: number; positionName?: string; abbreviation?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.sportId || !body.positionName?.trim() || !body.abbreviation?.trim()) {
    return NextResponse.json({ error: 'sportId, positionName, and abbreviation are required.' }, { status: 422 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const result = await sp_AddSportsPosition({
        sportId:      body.sportId!,
        positionName: body.positionName!.trim(),
        abbreviation: body.abbreviation!.trim().toUpperCase(),
      })
      if (result.errorCode === 'DUPLICATE_ABBR') {
        return NextResponse.json({ error: 'A position with that abbreviation already exists for this sport.' }, { status: 409 })
      }
      return NextResponse.json({ success: true, data: { positionId: result.newId } }, { status: 201 })
    } catch (err) {
      console.error('[POST /api/settings/positions]', err)
      return NextResponse.json({ error: 'Failed to add position.' }, { status: 500 })
    }
  })
}
