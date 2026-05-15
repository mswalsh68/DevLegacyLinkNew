import { NextRequest, NextResponse } from 'next/server'
import { sp_ProcessUnsubscribe } from '@/lib/db/procedures'

// Public endpoint — no auth required.
// GET /api/unsubscribe?token=<uuid>
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ success: false, error: 'MISSING_TOKEN' }, { status: 400 })
  }

  try {
    const { firstName, errorCode } = await sp_ProcessUnsubscribe({ token })

    if (errorCode === 'INVALID_TOKEN') {
      return NextResponse.json({ success: false, error: 'INVALID_TOKEN' }, { status: 404 })
    }

    return NextResponse.json({ success: true, firstName })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[unsubscribe] error:', msg)
    return NextResponse.json({ success: false, error: 'SERVER_ERROR', detail: msg }, { status: 500 })
  }
}
