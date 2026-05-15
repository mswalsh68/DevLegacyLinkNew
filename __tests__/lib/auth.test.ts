import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import type { UserSession } from '@/types'

// Must be declared before any imports that pull in next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { cookies } from 'next/headers'
import { isGlobalAdmin, hasAppAccess, getServerSession } from '@/lib/auth'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseSession: UserSession = {
  userId:         42,
  username:       'testuser',
  email:          'test@example.com',
  roleId:         3,
  role:           'client',
  accountClaimed: true,
  apps:           ['roster', 'feed'],
  exp:            Math.floor(Date.now() / 1000) + 3600,
  iat:            Math.floor(Date.now() / 1000),
}

function makeJwt(payload: Record<string, unknown>): Promise<string> {
  const secret = new TextEncoder().encode('test-secret-key-that-is-long-enough')
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

// ─── isGlobalAdmin ────────────────────────────────────────────────────────────

describe('isGlobalAdmin', () => {
  it('returns true for roleId 1 (super_admin)', () => {
    expect(isGlobalAdmin({ ...baseSession, roleId: 1 })).toBe(true)
  })

  it('returns true for roleId 2 (support_admin)', () => {
    expect(isGlobalAdmin({ ...baseSession, roleId: 2 })).toBe(true)
  })

  it('returns true when role string is super_admin regardless of roleId', () => {
    expect(isGlobalAdmin({ ...baseSession, roleId: 3, role: 'super_admin' })).toBe(true)
  })

  it('returns true when role string is support_admin regardless of roleId', () => {
    expect(isGlobalAdmin({ ...baseSession, roleId: 3, role: 'support_admin' })).toBe(true)
  })

  it('returns false for a regular client user', () => {
    expect(isGlobalAdmin({ ...baseSession, roleId: 3, role: 'client' })).toBe(false)
  })
})

// ─── hasAppAccess ─────────────────────────────────────────────────────────────

describe('hasAppAccess', () => {
  it('returns true when app is present in session.apps', () => {
    expect(hasAppAccess({ ...baseSession, apps: ['roster', 'feed'] }, 'roster')).toBe(true)
  })

  it('returns false when app is absent from session.apps', () => {
    expect(hasAppAccess({ ...baseSession, apps: ['roster'] }, 'alumni')).toBe(false)
  })

  it('returns false when apps is undefined', () => {
    expect(hasAppAccess({ ...baseSession, apps: undefined as unknown as string[] }, 'roster')).toBe(false)
  })

  it('returns false for empty apps array', () => {
    expect(hasAppAccess({ ...baseSession, apps: [] }, 'feed')).toBe(false)
  })
})

// ─── getServerSession ─────────────────────────────────────────────────────────

describe('getServerSession', () => {
  const JWT_SECRET = 'test-secret-key-that-is-long-enough'

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.JWT_ACCESS_SECRET = JWT_SECRET
  })

  it('returns null when no access_token cookie is present', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as never)

    const session = await getServerSession()
    expect(session).toBeNull()
  })

  it('returns null when the JWT is invalid / tampered', async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'not.a.valid.jwt' }),
    } as never)

    const session = await getServerSession()
    expect(session).toBeNull()
  })

  it('returns a parsed session for a valid JWT', async () => {
    const token = await makeJwt({
      sub:            '42',
      userId:         42,
      username:       'alice',
      email:          'alice@example.com',
      roleId:         3,
      role:           'client',
      accountClaimed: true,
      apps:           ['roster'],
    })

    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token }),
    } as never)

    const session = await getServerSession()
    expect(session).not.toBeNull()
    expect(session?.userId).toBe(42)
    expect(session?.email).toBe('alice@example.com')
  })

  it('coerces string userId from sub claim when userId claim is absent (backward-compat)', async () => {
    const token = await makeJwt({
      sub:            '99',
      // userId deliberately omitted — old JWT format
      username:       'bob',
      email:          'bob@example.com',
      roleId:         3,
      role:           'client',
      accountClaimed: true,
      apps:           [],
    })

    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token }),
    } as never)

    const session = await getServerSession()
    expect(session?.userId).toBe(99)
  })

  it('coerces string userId to number (backward-compat for old string-encoded JWTs)', async () => {
    const token = await makeJwt({
      sub:            '77',
      userId:         '77',   // stored as string in old JWT
      username:       'carol',
      email:          'carol@example.com',
      roleId:         3,
      role:           'client',
      accountClaimed: true,
      apps:           [],
    })

    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token }),
    } as never)

    const session = await getServerSession()
    expect(typeof session?.userId).toBe('number')
    expect(session?.userId).toBe(77)
  })

  it('maps globalRole → role for pre-migration-018 JWTs', async () => {
    const token = await makeJwt({
      sub:            '5',
      userId:         5,
      username:       'dave',
      email:          'dave@example.com',
      roleId:         1,
      globalRole:     'super_admin',  // old field name
      // role deliberately omitted
      accountClaimed: true,
      apps:           [],
    })

    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: token }),
    } as never)

    const session = await getServerSession()
    expect(session?.role).toBe('super_admin')
  })
})
