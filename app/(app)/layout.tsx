// Protected app layout — wraps all (app) routes.
// Server-side auth check: unauthenticated users are redirected to /login.
// Renders the dark app shell: sidebar + sticky header + scrollable main area.
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth'
import { AppSidebar } from '@/components/app/AppSidebar'
import { AppHeader } from '@/components/app/AppHeader'

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
    // Full-viewport dark shell
    <div className="flex min-h-screen bg-[#0D0D0D]">
      {/* Fixed-width sidebar */}
      <AppSidebar />

      {/* Content column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Sticky top header */}
        <AppHeader />

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
