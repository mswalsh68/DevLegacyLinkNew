'use client'

import { theme } from '@/lib/theme'

interface MetricCardProps {
  label:       string
  total:       number | string
  monthValue?: number | string
  monthLabel?: string
}

export default function MetricCard({ label, total, monthValue, monthLabel = 'this month' }: MetricCardProps) {
  return (
    <div style={{
      backgroundColor: theme.cardBg,
      border:          `1px solid ${theme.cardBorder}`,
      borderRadius:    12,
      padding:         '20px 24px',
      flex:            1,
      minWidth:        140,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: theme.gray900 }}>{total}</div>
      <div style={{ fontSize: 13, color: theme.gray500, marginTop: 4 }}>{label}</div>
      {monthValue !== undefined && (
        <div style={{ fontSize: 12, color: theme.primaryDark, marginTop: 6, fontWeight: 500 }}>
          +{monthValue} {monthLabel}
        </div>
      )}
    </div>
  )
}
