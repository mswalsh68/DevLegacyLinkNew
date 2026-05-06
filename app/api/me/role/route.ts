import { NextResponse } from 'next/server'
import { requireSession, isGlobalAdmin } from '@/lib/auth'
import { sp_GetUserProgramRole } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'

// GET /api/me/role
// Returns the most-privileged program role for the current user in their active team.
// Global admins (super_admin / support_admin) have no users_roles record — they
// receive programRoleId=1 (Athletic Director) so they get full wizard access.
export async function GET() {
  const { session, error } = await requireSession({ appDb: false })
  if (error) return error

  if (isGlobalAdmin(session)) {
    const globalRole = (session as unknown as Record<string, unknown>).role as string | undefined
    const displayName = (globalRole ?? 'Admin')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
    return NextResponse.json({
      success: true,
      data: { programRoleId: 1, roleName: globalRole ?? 'admin', displayName },
    })
  }

  if (!session.appDb) {
    return NextResponse.json({ success: false, error: 'App DB not configured.' }, { status: 503 })
  }

  return appDbContext.run(session.appDb, async () => {
    try {
      const role = await sp_GetUserProgramRole({ userId: session.userId })
      return NextResponse.json({ success: true, data: role })
    } catch (err) {
      console.error('[GET /api/me/role]', err)
      return NextResponse.json({ success: false, error: 'Failed to load role' }, { status: 500 })
    }
  })
}
