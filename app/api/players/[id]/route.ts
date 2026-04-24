import { NextRequest } from 'next/server'
import { guardAppAccess, isResponse } from '@/app/api/_lib/auth'
import { ok, badReq, notFound, serverErrFrom } from '@/app/api/_lib/response'
import { sp_GetPlayerById, sp_UpdatePlayer } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppAccess('roster')
    if (isResponse(user)) return user

    const { id } = await context.params

    const { player, stats, errorCode } = await sp_GetPlayerById({
      userId: id,
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    if (errorCode || !player) return notFound('Player not found')

    return ok({ ...player, stats })
  } catch (err) {
    return serverErrFrom('GET /api/players/[id]', err)
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppAccess('roster')
    if (isResponse(user)) return user

    const { id } = await context.params
    const body = await req.json()

    const { errorCode } = await sp_UpdatePlayer({
      userId: id,
      updatedBy: user.sub,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      position: body.position,
      academicYear: body.academicYear,
      recruitingClass: body.recruitingClass,
      jerseyNumber: body.jerseyNumber,
      heightInches: body.heightInches,
      weightLbs: body.weightLbs,
      homeTown: body.homeTown,
      homeState: body.homeState,
      highSchool: body.highSchool,
      major: body.major,
      phone: body.phone,
      emergencyContactName: body.emergencyContactName,
      emergencyContactPhone: body.emergencyContactPhone,
      parent1Name: body.parent1Name,
      parent1Phone: body.parent1Phone,
      parent1Email: body.parent1Email,
      parent2Name: body.parent2Name,
      parent2Phone: body.parent2Phone,
      parent2Email: body.parent2Email,
      notes: body.notes,
      status: body.status,
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    if (errorCode) return badReq(errorCode)

    return ok({ message: 'Player updated' })
  } catch (err) {
    return serverErrFrom('PATCH /api/players/[id]', err)
  }
}
