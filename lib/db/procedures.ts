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
// Schema baseline: post-migration 008 + 009
//   dbo.players and dbo.alumni are DROPPED.
//   Everyone is a row in dbo.users (synced from Global) with one or more
//   rows in dbo.users_roles (user_id × sport_id × program_role_id × status).
//   status = 'current_player' | 'alumni' | 'removed'
//   dbo.sports.id is INT (Football = 1) — no more GUIDs.

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
  teamId:    number
}): Promise<{ userId: number | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_GetOrCreateUser', (r) => {
    r.input ('Email',     sql.NVarChar(255), params.email)
    r.input ('FirstName', sql.NVarChar(100), params.firstName)
    r.input ('LastName',  sql.NVarChar(100), params.lastName)
    r.input ('TeamId',    sql.Int,           params.teamId)
    r.output('UserId',    sql.BigInt)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    userId:    (output.UserId    as number | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

/**
 * Revokes the user's 'roster' app-permission in the Global DB and grants
 * 'alumni' in its place.
 */
export async function sp_TransferPlayerToAlumni(params: {
  userId:    number
  grantedBy: number
}): Promise<void> {
  await execFull('global', 'sp_TransferPlayerToAlumni', (r) => {
    r.input('UserId',    sql.BigInt, params.userId)
    r.input('GrantedBy', sql.BigInt, params.grantedBy)
  })
}

// ─── Team config row returned by sp_GetTeamConfig / sp_GetTeams ───────────────
export type TeamConfigRow = Record<string, unknown>

/** Returns config for a specific team (or the default team if teamId is omitted). */
export async function sp_GetTeamConfig(params?: { teamId?: number }): Promise<TeamConfigRow | null> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('global', 'sp_GetTeamConfig', (r) => {
    r.input('TeamId', sql.Int, params?.teamId ?? null)
  })
  return (rows as unknown as TeamConfigRow[])[0] ?? null
}

/** Returns all active teams. */
export async function sp_GetTeams(): Promise<TeamConfigRow[]> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('global', 'sp_GetTeams')
  return rows as unknown as TeamConfigRow[]
}

/** Returns the teams a specific user has access to. */
export async function sp_GetUserTeams(params: {
  userId: number
}): Promise<TeamConfigRow[]> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('global', 'sp_GetUserTeams', (r) => {
    r.input('UserId', sql.BigInt, params.userId)
  })
  return rows as unknown as TeamConfigRow[]
}

/**
 * Validates user access to the new team and returns team details for
 * re-issuing the JWT.
 */
