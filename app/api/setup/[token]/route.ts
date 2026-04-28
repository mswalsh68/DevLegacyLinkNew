// GET /api/setup/[token]
// The invite_tokens table was removed in Global DB migration 024.
// This endpoint returns 410 Gone — direct users to the invite code flow instead.
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  _ctx: { params: Promise<{ token: string }> },
) {
  return NextResponse.json(
    { error: 'Setup links are no longer supported. Please use an invite link.' },
    { status: 410 },
  )
}
