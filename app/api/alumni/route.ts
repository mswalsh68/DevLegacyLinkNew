import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetAlumni } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!session.appDb) {
    console.error('[GET /api/alumni] session.appDb is missing — re-login required')
    return NextResponse.json({ success: false, error: 'App DB not configured for this session. Please sign out and sign back in.' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const page     = parseInt(searchParams.get('page')     ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50')
  const search   = searchParams.get('search')   || undefined
  const position = searchParams.get('position') || undefined
  const isDonor  = searchParams.get('isDonor') === 'true' ? true : undefined
  const sportId  = searchParams.get('sportId')  || undefined

  return appDbContext.run(session.appDb, async () => {
    try {
      const { alumni, totalCount } = await sp_GetAlumni({
        search, position, isDonor, sportId,
        page, pageSize,
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })
      return NextResponse.json({ success: true, data: alumni, total: totalCount })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/alumni]', msg)
      return NextResponse.json({ success: false, error: 'Failed to load alumni' }, { status: 500 })
    }
  })
}
