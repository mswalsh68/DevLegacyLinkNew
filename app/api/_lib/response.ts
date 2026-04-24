/**
 * Typed response helpers for Route Handlers.
 * Keeps status codes and envelope shape consistent across all routes.
 */
import { NextResponse } from 'next/server'

export const ok = (data: unknown, extra?: Record<string, unknown>) =>
  NextResponse.json({ success: true, data, ...extra })

export const created = (data: unknown) =>
  NextResponse.json({ success: true, data }, { status: 201 })

export const accepted = () =>
  NextResponse.json({ success: true }, { status: 202 })

export const badReq = (error: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ success: false, error, ...extra }, { status: 400 })

export const unauth = (error = 'Authentication required') =>
  NextResponse.json({ success: false, error }, { status: 401 })

export const forbidden = (error = 'Forbidden') =>
  NextResponse.json({ success: false, error }, { status: 403 })

export const notFound = (error = 'Not found') =>
  NextResponse.json({ success: false, error }, { status: 404 })

export const serverErr = (error = 'Internal server error') =>
  NextResponse.json({ success: false, error }, { status: 500 })

/** Log + return 500. */
export function serverErrFrom(label: string, err: unknown) {
  console.error(`[${label}]`, err)
  return serverErr()
}
