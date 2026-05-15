import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { appDbContext } from '@/lib/db/connection'
import { sp_GetEmailSubscription, sp_ResubscribeEmail } from '@/lib/db/procedures'

// GET /api/profile/email-subscription — returns current subscription status
export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error

  return appDbContext.run(session.appDb, async () => {
    try {
      const { isUnsubscribed } = await sp_GetEmailSubscription({ userId: session.userId })
      return NextResponse.json({ success: true, isUnsubscribed })
    } catch (err) {
      console.error('[GET /api/profile/email-subscription]', err)
      return NextResponse.json({ success: false, error: 'Failed to load subscription status.' }, { status: 500 })
    }
  })
}

// DELETE /api/profile/email-subscription — re-subscribe (remove from unsubscribes)
export async function DELETE() {
  const { session, error } = await requireSession()
  if (error) return error

  return appDbContext.run(session.appDb, async () => {
    try {
      await sp_ResubscribeEmail({ userId: session.userId })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[DELETE /api/profile/email-subscription]', err)
      return NextResponse.json({ success: false, error: 'Failed to re-subscribe.' }, { status: 500 })
    }
  })
}
