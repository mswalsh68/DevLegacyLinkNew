// Protected app layout — wraps all (app) routes.
// Server-side auth check: unauthenticated users are redirected to /login.
// Renders the original design: sticky top nav (team primary color) + light page background.
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth'
import { AppNav } from '@/components/app/AppNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-page-bg)' }}>
      {/* Sticky top nav — background is var(--color-primary), updates on team switch */}
      <AppNav />

      {/* Page content — centered, max 1200px, matches original padding */}
      <div
        style={{
          maxWidth: 1200,
          margin:   '0 auto',
          padding:  '32px 24px',
        }}
      >
        {children}
      </div>
    </div>
  )
}
