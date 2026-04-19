// ─── Central Stored Procedure Registry ───────────────────────────────────────
// ALL database calls go through this file. Never import sql or mssql directly
// in route handlers or components — call a function from here instead.
// This keeps SQL Server connection config, error handling, and result mapping DRY.

import sql from 'mssql'

// ─── Connection Pools ─────────────────────────────────────────────────────────
// One pool per database. Pools are lazy — created on first use.

const baseConfig: sql.config = {
  server: process.env.DB_SERVER ?? 'localhost\\SQLEXPRESS',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER ?? 'sa',
      password: process.env.DB_PASSWORD ?? '',
    },
  },
}

let globalPool: sql.ConnectionPool | null = null
let rosterPool: sql.ConnectionPool | null = null
let alumniPool: sql.ConnectionPool | null = null

async function getPool(database: 'CfbGlobal' | 'CfbRoster' | 'CfbAlumni') {
  if (database === 'CfbGlobal') {
    if (!globalPool) globalPool = await new sql.ConnectionPool({ ...baseConfig, database }).connect()
    return globalPool
  }
  if (database === 'CfbRoster') {
    if (!rosterPool) rosterPool = await new sql.ConnectionPool({ ...baseConfig, database }).connect()
    return rosterPool
  }
  if (!alumniPool) alumniPool = await new sql.ConnectionPool({ ...baseConfig, database }).connect()
  return alumniPool
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function exec<T = sql.IRecordSet<Record<string, unknown>>>(
  database: 'CfbGlobal' | 'CfbRoster' | 'CfbAlumni',
  procedure: string,
  params: (req: sql.Request) => void = () => {},
): Promise<T> {
  const pool = await getPool(database)
  const request = pool.request()
  params(request)
  const result = await request.execute(procedure)
  return result.recordset as T
}

// ─── Auth / Users (CfbGlobal) ─────────────────────────────────────────────────

export async function sp_Login(username: string, password: string) {
  return exec('CfbGlobal', 'sp_Login', (r) => {
    r.input('Username', sql.NVarChar, username)
    r.input('Password', sql.NVarChar, password)
  })
}

export async function sp_GetUserById(userId: number) {
  return exec('CfbGlobal', 'sp_GetUserById', (r) => {
    r.input('UserId', sql.Int, userId)
  })
}

export async function sp_GetTeamConfig() {
  return exec('CfbGlobal', 'sp_GetTeamConfig')
}

export async function sp_UpdateTeamConfig(config: Record<string, unknown>) {
  return exec('CfbGlobal', 'sp_UpdateTeamConfig', (r) => {
    r.input('ConfigJson', sql.NVarChar(sql.MAX), JSON.stringify(config))
  })
}

// ─── Roster (CfbRoster) ───────────────────────────────────────────────────────

export async function sp_GetPlayers() {
  return exec('CfbRoster', 'sp_GetPlayers')
}

export async function sp_GetPlayerById(playerId: number) {
  return exec('CfbRoster', 'sp_GetPlayerById', (r) => {
    r.input('PlayerId', sql.Int, playerId)
  })
}

export async function sp_CreatePlayer(player: Record<string, unknown>) {
  return exec('CfbRoster', 'sp_CreatePlayer', (r) => {
    r.input('PlayerJson', sql.NVarChar(sql.MAX), JSON.stringify(player))
  })
}

export async function sp_TransferToAlumni(
  playerIds: number[],
  transferReason: string,
  transferYear: number,
  transferSemester: string,
) {
  return exec('CfbRoster', 'sp_TransferToAlumni', (r) => {
    r.input('PlayerIds', sql.NVarChar(sql.MAX), JSON.stringify(playerIds))
    r.input('TransferReason', sql.NVarChar, transferReason)
    r.input('TransferYear', sql.Int, transferYear)
    r.input('TransferSemester', sql.NVarChar, transferSemester)
  })
}

// ─── Alumni (CfbAlumni) ───────────────────────────────────────────────────────

export async function sp_GetAlumni() {
  return exec('CfbAlumni', 'sp_GetAlumni')
}

export async function sp_GetAlumniById(alumniId: number) {
  return exec('CfbAlumni', 'sp_GetAlumniById', (r) => {
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
  return exec('CfbAlumni', 'sp_CreateAlumniFromPlayer', (r) => {
    r.input('UserId', sql.Int, params.userId)
    r.input('SourcePlayerId', sql.Int, params.sourcePlayerId)
    r.input('FirstName', sql.NVarChar, params.firstName)
    r.input('LastName', sql.NVarChar, params.lastName)
    r.input('GraduationYear', sql.Int, params.graduationYear)
    r.input('GraduationSemester', sql.NVarChar, params.graduationSemester)
    r.input('Position', sql.NVarChar, params.position)
    r.input('RecruitingClass', sql.Int, params.recruitingClass)
  })
}

export async function sp_GetAlumniInteractions(alumniId: number) {
  return exec('CfbAlumni', 'sp_GetAlumniInteractions', (r) => {
    r.input('AlumniId', sql.Int, alumniId)
  })
}

export async function sp_CreateInteraction(interaction: Record<string, unknown>) {
  return exec('CfbAlumni', 'sp_CreateInteraction', (r) => {
    r.input('InteractionJson', sql.NVarChar(sql.MAX), JSON.stringify(interaction))
  })
}
