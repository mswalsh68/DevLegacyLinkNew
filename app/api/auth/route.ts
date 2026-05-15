// DELETE /api/auth — logout (clears JWT cookies)
// Login is handled by /api/auth/login/route.ts
import { NextResponse } from 'next/server'

export async function DELETE() {
  const response = NextResponse.json({ message: 'Logged out' }, { status: 200 })
  response.cookies.delete('access_token')
  response.cookies.delete('refresh_token')
  return response
}
