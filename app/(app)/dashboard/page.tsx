// Protected dashboard — server component.
// Reads the session server-side and passes the role to the client DashboardContent
// so the welcome header can show the right label on first render (no flash).
//
// Post-login routing check (directive §6):
//   global_admin / platform_owner → always allowed through
//   has appPermissions             → allowed through (real access)
//   no appPermissions              → check for pending access_requests
//                                    pending  → /pending
//                                    denied / none → /join
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { sp_GetMyAccessRequests } from '@/lib/db/procedures'
import DashboardContent from './DashboardContent'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  // Auth already enforced by the (app) layout — session is guaranteed here.
  const session = await getServerSession()

  // Admins always have full access — skip request check.
  if (!isGlobalAdmin(session!)) {
    const perms = (session as unknown as Record<string, unknown>)?.appPermissions
    const hasAccess = Array.isArray(perms) && perms.length > 0

    if (!hasAccess) {
      try {
        const rows = await sp_GetMyAccessRequests({ userId: session!.userId })
        const requests = Array.from(rows) as Record<string, unknown>[]
        if (requests.some(r => r.status === 'pending')) {
          redirect('/pending')
        }
      } catch { /* non-fatal — fall through to dashboard */ }

      // No pending requests and no access → send to join
      redirect('/join')
    }
  }

  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
