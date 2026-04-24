// ─── Central Stored Procedure Registry ───────────────────────────────────────
// ALL database calls go through this file.
// Never import mssql or getPool directly in route handlers or server actions —
// call a typed function from here instead.
//
// Cross-database coordination (Azure SQL Database does not support cross-DB
// synonyms or linked servers):
//   Global DB SPs  → use 'global' key
//   App DB SPs     → use 'app' key
//
// Procedures that previously called Global DB internally (sp_CreatePlayer,
// sp_BulkCreatePlayers, sp_BulkCreateAlumni, sp_GraduatePlayer) now receive
// the resolved userId(s) as parameters. The server actions in
// app/actions/players.ts and app/actions/alumni.ts handle the two-step
// Global DB → App DB coordination.

import sql from 'mssql'
import { dbRequest, type DbKey } from './connection'

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Execute a stored procedure and return the first recordset. */
async function exec<T = sql.IRecordSet<Record<string, unknown>>>(
  db: DbKey,
  procedure: string,
  params: (req: sql.Request) => void = () => {},
): Promise<T> {
  const req = await dbRequest(db)
  params(req)
  const result = await req.execute(procedure)
  return result.recordset as T
}

/** Execute a stored procedure and return both recordset(s) and OUTPUT params. */
async function execFull(
  db: DbKey,
  procedure: string,
  params: (req: sql.Request) => void = () => {},
) {
  const req = await dbRequest(db)
  params(req)
  const result = await req.execute(procedure)
  return {
    recordsets: result.recordsets as sql.IRecordSet<Record<string, unknown>>[],
    recordset:  result.recordset  as sql.IRecordSet<Record<string, unknown>>,
    output:     result.output     as Record<string, unknown>,
  }
}

// ─── Global DB — Auth / Users / Config ───────────────────────────────────────

/**
 * Idempotent user lookup / creation in the Global DB.
 * Returns the existing user ID if the email is already registered,
 * or creates the account and returns the new ID.
 */
export async function sp_GetOrCreateUser(params: {
  email:     string
  firstName: string
  lastName:  string
  teamId:    string
}): Promise<{ userId: string | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_GetOrCreateUser', (r) => {
    r.input ('Email',     sql.NVarChar(255),     params.email)
    r.input ('FirstName', sql.NVarChar(100),     params.firstName)
    r.input ('LastName',  sql.NVarChar(100),     params.lastName)
    r.input ('TeamId',    sql.UniqueIdentifier,  params.teamId)
    r.output('UserId',    sql.UniqueIdentifier)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    userId:    (output.UserId    as string | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

/**
 * Revokes the user's 'roster' app-permission in the Global DB and grants
 * 'alumni' in its place. Called by the graduation server action after
 * sp_GraduatePlayer has already flipped status in the App DB.
 */
export async function sp_TransferPlayerToAlumni(params: {
  userId:    string
  grantedBy: string
}): Promise<void> {
  await execFull('global', 'sp_TransferPlayerToAlumni', (r) => {
    r.input('UserId',    sql.UniqueIdentifier, params.userId)
    r.input('GrantedBy', sql.NVarChar(100),    params.grantedBy)
  })
}

// ─── Team config row returned by sp_GetTeamConfig / sp_GetTeams ───────────────
// SP columns can be PascalCase (TeamId, TeamName…) or camelCase — both are
// handled by the normalizeTeamRow() helper in the route handlers.
export type TeamConfigRow = Record<string, unknown>

/** Returns config for a specific team (or the default team if teamId is omitted). */
export async function sp_GetTeamConfig(params?: { teamId?: string }): Promise<TeamConfigRow | null> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('global', 'sp_GetTeamConfig', (r) => {
    r.input('TeamId', sql.UniqueIdentifier, params?.teamId ?? null)
  })
  return (rows as unknown as TeamConfigRow[])[0] ?? null
}

/** Returns all active teams — used by /api/teams to populate the TeamSwitcher. */
export async function sp_GetTeams(): Promise<TeamConfigRow[]> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('global', 'sp_GetTeams')
  return rows as unknown as TeamConfigRow[]
}

/** Returns the teams a specific user has access to. */
export async function sp_GetUserTeams(params: {
  userId: string
}): Promise<TeamConfigRow[]> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('global', 'sp_GetUserTeams', (r) => {
    r.input('UserId', sql.UniqueIdentifier, params.userId)
  })
  return rows as unknown as TeamConfigRow[]
}

/**
 * Validates user access to the new team and returns team details for re-issuing the JWT.
 * platform_owner bypasses the user_teams membership check.
 */
