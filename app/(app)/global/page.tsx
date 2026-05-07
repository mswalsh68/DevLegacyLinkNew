// Global Settings — internal command center.
// Accessible only to global admins (roleId 1 or 2). The route is intentionally
// unlisted — it does not appear in nav — but is enforced server-side here and
// at every API route under /api/internal/*.
import type { Metadata } from 'next'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { AccessDenied } from '@/components/ui/AccessDenied'
import { sp_GetTeams, sp_GetTiers, sp_GetLevels } from '@/lib/db/procedures'
import RolePreviewTool from './RolePreviewTool'
import TeamManagementTool from './TeamManagementTool'

export const metadata: Metadata = { title: 'Global Settings' }

export default async function GlobalPage() {
  const session = await getServerSession()

  if (!session || !isGlobalAdmin(session)) {
    return (
      <AccessDenied
        currentRole={session?.role ?? 'unknown'}
        requiredRole="Support Admin or higher"
      />
    )
  }

  const [rawTeams, tiers, levels] = await Promise.all([
    sp_GetTeams({ includeInactive: true }),
    sp_GetTiers(),
    sp_GetLevels(),
  ])

  const teams = rawTeams.map(t => ({
    id:               t.id               as number,
    name:             t.name             as string,
    tierId:           t.tierId           as number,
    tier:             (t.tier            as string) ?? '',
    tierDisplayName:  (t.tierDisplayName as string) ?? '',
    levelId:          t.levelId          as number,
    level:            (t.level           as string) ?? '',
    levelDisplayName: (t.levelDisplayName as string) ?? '',
    appDb:            (t.appDb           as string) ?? '',
    isActive:         Boolean(t.isActive),
    createdAt:        (t.createdAt       as string) ?? '',
  }))

  const previewTeams = teams.filter(t => t.isActive).map(t => ({ id: t.id, name: t.name }))

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Global Settings
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
          Internal LegacyLink command center. Changes here affect the platform, not a single team.
        </p>
      </div>

      {/* Tool: Client / Team Management */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Client Management
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Provision new clients, manage tiers and levels, assign App DBs, and activate or deactivate accounts.
        </p>
        <TeamManagementTool teams={teams} tiers={tiers} levels={levels} />
      </section>

      {/* Tool: Role Preview */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          View As
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Render the app exactly as a specific program role sees it — without changing any data.
          All writes are blocked in production while a preview session is active.
        </p>
        <RolePreviewTool teams={previewTeams} />
      </section>
    </div>
  )
}
