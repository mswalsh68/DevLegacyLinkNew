import { NextResponse } from 'next/server'
import { requireSession, isGlobalAdmin } from '@/lib/auth'
import { sp_GetAllSports, sp_AddSport } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/settings/sports ─────────────────────────────────────────────────
// Returns ALL sports (active + inactive) for the admin settings panel.
// Global admin only.

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return appDbContext.run(session.appDb, async () => {
    try {
      const sports = await sp_GetAllSports()
      return NextResponse.json({ success: true, data: sports })
    } catch (err) {
      console.error('[GET /api/settings/sports]', err)
      return NextResponse.json({ error: 'Failed to load sports.' }, { status: 500 })
    }
  })
}

// ─── POST /api/settings/sports ────────────────────────────────────────────────
// Adds a new sport.  Body: { name, abbr, isActive? }

export async function POST(req: Request) {
  const { session, error: authErr } = await requireSession()
  if (authErr) return authErr
  if (!isGlobalAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { name?: string; abbr?: string; isActive?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const name = body.name?.trim()
  const abbr = body.abbr?.trim().toUpperCase()

  if (!name || !abbr) {
    return NextResponse.json({ error: 'name and abbr are required.' }, { status: 422 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const result = await sp_AddSport({ name, abbr, isActive: body.isActive !== false })
      if (result.errorCode === 'DUPLICATE_ABBR') {
        return NextResponse.json({ error: 'A sport with that abbreviation already exists.' }, { status: 409 })
      }
      return NextResponse.json({ success: true, data: { id: result.newId, name, abbr, isActive: body.isActive !== false } }, { status: 201 })
    } catch (err) {
      console.error('[POST /api/settings/sports]', err)
      return NextResponse.json({ error: 'Failed to add sport.' }, { status: 500 })
    }
  })
}
