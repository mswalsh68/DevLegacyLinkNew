// Protected app layout — wraps all (app) routes.
// Server-side auth check: unauthenticated users are redirected to /login.
// Renders the original design: sticky top nav (team primary color) + light page background.
import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth'
import { AppNav } from '@/components/app/AppNav'
import { CommunityConsentGate } from './CommunityConsentGate'
import { WelcomePopupGate } from './WelcomePopupGate'
import { PreviewBanner } from '@/components/PreviewBanner'

// program_role_id 7 = alumni (platform-standard, never customized)
const ALUMNI_PROGRAM_ROLE_ID = 7

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  const isAlumni = session.programRoleId === ALUMNI_PROGRAM_ROLE_ID

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-page-bg)' }}>
      {/* Preview mode banner — only visible during a View As session */}
      {session.previewActive && session.previewTeamName && session.previewProgramRoleId && (
        <PreviewBanner
          teamName={session.previewTeamName}
          programRoleId={session.previewProgramRoleId}
        />
      )}

      {/* Sticky top nav — background is var(--color-primary), updates on team switch */}
      <AppNav />

      {/* Consent gate — renders as an overlay modal for alumni; no-ops for all other roles */}
      {isAlumni && <CommunityConsentGate />}

      {/* Welcome popup — shown once after player → alumni promotion; no-op once dismissed */}
      {isAlumni && <WelcomePopupGate />}

      {/* Page content — centered, max 1200px, responsive padding via .app-page */}
      <div className="app-page">
        {children}
      </div>
    </div>
  )
}
