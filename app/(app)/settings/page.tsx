// Team Settings — server component.
// Enforces global_admin / platform_owner only. Shows AccessDenied otherwise.
// Ported from original project: app/admin/settings/page.tsx
import type { Metadata } from 'next'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import { AccessDenied } from '@/components/ui/AccessDenied'
import { roleLabel, requiredRoleLabel } from '@/lib/permissions'
import Link from 'next/link'
import SettingsContent from './SettingsContent'

export const metadata: Metadata = { title: 'Team Settings' }

export default async function SettingsPage() {
  const session = await getServerSession()

  // Auth enforced by (app) layout — session is guaranteed here.
  // Additional role check: only global_admin / platform_owner may edit team settings.
  if (!session || !isGlobalAdmin(session)) {
    return (
      <AccessDenied
        currentRole={roleLabel(session?.role)}
        requiredRole={requiredRoleLabel('settings:view')}
      />
    )
  }

  return (
    <>
      {/* Settings sub-nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <Link
          href="/settings"
          style={{
            padding:         '7px 16px',
            borderRadius:    8,
            fontSize:        13,
            fontWeight:      600,
            textDecoration:  'none',
            backgroundColor: 'var(--color-primary)',
            color:           '#fff',
          }}
        >
          Team Config
        </Link>
        <Link
          href="/settings/requests"
          style={{
            padding:         '7px 16px',
            borderRadius:    8,
            fontSize:        13,
            fontWeight:      600,
            textDecoration:  'none',
            backgroundColor: '#f3f4f6',
            color:           '#374151',
          }}
        >
          Access Requests
        </Link>
      </div>
      <SettingsContent />
    </>
  )
}