export async function sp_SwitchTeam(params: {
  userId:    number
  newTeamId: number
}): Promise<{ teamJson: string | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_SwitchTeam', (r) => {
    r.input ('UserId',    sql.BigInt, params.userId)
    r.input ('NewTeamId', sql.Int,    params.newTeamId)
    r.output('TeamJson',  sql.NVarChar(sql.MAX))
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    teamJson:  (output.TeamJson  as string | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_UpdateTeamConfig(params: {
  teamId?:            number | null
  teamName?:          string | null
  teamAbbr?:          string | null
  sport?:             string | null
  level?:             string | null
  logoUrl?:           string | null
  colorPrimary?:      string | null
  colorPrimaryDark?:  string | null
  colorPrimaryLight?: string | null
  colorAccent?:       string | null
  colorAccentDark?:   string | null
  colorAccentLight?:  string | null
  positionsJson?:     string | null
  academicYearsJson?: string | null
  alumniLabel?:       string | null
  rosterLabel?:       string | null
  classLabel?:        string | null
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_UpdateTeamConfig', (r) => {
    r.input ('TeamId',            sql.Int,               params.teamId            ?? null)
    r.input ('TeamName',          sql.NVarChar(100),     params.teamName          ?? null)
    r.input ('TeamAbbr',          sql.NVarChar(10),      params.teamAbbr          ?? null)
    r.input ('Sport',             sql.NVarChar(50),      params.sport             ?? null)
    r.input ('Level',             sql.NVarChar(20),      params.level             ?? null)
    r.input ('LogoUrl',           sql.NVarChar(500),     params.logoUrl           ?? null)
    r.input ('ColorPrimary',      sql.NVarChar(7),       params.colorPrimary      ?? null)
    r.input ('ColorPrimaryDark',  sql.NVarChar(7),       params.colorPrimaryDark  ?? null)
    r.input ('ColorPrimaryLight', sql.NVarChar(7),       params.colorPrimaryLight ?? null)
    r.input ('ColorAccent',       sql.NVarChar(7),       params.colorAccent       ?? null)
    r.input ('ColorAccentDark',   sql.NVarChar(7),       params.colorAccentDark   ?? null)
    r.input ('ColorAccentLight',  sql.NVarChar(7),       params.colorAccentLight  ?? null)
    r.input ('PositionsJson',     sql.NVarChar(sql.MAX), params.positionsJson     ?? null)
    r.input ('AcademicYearsJson', sql.NVarChar(sql.MAX), params.academicYearsJson ?? null)
    r.input ('AlumniLabel',       sql.NVarChar(50),      params.alumniLabel       ?? null)
    r.input ('RosterLabel',       sql.NVarChar(50),      params.rosterLabel       ?? null)
    r.input ('ClassLabel',        sql.NVarChar(50),      params.classLabel        ?? null)
    r.output('ErrorCode',         sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

// ─── App DB — User sync ───────────────────────────────────────────────────────

/**
 * Syncs a Global DB user into the local App DB dbo.users.
 * Call this before sp_AddUserRole when creating a new member.
 */
export async function sp_UpsertUser(params: {
  userId:       number
  email:        string
  firstName:    string
  lastName:     string
  platformRole?: string
}): Promise<void> {
  await exec('app', 'sp_UpsertUser', (r) => {
    r.input('UserId',       sql.Int,           params.userId)
    r.input('Email',        sql.NVarChar(255),  params.email)
    r.input('FirstName',    sql.NVarChar(100),  params.firstName)
    r.input('LastName',     sql.NVarChar(100),  params.lastName)
    r.input('PlatformRole', sql.NVarChar(50),   params.platformRole ?? 'player')
  })
}

// ─── App DB — Roster / Users Roles ───────────────────────────────────────────

export interface RosterRow {
  userRoleId:   number
  userId:       number
  firstName:    string
  lastName:     string
  email:        string
  sportId:      number
  sportName:    string
  positionId:   number | null
  position:     string | null
  jerseyNumber: number | null
  seasonsPlayed: number | null
  classYear:    number | null
  createdAt:    string
  updatedAt:    string
}

/**
 * Returns paginated current roster for a sport.
 * Replaces the old sp_GetPlayers function.
 */
export async function sp_GetRoster(params: {
  sportId?:    number | null
  search?:     string
  positionId?: number
  classYear?:  number
  page?:       number
  pageSize?:   number
}): Promise<{ roster: RosterRow[]; totalCount: number }> {
  const { recordset, output } = await execFull('app', 'sp_GetRosterBySport', (r) => {
    r.input ('SportId',    sql.Int,           params.sportId ?? null)
    r.input ('Search',     sql.NVarChar(255),  params.search      ?? null)
    r.input ('PositionId', sql.Int,           params.positionId  ?? null)
    r.input ('ClassYear',  sql.SmallInt,      params.classYear   ?? null)
    r.input ('Page',       sql.Int,           params.page     ?? 1)
    r.input ('PageSize',   sql.Int,           params.pageSize ?? 50)
    r.output('TotalCount', sql.Int)
  })
  return {
    roster:     recordset as unknown as RosterRow[],
    totalCount: (output.TotalCount as number) ?? 0,
  }
}

/**
 * Returns paginated alumni for a sport.
 * Replaces the old sp_GetAlumni function.
 */
export async function sp_GetAlumniRoster(params: {
  sportId?:    number | null
  search?:     string
  positionId?: number
  classYear?:  number
  page?:       number
  pageSize?:   number
}): Promise<{ alumni: RosterRow[]; totalCount: number }> {
  const { recordset, output } = await execFull('app', 'sp_GetAlumniBySport', (r) => {
    r.input ('SportId',    sql.Int,           params.sportId ?? null)
    r.input ('Search',     sql.NVarChar(255),  params.search      ?? null)
    r.input ('PositionId', sql.Int,           params.positionId  ?? null)
    r.input ('ClassYear',  sql.SmallInt,      params.classYear   ?? null)
    r.input ('Page',       sql.Int,           params.page     ?? 1)
    r.input ('PageSize',   sql.Int,           params.pageSize ?? 50)
    r.output('TotalCount', sql.Int)
  })
  return {
    alumni:     recordset as unknown as RosterRow[],
    totalCount: (output.TotalCount as number) ?? 0,
  }
}

export interface MemberDetailsRow {
  userId:            number
  email:             string
  firstName:         string
  lastName:          string
  platformRole:      string
  lastTeamLogin:     string | null
  userRoleId:        number | null
  sportId:           number | null
  sportName:         string | null
  sportAbbr:         string | null
  programRoleId:     number | null
  programRoleDisplay: string | null
  status:            string | null
  positionId:        number | null
  position:          string | null
  jerseyNumber:      number | null
  seasonsPlayed:     number | null
  classYear:         number | null
  createdAt:         string | null
  updatedAt:         string | null
}

export interface InteractionRow {
  id:            number
  channel:       string
  summary:       string
  outcome:       string | null
  followUpAt:    string | null
  loggedAt:      string
  loggedByUserId: number | null
  loggedByName:  string | null
}

/**
 * Returns a user's profile + all role records + recent interactions.
 * Two result sets: [0] roles (one row per users_roles entry), [1] interactions.
 * Replaces sp_GetPlayerById and sp_GetAlumniById.
 */
export async function sp_GetMemberDetails(params: {
  userId: number
}): Promise<{
  roles:        MemberDetailsRow[]
  interactions: InteractionRow[]
  errorCode:    string | null
}> {
  const { recordsets, output } = await execFull('app', 'sp_GetMemberDetails', (r) => {
    r.input ('UserId',    sql.Int,          params.userId)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    roles:        (recordsets[0] ?? []) as unknown as MemberDetailsRow[],
    interactions: (recordsets[1] ?? []) as unknown as InteractionRow[],
    errorCode:    (output.ErrorCode as string | null) ?? null,
  }
}

/**
 * Adds a new users_roles record for a user (adds them to a sport roster).
 * Replaces sp_CreatePlayer / sp_BulkCreatePlayers for the App DB step.
 * Caller must first call sp_UpsertUser + sp_GetOrCreateUser (Global DB).
 */
export async function sp_AddUserRole(params: {
  userId:        number
  programRoleId: number
  sportId?:      number | null
  status?:       'current_player' | 'alumni' | 'removed'
  positionId?:   number | null
  jerseyNumber?: number | null
  seasonsPlayed?: number | null
  classYear?:    number | null
  adminUserId:   number
}): Promise<{ newUserRoleId: number | null; errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_AddUserRole', (r) => {
    r.input ('UserId',        sql.Int,          params.userId)
    r.input ('ProgramRoleId', sql.Int,          params.programRoleId)
    r.input ('SportId',       sql.Int,          params.sportId       ?? null)
    r.input ('Status',        sql.NVarChar(20), params.status        ?? 'current_player')
    r.input ('PositionId',    sql.Int,          params.positionId    ?? null)
    r.input ('JerseyNumber',  sql.TinyInt,      params.jerseyNumber  ?? null)
    r.input ('SeasonsPlayed', sql.TinyInt,      params.seasonsPlayed ?? null)
    r.input ('ClassYear',     sql.SmallInt,     params.classYear     ?? null)
    r.input ('AdminUserId',   sql.Int,          params.adminUserId)
    r.output('NewUserRoleId', sql.Int)
    r.output('ErrorCode',     sql.NVarChar(50))
  })
  return {
    newUserRoleId: (output.NewUserRoleId as number | null) ?? null,
    errorCode:     (output.ErrorCode     as string | null) ?? null,
  }
}

/**
 * Updates mutable fields on a users_roles record.
 * Pass only the fields you want to change — null/undefined = no change.
 * Replaces sp_UpdatePlayer and sp_UpdateAlumni.
 */
export async function sp_UpdateUserRole(params: {
  userRoleId:    number
  positionId?:   number | null
  jerseyNumber?: number | null
  seasonsPlayed?: number | null
  classYear?:    number | null
  adminUserId:   number
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_UpdateUserRole', (r) => {
    r.input ('UserRoleId',   sql.Int,      params.userRoleId)
    r.input ('PositionId',   sql.Int,      params.positionId    ?? null)
    r.input ('JerseyNumber', sql.TinyInt,  params.jerseyNumber  ?? null)
    r.input ('SeasonsPlayed',sql.TinyInt,  params.seasonsPlayed ?? null)
    r.input ('ClassYear',    sql.SmallInt, params.classYear     ?? null)
    r.input ('AdminUserId',  sql.Int,      params.adminUserId)
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

/**
 * Transitions a users_roles record's status (e.g. current_player → alumni).
 * Logs the change to dbo.role_transfer_log.
 * Replaces sp_GraduatePlayer and sp_RemovePlayer.
 */
export async function sp_TransferUserRole(params: {
  userRoleId:         number
  newStatus:          'current_player' | 'alumni' | 'removed'
  seasonsPlayed?:     number | null
  classYear?:         number | null
  adminUserId:        number
  adminAcknowledged?: boolean
  notes?:             string | null
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_TransferUserRole', (r) => {
    r.input ('UserRoleId',        sql.Int,           params.userRoleId)
    r.input ('NewStatus',         sql.NVarChar(20),  params.newStatus)
    r.input ('SeasonsPlayed',     sql.TinyInt,       params.seasonsPlayed     ?? null)
    r.input ('ClassYear',         sql.SmallInt,      params.classYear         ?? null)
    r.input ('AdminUserId',       sql.Int,           params.adminUserId)
    r.input ('AdminAcknowledged', sql.Bit,           params.adminAcknowledged ? 1 : 0)
    r.input ('Notes',             sql.NVarChar(sql.MAX), params.notes         ?? null)
    r.output('ErrorCode',         sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

/** Summary stats: total current players, alumni, earliest / latest class year. */
export async function sp_GetRosterStats(params: {
  sportId?: number | null
}): Promise<{
  totalCurrentPlayers: number
  totalAlumni:         number
  earliestClass:       number | null
  latestClass:         number | null
}> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetRosterStats', (r) => {
    r.input('SportId', sql.Int, params.sportId ?? null)
  })
  const row = rows[0] ?? {}
  return {
    totalCurrentPlayers: (row.totalCurrentPlayers as number) ?? 0,
    totalAlumni:         (row.totalAlumni         as number) ?? 0,
    earliestClass:       (row.earliestClass        as number | null) ?? null,
    latestClass:         (row.latestClass          as number | null) ?? null,
  }
}

// ─── App DB — Interactions ────────────────────────────────────────────────────

/**
 * Logs a staff interaction with a user (player or alumni).
 * @UserId is dbo.users.user_id (not alumni_id — that column is gone).
 */
export async function sp_LogInteraction(params: {
  userId:     number
  loggedBy:   number
  channel:    string
  summary:    string
  outcome?:   string | null
  followUpAt?: string | null
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_LogInteraction', (r) => {
    r.input ('UserId',    sql.Int,               params.userId)
    r.input ('LoggedBy',  sql.Int,               params.loggedBy)
    r.input ('Channel',   sql.NVarChar(30),      params.channel)
    r.input ('Summary',   sql.NVarChar(sql.MAX), params.summary)
    r.input ('Outcome',   sql.NVarChar(50),      params.outcome    ?? null)
    r.input ('FollowUpAt',sql.DateTime2,         params.followUpAt ?? null)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

/** Returns paginated interaction history for a user. */
export async function sp_GetInteractionsByUser(params: {
  userId:   number
  page?:    number
  pageSize?: number
}): Promise<InteractionRow[]> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetInteractionsByUser', (r) => {
    r.input('UserId',   sql.Int, params.userId)
    r.input('Page',     sql.Int, params.page     ?? 1)
    r.input('PageSize', sql.Int, params.pageSize ?? 20)
  })
  return rows as unknown as InteractionRow[]
}

// ─── App DB — Sports ──────────────────────────────────────────────────────────

export interface SportOption {
  id:   number   // INT (Football = 1) — was string/GUID before migration 008
  name: string
  abbr: string
}

export interface PositionOption {
  positionId:   number
  sportId:      number
  sportName:    string
  positionName: string
  positionAbbr: string | null
  isActive:     boolean
}

/** Returns all active sports for this App DB. */
export async function sp_GetSports(): Promise<SportOption[]> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetSports')
  return rows.map(r => ({
    id:   r.id   as number,
    name: r.name as string,
    abbr: r.abbr as string,
  }))
}

/** Returns positions for a given sport (or all sports if sportId is null). */
export async function sp_GetSportsPositions(params: {
  sportId?: number | null
}): Promise<PositionOption[]> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetSportsPositions', (r) => {
    r.input('SportId', sql.Int, params.sportId ?? null)
  })
  return rows.map(r => ({
    positionId:   r.positionId   as number,
    sportId:      r.sportId      as number,
    sportName:    r.sportName    as string,
    positionName: r.positionName as string,
    positionAbbr: r.positionAbbr as string | null,
    isActive:     Boolean(r.isActive),
  }))
}

/**
 * Returns sports for a user (or all sports if userId is null, i.e. admin/platform_owner).
 * @TenantId is accepted for convention but unused (single-tenant App DB).
 */
export async function sp_GetUserSports(params: {
  tenantId: number
  userId?:  number | null
}): Promise<SportOption[]> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetUserSports', (r) => {
    r.input('TenantId', sql.Int, params.tenantId)
    r.input('UserId',   sql.Int, params.userId ?? null)
  })
  return rows.map(r => ({
    id:   r.id   as number,
    name: r.name as string,
    abbr: r.abbr as string,
  }))
}

