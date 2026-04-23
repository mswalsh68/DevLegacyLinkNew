import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetPlayerById } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!session.appDb) return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  const { userId } = await params

  return appDbContext.run(session.appDb, async () => {
    try {
      const { player, stats, errorCode } = await sp_GetPlayerById({
        userId,
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })

      if (errorCode === 'PLAYER_NOT_FOUND' || !player) {
        return NextResponse.json({ success: false, error: 'Player not found.' }, { status: 404 })
      }

      // Normalise id → userId
      const data = { ...player, userId: player.id ?? player.userId }
      return NextResponse.json({ success: true, data, stats })
    } catch (err) {
      console.error('[GET /api/players/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to load player.' }, { status: 500 })
    }
  })
}
