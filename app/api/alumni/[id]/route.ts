import { NextRequest } from 'next/server'
import { guardAppAccess, isResponse } from '@/app/api/_lib/auth'
import { ok, badReq, notFound, serverErrFrom } from '@/app/api/_lib/response'
import { sp_GetAlumniById, sp_UpdateAlumni } from '@/lib/db/procedures'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppAccess('alumni')
    if (isResponse(user)) return user

    const { id } = await context.params

    const { alumni, interactions, errorCode } = await sp_GetAlumniById({
      userId: id,
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    if (errorCode || !alumni) return notFound('Alumni not found')

    return ok({ ...alumni, interactions })
  } catch (err) {
    return serverErrFrom('GET /api/alumni/[id]', err)
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await guardAppAccess('alumni')
    if (isResponse(user)) return user

    const { id } = await context.params
    const body = await req.json()

    const { errorCode } = await sp_UpdateAlumni({
      userId: id,
      updatedBy: user.sub,
      firstName: body.firstName,
      lastName: body.lastName,
      graduationYear: body.graduationYear,
      graduationSemester: body.graduationSemester,
      position: body.position,
      recruitingClass: body.recruitingClass,
      phone: body.phone,
      personalEmail: body.personalEmail,
      currentEmployer: body.currentEmployer,
      currentJobTitle: body.currentJobTitle,
      currentCity: body.currentCity,
      currentState: body.currentState,
      isDonor: body.isDonor,
      notes: body.notes,
      requestingUserId: user.sub,
      requestingUserRole: user.globalRole,
    })

    if (errorCode) return badReq(errorCode)

    return ok({ message: 'Alumni updated' })
  } catch (err) {
    return serverErrFrom('PATCH /api/alumni/[id]', err)
  }
}
