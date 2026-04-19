// Protected app layout — all routes inside (app) require authentication.
// Auth check happens here (server-side redirect or middleware).
// Sidebar / top nav shared across all app pages goes here.
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth'

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
    <div className="flex min-h-screen">
      {/* AppSidebar will go here */}
      <div className="flex flex-1 flex-col">
        {/* AppHeader will go here */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
