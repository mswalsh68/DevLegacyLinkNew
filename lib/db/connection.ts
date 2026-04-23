// ─── Smart Database Connection Layer ─────────────────────────────────────────
//
// Azure SQL  (NODE_ENV=production OR server contains .database.windows.net):
//   → encrypt=true, trustServerCertificate=false
//
// Local SQLEXPRESS (everything else):
//   → encrypt=false, trustServerCertificate=true
//
// App DB is multi-tenant: each team has its own database name stored in
// dbo.teams.app_db (Global DB). The JWT carries appDb so we don't need
// a hardcoded APP_DB_NAME env var. Wrap API routes and server actions with:
//   return appDbContext.run(session.appDb, async () => { ... })
// before calling any App DB procedures.

import { AsyncLocalStorage } from 'async_hooks'
import sql from 'mssql'

const DB_SERVER = process.env.DB_SERVER ?? ''

// Treat as Azure if explicitly in production OR the server URL looks like Azure SQL
const isAzure =
  process.env.NODE_ENV === 'production' ||
  DB_SERVER.toLowerCase().includes('.database.windows.net')

// ─── Logical DB identifiers → actual database names ───────────────────────────

// 'global' — shared Global DB (users, auth, team config)
// 'app' / 'roster' / 'alumni' — per-tenant App DB; actual name resolved at
//   request time from appDbContext (falls back to APP_DB_NAME env var for local dev)
export type DbKey = 'global' | 'app' | 'roster' | 'alumni'

const DB_NAMES: Record<DbKey, string> = {
  global: process.env.GLOBAL_DB_NAME ?? 'LegacyLinkGlobal',
  // App DB fallback — only used in local dev. Production reads from JWT appDb.
  app:    process.env.APP_DB_NAME    ?? '',
  roster: process.env.APP_DB_NAME    ?? '',
  alumni: process.env.APP_DB_NAME    ?? '',
}

// ─── Per-request App DB context ───────────────────────────────────────────────
// Stores the tenant's database name for the duration of a single request.
// Avoids threading appDb through every SP wrapper function.
//
// Usage in API routes / server actions:
//   return appDbContext.run(session.appDb, async () => { ... all DB calls ... })
export const appDbContext = new AsyncLocalStorage<string>()

// ─── Base config ──────────────────────────────────────────────────────────────

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

// ─── Connection pools ─────────────────────────────────────────────────────────
// Global pool: keyed by DbKey (only 'global' in practice)
// App pools: keyed by actual database name (one pool per tenant DB)

const globalPool = new Map<DbKey, sql.ConnectionPool>()
const appPools   = new Map<string, sql.ConnectionPool>()

async function createPool(dbName: string): Promise<sql.ConnectionPool> {
  if (isAzure && !DB_SERVER) {
    throw new Error(
      `[db/connection] DB_SERVER env var is required when targeting Azure SQL.`,
    )
  }

  console.log(
    `[db/connection] Connecting to ${isAzure ? 'Azure' : 'local'} SQL — ` +
    `${DB_SERVER || 'localhost\\SQLEXPRESS'}/${dbName} (encrypt=${isAzure})`,
  )

  return new sql.ConnectionPool(buildBaseConfig(dbName)).connect()
}

export async function getPool(db: DbKey): Promise<sql.ConnectionPool> {
  // App-family keys: resolve database name from per-request context first,
  // then fall back to env var (useful for local dev without JWT).
  if (db === 'app' || db === 'roster' || db === 'alumni') {
    const dbName = appDbContext.getStore() ?? DB_NAMES[db]

    if (!dbName) {
      throw new Error(
        `[db/connection] No App DB name available for key '${db}'. ` +
        `Wrap the handler in appDbContext.run(session.appDb, fn).`,
      )
    }

    if (appPools.has(dbName)) return appPools.get(dbName)!

    const pool = await createPool(dbName)
    pool.on('error', (err) => {
      console.error(`[db/connection] Pool error on '${dbName}':`, err)
      appPools.delete(dbName)
    })
    appPools.set(dbName, pool)
    return pool
  }

  // Global DB: fixed name, cached by DbKey
  if (globalPool.has(db)) return globalPool.get(db)!

  const dbName = DB_NAMES[db]
  const pool   = await createPool(dbName)
  pool.on('error', (err) => {
    console.error(`[db/connection] Pool error on '${db}':`, err)
    globalPool.delete(db)
  })
  globalPool.set(db, pool)
  return pool
}

// ─── Convenience: create a pre-configured Request on a given DB ───────────────

export async function dbRequest(db: DbKey): Promise<sql.Request> {
  const pool = await getPool(db)
  return pool.request()
}
