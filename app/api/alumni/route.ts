import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetAlumniRoster } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { fetchAccountClaimedMap } from '@/lib/db/globalLookup'

// ─── GET /api/alumni ──────────────────────────────────────────────────────────
// Query params:
//   sportId    INT (optional — omit or null = all sports)
//   search     string
//   positionId INT
//   classYear  INT
//   page       INT (default 1)
//   pageSize   INT (default 50)

export async function GET(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'alumni:view')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const canManage = can(session, 'alumni:edit')

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
        requestingUserId: session.role === 'client' ? session.userId : null,
        search,
        positionId,
        classYear,
        page,
        pageSize,
      })

      const accountClaimedMap = canManage
        ? await fetchAccountClaimedMap(alumni.map(a => Number(a.userId)))
        : new Map<number, boolean>()

      const enriched = alumni.map(a => ({
        ...a,
        ...(canManage ? { accountClaimed: accountClaimedMap.get(Number(a.userId)) ?? false } : {}),
      }))

      return NextResponse.json({ success: true, data: enriched, total: totalCount })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/alumni]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load alumni' }, { status: 500 })
    }
  })
}
