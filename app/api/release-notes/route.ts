import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { sp_GetReleaseNotes, sp_CreateReleaseNote } from '@/lib/db/procedures'

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

// POST /api/release-notes — super_admin only
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession({ appDb: false })
  if (error) return error
  if (session.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 })
  }

  let body: { version?: string; releaseDate?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 })
  }

  if (!body.version?.trim() || !body.releaseDate?.trim()) {
    return NextResponse.json({ success: false, error: 'version and releaseDate are required.' }, { status: 400 })
  }

  try {
    const { newId, errorCode } = await sp_CreateReleaseNote({
      version:     body.version.trim(),
      releaseDate: body.releaseDate.trim(),
    })
    if (errorCode === 'DUPLICATE_VERSION') {
      return NextResponse.json({ success: false, error: 'That version already exists.' }, { status: 409 })
    }
    return NextResponse.json({ success: true, data: { id: newId } }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/release-notes]', err)
    return NextResponse.json({ success: false, error: 'Failed to create release.' }, { status: 500 })
  }
}
