// Shared helpers for fetching supplementary data from the Global DB.
// Import these instead of inlining raw SQL in route handlers.

import { getPool } from './connection'

/**
 * Batch-fetches account_claimed for a list of user IDs from the Global DB.
 * Returns a Map<userId, accountClaimed>.
 */
export async function fetchAccountClaimedMap(userIds: number[]): Promise<Map<number, boolean>> {
  const map = new Map<number, boolean>()
  if (userIds.length === 0) return map

  try {
    const globalDb = await getPool('global')
    const ids = userIds.join(',')
    const { recordset } = await globalDb.request()
      .query(`SELECT user_id, account_claimed FROM dbo.users WHERE user_id IN (${ids})`)
    for (const row of recordset as { user_id: number; account_claimed: boolean }[]) {
      map.set(row.user_id, Boolean(row.account_claimed))
    }
  } catch (err) {
    console.warn('[globalLookup] Could not fetch account_claimed:', err)
  }

  return map
}