export async function sp_SwitchTeam(params: {
  userId:    string
  newTeamId: string
}): Promise<{ teamJson: string | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_SwitchTeam', (r) => {
    r.input ('UserId',    sql.UniqueIdentifier, params.userId)
    r.input ('NewTeamId', sql.UniqueIdentifier, params.newTeamId)
    r.output('TeamJson',  sql.NVarChar(sql.MAX))
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    teamJson:  (output.TeamJson  as string | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_UpdateTeamConfig(params: {
  teamId?:           string | null
  teamName?:         string | null
  teamAbbr?:         string | null
  sport?:            string | null
  level?:            string | null
  logoUrl?:          string | null
  colorPrimary?:     string | null
  colorPrimaryDark?: string | null
  colorPrimaryLight?:string | null
  colorAccent?:      string | null
  colorAccentDark?:  string | null
  colorAccentLight?: string | null
  positionsJson?:    string | null
  academicYearsJson?:string | null
  alumniLabel?:      string | null
  rosterLabel?:      string | null
  classLabel?:       string | null
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_UpdateTeamConfig', (r) => {
    r.input ('TeamId',            sql.UniqueIdentifier, params.teamId            ?? null)
    r.input ('TeamName',          sql.NVarChar(100),    params.teamName          ?? null)
    r.input ('TeamAbbr',          sql.NVarChar(10),     params.teamAbbr          ?? null)
    r.input ('Sport',             sql.NVarChar(50),     params.sport             ?? null)
    r.input ('Level',             sql.NVarChar(20),     params.level             ?? null)
    r.input ('LogoUrl',           sql.NVarChar(500),    params.logoUrl           ?? null)
    r.input ('ColorPrimary',      sql.NVarChar(7),      params.colorPrimary      ?? null)
    r.input ('ColorPrimaryDark',  sql.NVarChar(7),      params.colorPrimaryDark  ?? null)
    r.input ('ColorPrimaryLight', sql.NVarChar(7),      params.colorPrimaryLight ?? null)
    r.input ('ColorAccent',       sql.NVarChar(7),      params.colorAccent       ?? null)
    r.input ('ColorAccentDark',   sql.NVarChar(7),      params.colorAccentDark   ?? null)
    r.input ('ColorAccentLight',  sql.NVarChar(7),      params.colorAccentLight  ?? null)
    r.input ('PositionsJson',     sql.NVarChar(sql.MAX),params.positionsJson     ?? null)
    r.input ('AcademicYearsJson', sql.NVarChar(sql.MAX),params.academicYearsJson ?? null)
    r.input ('AlumniLabel',       sql.NVarChar(50),     params.alumniLabel       ?? null)
    r.input ('RosterLabel',       sql.NVarChar(50),     params.rosterLabel       ?? null)
    r.input ('ClassLabel',        sql.NVarChar(50),     params.classLabel        ?? null)
    r.output('ErrorCode',         sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

// ─── App DB — Players ─────────────────────────────────────────────────────────

export async function sp_GetPlayers(params: {
  search?:         string
  position?:       string
  academicYear?:   string
  recruitingClass?: number
  sportId?:        string
  page?:           number
  pageSize?:       number
  requestingUserId?:   string
  requestingUserRole?: string
} = {}) {
  const { recordset, output } = await execFull('app', 'sp_GetPlayers', (r) => {
    r.input ('Search',           sql.NVarChar(255),    params.search         ?? null)
    r.input ('Position',         sql.NVarChar(10),     params.position       ?? null)
    r.input ('AcademicYear',     sql.NVarChar(20),     params.academicYear   ?? null)
    r.input ('RecruitingClass',  sql.SmallInt,         params.recruitingClass ?? null)
    r.input ('SportId',          sql.UniqueIdentifier, params.sportId        ?? null)
    r.input ('Page',             sql.Int,              params.page     ?? 1)
    r.input ('PageSize',         sql.Int,              params.pageSize ?? 50)
    r.input ('RequestingUserId',   sql.UniqueIdentifier, params.requestingUserId   ?? null)
    r.input ('RequestingUserRole', sql.NVarChar(50),     params.requestingUserRole ?? null)
    r.output('TotalCount', sql.Int)
  })
  return {
    players:    recordset,
    totalCount: (output.TotalCount as number) ?? 0,
  }
}

export async function sp_GetPlayerById(params: {
  userId:              string
  requestingUserId?:   string
  requestingUserRole?: string
}) {
  const { recordsets, output } = await execFull('app', 'sp_GetPlayerById', (r) => {
    r.input ('UserId',             sql.UniqueIdentifier, params.userId)
    r.input ('RequestingUserId',   sql.UniqueIdentifier, params.requestingUserId   ?? null)
    r.input ('RequestingUserRole', sql.NVarChar(50),     params.requestingUserRole ?? null)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    player:    recordsets[0]?.[0] ?? null,
    stats:     recordsets[1]      ?? [],
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

/**
 * Creates a player in the App DB.
 * @UserId must be resolved BEFORE calling this — use sp_GetOrCreateUser first.
 */
export async function sp_CreatePlayer(params: {
  userId:                string
  email:                 string
  firstName:             string
  lastName:              string
  position:              string
  academicYear:          string
  recruitingClass:       number
  createdBy:             string
  sportId?:              string
  jerseyNumber?:         number
  heightInches?:         number
  weightLbs?:            number
  homeTown?:             string
  homeState?:            string
  highSchool?:           string
  major?:                string
  phone?:                string
  instagram?:            string
  twitter?:              string
  snapchat?:             string
  emergencyContactName?:  string
  emergencyContactPhone?: string
  parent1Name?:          string
  parent1Phone?:         string
  parent1Email?:         string
  parent2Name?:          string
  parent2Phone?:         string
  parent2Email?:         string
  notes?:                string
  requestingUserId?:     string
  requestingUserRole?:   string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_CreatePlayer', (r) => {
    r.input ('UserId',                sql.UniqueIdentifier, params.userId)
    r.input ('Email',                 sql.NVarChar(255),    params.email)
    r.input ('FirstName',             sql.NVarChar(100),    params.firstName)
    r.input ('LastName',              sql.NVarChar(100),    params.lastName)
    r.input ('Position',              sql.NVarChar(10),     params.position)
    r.input ('AcademicYear',          sql.NVarChar(20),     params.academicYear)
    r.input ('RecruitingClass',       sql.SmallInt,         params.recruitingClass)
    r.input ('CreatedBy',             sql.UniqueIdentifier, params.createdBy)
    r.input ('SportId',               sql.UniqueIdentifier, params.sportId              ?? null)
    r.input ('JerseyNumber',          sql.TinyInt,          params.jerseyNumber          ?? null)
    r.input ('HeightInches',          sql.TinyInt,          params.heightInches          ?? null)
    r.input ('WeightLbs',             sql.SmallInt,         params.weightLbs             ?? null)
    r.input ('HomeTown',              sql.NVarChar(100),    params.homeTown              ?? null)
    r.input ('HomeState',             sql.NVarChar(50),     params.homeState             ?? null)
    r.input ('HighSchool',            sql.NVarChar(150),    params.highSchool            ?? null)
    r.input ('Major',                 sql.NVarChar(100),    params.major                 ?? null)
    r.input ('Phone',                 sql.NVarChar(20),     params.phone                 ?? null)
    r.input ('Instagram',             sql.NVarChar(100),    params.instagram             ?? null)
    r.input ('Twitter',               sql.NVarChar(100),    params.twitter               ?? null)
    r.input ('Snapchat',              sql.NVarChar(100),    params.snapchat              ?? null)
    r.input ('EmergencyContactName',  sql.NVarChar(150),    params.emergencyContactName  ?? null)
    r.input ('EmergencyContactPhone', sql.NVarChar(20),     params.emergencyContactPhone ?? null)
    r.input ('Parent1Name',           sql.NVarChar(150),    params.parent1Name           ?? null)
    r.input ('Parent1Phone',          sql.NVarChar(20),     params.parent1Phone          ?? null)
    r.input ('Parent1Email',          sql.NVarChar(255),    params.parent1Email          ?? null)
    r.input ('Parent2Name',           sql.NVarChar(150),    params.parent2Name           ?? null)
    r.input ('Parent2Phone',          sql.NVarChar(20),     params.parent2Phone          ?? null)
    r.input ('Parent2Email',          sql.NVarChar(255),    params.parent2Email          ?? null)
    r.input ('Notes',                 sql.NVarChar(sql.MAX),params.notes                 ?? null)
    r.input ('RequestingUserId',      sql.UniqueIdentifier, params.requestingUserId      ?? null)
    r.input ('RequestingUserRole',    sql.NVarChar(50),     params.requestingUserRole    ?? null)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

export async function sp_UpdatePlayer(params: {
  userId:                string
  updatedBy:             string
  jerseyNumber?:         number
  position?:             string
  academicYear?:         string
  heightInches?:         number
  weightLbs?:            number
  major?:                string
  phone?:                string
  email?:                string
  instagram?:            string
  twitter?:              string
  snapchat?:             string
  emergencyContactName?:  string
  emergencyContactPhone?: string
  parent1Name?:          string
  parent1Phone?:         string
  parent1Email?:         string
  parent2Name?:          string
  parent2Phone?:         string
  parent2Email?:         string
  notes?:                string
  requestingUserId?:     string
  requestingUserRole?:   string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_UpdatePlayer', (r) => {
    r.input ('UserId',                sql.UniqueIdentifier, params.userId)
    r.input ('UpdatedBy',             sql.UniqueIdentifier, params.updatedBy)
    r.input ('JerseyNumber',          sql.TinyInt,          params.jerseyNumber          ?? null)
    r.input ('Position',              sql.NVarChar(10),     params.position              ?? null)
    r.input ('AcademicYear',          sql.NVarChar(20),     params.academicYear          ?? null)
    r.input ('HeightInches',          sql.TinyInt,          params.heightInches          ?? null)
    r.input ('WeightLbs',             sql.SmallInt,         params.weightLbs             ?? null)
    r.input ('Major',                 sql.NVarChar(100),    params.major                 ?? null)
    r.input ('Phone',                 sql.NVarChar(20),     params.phone                 ?? null)
    r.input ('Email',                 sql.NVarChar(255),    params.email                 ?? null)
    r.input ('Instagram',             sql.NVarChar(100),    params.instagram             ?? null)
    r.input ('Twitter',               sql.NVarChar(100),    params.twitter               ?? null)
    r.input ('Snapchat',              sql.NVarChar(100),    params.snapchat              ?? null)
    r.input ('EmergencyContactName',  sql.NVarChar(150),    params.emergencyContactName  ?? null)
    r.input ('EmergencyContactPhone', sql.NVarChar(20),     params.emergencyContactPhone ?? null)
    r.input ('Parent1Name',           sql.NVarChar(150),    params.parent1Name           ?? null)
    r.input ('Parent1Phone',          sql.NVarChar(20),     params.parent1Phone          ?? null)
    r.input ('Parent1Email',          sql.NVarChar(255),    params.parent1Email          ?? null)
    r.input ('Parent2Name',           sql.NVarChar(150),    params.parent2Name           ?? null)
    r.input ('Parent2Phone',          sql.NVarChar(20),     params.parent2Phone          ?? null)
    r.input ('Parent2Email',          sql.NVarChar(255),    params.parent2Email          ?? null)
    r.input ('Notes',                 sql.NVarChar(sql.MAX),params.notes                 ?? null)
    r.input ('RequestingUserId',      sql.UniqueIdentifier, params.requestingUserId      ?? null)
    r.input ('RequestingUserRole',    sql.NVarChar(50),     params.requestingUserRole    ?? null)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

/**
 * Flips status to alumni in the App DB for the given player IDs.
 * Returns @SucceededJson — the caller MUST then call sp_TransferPlayerToAlumni
 * on the Global DB for each userId in that array.
 */
export async function sp_GraduatePlayer(params: {
  playerIds:      string[]
  graduationYear: number
  semester:       string
  triggeredBy:    string
}): Promise<{
  transactionId:  string
  successCount:   number
  failureJson:    string
  succeededJson:  string
}> {
  const { output } = await execFull('app', 'sp_GraduatePlayer', (r) => {
    r.input ('PlayerIds',      sql.NVarChar(sql.MAX), JSON.stringify(params.playerIds))
    r.input ('GraduationYear', sql.SmallInt,          params.graduationYear)
    r.input ('Semester',       sql.NVarChar(10),      params.semester)
    r.input ('TriggeredBy',    sql.NVarChar(100),     params.triggeredBy)
    r.output('TransactionId',  sql.UniqueIdentifier)
    r.output('SuccessCount',   sql.Int)
    r.output('FailureJson',    sql.NVarChar(sql.MAX))
    r.output('SucceededJson',  sql.NVarChar(sql.MAX))
  })
  return {
    transactionId: (output.TransactionId  as string) ?? '',
    successCount:  (output.SuccessCount   as number) ?? 0,
    failureJson:   (output.FailureJson    as string) ?? '[]',
    succeededJson: (output.SucceededJson  as string) ?? '[]',
  }
}

export async function sp_RemovePlayer(params: {
  userId:              string
  removedBy:           string
  requestingUserId?:   string
  requestingUserRole?: string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_RemovePlayer', (r) => {
    r.input ('UserId',             sql.UniqueIdentifier, params.userId)
    r.input ('RemovedBy',          sql.UniqueIdentifier, params.removedBy)
    r.input ('RequestingUserId',   sql.UniqueIdentifier, params.requestingUserId   ?? null)
    r.input ('RequestingUserRole', sql.NVarChar(50),     params.requestingUserRole ?? null)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

/**
 * Bulk-creates players. Each entry in the array must include a `userId`
 * that was already resolved via sp_GetOrCreateUser on the Global DB.
 */
export async function sp_BulkCreatePlayers(params: {
  players:   BulkPlayerRow[]
  createdBy: string
  sportId?:  string
}): Promise<{ successCount: number; skippedCount: number; errorJson: string }> {
  const { output } = await execFull('app', 'sp_BulkCreatePlayers', (r) => {
    r.input ('PlayersJson', sql.NVarChar(sql.MAX), JSON.stringify(params.players))
    r.input ('CreatedBy',   sql.UniqueIdentifier,  params.createdBy)
    r.input ('SportId',     sql.UniqueIdentifier,  params.sportId ?? null)
    r.output('SuccessCount', sql.Int)
    r.output('SkippedCount', sql.Int)
    r.output('ErrorJson',    sql.NVarChar(sql.MAX))
  })
  return {
    successCount: (output.SuccessCount as number) ?? 0,
    skippedCount: (output.SkippedCount as number) ?? 0,
    errorJson:    (output.ErrorJson    as string) ?? '[]',
  }
}

export interface BulkPlayerRow {
  userId?:               string   // resolved by caller; generated by SP if absent
  email?:                string
  firstName:             string
  lastName:              string
  jerseyNumber?:         number
  position?:             string
  academicYear?:         string
  recruitingClass:       number
  heightInches?:         number
  weightLbs?:            number
  homeTown?:             string
  homeState?:            string
  highSchool?:           string
  major?:                string
  phone?:                string
  emergencyContactName?:  string
  emergencyContactPhone?: string
  parent1Name?:          string
  parent1Phone?:         string
  parent1Email?:         string
  parent2Name?:          string
  parent2Phone?:         string
  parent2Email?:         string
  notes?:                string
}

// ─── App DB — Alumni ──────────────────────────────────────────────────────────

export async function sp_GetAlumni(params: {
  search?:    string
  isDonor?:   boolean
  gradYear?:  number
  position?:  string
  sportId?:   string
  page?:      number
  pageSize?:  number
  requestingUserId?:   string
  requestingUserRole?: string
} = {}) {
  const { recordset, output } = await execFull('app', 'sp_GetAlumni', (r) => {
    r.input ('Search',             sql.NVarChar(255),    params.search    ?? null)
    r.input ('IsDonor',            sql.Bit,              params.isDonor   ?? null)
    r.input ('GradYear',           sql.SmallInt,         params.gradYear  ?? null)
    r.input ('Position',           sql.NVarChar(10),     params.position  ?? null)
    r.input ('SportId',            sql.UniqueIdentifier, params.sportId   ?? null)
    r.input ('Page',               sql.Int,              params.page     ?? 1)
    r.input ('PageSize',           sql.Int,              params.pageSize ?? 50)
    r.input ('RequestingUserId',   sql.UniqueIdentifier, params.requestingUserId   ?? null)
    r.input ('RequestingUserRole', sql.NVarChar(50),     params.requestingUserRole ?? null)
    r.output('TotalCount', sql.Int)
  })
  return {
    alumni:     recordset,
    totalCount: (output.TotalCount as number) ?? 0,
  }
}

export async function sp_GetAlumniById(params: {
  userId:              string
  requestingUserId?:   string
  requestingUserRole?: string
}) {
  const { recordsets, output } = await execFull('app', 'sp_GetAlumniById', (r) => {
    r.input ('UserId',             sql.UniqueIdentifier, params.userId)
    r.input ('RequestingUserId',   sql.UniqueIdentifier, params.requestingUserId   ?? null)
    r.input ('RequestingUserRole', sql.NVarChar(50),     params.requestingUserRole ?? null)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    alumni:    recordsets[0]?.[0] ?? null,
    interactions: recordsets[1]   ?? [],
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_UpdateAlumni(params: {
  userId:              string
  updatedBy:           string
  phone?:              string
  personalEmail?:      string
  linkedInUrl?:        string
  twitterUrl?:         string
  currentEmployer?:    string
  currentJobTitle?:    string
  currentCity?:        string
  currentState?:       string
  isDonor?:            boolean
  lastDonationDate?:   string
  totalDonations?:     number
  engagementScore?:    number
  communicationConsent?: boolean
  yearsOnRoster?:      number
  notes?:              string
  requestingUserId?:   string
  requestingUserRole?: string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_UpdateAlumni', (r) => {
    r.input ('UserId',               sql.UniqueIdentifier, params.userId)
    r.input ('UpdatedBy',            sql.UniqueIdentifier, params.updatedBy)
    r.input ('Phone',                sql.NVarChar(20),     params.phone              ?? null)
    r.input ('PersonalEmail',        sql.NVarChar(255),    params.personalEmail      ?? null)
    r.input ('LinkedInUrl',          sql.NVarChar(500),    params.linkedInUrl        ?? null)
    r.input ('TwitterUrl',           sql.NVarChar(500),    params.twitterUrl         ?? null)
    r.input ('CurrentEmployer',      sql.NVarChar(200),    params.currentEmployer    ?? null)
    r.input ('CurrentJobTitle',      sql.NVarChar(200),    params.currentJobTitle    ?? null)
    r.input ('CurrentCity',          sql.NVarChar(100),    params.currentCity        ?? null)
    r.input ('CurrentState',         sql.NVarChar(50),     params.currentState       ?? null)
    r.input ('IsDonor',              sql.Bit,              params.isDonor            ?? null)
    r.input ('LastDonationDate',     sql.Date,             params.lastDonationDate   ?? null)
    r.input ('TotalDonations',       sql.Decimal(10, 2),   params.totalDonations     ?? null)
    r.input ('EngagementScore',      sql.Int,              params.engagementScore    ?? null)
    r.input ('CommunicationConsent', sql.Bit,              params.communicationConsent ?? null)
    r.input ('YearsOnRoster',        sql.Int,              params.yearsOnRoster      ?? null)
    r.input ('Notes',                sql.NVarChar(sql.MAX),params.notes              ?? null)
    r.input ('RequestingUserId',     sql.UniqueIdentifier, params.requestingUserId   ?? null)
    r.input ('RequestingUserRole',   sql.NVarChar(50),     params.requestingUserRole ?? null)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

export async function sp_LogInteraction(params: {
  userId:    string
  loggedBy:  string
  channel:   string
  summary:   string
  outcome?:  string
  followUpAt?: string
}): Promise<void> {
  await exec('app', 'sp_LogInteraction', (r) => {
    r.input('UserId',     sql.UniqueIdentifier,  params.userId)
    r.input('LoggedBy',   sql.UniqueIdentifier,  params.loggedBy)
    r.input('Channel',    sql.NVarChar(50),      params.channel)
    r.input('Summary',    sql.NVarChar(sql.MAX), params.summary)
    r.input('Outcome',    sql.NVarChar(sql.MAX), params.outcome    ?? null)
    r.input('FollowUpAt', sql.DateTime2,         params.followUpAt ?? null)
  })
}

/**
 * Bulk-creates alumni. Each entry must include a `userId` resolved via
 * sp_GetOrCreateUser on the Global DB (for rows that have an email).
 */
export async function sp_BulkCreateAlumni(params: {
  alumni:    BulkAlumniRow[]
  createdBy: string
  sportId?:  string
}): Promise<{ successCount: number; skippedCount: number; errorJson: string }> {
  const { output } = await execFull('app', 'sp_BulkCreateAlumni', (r) => {
    r.input ('AlumniJson',   sql.NVarChar(sql.MAX), JSON.stringify(params.alumni))
    r.input ('CreatedBy',    sql.UniqueIdentifier,  params.createdBy)
    r.input ('SportId',      sql.UniqueIdentifier,  params.sportId ?? null)
    r.output('SuccessCount', sql.Int)
    r.output('SkippedCount', sql.Int)
    r.output('ErrorJson',    sql.NVarChar(sql.MAX))
  })
  return {
    successCount: (output.SuccessCount as number) ?? 0,
    skippedCount: (output.SkippedCount as number) ?? 0,
    errorJson:    (output.ErrorJson    as string) ?? '[]',
  }
}

export interface BulkAlumniRow {
  userId?:            string   // resolved by caller; generated by SP if absent
  email?:             string
  firstName:          string
  lastName:           string
  graduationYear?:    number
  graduationSemester?: string
  phone?:             string
  linkedInUrl?:       string
  currentEmployer?:   string
  currentJobTitle?:   string
  currentCity?:       string
  currentState?:      string
  isDonor?:           boolean
  notes?:             string
}

// ─── App DB — Campaigns ───────────────────────────────────────────────────────

export async function sp_CreateCampaign(params: {
  name:            string
  createdBy:       string
  targetAudience:  string
  description?:    string
  audienceFilters?: string
  scheduledAt?:    string
  subjectLine?:    string
  bodyHtml?:       string
  fromName?:       string
  replyToEmail?:   string
  physicalAddress?: string
  sportId?:        string
}): Promise<{ campaignId: string | null; errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_CreateCampaign', (r) => {
    r.input ('Name',            sql.NVarChar(300),    params.name)
    r.input ('CreatedBy',       sql.UniqueIdentifier, params.createdBy)
    r.input ('TargetAudience',  sql.NVarChar(30),     params.targetAudience)
    r.input ('Description',     sql.NVarChar(sql.MAX),params.description     ?? null)
    r.input ('AudienceFilters', sql.NVarChar(sql.MAX),params.audienceFilters ?? null)
    r.input ('ScheduledAt',     sql.DateTime2,        params.scheduledAt     ?? null)
    r.input ('SubjectLine',     sql.NVarChar(500),    params.subjectLine     ?? null)
    r.input ('BodyHtml',        sql.NVarChar(sql.MAX),params.bodyHtml        ?? null)
    r.input ('FromName',        sql.NVarChar(150),    params.fromName        ?? null)
    r.input ('ReplyToEmail',    sql.NVarChar(255),    params.replyToEmail    ?? null)
    r.input ('PhysicalAddress', sql.NVarChar(500),    params.physicalAddress ?? null)
    r.input ('SportId',         sql.UniqueIdentifier, params.sportId         ?? null)
    r.output('NewCampaignId', sql.UniqueIdentifier)
    r.output('ErrorCode',     sql.NVarChar(50))
  })
  return {
    campaignId: (output.NewCampaignId as string | null) ?? null,
    errorCode:  (output.ErrorCode     as string | null) ?? null,
  }
}

export async function sp_GetCampaigns(params: {
  sportId?:            string
  requestingUserId?:   string
  requestingUserRole?: string
} = {}) {
  return exec('app', 'sp_GetCampaigns', (r) => {
    r.input('SportId',            sql.UniqueIdentifier, params.sportId            ?? null)
    r.input('RequestingUserId',   sql.UniqueIdentifier, params.requestingUserId   ?? null)
    r.input('RequestingUserRole', sql.NVarChar(50),     params.requestingUserRole ?? null)
  })
}

export async function sp_GetAlumniStats(params: {
  sportId?:            string
  requestingUserId?:   string
  requestingUserRole?: string
} = {}) {
  return exec('app', 'sp_GetAlumniStats', (r) => {
    r.input('SportId',            sql.UniqueIdentifier, params.sportId            ?? null)
    r.input('RequestingUserId',   sql.UniqueIdentifier, params.requestingUserId   ?? null)
    r.input('RequestingUserRole', sql.NVarChar(50),     params.requestingUserRole ?? null)
  })
}

// ─── Global DB — Team Member Creation ────────────────────────────────────────

/** Creates or looks up a user, assigns the given role, grants app_permissions. */
export async function sp_CreateTeamMember(params: {
  email:     string
  firstName: string
  lastName:  string
  teamId:    string
  role:      string
  createdBy: string
}): Promise<{ userId: string | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_CreateTeamMember', (r) => {
    r.input ('Email',     sql.NVarChar(255),    params.email)
    r.input ('FirstName', sql.NVarChar(100),    params.firstName)
    r.input ('LastName',  sql.NVarChar(100),    params.lastName)
    r.input ('TeamId',    sql.UniqueIdentifier, params.teamId)
    r.input ('Role',      sql.NVarChar(30),     params.role)
    r.input ('CreatedBy', sql.UniqueIdentifier, params.createdBy)
    r.output('UserId',    sql.UniqueIdentifier)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    userId:    (output.UserId    as string | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

// ─── Global DB — Invite Codes & Access Requests ───────────────────────────────

/** Creates a new user account for self-signup via invite code. */
export async function sp_RegisterUserViaInvite(params: {
  email:        string
  passwordHash: string
  firstName:    string
  lastName:     string
}): Promise<{ userId: string | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_RegisterUserViaInvite', (r) => {
    r.input ('Email',        sql.NVarChar(255), params.email)
    r.input ('PasswordHash', sql.NVarChar(sql.MAX), params.passwordHash)
    r.input ('FirstName',    sql.NVarChar(100), params.firstName)
    r.input ('LastName',     sql.NVarChar(100), params.lastName)
    r.output('UserId',       sql.UniqueIdentifier)
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return {
    userId:    (output.UserId    as string | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

/** Validates an invite token and returns team + role info. Returns null if token not found. */
export async function sp_ValidateInviteCode(params: {
  token: string
}): Promise<Record<string, unknown> | null> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('global', 'sp_ValidateInviteCode', (r) => {
    r.input('Token', sql.NVarChar(128), params.token)
  })
  return rows[0] ?? null
}

/** Creates a new invite code. */
export async function sp_CreateInviteCode(params: {
  teamId:    string
  role:      string
  token:     string
  createdBy: string
  expiresAt?: Date | null
  maxUses?:   number | null
}): Promise<{ inviteCodeId: string | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_CreateInviteCode', (r) => {
    r.input ('TeamId',       sql.UniqueIdentifier, params.teamId)
    r.input ('Role',         sql.NVarChar(30),     params.role)
    r.input ('Token',        sql.NVarChar(128),    params.token)
    r.input ('CreatedBy',    sql.UniqueIdentifier, params.createdBy)
    r.input ('ExpiresAt',    sql.DateTime2,        params.expiresAt ?? null)
    r.input ('MaxUses',      sql.Int,              params.maxUses   ?? null)
    r.output('InviteCodeId', sql.UniqueIdentifier)
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return {
    inviteCodeId: (output.InviteCodeId as string | null) ?? null,
    errorCode:    (output.ErrorCode    as string | null) ?? null,
  }
}

/** Lists all invite codes for a team. */
export async function sp_ListInviteCodes(params: {
  teamId: string
}): Promise<sql.IRecordSet<Record<string, unknown>>> {
  return exec('global', 'sp_ListInviteCodes', (r) => {
    r.input('TeamId', sql.UniqueIdentifier, params.teamId)
  })
}

/** Deactivates an invite code. */
export async function sp_DeactivateInviteCode(params: {
  inviteCodeId:  string
  deactivatedBy: string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_DeactivateInviteCode', (r) => {
    r.input ('InviteCodeId',  sql.UniqueIdentifier, params.inviteCodeId)
    r.input ('DeactivatedBy', sql.UniqueIdentifier, params.deactivatedBy)
    r.output('ErrorCode',     sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

/** Submits an access request. Increments invite code use_count. */
export async function sp_SubmitAccessRequest(params: {
  userId: string
  token:  string
}): Promise<{ requestId: string | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_SubmitAccessRequest', (r) => {
    r.input ('UserId',    sql.UniqueIdentifier, params.userId)
    r.input ('Token',     sql.NVarChar(128),    params.token)
    r.output('RequestId', sql.UniqueIdentifier)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    requestId: (output.RequestId as string | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

/** Returns all access requests for the calling user. */
export async function sp_GetMyAccessRequests(params: {
  userId: string
}): Promise<sql.IRecordSet<Record<string, unknown>>> {
  return exec('global', 'sp_GetMyAccessRequests', (r) => {
    r.input('UserId', sql.UniqueIdentifier, params.userId)
  })
}

/** Returns access requests visible to an admin (scoped by team membership). */
export async function sp_GetPendingAccessRequests(params: {
  adminUserId:   string
  statusFilter?: 'pending' | 'approved' | 'denied' | 'all'
}): Promise<sql.IRecordSet<Record<string, unknown>>> {
  return exec('global', 'sp_GetPendingAccessRequests', (r) => {
    r.input('AdminUserId',  sql.UniqueIdentifier, params.adminUserId)
    r.input('StatusFilter', sql.NVarChar(20),     params.statusFilter ?? 'pending')
  })
}

/** Approves or denies an access request. */
export async function sp_ReviewAccessRequest(params: {
  requestId:    string
  reviewedBy:   string
  action:       'approve' | 'deny'
  role?:        string | null
  denialReason?: string | null
}): Promise<{
  userId:    string | null
  teamId:    string | null
  finalRole: string | null
  errorCode: string | null
}> {
  const { output } = await execFull('global', 'sp_ReviewAccessRequest', (r) => {
    r.input ('RequestId',    sql.UniqueIdentifier, params.requestId)
    r.input ('ReviewedBy',   sql.UniqueIdentifier, params.reviewedBy)
    r.input ('Action',       sql.NVarChar(10),     params.action)
    r.input ('Role',         sql.NVarChar(30),     params.role         ?? null)
    r.input ('DenialReason', sql.NVarChar(sql.MAX),params.denialReason ?? null)
    r.output('UserId',       sql.UniqueIdentifier)
    r.output('TeamId',       sql.UniqueIdentifier)
    r.output('FinalRole',    sql.NVarChar(30))
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return {
    userId:    (output.UserId    as string | null) ?? null,
    teamId:    (output.TeamId    as string | null) ?? null,
    finalRole: (output.FinalRole as string | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

/** Updates reminder_sent_at. Only allowed if null or older than 48 hours. */
export async function sp_SendRequestReminder(params: {
  requestId: string
  userId:    string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_SendRequestReminder', (r) => {
    r.input ('RequestId', sql.UniqueIdentifier, params.requestId)
    r.input ('UserId',    sql.UniqueIdentifier, params.userId)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

// ─── App DB — Feed ────────────────────────────────────────────────────────────

export interface FeedPostRow {
  id:            string
  title:         string | null
  bodyHtml:      string
  audience:      string
  audienceJson:  string | null
  sportId:       string | null
  isPinned:      boolean
  isWelcomePost: boolean
  campaignId:    string | null
  createdBy:     string
  publishedAt:   string
  createdAt:     string
  isRead:        boolean
}

export async function sp_GetFeed(params: {
  viewerUserId:       string
  sportId?:           string
  page:               number
  pageSize:           number
  requestingUserId:   string
  requestingUserRole: string
}): Promise<{ posts: FeedPostRow[]; totalCount: number }> {
  const { recordset, output } = await execFull('app', 'sp_GetFeed', (r) => {
    r.input ('ViewerUserId',        sql.UniqueIdentifier, params.viewerUserId)
    r.input ('SportId',             sql.UniqueIdentifier, params.sportId ?? null)
    r.input ('Page',                sql.Int,              params.page)
    r.input ('PageSize',            sql.Int,              params.pageSize)
    r.output('TotalCount',          sql.Int)
    r.input ('RequestingUserId',    sql.UniqueIdentifier, params.requestingUserId)
    r.input ('RequestingUserRole',  sql.NVarChar(50),     params.requestingUserRole)
  })
  return {
    posts:      (recordset as unknown as FeedPostRow[]) ?? [],
    totalCount: (output.TotalCount as number) ?? 0,
  }
}

export async function sp_GetFeedPost(params: {
  postId:             string
  viewerUserId:       string
  requestingUserId:   string
  requestingUserRole: string
}): Promise<{ post: FeedPostRow | null; errorCode: string | null }> {
  const { recordset, output } = await execFull('app', 'sp_GetFeedPost', (r) => {
    r.input ('PostId',              sql.UniqueIdentifier, params.postId)
    r.input ('ViewerUserId',        sql.UniqueIdentifier, params.viewerUserId)
    r.output('ErrorCode',           sql.NVarChar(50))
    r.input ('RequestingUserId',    sql.UniqueIdentifier, params.requestingUserId)
    r.input ('RequestingUserRole',  sql.NVarChar(50),     params.requestingUserRole)
  })
  const rows = recordset as unknown as FeedPostRow[]
  return {
    post:      rows?.[0] ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_CreatePost(params: {
  createdBy:          string
  bodyHtml:           string
  audience:           string
  title?:             string | null
  audienceJson?:      string | null
  sportId?:           string | null
  isPinned:           boolean
  alsoEmail:          boolean
  emailSubject?:      string | null
  requestingUserId:   string
  requestingUserRole: string
}): Promise<{ postId: string | null; campaignId: string | null; errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_CreatePost', (r) => {
    r.input ('CreatedBy',           sql.UniqueIdentifier, params.createdBy)
    r.input ('BodyHtml',            sql.NVarChar(sql.MAX), params.bodyHtml)
    r.input ('Audience',            sql.NVarChar(30),     params.audience)
    r.input ('Title',               sql.NVarChar(300),    params.title ?? null)
    r.input ('AudienceJson',        sql.NVarChar(sql.MAX), params.audienceJson ?? null)
    r.input ('SportId',             sql.UniqueIdentifier, params.sportId ?? null)
    r.input ('IsPinned',            sql.Bit,              params.isPinned ? 1 : 0)
    r.input ('AlsoEmail',           sql.Bit,              params.alsoEmail ? 1 : 0)
    r.input ('EmailSubject',        sql.NVarChar(500),    params.emailSubject ?? null)
    r.output('NewPostId',           sql.UniqueIdentifier)
    r.output('CampaignId',          sql.UniqueIdentifier)
    r.output('ErrorCode',           sql.NVarChar(50))
    r.input ('RequestingUserId',    sql.UniqueIdentifier, params.requestingUserId)
    r.input ('RequestingUserRole',  sql.NVarChar(50),     params.requestingUserRole)
  })
  return {
    postId:     (output.NewPostId   as string | null) ?? null,
    campaignId: (output.CampaignId  as string | null) ?? null,
    errorCode:  (output.ErrorCode   as string | null) ?? null,
  }
}

export async function sp_MarkPostRead(params: {
  postId: string
  userId: string
}): Promise<void> {
  await exec('app', 'sp_MarkPostRead', (r) => {
    r.input('PostId', sql.UniqueIdentifier, params.postId)
    r.input('UserId', sql.UniqueIdentifier, params.userId)
  })
}

export interface PostReadStats {
  totalEligible:      number
  totalRead:          number
  readThroughRatePct: number
}

export async function sp_GetPostReadStats(params: {
  postId:             string
  requestingUserId:   string
  requestingUserRole: string
}): Promise<{ stats: PostReadStats | null; errorCode: string | null }> {
  const { recordset, output } = await execFull('app', 'sp_GetPostReadStats', (r) => {
    r.input ('PostId',              sql.UniqueIdentifier, params.postId)
    r.output('ErrorCode',           sql.NVarChar(50))
    r.input ('RequestingUserId',    sql.UniqueIdentifier, params.requestingUserId)
    r.input ('RequestingUserRole',  sql.NVarChar(50),     params.requestingUserRole)
  })
  const rows = recordset as unknown as PostReadStats[]
  return {
    stats:     rows?.[0] ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

/**
 * Dispatches an outreach campaign (queues messages for all eligible recipients).
 * Maps to dbo.sp_DispatchEmailCampaign.
 * dailyRemaining / monthlyRemaining default to high values — enforce limits
 * at the application layer if needed.
 */
export async function sp_DispatchCampaign(params: {
  campaignId:       string
  dispatchedBy:     string
  dailyRemaining?:  number
  monthlyRemaining?: number
}): Promise<{ queuedCount: number; errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_DispatchEmailCampaign', (r) => {
    r.input ('CampaignId',        sql.UniqueIdentifier, params.campaignId)
    r.input ('DailyRemaining',    sql.Int,              params.dailyRemaining  ?? 10000)
    r.input ('MonthlyRemaining',  sql.Int,              params.monthlyRemaining ?? 100000)
    r.output('QueuedCount',       sql.Int)
    r.output('ErrorCode',         sql.NVarChar(50))
    r.input ('RequestingUserId',  sql.UniqueIdentifier, params.dispatchedBy)
    r.input ('RequestingUserRole', sql.NVarChar(50),    'platform_owner')
  })
  return {
    queuedCount: (output.QueuedCount as number) ?? 0,
    errorCode:   (output.ErrorCode   as string | null) ?? null,
  }
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export interface AlumniDashboardMetrics {
  totalInteractions:      number
  monthInteractions:      number
  totalEmailsSent:        number
  monthEmailsSent:        number
  alumniLoginsLast30Days: number
  emailOpenRatePct:       number
}

export async function sp_GetDashboardMetrics_Alumni(params: {
  tenantId?:          string
  requestingUserId:   string
  requestingUserRole: string
}): Promise<AlumniDashboardMetrics> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetDashboardMetrics_Alumni', (r) => {
    r.input('TenantId',           sql.UniqueIdentifier, params.tenantId          ?? null)
    r.input('RequestingUserId',   sql.UniqueIdentifier, params.requestingUserId)
    r.input('RequestingUserRole', sql.NVarChar(50),     params.requestingUserRole)
  })
  const row = rows[0] ?? {}
  return {
    totalInteractions:      (row.totalInteractions      as number) ?? 0,
    monthInteractions:      (row.monthInteractions       as number) ?? 0,
    totalEmailsSent:        (row.totalEmailsSent         as number) ?? 0,
    monthEmailsSent:        (row.monthEmailsSent         as number) ?? 0,
    alumniLoginsLast30Days: (row.alumniLoginsLast30Days  as number) ?? 0,
    emailOpenRatePct:       (row.emailOpenRatePct        as number) ?? 0,
  }
}

export interface PlayerDashboardMetrics {
  totalEmailsSent: number
  monthEmailsSent: number
  totalFeedPosts:  number
  monthFeedPosts:  number
}

export async function sp_GetDashboardMetrics_Players(params: {
  tenantId?:          string
  requestingUserId:   string
  requestingUserRole: string
}): Promise<PlayerDashboardMetrics> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetDashboardMetrics_Players', (r) => {
    r.input('TenantId',           sql.UniqueIdentifier, params.tenantId          ?? null)
    r.input('RequestingUserId',   sql.UniqueIdentifier, params.requestingUserId)
    r.input('RequestingUserRole', sql.NVarChar(50),     params.requestingUserRole)
  })
  const row = rows[0] ?? {}
  return {
    totalEmailsSent: (row.totalEmailsSent as number) ?? 0,
    monthEmailsSent: (row.monthEmailsSent as number) ?? 0,
    totalFeedPosts:  (row.totalFeedPosts  as number) ?? 0,
    monthFeedPosts:  (row.monthFeedPosts  as number) ?? 0,
  }
}
