import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { sp_UpdateReleaseNote, sp_DeleteReleaseNote, type ReleaseSectionInput } from '@/lib/db/procedures'

// ─── Shared auth guard ────────────────────────────────────────────────────────

async function guardSuperAdmin() {
  const { session, error } = await requireSession({ appDb: false })
  if (error) return { session: null, error }
  if (session.role !== 'super_admin') {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 }),
    }
  }
  return { session, error: null }
}

// PATCH /api/release-notes/[id] — super_admin only
// Body: { version, releaseDate, sections: ReleaseSectionInput[] }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await guardSuperAdmin()
  if (error) return error

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid id.' }, { status: 400 })
  }

  let body: { version?: string; releaseDate?: string; sections?: ReleaseSectionInput[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 })
  }

  if (!body.version?.trim() || !body.releaseDate?.trim() || !Array.isArray(body.sections)) {
    return NextResponse.json(
      { success: false, error: 'version, releaseDate, and sections are required.' },
      { status: 400 },
    )
  }

  try {
    const { errorCode } = await sp_UpdateReleaseNote({
      id,
      version:     body.version.trim(),
      releaseDate: body.releaseDate.trim(),
      sections:    body.sections,
    })
    if (errorCode === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Release not found.' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/release-notes/[id]]', err)
    return NextResponse.json({ success: false, error: 'Failed to update release.' }, { status: 500 })
  }
}

// DELETE /api/release-notes/[id] — super_admin only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await guardSuperAdmin()
  if (error) return error

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid id.' }, { status: 400 })
  }

  try {
    const { errorCode } = await sp_DeleteReleaseNote({ id })
    if (errorCode === 'NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Release not found.' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/release-notes/[id]]', err)
    return NextResponse.json({ success: false, error: 'Failed to delete release.' }, { status: 500 })
  }
}
