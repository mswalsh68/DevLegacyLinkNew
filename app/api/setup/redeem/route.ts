// POST /api/setup/redeem
// The invite_tokens table was removed in Global DB migration 024.
// This endpoint returns 410 Gone — direct users to the invite code flow instead.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Setup links are no longer supported. Please use an invite link.' },
    { status: 410 },
  )
}
