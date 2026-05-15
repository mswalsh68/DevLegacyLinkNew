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

// ─── Player Tab ───────────────────────────────────────────────────────────────

export default function PlayerTab({ sportId }: { sportId?: number | null }) {
  return (
    <CommsDashboardTab
      metricsEndpoint="/dashboard/player-metrics"
      sportId={sportId}
      title="Player Communications"
      subtitle="Emails and feed posts targeting current roster"

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
