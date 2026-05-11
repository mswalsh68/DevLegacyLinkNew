import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { appDbContext } from '@/lib/db/connection'
import { sp_GetAlumniMentorDashboard } from '@/lib/db/procedures'

// ─── GET /api/mentor/alumni ── alumni's full mentoring dashboard ───────────────

export async function GET(_req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const isAlumni = session.programRoleId === 7
  const isStaff  = session.programRoleId != null && session.programRoleId >= 1 && session.programRoleId <= 6
  if (!isAlumni && !isStaff) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const rows = await sp_GetAlumniMentorDashboard({ alumniUserId: session.userId })

      const pending  = rows.filter(r => r.status === 'pending')
      const active   = rows.filter(r => r.status === 'active' && r.playerIsActive)
      const history  = rows.filter(r => r.status === 'active' && !r.playerIsActive)

      return NextResponse.json({ success: true, data: { pending, active, history } })
    } catch (err) {
      console.error('[GET /api/mentor/alumni]', err)
      return NextResponse.json({ success: false, error: 'Failed to load mentoring data.' }, { status: 500 })
    }
  })
}
