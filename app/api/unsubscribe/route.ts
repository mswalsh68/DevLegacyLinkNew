import { NextRequest, NextResponse } from 'next/server'
import { getAllAppDbs, appDbContext } from '@/lib/db/connection'
import { sp_ProcessUnsubscribe } from '@/lib/db/procedures'

// Public endpoint — no auth required.
// GET /api/unsubscribe?token=<uuid>
//
// Unsubscribe tokens live in the per-tenant App DB (outreach_messages).
// Since this is a public route with no session, we don't know which tenant
// owns the token. We iterate through all app DBs (via getAllAppDbs) and stop
// at the first match — correct for both single and multi-tenant setups.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ success: false, error: 'MISSING_TOKEN' }, { status: 400 })
  }

  try {
    const appDbs = await getAllAppDbs()

    for (const dbName of appDbs) {
      const { firstName, errorCode } = await appDbContext.run(dbName, () =>
        sp_ProcessUnsubscribe({ token }),
      )

      if (errorCode !== 'INVALID_TOKEN') {
        // Found and processed (errorCode is null = success)
        return NextResponse.json({ success: true, firstName })
      }
    }

    // Token not found in any tenant DB
    return NextResponse.json({ success: false, error: 'INVALID_TOKEN' }, { status: 404 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[unsubscribe] error:', msg)
    return NextResponse.json({ success: false, error: 'SERVER_ERROR' }, { status: 500 })
  }
}
