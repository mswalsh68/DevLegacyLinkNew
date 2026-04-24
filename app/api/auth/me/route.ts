// GET /api/auth/me
// Returns the current user session decoded from the access_token cookie.
// Used by AuthProvider as a fallback when localStorage is empty but a
// valid cookie exists (e.g., localStorage cleared, new device, etc.).
import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ success: true, data: { user: session } })
}
