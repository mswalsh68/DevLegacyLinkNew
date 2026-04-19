// Protected dashboard — replace with real widgets when building out the app.
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome back. Your dashboard will appear here.</p>
    </div>
  )
}
