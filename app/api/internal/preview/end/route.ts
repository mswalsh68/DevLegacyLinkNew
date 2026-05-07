import { NextResponse } from 'next/server'
import { requireSession, isGlobalAdmin, signExitPreviewToken } from '@/lib/auth'
import { sp_EndPreviewSession } from '@/lib/db/procedures'

export async function POST() {
  // appDb is not required — admin may not have a real team context during preview
  const { session, error } = await requireSession({ appDb: false })
  if (error) return error

  if (!isGlobalAdmin(session)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  // Stamp the audit log even if previewActive is somehow not set
  if (session.previewSessionId) {
    await sp_EndPreviewSession({ sessionId: session.previewSessionId })
  }

  const token  = await signExitPreviewToken(session)
  const isProd = process.env.NODE_ENV === 'production'

  const response = NextResponse.json({ success: true })

  response.cookies.set('access_token', token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    path:     '/',
    maxAge:   15 * 60,
  })

  return response
}
