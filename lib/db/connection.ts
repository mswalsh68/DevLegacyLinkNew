// ─── Smart Database Connection Layer ─────────────────────────────────────────
//
// Azure SQL  (NODE_ENV=production OR server contains .database.windows.net):
//   → encrypt=true, trustServerCertificate=false
//
// Local SQLEXPRESS (everything else):
//   → encrypt=false, trustServerCertificate=true
//
// All route handlers and procedures import from here — never create a pool
// directly anywhere else.

import sql from 'mssql'

const DB_SERVER = process.env.DB_SERVER ?? ''

// Treat as Azure if explicitly in production OR the server URL looks like Azure SQL
const isAzure =
  process.env.NODE_ENV === 'production' ||
  DB_SERVER.toLowerCase().includes('.database.windows.net')

// ─── Logical DB identifiers → actual database names (from env vars) ───────────

// 'app'    — the per-tenant App DB (players + alumni, single DB)
// 'global' — the shared Global DB (users, auth, team config)
// 'roster' / 'alumni' kept as aliases for backward compat — both point to APP_DB_NAME
export type DbKey = 'global' | 'app' | 'roster' | 'alumni'

const DB_NAMES: Record<DbKey, string> = {
  global: process.env.GLOBAL_DB_NAME ?? 'DevLegacyLinkGlobal',
  app:    process.env.APP_DB_NAME    ?? 'DevLegacyLinkApp',
  roster: process.env.APP_DB_NAME    ?? 'DevLegacyLinkApp',
  alumni: process.env.APP_DB_NAME    ?? 'DevLegacyLinkApp',
}

// ─── Base config — switches per environment ───────────────────────────────────

function buildBaseConfig(database: string): sql.config {
  const server = DB_SERVER || (isAzure ? '' : 'localhost\\SQLEXPRESS')

  return {
    server,
    database,
    authentication: {
      type: 'default',
      options: {
        userName: process.env.DB_USER ?? 'sa',
        password: process.env.DB_PASS ?? '',
      },
    },
    options: {
      // Azure SQL mandates encryption; local SQLEXPRESS rejects it.
      encrypt:                isAzure,
      trustServerCertificate: !isAzure,
      enableArithAbort:       true,
    },
    pool: {
      max:                  10,
      min:                  0,
      idleTimeoutMillis:    30_000,
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

  if (isAzure && !config.server) {
    throw new Error(
      `[db/connection] DB_SERVER env var is required when targeting Azure SQL. ` +
      `Set it to your server hostname (e.g. myserver.database.windows.net).`,
    )
  }

  console.log(
    `[db/connection] Connecting to ${isAzure ? 'Azure' : 'local'} SQL — ` +
    `${config.server}/${DB_NAMES[db]} (encrypt=${isAzure})`,
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
