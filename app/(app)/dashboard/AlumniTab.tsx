'use client'

import { useTeamConfig } from '@/providers/ThemeProvider'
import { hasFeature } from '@/lib/features'
import CommsDashboardTab from './CommsDashboardTab'
import MetricCard from './MetricCard'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlumniMetrics {
  totalInteractions:      number
  monthInteractions:      number
  totalEmailsSent:        number
  monthEmailsSent:        number
  alumniLoginsLast30Days: number
  emailOpenRatePct:       number
}

// Module-level constants so useCallback deps stay stable
const CAMPAIGN_AUDIENCES = ['all', 'alumni_only'] as const
const POST_AUDIENCES     = ['all', 'alumni_only'] as const

// ─── Alumni Tab ───────────────────────────────────────────────────────────────

export default function AlumniTab({ sportId }: { sportId?: string | null }) {
  const config = useTeamConfig()
  const tier   = config.subscriptionTier

  return (
    <CommsDashboardTab
      campaignAudiences={CAMPAIGN_AUDIENCES}
      postAudiences={POST_AUDIENCES}
      metricsEndpoint="/dashboard/alumni-metrics"
      sportId={sportId}
      title="Alumni Engagement"
      subtitle="Outreach interactions, emails, and login activity"
      emailAudience="alumni_only"
      emailAudienceLabel="Alumni"
      emptyCampaignsText="No alumni campaigns yet. Create your first email above."
      emptyPostsText="No alumni posts yet."
      errorMessage="Failed to load alumni metrics"
      renderMetrics={(raw, features) => {
        const m = raw as AlumniMetrics
        return (
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            {(features.includes('interactions') || hasFeature(tier, 'interactions')) && (
              <MetricCard label="Logged Interactions" total={m.totalInteractions} monthValue={m.monthInteractions} />
            )}
            {(features.includes('emails_sent') || hasFeature(tier, 'emails_sent')) && (
              <MetricCard label="Emails Sent" total={m.totalEmailsSent} monthValue={m.monthEmailsSent} />
            )}
            {(features.includes('login_frequency') || hasFeature(tier, 'login_frequency')) && (
              <MetricCard label="Alumni Logins" total={m.alumniLoginsLast30Days} monthLabel="in last 30 days" />
            )}
          </div>
        )
      }}
    />
  )
}
