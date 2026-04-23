import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetAlumni } from '@/lib/db/procedures'

export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page     = parseInt(searchParams.get('page')     ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50')
  const search   = searchParams.get('search')   || undefined
  const position = searchParams.get('position') || undefined
  const isDonor  = searchParams.get('isDonor') === 'true' ? true : undefined
  const sportId  = searchParams.get('sportId')  || undefined

  try {
    const { alumni, totalCount } = await sp_GetAlumni({
      search, position, isDonor, sportId,
      page, pageSize,
      requestingUserId:   session.userId,
      requestingUserRole: session.role,
    })
    return NextResponse.json({ success: true, data: alumni, total: totalCount })
  } catch (err) {
    console.error('[GET /api/alumni]', err)
    return NextResponse.json({ success: false, error: 'Failed to load alumni' }, { status: 500 })
  }
}
