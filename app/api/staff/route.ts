import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetStaff } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { fetchAccountClaimedMap } from '@/lib/db/globalLookup'

// ─── GET /api/staff ───────────────────────────────────────────────────────────
// Query params:
//   sportId  INT (optional)
//   roleId   INT (optional, 1–6)
//   search   string
//   page     INT (default 1)
//   pageSize INT (default 50)

export async function GET(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'staff:view')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const canManage = can(session, 'staff:manage')

  const { searchParams } = new URL(req.url)

  const sportIdParam = searchParams.get('sportId')
  const sportId      = sportIdParam ? (parseInt(sportIdParam, 10) || null) : null

  const roleIdParam  = searchParams.get('roleId')
  const roleId       = roleIdParam ? (parseInt(roleIdParam, 10) || null) : null

  const page         = parseInt(searchParams.get('page')     ?? '1')
  const pageSize     = parseInt(searchParams.get('pageSize') ?? '50')
  const search       = searchParams.get('search') || undefined

  return appDbContext.run(session.appDb, async () => {
    try {
      const { staff, totalCount } = await sp_GetStaff({
        sportId,
        roleId,
        search,
        page,
        pageSize,
      })

      const accountClaimedMap = canManage
        ? await fetchAccountClaimedMap(staff.map(s => s.userId))
        : new Map<number, boolean>()

      const enriched = staff.map(s => ({
        ...s,
        ...(canManage ? { accountClaimed: accountClaimedMap.get(s.userId) ?? false } : {}),
      }))

      return NextResponse.json({ success: true, data: enriched, total: totalCount })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/staff]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load staff' }, { status: 500 })
    }
  })
}
