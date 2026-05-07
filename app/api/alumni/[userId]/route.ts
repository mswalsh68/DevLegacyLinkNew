import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { sp_GetMemberDetails, sp_GetUserProfile, sp_UpsertUserContact } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/alumni/[userId] ─────────────────────────────────────────────────
// Returns the alumni profile shaped for the detail page.
// Combines sp_GetMemberDetails (app DB) + sp_GetUserProfile (global DB).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'alumni:view')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await params
  const uid = parseInt(userId, 10)

  return appDbContext.run(session.appDb, async () => {
    try {
      const [memberResult, profile] = await Promise.all([
        sp_GetMemberDetails({ userId: uid }),
        sp_GetUserProfile(uid),
      ])

      const { sportRows, interactions, errorCode } = memberResult

      if (errorCode === 'USER_NOT_FOUND' || sportRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Alumni record not found.' }, { status: 404 })
      }

      const base   = sportRows[0]
      const active = sportRows.filter(r => r.sportIsActive !== false)
      const row    = active[0] ?? base

      const data = {
        userId:              String(base.userId),
        firstName:           base.firstName,
        lastName:            base.lastName,
        email:               base.email,
        lastTeamLogin:       base.lastTeamLogin,
        // Mapped from users_sports
        graduationYear:      row.classYear     ?? null,
        graduationSemester:  null,
        position:            row.position      ?? '',
        recruitingClass:     null,
        yearsOnRoster:       row.seasonsPlayed ?? null,
        status:              row.sportIsActive !== false ? 'active' : 'inactive',
        // Contact — from global user_contact
        personalEmail:       base.email        ?? null,
        phone:               profile?.phone    ?? null,
        // Social — from global user_contact
        linkedInUrl:         profile?.linkedIn ?? null,
        twitterUrl:          profile?.twitter  ?? null,
        // Career fields — not yet in schema
        currentEmployer:     null,
        currentJobTitle:     null,
        currentCity:         null,
        currentState:        null,
        // Giving/engagement fields — not yet in schema
        isDonor:             false,
        lastDonationDate:    null,
        totalDonations:      null,
        engagementScore:     null,
        communicationConsent: false,
        notes:               null,
        // Multi-sport rows for any downstream use
        sportRows:           active,
      }

      return NextResponse.json({ success: true, data, interactions })
    } catch (err) {
      console.error('[GET /api/alumni/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to load alumni record.' }, { status: 500 })
    }
  })
}

// ─── PATCH /api/alumni/[userId] ───────────────────────────────────────────────
// Updates editable alumni fields:
//   contact (phone, linkedInUrl, twitterUrl) → sp_UpsertUserContact (global DB)
// Career, giving, and note fields are not yet in the schema and are silently ignored.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!can(session, 'alumni:edit')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await params
  const uid = parseInt(userId, 10)

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const str = (k: string): string | null =>
    typeof body[k] === 'string' ? (body[k] as string) || null : null

  try {
    const { errorCode } = await sp_UpsertUserContact({
      targetUserId: uid,
      actorId:      session.userId,
      phone:        str('phone'),
      linkedIn:     str('linkedInUrl'),
      twitter:      str('twitterUrl'),
    })

    if (errorCode) {
      return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/alumni/[userId]]', err)
    return NextResponse.json({ success: false, error: 'Failed to update alumni record.' }, { status: 500 })
  }
}
