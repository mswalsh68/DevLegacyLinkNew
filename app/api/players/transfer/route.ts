import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import { sp_TransferUserRole } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── POST /api/players/transfer ───────────────────────────────────────────────
// Body: {
//   transfers:      { userId: number; sportId: number }[]  — player × sport pairs
//   transferYear?:  number     — becomes classYear on the users_sports row
//   notes?:         string
// }
//
// For each transfer pair, flips program_role_id from 8 (player) → 7 (alumni)
// and logs to role_change_log. Runs in parallel; per-item errors are collected
// and returned as failures without aborting the whole batch.

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!(await canAsync(session, 'roster:promote_to_alumni')).allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (!session.appDb) return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  let body: {
    transfers:     { userId: number; sportId: number }[]
    transferYear?: number
    notes?:        string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { transfers, transferYear, notes } = body

  if (!Array.isArray(transfers) || transfers.length === 0) {
    return NextResponse.json({ success: false, error: 'transfers (array of { userId, sportId }) is required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const results = await Promise.allSettled(
        transfers.map((t) =>
          sp_TransferUserRole({
            userId:           t.userId,
            newProgramRoleId: 7,   // alumni
            sportId:          t.sportId,
            classYear:        transferYear ?? null,
            adminUserId:      session.userId,
            notes:            notes ?? null,
          }),
        ),
      )

      const failures: { userId: number; sportId: number; reason: string }[] = []
      let successCount = 0

      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          if (r.value.errorCode) {
            failures.push({ userId: transfers[i].userId, sportId: transfers[i].sportId, reason: r.value.errorCode })
          } else {
            successCount++
          }
        } else {
          failures.push({ userId: transfers[i].userId, sportId: transfers[i].sportId, reason: 'INTERNAL_ERROR' })
        }
      })

      return NextResponse.json({
        success: true,
        data: { transferredCount: successCount, failures },
      })
    } catch (err) {
      console.error('[POST /api/players/transfer]', err)
      return NextResponse.json({ success: false, error: 'Transfer failed' }, { status: 500 })
    }
  })
}
