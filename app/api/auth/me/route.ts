// GET /api/auth/me
// Returns the current user session decoded from the access_token cookie.
// Used by AuthProvider as a fallback when localStorage is empty but a
// valid cookie exists (e.g., localStorage cleared, new device, etc.).
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'

export async function GET() {
  const { session, error } = await requireSession({ appDb: false })
  if (error) return error

  return NextResponse.json({ success: true, data: { user: session } })
}
