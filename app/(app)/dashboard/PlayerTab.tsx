'use client'

import CommsDashboardTab from './CommsDashboardTab'
import MetricCard from './MetricCard'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerMetrics {
  totalEmailsSent: number
  monthEmailsSent: number
  totalFeedPosts:  number
  monthFeedPosts:  number
}

// Module-level constants so useCallback deps stay stable
const CAMPAIGN_AUDIENCES = ['all', 'players_only'] as const
const POST_AUDIENCES     = ['all', 'players_only', 'by_position'] as const

// ─── Player Tab ───────────────────────────────────────────────────────────────

export default function PlayerTab({ sportId }: { sportId?: string | null }) {
  return (
    <CommsDashboardTab
      campaignAudiences={CAMPAIGN_AUDIENCES}
      postAudiences={POST_AUDIENCES}
      metricsEndpoint="/dashboard/player-metrics"
      sportId={sportId}
      title="Player Communications"
      subtitle="Emails and feed posts targeting current roster"
      emailAudience="players_only"
      emailAudienceLabel="Players"
      emptyCampaignsText="No player campaigns yet."
      emptyPostsText="No player posts yet."
      errorMessage="Failed to load player metrics"
      renderMetrics={(raw) => {
        const m = raw as PlayerMetrics
        return (
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            <MetricCard label="Emails Sent" total={m.totalEmailsSent} monthValue={m.monthEmailsSent} />
            <MetricCard label="Feed Posts"  total={m.totalFeedPosts}  monthValue={m.monthFeedPosts}  />
          </div>
        )
      }}
    />
  )
}
