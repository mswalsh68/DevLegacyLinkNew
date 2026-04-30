import { NextResponse } from 'next/server'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_TransferUserRole } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── POST /api/players/transfer ───────────────────────────────────────────────
// Body: {
//   userRoleIds:      number[]   — users_roles.user_role_id values to transfer
//   transferYear?:    number     — becomes classYear on the role record
//   transferSemester?: string
//   notes?:           string
// }
//
// For each userRoleId, flips status current_player → alumni and logs to
// role_transfer_log. Runs in parallel; per-item errors are collected and
// returned as failures without aborting the whole batch.

export async function POST(req: Request) {
  const session = await getServerSession()
  if (!session)                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!isGlobalAdmin(session)) return NextResponse.json({ success: false, error: 'Forbidden'    }, { status: 403 })
  if (!session.appDb)          return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  let body: {
    userRoleIds:       number[]
    transferYear?:     number
    transferSemester?: string
    notes?:            string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userRoleIds, transferYear, transferSemester, notes } = body

  if (!Array.isArray(userRoleIds) || userRoleIds.length === 0) {
    return NextResponse.json({ success: false, error: 'userRoleIds (array) is required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const results = await Promise.allSettled(
        userRoleIds.map((userRoleId) =>
          sp_TransferUserRole({
            userRoleId,
            newStatus:    'alumni',
            classYear:    transferYear    ?? null,
            adminUserId:  session.userId,
            adminAcknowledged: true,
            notes:        notes ?? null,
          }),
        ),
      )

      const failures: { userRoleId: number; reason: string }[] = []
      let successCount = 0

      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          if (r.value.errorCode) {
            failures.push({ userRoleId: userRoleIds[i], reason: r.value.errorCode })
          } else {
            successCount++
          }
        } else {
          failures.push({ userRoleId: userRoleIds[i], reason: 'INTERNAL_ERROR' })
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