export interface SportAdminOption {
  id:       number
  name:     string
  abbr:     string
  isActive: boolean
}

/** Returns ALL sports (active and inactive) for the admin settings panel. */
export async function sp_GetAllSports(): Promise<SportAdminOption[]> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetAllSports')
  return rows.map(r => ({
    id:       r.id       as number,
    name:     r.name     as string,
    abbr:     r.abbr     as string,
    isActive: Boolean(r.isActive),
  }))
}

/** Toggles is_active on a sport. Returns rowsAffected. */
export async function sp_SetSportActive(params: {
  sportId:  number
  isActive: boolean
}): Promise<number> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_SetSportActive', (r) => {
    r.input('SportId',  sql.Int, params.sportId)
    r.input('IsActive', sql.Bit, params.isActive ? 1 : 0)
  })
  return (rows[0]?.rowsAffected as number) ?? 0
}

/** Inserts a new sport. Returns { newId, errorCode }. */
export async function sp_AddSport(params: {
  name:     string
  abbr:     string
  isActive?: boolean
}): Promise<{ newId: number; errorCode: string | null }> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_AddSport', (r) => {
    r.input('Name',     sql.NVarChar(100), params.name)
    r.input('Abbr',     sql.NVarChar(10),  params.abbr)
    r.input('IsActive', sql.Bit,           params.isActive !== false ? 1 : 0)
  })
  return {
    newId:     rows[0]?.newId     as number,
    errorCode: rows[0]?.errorCode as string | null,
  }
}

