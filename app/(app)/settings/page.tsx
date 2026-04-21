// Team Settings — server component.
// Enforces global_admin only. Redirects to /dashboard otherwise.
// Ported from original project: app/admin/settings/page.tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerSession, isGlobalAdmin } from '@/lib/auth'
import SettingsContent from './SettingsContent'

export const metadata: Metadata = { title: 'Team Settings' }

export default async function SettingsPage() {
  const session = await getServerSession()

  // Auth enforced by (app) layout — session is guaranteed here.
  // Additional role check: only global_admin may edit team settings.
  if (!session || !isGlobalAdmin(session)) {
    redirect('/dashboard')
  }

  return <SettingsContent />
}
