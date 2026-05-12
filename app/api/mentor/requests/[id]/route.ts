import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { appDbContext, getPool } from '@/lib/db/connection'
import { sp_RespondToMentorRequest } from '@/lib/db/procedures'
import { notifyPlayerMentorAccepted, notifyAdminMentorDeclined } from '@/app/actions/mentor'

// ─── PATCH /api/mentor/requests/[id] ── alumni accepts or declines ─────────────
// Body: { response: 'active' | 'declined', teamName, alumniPosition?, alumniClassYear? }

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  // Only alumni (programRoleId 7) or staff can respond
  const isAlumni = session.programRoleId === 7
  const isStaff  = session.programRoleId != null && session.programRoleId >= 1 && session.programRoleId <= 6
  if (!isAlumni && !isStaff) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const pairingId = parseInt(id, 10)
  if (!pairingId) return NextResponse.json({ success: false, error: 'Invalid id.' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return NextResponse.json({ success: false, error: 'Invalid body.' }, { status: 400 }) }

  const response = body.response as string
  if (response !== 'active' && response !== 'declined') {
    return NextResponse.json({ success: false, error: 'response must be "active" or "declined".' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode, playerUserId, adminUserId } = await sp_RespondToMentorRequest({
        pairingId,
        alumniUserId: session.userId,
        response,
      })

      if (errorCode === 'NOT_FOUND') {
        return NextResponse.json({ success: false, error: 'Pairing not found or already responded.' }, { status: 404 })
      }
      if (errorCode) {
        return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      }

      const teamName       = (body.teamName as string | undefined) ?? 'Your Program'
      const alumniPosition = (body.alumniPosition as string | null) ?? null
      const alumniClassYear = body.alumniClassYear != null ? Number(body.alumniClassYear) : null

      // Send the right email based on response
      if (playerUserId && adminUserId) {
        try {
          const globalDb = await getPool('global')
          const [playerRes, adminRes, alumniRes] = await Promise.all([
            globalDb.request().query(`SELECT first_name, last_name, email FROM dbo.users WHERE user_id = ${playerUserId}`),
            globalDb.request().query(`SELECT first_name, last_name, email FROM dbo.users WHERE user_id = ${adminUserId}`),
            globalDb.request().query(`SELECT first_name, last_name FROM dbo.users WHERE user_id = ${session.userId}`),
          ])

          const playerRow = (playerRes.recordset as Record<string, string>[])[0]
          const adminRow  = (adminRes.recordset  as Record<string, string>[])[0]
          const alumniRow = (alumniRes.recordset  as Record<string, string>[])[0]

          if (response === 'active' && playerRow?.email) {
            void notifyPlayerMentorAccepted({
              playerEmail:     playerRow.email,
              playerFirstName: playerRow.first_name,
              alumniFirstName: alumniRow?.first_name ?? 'Your Mentor',
              alumniLastName:  alumniRow?.last_name  ?? '',
              alumniPosition,
              alumniClassYear,
              teamName,
            })
          } else if (response === 'declined' && adminRow?.email) {
            void notifyAdminMentorDeclined({
              adminEmail:      adminRow.email,
              adminFirstName:  adminRow.first_name,
              alumniFirstName: alumniRow?.first_name ?? 'The alumni',
              alumniLastName:  alumniRow?.last_name  ?? '',
              playerFirstName: playerRow?.first_name ?? 'the player',
              playerLastName:  playerRow?.last_name  ?? '',
              teamName,
            })
          }
        } catch (emailErr) {
          console.warn('[PATCH /api/mentor/requests/[id]] email failed', emailErr)
        }
      }

      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[PATCH /api/mentor/requests/[id]]', err)
      return NextResponse.json({ success: false, error: 'Failed to respond to request.' }, { status: 500 })
    }
  })
}