/** Inserts a new position for a sport. Returns { newId, errorCode }. */
export async function sp_AddSportsPosition(params: {
  sportId:      number
  positionName: string
  abbreviation: string
}): Promise<{ newId: number; errorCode: string | null }> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_AddSportsPosition', (r) => {
    r.input('SportId',      sql.Int,          params.sportId)
    r.input('PositionName', sql.NVarChar(100), params.positionName)
    r.input('Abbreviation', sql.NVarChar(10),  params.abbreviation)
  })
  return {
    newId:     rows[0]?.newId     as number,
    errorCode: rows[0]?.errorCode as string | null,
  }
}

/** Updates an existing position. NULL params = keep existing value. */
export async function sp_UpdateSportsPosition(params: {
  positionId:    number
  positionName?: string | null
  abbreviation?: string | null
  isActive?:     boolean | null
}): Promise<number> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_UpdateSportsPosition', (r) => {
    r.input('PositionId',   sql.Int,          params.positionId)
    r.input('PositionName', sql.NVarChar(100), params.positionName ?? null)
    r.input('Abbreviation', sql.NVarChar(10),  params.abbreviation ?? null)
    r.input('IsActive',     sql.Bit,           params.isActive != null ? (params.isActive ? 1 : 0) : null)
  })
  return (rows[0]?.rowsAffected as number) ?? 0
}

/** Hard-deletes a position by positionId. Returns rowsAffected. */
export async function sp_DeleteSportsPosition(params: {
  positionId: number
}): Promise<number> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_DeleteSportsPosition', (r) => {
    r.input('PositionId', sql.Int, params.positionId)
  })
  return (rows[0]?.rowsAffected as number) ?? 0
}

// ─── App DB — Campaigns ───────────────────────────────────────────────────────

export async function sp_CreateCampaign(params: {
  name:             string
  createdBy:        number
  targetAudience:   string
  description?:     string | null
  audienceFilters?: string | null
  scheduledAt?:     string | null
  subjectLine?:     string | null
  bodyHtml?:        string | null
  fromName?:        string | null
  replyToEmail?:    string | null
  physicalAddress?: string | null
  sportId?:         number | null   // INT — was UNIQUEIDENTIFIER before migration 009
}): Promise<{ campaignId: string | null; errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_CreateCampaign', (r) => {
    r.input ('Name',            sql.NVarChar(200),    params.name)
    r.input ('CreatedBy',       sql.Int,              params.createdBy)
    r.input ('TargetAudience',  sql.NVarChar(30),     params.targetAudience)
    r.input ('Description',     sql.NVarChar(sql.MAX),params.description     ?? null)
    r.input ('AudienceFilters', sql.NVarChar(sql.MAX),params.audienceFilters ?? null)
    r.input ('ScheduledAt',     sql.DateTime2,        params.scheduledAt     ?? null)
    r.input ('SubjectLine',     sql.NVarChar(500),    params.subjectLine     ?? null)
    r.input ('BodyHtml',        sql.NVarChar(sql.MAX),params.bodyHtml        ?? null)
    r.input ('FromName',        sql.NVarChar(200),    params.fromName        ?? null)
    r.input ('ReplyToEmail',    sql.NVarChar(255),    params.replyToEmail    ?? null)
    r.input ('PhysicalAddress', sql.NVarChar(500),    params.physicalAddress ?? null)
    r.input ('SportId',         sql.Int,              params.sportId         ?? null)
    r.output('NewCampaignId',   sql.UniqueIdentifier)
    r.output('ErrorCode',       sql.NVarChar(50))
  })
  return {
    campaignId: (output.NewCampaignId as string | null) ?? null,
    errorCode:  (output.ErrorCode     as string | null) ?? null,
  }
}

