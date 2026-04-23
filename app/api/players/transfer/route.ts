import { NextResponse } from 'next/server'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_GraduatePlayer } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session)                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!isGlobalAdmin(session)) return NextResponse.json({ success: false, error: 'Forbidden'    }, { status: 403 })
  if (!session.appDb)          return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  const { playerIds, transferYear, transferSemester } = await req.json() as {
    playerIds:        string[]
    transferYear:     number
    transferSemester: string
  }

  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return NextResponse.json({ success: false, error: 'playerIds required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const result = await sp_GraduatePlayer({
        playerIds,
        graduationYear: transferYear,
        semester:       transferSemester ?? 'spring',
        triggeredBy:    session.userId,
      })

      const failures = JSON.parse(result.failureJson || '[]') as { reason: string }[]

      return NextResponse.json({
        success: true,
        data: { transferredCount: result.successCount, failures },
      })
    } catch (err) {
      console.error('[POST /api/players/transfer]', err)
      return NextResponse.json({ success: false, error: 'Transfer failed' }, { status: 500 })
    }
  })
}
