// GET /api/invite/[token]
// Validates an invite code and returns team + role info.
// Unauthenticated — used for the /join preview card.
// Does NOT increment use_count; that happens on request submission.
import { NextRequest, NextResponse } from 'next/server'
import { sp_ValidateInviteCode } from '@/lib/db/procedures'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

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

    return NextResponse.json({
      success: true,
      data: {
        teamName: row.teamName   as string,
        teamAbbr: row.teamAbbr   as string,
        sport:    row.sport      as string,
        role:     row.role       as string,
      },
    })
  } catch (err) {
    console.error('[GET /api/invite/[token]]', err)
    return NextResponse.json({ error: 'Failed to validate invite code.' }, { status: 500 })
  }
}
