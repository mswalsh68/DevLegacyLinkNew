import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { guardGlobalAdmin, isResponse } from '@/app/api/_lib/auth'
import { created, badReq, serverErrFrom } from '@/app/api/_lib/response'
import { sp_GetUsers, sp_CreateUser, sp_CreateInviteToken } from '@/lib/db/procedures'

export async function GET(req: NextRequest) {
  try {
    const user = await guardGlobalAdmin()
    if (isResponse(user)) return user

    const sp = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(sp.get('pageSize') ?? '50', 10) || 50))

    const { users, totalCount } = await sp_GetUsers({
      search: sp.get('search') ?? undefined,
      globalRole: sp.get('role') ?? undefined,
      page,
      pageSize,
    })

    return NextResponse.json({ success: true, data: users, total: totalCount, page, pageSize })
  } catch (err) {
    return serverErrFrom('GET /api/users', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await guardGlobalAdmin()
    if (isResponse(user)) return user

    const body = await req.json()
    const { email, firstName, lastName, globalRole, grantAppName, grantAppRole } = body

    if (!email) return badReq('email is required')
    if (!firstName) return badReq('firstName is required')
    if (!lastName) return badReq('lastName is required')
    if (!globalRole) return badReq('globalRole is required')

    const rawPassword = crypto.randomBytes(32).toString('hex')
    const passwordHash = await bcrypt.hash(rawPassword, 12)

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

    const { newUserId, errorCode } = await sp_CreateUser({
      email: email.trim().toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      globalRole,
      createdBy: user.sub,
      grantAppName,
      grantAppRole,
    })

    if (errorCode === 'EMAIL_ALREADY_EXISTS') {
      const { users } = await sp_GetUsers({ search: email, page: 1, pageSize: 1 })
      const existingId = users?.[0]?.id
      await sp_CreateInviteToken({ userId: existingId, tokenHash, expiresAt })
      return NextResponse.json(
        { success: true, data: { id: existingId, inviteToken: rawToken }, alreadyExisted: true },
        { status: 200 }
      )
    }

    if (errorCode) return badReq(errorCode)

    await sp_CreateInviteToken({ userId: newUserId, tokenHash, expiresAt })

    return created({ id: newUserId, inviteToken: rawToken })
  } catch (err) {
    return serverErrFrom('POST /api/users', err)
  }
}
