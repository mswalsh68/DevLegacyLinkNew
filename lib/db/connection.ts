// ─── Smart Database Connection Layer ─────────────────────────────────────────
//
// Development  (NODE_ENV=development):
//   → localhost\SQLEXPRESS, encrypt=false, trustServerCertificate=true
//
// Production   (NODE_ENV=production):
//   → Azure SQL (DB_SERVER env var), encrypt=true, trustServerCertificate=false
//
// All route handlers and procedures import from here — never create a pool
// directly anywhere else.

import sql from 'mssql'

const isProd = process.env.NODE_ENV === 'production'

// ─── Logical DB identifiers → actual database names (from env vars) ───────────

export type DbKey = 'global' | 'roster' | 'alumni'

const DB_NAMES: Record<DbKey, string> = {
  global: process.env.GLOBAL_DB_NAME ?? 'DevLegacyLinkGlobal',
  roster: process.env.ROSTER_DB_NAME ?? 'DevLegacyLinkRoster',
  alumni: process.env.ALUMNI_DB_NAME ?? 'DevLegacyLinkAlumni',
}

// ─── Base config — switches per environment ───────────────────────────────────

function buildBaseConfig(database: string): sql.config {
  return {
    server:   process.env.DB_SERVER ?? (isProd ? '' : 'localhost\\SQLEXPRESS'),
    database,
    authentication: {
      type: 'default',
      options: {
        userName: process.env.DB_USER ?? 'sa',
        password: process.env.DB_PASS ?? '',
      },
    },
    options: {
      // Azure SQL requires encryption. Local SQLEXPRESS does not (and rejects it).
      encrypt:                isProd,
      trustServerCertificate: !isProd,
      // Allows named-instance syntax (localhost\SQLEXPRESS) in dev
      enableArithAbort:       true,
    },
    pool: {
      max:                10,
      min:                0,
      idleTimeoutMillis:  30_000,
      acquireTimeoutMillis: 15_000,
    },
    connectionTimeout: 15_000,
    requestTimeout:    30_000,
  }
}

// ─── Lazy connection pools — one per database ─────────────────────────────────

const pools = new Map<DbKey, sql.ConnectionPool>()

export async function getPool(db: DbKey): Promise<sql.ConnectionPool> {
  if (pools.has(db)) return pools.get(db)!

  const config = buildBaseConfig(DB_NAMES[db])

  if (isProd && !config.server) {
    throw new Error(
      `[db/connection] DB_SERVER env var is required in production. ` +
      `Set it to your Azure SQL server (e.g. myserver.database.windows.net).`,
    )
  }

  console.log(
    `[db/connection] Connecting to ${isProd ? 'Azure' : 'local'} SQL — ` +
    `${config.server}/${DB_NAMES[db]}`,
  )

  const pool = await new sql.ConnectionPool(config).connect()

  pool.on('error', (err) => {
    console.error(`[db/connection] Pool error on '${db}':`, err)
    pools.delete(db) // allow reconnect on next request
  })

  pools.set(db, pool)
  return pool
}

// ─── Convenience: create a pre-configured Request on a given DB ───────────────

export async function dbRequest(db: DbKey): Promise<sql.Request> {
  const pool = await getPool(db)
  return pool.request()
}
