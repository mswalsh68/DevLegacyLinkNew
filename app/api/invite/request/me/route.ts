// GET /api/invite/request/me
// Returns the current user's access requests. Authenticated.
// Used by /pending for status polling and routing decisions.
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { sp_GetMyAccessRequests } from '@/lib/db/procedures'

export async function GET() {
  const { session, error } = await requireSession({ appDb: false })
  if (error) return error

  try {
    const rows = await sp_GetMyAccessRequests({ userId: session.userId })
    return NextResponse.json({ success: true, data: Array.from(rows) })
  } catch (err) {
    console.error('[GET /api/invite/request/me]', err)
    return NextResponse.json({ error: 'Failed to fetch requests.' }, { status: 500 })
  }
}
