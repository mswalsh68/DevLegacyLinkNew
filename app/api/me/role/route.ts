import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetUserProgramRole } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// GET /api/me/role
// Returns the most-privileged program role for the current user in their active team.
// Used by the Add Members wizard to gate what the creator can do.
export async function GET() {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured.' }, { status: 503 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const role = await sp_GetUserProgramRole({ userId: session.userId })
      return NextResponse.json({ success: true, data: role })
    } catch (err) {
      console.error('[GET /api/me/role]', err)
      return NextResponse.json({ success: false, error: 'Failed to load role' }, { status: 500 })
    }
  })
}
