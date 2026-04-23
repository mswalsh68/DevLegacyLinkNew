// /settings/requests — admin view of access requests.
// global_admin / platform_owner only. Shows AccessDenied otherwise.
import type { Metadata } from 'next'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { AccessDenied } from '@/components/ui/AccessDenied'
import { roleLabel, requiredRoleLabel } from '@/lib/permissions'
import { sp_GetPendingAccessRequests } from '@/lib/db/procedures'
import { RequestsContent } from './RequestsContent'

export const metadata: Metadata = { title: 'Access Requests — LegacyLink' }

export default async function RequestsPage() {
  const session = await getServerSession()

  if (!session || !isGlobalAdmin(session)) {
    return (
      <AccessDenied
        currentRole={roleLabel(session?.role)}
        requiredRole={requiredRoleLabel('settings:requests')}
      />
    )
  }

  let pending:  Record<string, unknown>[] = []
  let reviewed: Record<string, unknown>[] = []

  try {
    const [p, r] = await Promise.all([
      sp_GetPendingAccessRequests({ adminUserId: session.userId, statusFilter: 'pending' }),
      sp_GetPendingAccessRequests({ adminUserId: session.userId, statusFilter: 'all' }),
    ])
    pending  = Array.from(p) as Record<string, unknown>[]
    reviewed = (Array.from(r) as Record<string, unknown>[]).filter(
      row => row.status !== 'pending',
    )
  } catch (err) {
    console.error('[/settings/requests]', err)
  }

  return <RequestsContent pending={pending} reviewed={reviewed} />
}
