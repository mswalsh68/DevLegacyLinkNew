import { NextResponse } from 'next/server'
import { sp_GetReleaseNotes } from '@/lib/db/procedures'

// GET /api/release-notes — public, no auth required
export async function GET() {
  try {
    const releases = await sp_GetReleaseNotes()
    return NextResponse.json({ success: true, data: releases })
  } catch (err) {
    console.error('[GET /api/release-notes]', err)
    return NextResponse.json({ success: false, error: 'Failed to load release notes.' }, { status: 500 })
  }
}
