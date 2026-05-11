import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { appDbContext, getPool } from '@/lib/db/connection'
import { sp_CancelMentorPairing } from '@/lib/db/procedures'
import { notifyAlumniMentorCancelled } from '@/app/actions/mentor'

// ─── DELETE /api/mentor/pairings/[id] ── admin cancels a pending pairing ──────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'roster:manage') && !(session.programRoleId && session.programRoleId >= 1 && session.programRoleId <= 6)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const pairingId = parseInt(id, 10)
  if (!pairingId) return NextResponse.json({ success: false, error: 'Invalid id.' }, { status: 400 })

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode, alumniUserId, playerUserId } = await sp_CancelMentorPairing({
        pairingId,
        adminUserId: session.userId,
      })

      if (errorCode === 'NOT_PENDING') {
        return NextResponse.json({ success: false, error: 'Pairing is not pending.' }, { status: 409 })
      }
      if (errorCode) {
        return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      }

      // Notify alumni that the request was withdrawn
      if (alumniUserId && playerUserId) {
        try {
          const globalDb = await getPool('global')
          const [alumniRes, playerRes] = await Promise.all([
            globalDb.request().query(`SELECT first_name, last_name, email FROM dbo.users WHERE user_id = ${alumniUserId}`),
            globalDb.request().query(`SELECT first_name, last_name FROM dbo.users WHERE user_id = ${playerUserId}`),
          ])
          const alumniRow = (alumniRes.recordset as Record<string, string>[])[0]
          const playerRow = (playerRes.recordset as Record<string, string>[])[0]

          if (alumniRow?.email && playerRow) {
            void notifyAlumniMentorCancelled({
              alumniEmail:     alumniRow.email,
              alumniFirstName: alumniRow.first_name,
              playerFirstName: playerRow.first_name,
              playerLastName:  playerRow.last_name,
              teamName:        'Your Program',
            })
          }
        } catch (emailErr) {
          console.warn('[DELETE /api/mentor/pairings/[id]] email failed', emailErr)
        }
      }

      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[DELETE /api/mentor/pairings/[id]]', err)
      return NextResponse.json({ success: false, error: 'Failed to cancel pairing.' }, { status: 500 })
    }
  })
}
