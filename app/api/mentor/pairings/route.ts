import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { appDbContext, getPool } from '@/lib/db/connection'
import { sp_CreateMentorPairing, sp_GetMentorPairings } from '@/lib/db/procedures'
import { notifyAlumniMentorRequest } from '@/app/actions/mentor'

// ─── GET /api/mentor/pairings ── admin status board ───────────────────────────

export async function GET(_req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'roster:manage') && !(session.programRoleId && session.programRoleId >= 1 && session.programRoleId <= 6)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const pairings = await sp_GetMentorPairings()
      return NextResponse.json({ success: true, data: pairings })
    } catch (err) {
      console.error('[GET /api/mentor/pairings]', err)
      return NextResponse.json({ success: false, error: 'Failed to load pairings.' }, { status: 500 })
    }
  })
}

// ─── POST /api/mentor/pairings ── admin creates pairing ───────────────────────
// Body: { playerUserId, alumniUserId, sportId?, playerPosition?, playerClassYear?,
//         alumniEmail, alumniFirstName, playerFirstName, playerLastName,
//         teamName, coachName }

export async function POST(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'roster:manage') && !(session.programRoleId && session.programRoleId >= 1 && session.programRoleId <= 6)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return NextResponse.json({ success: false, error: 'Invalid body.' }, { status: 400 }) }

  const playerUserId = body.playerUserId != null ? Number(body.playerUserId) : null
  const alumniUserId = body.alumniUserId != null ? Number(body.alumniUserId) : null
  const sportId      = body.sportId      != null ? Number(body.sportId)      : null

  if (!playerUserId || !alumniUserId) {
    return NextResponse.json({ success: false, error: 'playerUserId and alumniUserId are required.' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode, pairingId } = await sp_CreateMentorPairing({
        playerUserId,
        alumniUserId,
        sportId,
        adminUserId: session.userId,
      })

      if (errorCode) {
        const messages: Record<string, string> = {
          ALREADY_EXISTS:       'A pending or active pairing already exists for this pair.',
          MAX_DECLINES_REACHED: 'This alumni has declined twice for this player. No further attempts allowed.',
          COOLDOWN_ACTIVE:      'Please wait 24 hours before re-pairing this combination.',
        }
        return NextResponse.json({ success: false, error: messages[errorCode] ?? errorCode }, { status: 409 })
      }

      // Send notification email to alumni — body contains display info from the wizard
      try {
        const alumniEmail     = body.alumniEmail     as string | undefined
        const alumniFirstName = body.alumniFirstName as string | undefined
        const playerFirstName = body.playerFirstName as string | undefined
        const playerLastName  = body.playerLastName  as string | undefined
        const teamName        = body.teamName        as string | undefined
        const coachName       = body.coachName       as string | undefined

        if (alumniEmail && alumniFirstName && playerFirstName && playerLastName) {
          void notifyAlumniMentorRequest({
            alumniEmail,
            alumniFirstName,
            playerFirstName,
            playerLastName,
            playerPosition:  (body.playerPosition  as string | null) ?? null,
            playerClassYear: body.playerClassYear != null ? Number(body.playerClassYear) : null,
            teamName:  teamName  ?? 'Your Program',
            coachName: coachName ?? 'Your Coach',
          })
        }
      } catch (emailErr) {
        console.warn('[POST /api/mentor/pairings] email send failed', emailErr)
      }

      return NextResponse.json({ success: true, pairingId })
    } catch (err) {
      console.error('[POST /api/mentor/pairings]', err)
      return NextResponse.json({ success: false, error: 'Failed to create pairing.' }, { status: 500 })
    }
  })
}
