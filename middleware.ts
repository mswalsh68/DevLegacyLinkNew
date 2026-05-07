// Preview write guard — the single place that enforces read-only mode during
// a View As / Role Preview session. Runs on every API mutation before the route
// handler even executes.
//
// Logic:
//   • Only fires on non-GET requests to /api/*
//   • The /api/internal/preview/* routes are always allowed through so the admin
//     can start and end a session even while one is active.
//   • Decodes (does NOT verify) the access_token cookie to read previewActive.
//     Verification happens in requireSession() inside each route handler — this
//     guard only needs to read one claim, and an attacker can't do harm by
//     faking previewActive=true (it only blocks writes, not grants access).
//   • Returns 403 if previewActive=true and PREVIEW_WRITE_ENABLED !== "true".

import { decodeJwt } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  // Only intercept API mutations
  if (req.method === 'GET')                           return NextResponse.next()
  if (!pathname.startsWith('/api/'))                  return NextResponse.next()
  // Always allow preview start/end through
  if (pathname.startsWith('/api/internal/preview/'))  return NextResponse.next()

  // If writes are explicitly enabled (dev / QA), pass through
  if (process.env.PREVIEW_WRITE_ENABLED === 'true')   return NextResponse.next()

  const token = req.cookies.get('access_token')?.value
  if (!token) return NextResponse.next()

  try {
    const payload = decodeJwt(token)
    if (payload.previewActive === true) {
      return NextResponse.json(
        { success: false, error: 'Writes are disabled during a preview session.' },
        { status: 403 },
      )
    }
  } catch {
    // Malformed token — let requireSession() handle it
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
