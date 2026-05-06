import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import { sp_TransferUserRole, sp_TransferPlayerToAlumni } from '@/lib/db/procedures'
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
  const { session, error } = await requireSession()
  if (error) return error

  if (!(await canAsync(session, 'roster:promote_to_alumni')).allowed) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

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
      const promotedUserIds = new Set<number>()

      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          if (r.value.errorCode) {
            failures.push({ userId: transfers[i].userId, sportId: transfers[i].sportId, reason: r.value.errorCode })
          } else {
            successCount++
            promotedUserIds.add(transfers[i].userId)
          }
        } else {
          failures.push({ userId: transfers[i].userId, sportId: transfers[i].sportId, reason: 'INTERNAL_ERROR' })
        }
      })

      // Update Global DB app permissions: swap roster → alumni for each promoted user.
      // Best-effort — App DB transfer already succeeded; don't fail the response over this.
      await Promise.allSettled(
        [...promotedUserIds].map((userId) =>
          sp_TransferPlayerToAlumni({ userId, grantedBy: session.userId }),
        ),
      )

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
