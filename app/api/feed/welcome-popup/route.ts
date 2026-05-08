import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { sp_GetPendingWelcomePopup, sp_MarkWelcomePopupShown } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// ─── GET /api/feed/welcome-popup ──────────────────────────────────────────────
// Returns pending welcome popup for the current alumni user.
// Returns { pending: false } when none — never hard-errors, best-effort.

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error

  const viewerTierId = session.tierId ?? null

  return appDbContext.run(session.appDb, async () => {
    try {
      const popup = await sp_GetPendingWelcomePopup({
        userId:       session.userId,
        viewerTierId,
      })
      if (!popup) return NextResponse.json({ success: true, data: { pending: false } })
      return NextResponse.json({
        success: true,
        data: {
          pending:             true,
          logId:               popup.logId,
          postId:              popup.postId,
          title:               popup.title,
          bodyHtml:            popup.bodyHtml,
          imageUrl:            popup.imageUrl,
          targetTierId:        popup.targetTierId,
          targetProgramRoleId: popup.targetProgramRoleId,
        },
      })
    } catch (err) {
      console.error('[GET /api/feed/welcome-popup]', err)
      return NextResponse.json({ success: true, data: { pending: false } })
    }
  })
}

// ─── POST /api/feed/welcome-popup ─────────────────────────────────────────────
// Body: { logId: number }
// Marks popup_shown = 1 on the specified role_change_log row.

export async function POST(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  let body: { logId: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.logId || typeof body.logId !== 'number') {
    return NextResponse.json({ success: false, error: 'logId (number) is required' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode } = await sp_MarkWelcomePopupShown({
        logId:  body.logId,
        userId: session.userId,
      })
      if (errorCode && errorCode !== 'NOT_FOUND_OR_ALREADY_SHOWN') {
        return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[POST /api/feed/welcome-popup]', err)
      return NextResponse.json({ success: false, error: 'Dismiss failed' }, { status: 500 })
    }
  })
}
