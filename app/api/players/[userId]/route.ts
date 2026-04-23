import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sp_GetPlayerById, sp_UpdatePlayer } from '@/lib/db/procedures'
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
      const { player, stats, errorCode } = await sp_GetPlayerById({
        userId,
        requestingUserId:   session.userId,
        requestingUserRole: session.role,
      })

      if (errorCode === 'PLAYER_NOT_FOUND' || !player) {
        return NextResponse.json({ success: false, error: 'Player not found.' }, { status: 404 })
      }

      // Normalise id → userId
      const data = { ...player, userId: player.id ?? player.userId }
      return NextResponse.json({ success: true, data, stats })
    } catch (err) {
      console.error('[GET /api/players/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to load player.' }, { status: 500 })
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
      const { errorCode } = await sp_UpdatePlayer({
        userId,
        updatedBy:             session.userId,
        jerseyNumber:          body.jerseyNumber  != null ? Number(body.jerseyNumber)  : undefined,
        position:              body.position      as string | undefined,
        academicYear:          body.academicYear  as string | undefined,
        heightInches:          body.heightInches  != null ? Number(body.heightInches)  : undefined,
        weightLbs:             body.weightLbs     != null ? Number(body.weightLbs)     : undefined,
        major:                 body.major         as string | undefined,
        phone:                 body.phone         as string | undefined,
        email:                 body.email         as string | undefined,
        instagram:             body.instagram     as string | undefined,
        twitter:               body.twitter       as string | undefined,
        snapchat:              body.snapchat      as string | undefined,
        emergencyContactName:  body.emergencyContactName  as string | undefined,
        emergencyContactPhone: body.emergencyContactPhone as string | undefined,
        parent1Name:           body.parent1Name   as string | undefined,
        parent1Phone:          body.parent1Phone  as string | undefined,
        parent1Email:          body.parent1Email  as string | undefined,
        parent2Name:           body.parent2Name   as string | undefined,
        parent2Phone:          body.parent2Phone  as string | undefined,
        parent2Email:          body.parent2Email  as string | undefined,
        notes:                 body.notes         as string | undefined,
        requestingUserId:      session.userId,
        requestingUserRole:    session.role,
      })
      if (errorCode) return NextResponse.json({ success: false, error: errorCode }, { status: 400 })
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[PATCH /api/players/[userId]]', err)
      return NextResponse.json({ success: false, error: 'Failed to update player.' }, { status: 500 })
    }
  })
}
