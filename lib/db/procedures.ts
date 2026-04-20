// ─── Central Stored Procedure Registry ───────────────────────────────────────
// ALL database calls go through this file. Never import mssql or getPool
// directly in route handlers — call a typed function from here instead.

import sql from 'mssql'
import { dbRequest, type DbKey } from './connection'

// ─── Internal helper ──────────────────────────────────────────────────────────

async function exec<T = sql.IRecordSet<Record<string, unknown>>>(
  db: DbKey,
  procedure: string,
  params: (req: sql.Request) => void = () => {},
): Promise<T> {
  const request = await dbRequest(db)
  params(request)
  const result = await request.execute(procedure)
  return result.recordset as T
}

// ─── Auth / Users (global DB) ─────────────────────────────────────────────────

export async function sp_GetUserById(userId: number) {
  return exec('global', 'sp_GetUserById', (r) => {
    r.input('UserId', sql.Int, userId)
  })
}

export async function sp_GetTeamConfig() {
  return exec('global', 'sp_GetTeamConfig')
}

export async function sp_UpdateTeamConfig(config: Record<string, unknown>) {
  return exec('global', 'sp_UpdateTeamConfig', (r) => {
    r.input('ConfigJson', sql.NVarChar(sql.MAX), JSON.stringify(config))
  })
}

// ─── Roster (roster DB) ───────────────────────────────────────────────────────

export async function sp_GetPlayers() {
  return exec('roster', 'sp_GetPlayers')
}

export async function sp_GetPlayerById(playerId: number) {
  return exec('roster', 'sp_GetPlayerById', (r) => {
    r.input('PlayerId', sql.Int, playerId)
  })
}

export async function sp_CreatePlayer(player: Record<string, unknown>) {
  return exec('roster', 'sp_CreatePlayer', (r) => {
    r.input('PlayerJson', sql.NVarChar(sql.MAX), JSON.stringify(player))
  })
}

export async function sp_TransferToAlumni(
  playerIds: number[],
  transferReason: string,
  transferYear: number,
  transferSemester: string,
) {
  return exec('roster', 'sp_TransferToAlumni', (r) => {
    r.input('PlayerIds',        sql.NVarChar(sql.MAX), JSON.stringify(playerIds))
    r.input('TransferReason',   sql.NVarChar,          transferReason)
    r.input('TransferYear',     sql.Int,               transferYear)
    r.input('TransferSemester', sql.NVarChar,          transferSemester)
  })
}

// ─── Alumni (alumni DB) ───────────────────────────────────────────────────────

export async function sp_GetAlumni() {
  return exec('alumni', 'sp_GetAlumni')
}

export async function sp_GetAlumniById(alumniId: number) {
  return exec('alumni', 'sp_GetAlumniById', (r) => {
    r.input('AlumniId', sql.Int, alumniId)
  })
}

export async function sp_CreateAlumniFromPlayer(params: {
  userId: number
  sourcePlayerId: number
  firstName: string
  lastName: string
  graduationYear: number
  graduationSemester: string
  position: string
  recruitingClass: number
}) {
  return exec('alumni', 'sp_CreateAlumniFromPlayer', (r) => {
    r.input('UserId',             sql.Int,      params.userId)
    r.input('SourcePlayerId',     sql.Int,      params.sourcePlayerId)
    r.input('FirstName',          sql.NVarChar, params.firstName)
    r.input('LastName',           sql.NVarChar, params.lastName)
    r.input('GraduationYear',     sql.Int,      params.graduationYear)
    r.input('GraduationSemester', sql.NVarChar, params.graduationSemester)
    r.input('Position',           sql.NVarChar, params.position)
    r.input('RecruitingClass',    sql.Int,      params.recruitingClass)
  })
}

export async function sp_GetAlumniInteractions(alumniId: number) {
  return exec('alumni', 'sp_GetAlumniInteractions', (r) => {
    r.input('AlumniId', sql.Int, alumniId)
  })
}

export async function sp_CreateInteraction(interaction: Record<string, unknown>) {
  return exec('alumni', 'sp_CreateInteraction', (r) => {
    r.input('InteractionJson', sql.NVarChar(sql.MAX), JSON.stringify(interaction))
  })
}
