// Auth API route placeholder.
// POST /api/auth  — login
// DELETE /api/auth — logout
import { NextResponse } from 'next/server'

export async function POST() {
  // TODO: validate credentials → call stored procedure → set httpOnly cookie
  return NextResponse.json({ message: 'Auth endpoint ready' }, { status: 200 })
}

export async function DELETE() {
  const response = NextResponse.json({ message: 'Logged out' }, { status: 200 })
  response.cookies.delete('access_token')
  response.cookies.delete('refresh_token')
  return response
}
