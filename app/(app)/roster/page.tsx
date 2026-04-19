import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Roster' }

export default function RosterPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Roster</h1>
      <p className="mt-2 text-gray-600">Player roster will appear here.</p>
    </div>
  )
}
