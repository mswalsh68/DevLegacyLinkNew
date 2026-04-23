// /pending — authenticated waiting screen for users awaiting access approval.
// Server component: loads the initial request list from the DB.
// PendingContent polls every 60 seconds and auto-redirects on approval.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth'
import { sp_GetMyAccessRequests } from '@/lib/db/procedures'
import { PendingContent } from './PendingContent'

export const metadata: Metadata = { title: 'Awaiting Approval — LegacyLink' }

export default async function PendingPage() {
  const session = await getServerSession()
  // Auth enforced by (app) layout — session guaranteed here.

  let requests: Record<string, unknown>[] = []
  try {
    const rows = await sp_GetMyAccessRequests({ userId: session!.userId })
    requests = Array.from(rows) as Record<string, unknown>[]
  } catch {
    // Non-fatal — PendingContent will poll
  }

  // If no requests at all, send to /join
  if (requests.length === 0) {
    redirect('/join')
  }

  // If all requests are approved, send to dashboard
  const allApproved = requests.every(r => r.status === 'approved')
  if (allApproved) {
    redirect('/dashboard')
  }

  return <PendingContent initialRequests={requests} />
}
