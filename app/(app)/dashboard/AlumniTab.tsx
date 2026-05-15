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
  totalFeedPosts:         number
  monthFeedPosts:         number
  emailOpenRatePct:       number
}

// ─── Alumni Tab ───────────────────────────────────────────────────────────────

export default function AlumniTab({ sportId }: { sportId?: number | null }) {
  const config = useTeamConfig()
  const tier   = config.tierId

  return (
    <CommsDashboardTab
      metricsEndpoint="/dashboard/alumni-metrics"
      sportId={sportId}
      title="Alumni Engagement"
      subtitle="Outreach interactions, emails, and login activity"

      errorMessage="Failed to load alumni metrics"
      renderMetrics={(raw, features) => {
        const m = raw as AlumniMetrics
        return (
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            {(features.includes('interactions') || hasFeature(tier, 'interactions')) && (
              <MetricCard label="Logged Interactions" total={m.totalInteractions} monthValue={m.monthInteractions} />
            )}
            {(features.includes('emails_sent') || hasFeature(tier, 'emails_sent')) && (
              <>
                <MetricCard label="Emails Sent" total={m.totalEmailsSent} monthValue={m.monthEmailsSent} />
                {m.emailOpenRatePct > 0 && (
                  <MetricCard label="Email Open Rate" total={`${m.emailOpenRatePct}%`} monthLabel="of sent emails opened" />
                )}
              </>
            )}
            {(features.includes('login_frequency') || hasFeature(tier, 'login_frequency')) && (
              <MetricCard label="Alumni Logins" total={m.alumniLoginsLast30Days} monthLabel="in last 30 days" />
            )}
            <MetricCard label="Feed Posts" total={m.totalFeedPosts} monthValue={m.monthFeedPosts} />
          </div>
        )
      }}
    />
  )
}
