import { NextResponse } from 'next/server'
import { requireSession, isGlobalAdmin, signPreviewToken } from '@/lib/auth'
import { sp_StartPreviewSession, sp_GetTeams } from '@/lib/db/procedures'

// programRoleId → apps mapping (mirrors the login route logic)
function appsForRole(programRoleId: number): string[] {
  if (programRoleId === 7) return ['alumni']
  if (programRoleId === 8) return ['roster']
  return ['roster', 'alumni']
}

export async function POST(req: Request) {
  const { session, error } = await requireSession({ appDb: false })
  if (error) return error

  if (!isGlobalAdmin(session)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { teamId, programRoleId } = body as Record<string, unknown>

  if (typeof teamId !== 'number' || typeof programRoleId !== 'number') {
    return NextResponse.json(
      { success: false, error: 'teamId and programRoleId are required numbers.' },
      { status: 422 },
    )
  }

  if (programRoleId < 1 || programRoleId > 8) {
    return NextResponse.json(
      { success: false, error: 'programRoleId must be between 1 and 8.' },
      { status: 422 },
    )
  }

  // Fetch the team to get its appDb, tier, level, and name
  const teams = await sp_GetTeams()
  const team  = (teams as unknown as Array<Record<string, unknown>>).find(t => t.id === teamId)

  if (!team) {
    return NextResponse.json({ success: false, error: 'Team not found.' }, { status: 404 })
  }

  const teamName   = team.name    as string
  const teamAppDb  = team.appDb   as string
  const teamTierId  = team.tierId  as number
  const teamLevelId = team.levelId as number

  if (!teamAppDb) {
    return NextResponse.json(
      { success: false, error: 'Team has no App DB configured.' },
      { status: 422 },
    )
  }

  // Log the session start
  const { sessionId } = await sp_StartPreviewSession({
    actorId:       session.userId,
    actorEmail:    session.email,
    teamId,
    teamName,
    programRoleId,
  })

  const token = await signPreviewToken({
    session,
    previewProgramRoleId: programRoleId,
    previewTeamId:        teamId,
    previewTeamName:      teamName,
    previewAppDb:         teamAppDb,
    previewTierId:        teamTierId,
    previewLevelId:       teamLevelId,
    previewSessionId:     sessionId,
    previewApps:          appsForRole(programRoleId),
  })

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
