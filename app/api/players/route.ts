import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetRoster } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/players ─────────────────────────────────────────────────────────
// Query params:
//   sportId    INT (required — Football = 1)
//   search     string
//   positionId INT
//   classYear  INT
//   page       INT (default 1)
//   pageSize   INT (default 50)

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)

  const sportIdParam = searchParams.get('sportId')
  const sportId      = sportIdParam ? parseInt(sportIdParam, 10) : NaN

  if (isNaN(sportId)) {
    return NextResponse.json({ success: false, error: 'sportId (INT) is required' }, { status: 400 })
  }

  const page         = parseInt(searchParams.get('page')     ?? '1')
  const pageSize     = parseInt(searchParams.get('pageSize') ?? '50')
  const search       = searchParams.get('search')      || undefined
  const positionIdP  = searchParams.get('positionId')
  const positionId   = positionIdP ? parseInt(positionIdP, 10) : undefined
  const classYearP   = searchParams.get('classYear')
  const classYear    = classYearP  ? parseInt(classYearP, 10)  : undefined

  return appDbContext.run(session.appDb, async () => {
    try {
      const { roster, totalCount } = await sp_GetRoster({
        sportId,
        search,
        positionId,
        classYear,
        page,
        pageSize,
      })
      return NextResponse.json({ success: true, data: roster, total: totalCount })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/players]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load roster' }, { status: 500 })
    }
  })
}
