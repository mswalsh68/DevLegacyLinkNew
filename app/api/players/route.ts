import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetPlayers } from '@/lib/db/procedures'

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page         = parseInt(searchParams.get('page')        ?? '1')
  const pageSize     = parseInt(searchParams.get('pageSize')    ?? '50')
  const search       = searchParams.get('search')      || undefined
  const position     = searchParams.get('position')    || undefined
  const academicYear = searchParams.get('academicYear') || undefined
  const sportId      = searchParams.get('sportId')     || undefined

  try {
    const { players, totalCount } = await sp_GetPlayers({
      search, position, academicYear, sportId,
      page, pageSize,
      requestingUserId:   session.userId,
      requestingUserRole: session.role,
    })
    return NextResponse.json({ success: true, data: players, total: totalCount })
  } catch (err) {
    console.error('[GET /api/players]', err)
    return NextResponse.json({ success: false, error: 'Failed to load players' }, { status: 500 })
  }
}
