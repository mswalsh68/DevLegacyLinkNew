// Protected dashboard — server component.
// Reads the session server-side and passes the role to the client DashboardContent
// so the welcome header can show the right label on first render (no flash).
import type { Metadata } from 'next'
import { getServerSession } from '@/lib/auth'
import DashboardContent from './DashboardContent'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  // Auth already enforced by the (app) layout — session is guaranteed here.
  const session = await getServerSession()

  return (
    <DashboardContent role={session?.role ?? 'user'} />
  )
}
