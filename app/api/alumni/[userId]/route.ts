import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetAlumniById, sp_UpdateAlumni } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!session.appDb) return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  const { userId } = await params

  return appDbContext.run(session.appDb, async () => {
    try {
      const { alumni, interactions, errorCode } = await sp_GetAlumniById({
        userId,
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })

      if (errorCode === 'ALUMNI_NOT_FOUND' || !alumni) {
        return NextResponse.json({ success: false, error: 'Alumni record not found.' }, { status: 404 })
      }

      // Normalise id → userId
      const data = { ...alumni, userId: (alumni as Record<string, unknown>).id ?? alumni.userId }
      return NextResponse.json({ success: true, data, interactions })
    } catch (err) {
      console.error('[GET /api/alumni/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to load alumni record.' }, { status: 500 })
    }
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!session.appDb) return NextResponse.json({ success: false, error: 'App DB not configured. Please sign out and sign back in.' }, { status: 503 })

  const { userId } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const { errorCode } = await sp_UpdateAlumni({
        userId,
        updatedBy:            session.userId,
        phone:                body.phone            as string | undefined,
        personalEmail:        body.personalEmail    as string | undefined,
        linkedInUrl:          body.linkedInUrl      as string | undefined,
        twitterUrl:           body.twitterUrl       as string | undefined,
        currentEmployer:      body.currentEmployer  as string | undefined,
        currentJobTitle:      body.currentJobTitle  as string | undefined,
        currentCity:          body.currentCity      as string | undefined,
        currentState:         body.currentState     as string | undefined,
        isDonor:              body.isDonor          != null ? Boolean(body.isDonor)          : undefined,
        lastDonationDate:     body.lastDonationDate as string | undefined,
        totalDonations:       body.totalDonations   != null ? Number(body.totalDonations)   : undefined,
        engagementScore:      body.engagementScore  != null ? Number(body.engagementScore)  : undefined,
        communicationConsent: body.communicationConsent != null ? Boolean(body.communicationConsent) : undefined,
        yearsOnRoster:        body.yearsOnRoster    != null ? Number(body.yearsOnRoster)    : undefined,
        notes:                body.notes            as string | undefined,
        requestingUserId:     session.userId,
        requestingUserRole:   session.role,
      })
      if (errorCode) return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[PATCH /api/alumni/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to update alumni record.' }, { status: 500 })
    }
  })
}
