// GET /api/invite/[token]?e=email
// Validates an invite code and returns team + role info.
// Optional ?e= email param: looks up the pre-created user's first name for claim flows.
// Unauthenticated — used for the /join preview card.
// Does NOT increment use_count; that happens on request submission.
import { NextRequest, NextResponse } from 'next/server'
import { sp_ValidateInviteCode } from '@/lib/db/procedures'
import { getPool } from '@/lib/db/connection'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const email = req.nextUrl.searchParams.get('e') ?? undefined

  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 })
  }

  try {
    const row = await sp_ValidateInviteCode({ token })

    if (!row) {
      return NextResponse.json({ error: 'Invalid invite code.' }, { status: 404 })
    }

    const errorReason = row.errorReason as string | null

    if (errorReason) {
      const messages: Record<string, string> = {
        INACTIVE:        'This invite code has been deactivated.',
        EXPIRED:         'This invite code has expired.',
        MAX_USES_REACHED:'This invite code has reached its maximum number of uses.',
      }
      return NextResponse.json(
        { error: messages[errorReason] ?? 'This invite code is no longer valid.' },
        { status: 410 },
      )
    }

    // Optionally look up first name for claim-link flows
    let firstName: string | undefined
    if (email) {
      try {
        const pool = await getPool('global')
        const result = await pool.request()
          .input('Email', email)
          .query('SELECT TOP 1 first_name FROM dbo.users WHERE email = @Email AND is_active = 1')
        firstName = result.recordset[0]?.first_name as string | undefined
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      data: {
        teamName:  row.teamName  as string,
        teamAbbr:  row.teamAbbr  as string,
        sport:     row.sport     as string,
        role:      row.role      as string,
        firstName,
      },
    })
  } catch (err) {
    console.error('[GET /api/invite/[token]]', err)
    return NextResponse.json({ error: 'Failed to validate invite code.' }, { status: 500 })
  }
}
