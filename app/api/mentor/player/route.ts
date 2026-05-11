import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { appDbContext, getPool } from '@/lib/db/connection'
import { sp_GetPlayerMentors } from '@/lib/db/procedures'

// ─── GET /api/mentor/player ── player's active mentor(s) ──────────────────────

export async function GET(_req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  // Only players (role 8) and staff (1-6) may call this
  const isPlayer = session.programRoleId === 8
  const isStaff  = session.programRoleId != null && session.programRoleId >= 1 && session.programRoleId <= 6
  if (!isPlayer && !isStaff) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const mentors = await sp_GetPlayerMentors({ playerUserId: session.userId })

      // Enrich with contact info from Global DB
      const alumniUserIds = [...new Set(mentors.map(m => m.alumniUserId))]
      const contactMap = new Map<number, { phone: string | null; email: string }>()

      if (alumniUserIds.length > 0) {
        const globalDb  = await getPool('global')
        const ids = alumniUserIds.join(',')
        const res = await globalDb.request()
          .query(`
            SELECT u.user_id, u.email, uc.phone
            FROM dbo.users u
            LEFT JOIN dbo.user_contact uc ON uc.user_id = u.user_id
            WHERE u.user_id IN (${ids})
          `)
        for (const row of res.recordset as Record<string, unknown>[]) {
          contactMap.set(Number(row.user_id), {
            email: row.email as string,
            phone: (row.phone as string | null) ?? null,
          })
        }
      }

      const enriched = mentors.map(m => ({
        ...m,
        alumniEmail: contactMap.get(m.alumniUserId)?.email ?? null,
        alumniPhone: contactMap.get(m.alumniUserId)?.phone ?? null,
      }))

      return NextResponse.json({ success: true, data: enriched })
    } catch (err) {
      console.error('[GET /api/mentor/player]', err)
      return NextResponse.json({ success: false, error: 'Failed to load mentors.' }, { status: 500 })
    }
  })
}
