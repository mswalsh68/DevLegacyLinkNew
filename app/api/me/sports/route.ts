import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetUserSportAssociations } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// GET /api/me/sports
// Returns the sport associations for the current user.
// Used by the new-post page to restrict alumni sport selection.
export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured.' }, { status: 503 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const sports = await sp_GetUserSportAssociations({ userId: session.userId })
      return NextResponse.json({ success: true, data: sports })
    } catch (err) {
      console.error('[GET /api/me/sports]', err)
      return NextResponse.json({ success: false, error: 'Failed to load sports' }, { status: 500 })
    }
  })
}