export async function sp_GetCampaigns(params: {
  sportId?: number | null   // INT — was UNIQUEIDENTIFIER
} = {}) {
  return exec('app', 'sp_GetCampaigns', (r) => {
    r.input('SportId', sql.Int, params.sportId ?? null)
  })
}

/**
 * Dispatches an outreach campaign (queues messages for all eligible recipients).
 */
export interface CampaignHeader {
  subjectLine:     string | null
  bodyHtml:        string | null
  fromName:        string | null
  replyToEmail:    string | null
  physicalAddress: string | null
  campaignName:    string | null
}

export interface CampaignRecipient {
  messageId:        string   // DB UUID — pass to sp_MarkEmailSent
  userId:           number
  firstName:        string | null
  emailAddress:     string
  unsubscribeToken: string   // UUID
}

export async function sp_DispatchCampaign(params: {
  campaignId:        string
  dispatchedBy:      number
  dailyRemaining?:   number
  monthlyRemaining?: number
}): Promise<{
  queuedCount:  number
  errorCode:    string | null
  header:       CampaignHeader | null
  recipients:   CampaignRecipient[]
}> {
  const { recordsets, output } = await execFull('app', 'sp_DispatchEmailCampaign', (r) => {
    r.input ('CampaignId',       sql.UniqueIdentifier, params.campaignId)
    r.input ('DailyRemaining',   sql.Int,              params.dailyRemaining   ?? 10000)
    r.input ('MonthlyRemaining', sql.Int,              params.monthlyRemaining ?? 100000)
    r.output('QueuedCount',      sql.Int)
    r.output('ErrorCode',        sql.NVarChar(50))
  })

  // recordsets[0] = campaign header (1 row); recordsets[1] = recipients
  const headerRows  = (recordsets?.[0] ?? []) as Record<string, unknown>[]
  const recipientRows = (recordsets?.[1] ?? []) as Record<string, unknown>[]

  const h = headerRows[0] ?? null
  const header: CampaignHeader | null = h ? {
    subjectLine:     (h.subjectLine     as string | null) ?? null,
    bodyHtml:        (h.bodyHtml        as string | null) ?? null,
    fromName:        (h.fromName        as string | null) ?? null,
    replyToEmail:    (h.replyToEmail    as string | null) ?? null,
    physicalAddress: (h.physicalAddress as string | null) ?? null,
    campaignName:    (h.campaignName    as string | null) ?? null,
  } : null

  const recipients: CampaignRecipient[] = recipientRows.map(r => ({
    messageId:        String(r.messageId ?? ''),
    userId:           (r.userId as number) ?? 0,
    firstName:        (r.firstName as string | null) ?? null,
    emailAddress:     String(r.emailAddress ?? ''),
    unsubscribeToken: String(r.unsubscribeToken ?? ''),
  }))

  return {
    queuedCount: (output.QueuedCount as number) ?? 0,
    errorCode:   (output.ErrorCode   as string | null) ?? null,
    header,
    recipients,
  }
}

// ─── sp_MarkEmailSent ─────────────────────────────────────────────────────────

