import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetAlumniRoster } from '@/lib/db/procedures'
import { appDbContext, getPool } from '@/lib/db/connection'

// ─── GET /api/alumni ──────────────────────────────────────────────────────────
// Query params:
//   sportId    INT (optional — omit or null = all sports)
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
  const sportId      = sportIdParam ? (parseInt(sportIdParam, 10) || null) : null

  const page        = parseInt(searchParams.get('page')     ?? '1')
  const pageSize    = parseInt(searchParams.get('pageSize') ?? '50')
  const search      = searchParams.get('search')      || undefined
  const positionIdP = searchParams.get('positionId')
  const positionId  = positionIdP ? parseInt(positionIdP, 10) : undefined
  const classYearP  = searchParams.get('classYear')
  const classYear   = classYearP  ? parseInt(classYearP, 10)  : undefined

  return appDbContext.run(session.appDb, async () => {
    try {
      const { alumni, totalCount } = await sp_GetAlumniRoster({
        sportId,
        search,
        positionId,
        classYear,
        page,
        pageSize,
      })

      // Batch-fetch account_claimed from Global DB for all returned users.
      const accountClaimedMap = new Map<number, boolean>()
      if (alumni.length > 0) {
        try {
          const globalDb = await getPool('global')
          const ids = alumni.map(a => a.userId).join(',')
          const { recordset } = await globalDb.request()
            .query(`SELECT user_id, account_claimed FROM dbo.users WHERE user_id IN (${ids})`)
          for (const row of recordset as { user_id: number; account_claimed: boolean }[]) {
            accountClaimedMap.set(row.user_id, Boolean(row.account_claimed))
          }
        } catch (err) {
          console.warn('[GET /api/alumni] Could not fetch account_claimed:', err)
        }
      }

      const enriched = alumni.map(a => ({
        ...a,
        accountClaimed: accountClaimedMap.get(a.userId) ?? false,
      }))

      return NextResponse.json({ success: true, data: enriched, total: totalCount })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/alumni]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load alumni' }, { status: 500 })
    }
  })
}
