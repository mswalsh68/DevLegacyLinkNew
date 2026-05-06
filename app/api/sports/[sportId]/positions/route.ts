import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { sp_GetSportsPositions } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// GET /api/sports/[sportId]/positions
// Returns active positions for a given sport. Accessible to any authenticated user
// (not admin-only) so the Add Members wizard can populate position dropdowns.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sportId: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  const { sportId: sportIdParam } = await params
  const sportId = parseInt(sportIdParam, 10)
  if (!sportId || isNaN(sportId)) {
    return NextResponse.json({ success: false, error: 'Invalid sportId.' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const positions = await sp_GetSportsPositions({ sportId })
      return NextResponse.json({ success: true, data: positions })
    } catch (err) {
      console.error('[GET /api/sports/[sportId]/positions]', err)
      return NextResponse.json({ success: false, error: 'Failed to load positions.' }, { status: 500 })
    }
  })
}