export async function sp_MarkEmailSent(params: {
  messages: Array<{ messageId: string; resendId: string }>
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_MarkEmailSent', (r) => {
    r.input ('MessagesJson', sql.NVarChar(sql.MAX), JSON.stringify(params.messages))
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

// ─── sp_MarkEmailOpened ───────────────────────────────────────────────────────

export async function sp_MarkEmailOpened(params: {
  resendId: string   // Resend message ID from webhook event data.email_id
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_MarkEmailOpened', (r) => {
    r.input ('ResendId',  sql.NVarChar(100), params.resendId)
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
  sportId:       number | null   // INT — was UNIQUEIDENTIFIER before migration 009
  sportName:     string | null
  isPinned:      boolean
  isWelcomePost: boolean
  imageUrl:      string | null
  campaignId:    string | null
  createdBy:     number
  createdByName: string
  publishedAt:   string
  createdAt:     string
  updatedAt:     string | null
  isRead:        boolean
  likeCount:     number
  userHasLiked:  boolean
}

export async function sp_GetFeed(params: {
  viewerUserId: number
  mySport?:     boolean
  page:         number
  pageSize:     number
  tierGroup?:   string | null
  roleGroup?:   string | null
}): Promise<{ posts: FeedPostRow[]; totalCount: number }> {
  const { recordset, output } = await execFull('app', 'sp_GetFeed', (r) => {
    r.input ('ViewerUserId', sql.Int,          params.viewerUserId)
    r.input ('MySport',      sql.Bit,          params.mySport ? 1 : 0)
    r.input ('Page',         sql.Int,          params.page)
    r.input ('PageSize',     sql.Int,          params.pageSize)
    r.input ('TierGroup',    sql.NVarChar(20), params.tierGroup ?? null)
    r.input ('RoleGroup',    sql.NVarChar(20), params.roleGroup ?? null)
    r.output('TotalCount',   sql.Int)
  })
  return {
    posts:      (recordset as unknown as FeedPostRow[]) ?? [],
    totalCount: (output.TotalCount as number) ?? 0,
  }
}

export async function sp_GetFeedPost(params: {
  postId:       string
  viewerUserId: number
}): Promise<{ post: FeedPostRow | null; errorCode: string | null }> {
  const { recordset, output } = await execFull('app', 'sp_GetFeedPost', (r) => {
    r.input ('PostId',       sql.UniqueIdentifier, params.postId)
    r.input ('ViewerUserId', sql.Int,              params.viewerUserId)
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  const rows = recordset as unknown as FeedPostRow[]
  return {
    post:      rows?.[0] ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_CreatePost(params: {
  createdBy:     number
  bodyHtml:      string
  audience:      string
  title?:        string | null
  audienceJson?: string | null
  sportId?:      number | null   // INT
  isPinned:      boolean
  alsoEmail:     boolean
  emailSubject?: string | null
  posterRole?:   string | null   // JWT global role — used for alumni sport validation
}): Promise<{ postId: string | null; campaignId: string | null; errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_CreatePost', (r) => {
    r.input ('CreatedBy',   sql.Int,               params.createdBy)
    r.input ('BodyHtml',    sql.NVarChar(sql.MAX),  params.bodyHtml)
    r.input ('Audience',    sql.NVarChar(30),       params.audience)
    r.input ('Title',       sql.NVarChar(300),      params.title        ?? null)
    r.input ('AudienceJson',sql.NVarChar(sql.MAX),  params.audienceJson ?? null)
    r.input ('SportId',     sql.Int,                params.sportId      ?? null)
    r.input ('IsPinned',    sql.Bit,                params.isPinned ? 1 : 0)
    r.input ('AlsoEmail',   sql.Bit,                params.alsoEmail ? 1 : 0)
    r.input ('EmailSubject',sql.NVarChar(500),      params.emailSubject ?? null)
    r.input ('PosterRole',  sql.NVarChar(50),       params.posterRole   ?? null)
    r.output('NewPostId',   sql.UniqueIdentifier)
    r.output('CampaignId',  sql.UniqueIdentifier)
    r.output('ErrorCode',   sql.NVarChar(50))
  })
  return {
    postId:     (output.NewPostId   as string | null) ?? null,
    campaignId: (output.CampaignId  as string | null) ?? null,
    errorCode:  (output.ErrorCode   as string | null) ?? null,
  }
}

export async function sp_MarkPostRead(params: {
  postId: string
  userId: number
}): Promise<void> {
  await exec('app', 'sp_MarkPostRead', (r) => {
    r.input('PostId', sql.UniqueIdentifier, params.postId)
    r.input('UserId', sql.Int,              params.userId)
  })
}

export interface PostReadStats {
  totalEligible: number
  totalRead:     number
  readRatePct:   number
}

export async function sp_GetPostReadStats(params: {
  postId: string
}): Promise<{ stats: PostReadStats | null; errorCode: string | null }> {
  const { recordset, output } = await execFull('app', 'sp_GetPostReadStats', (r) => {
    r.input ('PostId',    sql.UniqueIdentifier, params.postId)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  const rows = recordset as unknown as PostReadStats[]
  return {
    stats:     rows?.[0] ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_TogglePostLike(params: {
  postId: string
  userId: number
}): Promise<{ liked: boolean; likeCount: number; errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_TogglePostLike', (r) => {
    r.input ('PostId',    sql.UniqueIdentifier, params.postId)
    r.input ('UserId',    sql.Int,              params.userId)
    r.output('Liked',     sql.Bit)
    r.output('LikeCount', sql.Int)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    liked:     Boolean(output.Liked),
    likeCount: (output.LikeCount as number) ?? 0,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_SoftDeletePost(params: {
  postId:       string
  userId:       number
  canDeleteAny: boolean
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_SoftDeletePost', (r) => {
    r.input ('PostId',       sql.UniqueIdentifier, params.postId)
    r.input ('UserId',       sql.Int,              params.userId)
    r.input ('CanDeleteAny', sql.Bit,              params.canDeleteAny ? 1 : 0)
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

export async function sp_EditPost(params: {
  postId:   string
  userId:   number
  bodyHtml: string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_EditPost', (r) => {
    r.input ('PostId',    sql.UniqueIdentifier,  params.postId)
    r.input ('UserId',    sql.Int,               params.userId)
    r.input ('BodyHtml',  sql.NVarChar(sql.MAX), params.bodyHtml)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

export async function sp_PinPost(params: {
  postId: string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('app', 'sp_PinPost', (r) => {
    r.input ('PostId',    sql.UniqueIdentifier, params.postId)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

export interface UserSportAssociation {
  sportId:   number
  sportName: string
  sportAbbr: string
}

export async function sp_GetUserSportAssociations(params: {
  userId: number
}): Promise<UserSportAssociation[]> {
  const { recordset } = await execFull('app', 'sp_GetUserSportAssociations', (r) => {
    r.input('UserId', sql.Int, params.userId)
  })
  return (recordset as unknown as UserSportAssociation[]) ?? []
}

// ─── User Program Role ────────────────────────────────────────────────────────

export interface UserProgramRole {
  programRoleId: number
  roleName:      string
  displayName:   string
}

export async function sp_GetUserProgramRole(params: {
  userId: number
}): Promise<UserProgramRole | null> {
  const { recordset } = await execFull('app', 'sp_GetUserProgramRole', (r) => {
    r.input('UserId', sql.Int, params.userId)
  })
  return (recordset as unknown as UserProgramRole[])[0] ?? null
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export interface AlumniDashboardMetrics {
  totalInteractions:      number
  monthInteractions:      number
  totalEmailsSent:        number
  monthEmailsSent:        number
  alumniLoginsLast30Days: number
  totalFeedPosts:         number
  monthFeedPosts:         number
  emailOpenRatePct:       number   // populated via Resend open-tracking webhook
}

export async function sp_GetDashboardMetrics_Alumni(params: {
  tenantId: number
  sportId?: number | null   // INT — was UNIQUEIDENTIFIER
}): Promise<AlumniDashboardMetrics> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetDashboardMetrics_Alumni', (r) => {
    r.input('TenantId', sql.Int, params.tenantId)
    r.input('SportId',  sql.Int, params.sportId ?? null)
  })
  const row = rows[0] ?? {}
  return {
    totalInteractions:      (row.totalInteractions      as number) ?? 0,
    monthInteractions:      (row.monthInteractions      as number) ?? 0,
    totalEmailsSent:        (row.totalEmailsSent        as number) ?? 0,
    monthEmailsSent:        (row.monthEmailsSent        as number) ?? 0,
    alumniLoginsLast30Days: (row.alumniLoginsLast30Days as number) ?? 0,
    totalFeedPosts:         (row.totalFeedPosts         as number) ?? 0,
    monthFeedPosts:         (row.monthFeedPosts         as number) ?? 0,
    emailOpenRatePct:       (row.emailOpenRatePct       as number) ?? 0,
  }
}

export interface PlayerDashboardMetrics {
  totalEmailsSent: number
  monthEmailsSent: number
  totalFeedPosts:  number
  monthFeedPosts:  number
}

export async function sp_GetDashboardMetrics_Players(params: {
  tenantId: number
  sportId?: number | null   // INT
}): Promise<PlayerDashboardMetrics> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetDashboardMetrics_Players', (r) => {
    r.input('TenantId', sql.Int, params.tenantId)
    r.input('SportId',  sql.Int, params.sportId ?? null)
  })
  const row = rows[0] ?? {}
  return {
    totalEmailsSent: (row.totalEmailsSent as number) ?? 0,
    monthEmailsSent: (row.monthEmailsSent as number) ?? 0,
    totalFeedPosts:  (row.totalFeedPosts  as number) ?? 0,
    monthFeedPosts:  (row.monthFeedPosts  as number) ?? 0,
  }
}

export interface AllEngagementMetrics {
  totalInteractions:      number
  monthInteractions:      number
  alumniEmailsTotal:      number
  alumniEmailsMonth:      number
  alumniLoginsLast30Days: number
  playerEmailsTotal:      number
  playerEmailsMonth:      number
  totalFeedPosts:         number
  monthFeedPosts:         number
}

export async function sp_GetDashboardMetrics_All(params: {
  tenantId: number
  sportId?: number | null   // INT
}): Promise<AllEngagementMetrics> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('app', 'sp_GetDashboardMetrics_All', (r) => {
    r.input('TenantId', sql.Int, params.tenantId)
    r.input('SportId',  sql.Int, params.sportId ?? null)
  })
  const row = rows[0] ?? {}
  return {
    totalInteractions:      (row.totalInteractions      as number) ?? 0,
    monthInteractions:      (row.monthInteractions      as number) ?? 0,
    alumniEmailsTotal:      (row.alumniEmailsTotal      as number) ?? 0,
    alumniEmailsMonth:      (row.alumniEmailsMonth      as number) ?? 0,
    alumniLoginsLast30Days: (row.alumniLoginsLast30Days as number) ?? 0,
    playerEmailsTotal:      (row.playerEmailsTotal      as number) ?? 0,
    playerEmailsMonth:      (row.playerEmailsMonth      as number) ?? 0,
    totalFeedPosts:         (row.totalFeedPosts         as number) ?? 0,
    monthFeedPosts:         (row.monthFeedPosts         as number) ?? 0,
  }
}

// ─── Global DB — Team Member Creation ────────────────────────────────────────

export async function sp_CreateTeamMember(params: {
  email:     string
  firstName: string
  lastName:  string
  teamId:    number
  role:      string
  createdBy: number
}): Promise<{ userId: number | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_CreateTeamMember', (r) => {
    r.input ('Email',     sql.NVarChar(255), params.email)
    r.input ('FirstName', sql.NVarChar(100), params.firstName)
    r.input ('LastName',  sql.NVarChar(100), params.lastName)
    r.input ('TeamId',    sql.Int,           params.teamId)
    r.input ('Role',      sql.NVarChar(30),  params.role)
    r.input ('CreatedBy', sql.BigInt,        params.createdBy)
    r.output('UserId',    sql.BigInt)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    userId:    (output.UserId    as number | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

// ─── Global DB — Invite Codes & Access Requests ───────────────────────────────

export async function sp_ActivatePendingAccount(params: {
  email:           string
  newPasswordHash: string
}): Promise<{ userId: number | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_ActivatePendingAccount', (r) => {
    r.input ('Email',           sql.NVarChar(255),     params.email)
    r.input ('NewPasswordHash', sql.NVarChar(sql.MAX), params.newPasswordHash)
    r.output('UserId',          sql.BigInt)
    r.output('ErrorCode',       sql.NVarChar(50))
  })
  return {
    userId:    (output.UserId    as number | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_RegisterUserViaInvite(params: {
  email:        string
  passwordHash: string
  firstName:    string
  lastName:     string
}): Promise<{ userId: number | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_RegisterUserViaInvite', (r) => {
    r.input ('Email',        sql.NVarChar(255),     params.email)
    r.input ('PasswordHash', sql.NVarChar(sql.MAX), params.passwordHash)
    r.input ('FirstName',    sql.NVarChar(100),     params.firstName)
    r.input ('LastName',     sql.NVarChar(100),     params.lastName)
    r.output('UserId',       sql.BigInt)
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return {
    userId:    (output.UserId    as number | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_ValidateInviteCode(params: {
  token: string
}): Promise<Record<string, unknown> | null> {
  const rows = await exec<sql.IRecordSet<Record<string, unknown>>>('global', 'sp_ValidateInviteCode', (r) => {
    r.input('Token', sql.NVarChar(128), params.token)
  })
  return rows[0] ?? null
}

export async function sp_CreateInviteCode(params: {
  teamId:    number
  role:      string
  token:     string
  createdBy: number
  expiresAt?: Date | null
  maxUses?:   number | null
}): Promise<{ inviteCodeId: number | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_CreateInviteCode', (r) => {
    r.input ('TeamId',       sql.Int,           params.teamId)
    r.input ('Role',         sql.NVarChar(30),  params.role)
    r.input ('Token',        sql.NVarChar(128), params.token)
    r.input ('CreatedBy',    sql.BigInt,        params.createdBy)
    r.input ('ExpiresAt',    sql.DateTime2,     params.expiresAt ?? null)
    r.input ('MaxUses',      sql.Int,           params.maxUses   ?? null)
    r.output('InviteCodeId', sql.BigInt)
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return {
    inviteCodeId: (output.InviteCodeId as number | null) ?? null,
    errorCode:    (output.ErrorCode    as string | null) ?? null,
  }
}

export async function sp_ListInviteCodes(params: {
  teamId: number
}): Promise<sql.IRecordSet<Record<string, unknown>>> {
  return exec('global', 'sp_ListInviteCodes', (r) => {
    r.input('TeamId', sql.Int, params.teamId)
  })
}

export async function sp_DeactivateInviteCode(params: {
  inviteCodeId:  number
  deactivatedBy: number
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_DeactivateInviteCode', (r) => {
    r.input ('InviteCodeId',  sql.BigInt,      params.inviteCodeId)
    r.input ('DeactivatedBy', sql.BigInt,      params.deactivatedBy)
    r.output('ErrorCode',     sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

export async function sp_SubmitAccessRequest(params: {
  userId: number
  token:  string
}): Promise<{ requestId: number | null; errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_SubmitAccessRequest', (r) => {
    r.input ('UserId',    sql.BigInt,        params.userId)
    r.input ('Token',     sql.NVarChar(128), params.token)
    r.output('RequestId', sql.BigInt)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return {
    requestId: (output.RequestId as number | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_GetMyAccessRequests(params: {
  userId: number
}): Promise<sql.IRecordSet<Record<string, unknown>>> {
  return exec('global', 'sp_GetMyAccessRequests', (r) => {
    r.input('UserId', sql.BigInt, params.userId)
  })
}

export async function sp_GetPendingAccessRequests(params: {
  adminUserId:   number
  statusFilter?: 'pending' | 'approved' | 'denied' | 'all'
}): Promise<sql.IRecordSet<Record<string, unknown>>> {
  return exec('global', 'sp_GetPendingAccessRequests', (r) => {
    r.input('AdminUserId',  sql.BigInt,       params.adminUserId)
    r.input('StatusFilter', sql.NVarChar(20), params.statusFilter ?? 'pending')
  })
}

export async function sp_ReviewAccessRequest(params: {
  requestId:     number
  reviewedBy:    number
  action:        'approve' | 'deny'
  role?:         string | null
  denialReason?: string | null
}): Promise<{
  userId:    number | null
  teamId:    number | null
  finalRole: string | null
  errorCode: string | null
}> {
  const { output } = await execFull('global', 'sp_ReviewAccessRequest', (r) => {
    r.input ('RequestId',    sql.BigInt,            params.requestId)
    r.input ('ReviewedBy',   sql.BigInt,            params.reviewedBy)
    r.input ('Action',       sql.NVarChar(10),      params.action)
    r.input ('Role',         sql.NVarChar(30),      params.role         ?? null)
    r.input ('DenialReason', sql.NVarChar(sql.MAX), params.denialReason ?? null)
    r.output('UserId',       sql.BigInt)
    r.output('TeamId',       sql.Int)
    r.output('FinalRole',    sql.NVarChar(30))
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return {
    userId:    (output.UserId    as number | null) ?? null,
    teamId:    (output.TeamId    as number | null) ?? null,
    finalRole: (output.FinalRole as string | null) ?? null,
    errorCode: (output.ErrorCode as string | null) ?? null,
  }
}

export async function sp_SendRequestReminder(params: {
  requestId: number
  userId:    number
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_SendRequestReminder', (r) => {
    r.input ('RequestId', sql.BigInt,      params.requestId)
    r.input ('UserId',    sql.BigInt,      params.userId)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

// ─── Global DB — Profile / Account ───────────────────────────────────────────

import type { UserProfile } from '@/types'

export async function sp_GetUserProfile(userId: number): Promise<UserProfile | null> {
  const rows = await exec('global', 'sp_GetUserProfile', (r) => {
    r.input('UserId', sql.BigInt, userId)
  })
  return (rows[0] as unknown as UserProfile | undefined) ?? null
}

export async function sp_UpdateUserProfile(params: {
  targetUserId: number
  actorId:      number
  firstName?:   string | null
  lastName?:    string | null
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_UpdateUserProfile', (r) => {
    r.input ('TargetUserId', sql.BigInt,        params.targetUserId)
    r.input ('ActorId',      sql.BigInt,        params.actorId)
    r.input ('FirstName',    sql.NVarChar(100), params.firstName ?? null)
    r.input ('LastName',     sql.NVarChar(100), params.lastName  ?? null)
    r.output('ErrorCode',    sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

export async function sp_GetPasswordHash(userId: number): Promise<string | null> {
  const { output } = await execFull('global', 'sp_GetPasswordHash', (r) => {
    r.input ('UserId',       sql.BigInt,       userId)
    r.output('PasswordHash', sql.NVarChar(255))
  })
  return (output.PasswordHash as string | null) ?? null
}

export async function sp_ChangeEmail(params: {
  userId:   number
  newEmail: string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_ChangeEmail', (r) => {
    r.input ('UserId',    sql.BigInt,        params.userId)
    r.input ('NewEmail',  sql.NVarChar(255), params.newEmail)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

export async function sp_ChangePassword(params: {
  userId:          number
  newPasswordHash: string
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_ChangePassword', (r) => {
    r.input ('UserId',          sql.BigInt,        params.userId)
    r.input ('NewPasswordHash', sql.NVarChar(255),  params.newPasswordHash)
    r.output('ErrorCode',       sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}

export async function sp_SetPreferredTeam(params: {
  userId: number
  teamId: number
}): Promise<{ errorCode: string | null }> {
  const { output } = await execFull('global', 'sp_SetPreferredTeam', (r) => {
    r.input ('UserId',    sql.BigInt, params.userId)
    r.input ('TeamId',    sql.Int,    params.teamId)
    r.output('ErrorCode', sql.NVarChar(50))
  })
  return { errorCode: (output.ErrorCode as string | null) ?? null }
}
