import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetAlumniById } from '@/lib/db/procedures'
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
      const { alumni, interactions, errorCode } = await sp_GetAlumniById({
        userId,
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })

      if (errorCode === 'ALUMNI_NOT_FOUND' || !alumni) {
        return NextResponse.json({ success: false, error: 'Alumni record not found.' }, { status: 404 })
      }

      // Normalise id → userId
      const data = { ...alumni, userId: (alumni as Record<string, unknown>).id ?? alumni.userId }
      return NextResponse.json({ success: true, data, interactions })
    } catch (err) {
      console.error('[GET /api/alumni/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to load alumni record.' }, { status: 500 })
    }
  })
}
