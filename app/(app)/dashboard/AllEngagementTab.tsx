'use client'

import CommsDashboardTab from './CommsDashboardTab'
import MetricCard from './MetricCard'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AllEngagementMetrics {
  totalInteractions:      number
  monthInteractions:      number
  alumniEmailsTotal:      number
  alumniEmailsMonth:      number
  alumniLoginsLast30Days: number
  playerEmailsTotal:      number
  playerEmailsMonth:      number
  totalFeedPosts:         number
  monthFeedPosts:         number
}

// Module-level constants so useCallback deps stay stable
const CAMPAIGN_AUDIENCES = ['all', 'alumni_only', 'players_only'] as const
const POST_AUDIENCES     = ['all', 'alumni_only', 'players_only', 'by_position'] as const

// ─── All Engagement Tab ───────────────────────────────────────────────────────

export default function AllEngagementTab({ sportId }: { sportId?: string | null }) {
  return (
    <CommsDashboardTab
      campaignAudiences={CAMPAIGN_AUDIENCES}
      postAudiences={POST_AUDIENCES}
      metricsEndpoint="/dashboard/all-metrics"
      sportId={sportId}
      title="All Engagement"
      subtitle="Aggregated alumni and player communications across all sports"
      emailAudience="all"
      emailAudienceLabel="Everyone"
      emptyCampaignsText="No campaigns yet. Create your first email above."
      emptyPostsText="No posts yet."
      errorMessage="Failed to load engagement metrics"
      renderMetrics={(raw) => {
        const m = raw as AllEngagementMetrics
        return (
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            <MetricCard
              label="Alumni Interactions"
              total={m.totalInteractions}
              monthValue={m.monthInteractions}
            />
            <MetricCard
              label="Alumni Emails Sent"
              total={m.alumniEmailsTotal}
              monthValue={m.alumniEmailsMonth}
            />
            <MetricCard
              label="Alumni Logins"
              total={m.alumniLoginsLast30Days}
              monthLabel="in last 30 days"
            />
            <MetricCard
              label="Player Emails Sent"
              total={m.playerEmailsTotal}
              monthValue={m.playerEmailsMonth}
            />
            <MetricCard
              label="Feed Posts"
              total={m.totalFeedPosts}
              monthValue={m.monthFeedPosts}
            />
          </div>
        )
      }}
    />
  )
}
