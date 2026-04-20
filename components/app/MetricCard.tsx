// Presentational — no client directive needed (no hooks / event handlers).

import { cn } from '@/lib/utils'

interface MetricCardProps {
  label:     string
  value:     string | number
  trend?:    string
  trendUp?:  boolean      // true = green, false/undefined = muted
  icon?:     React.ReactNode
  className?: string
}

export function MetricCard({
  label,
  value,
  trend,
  trendUp,
  icon,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-4 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-5 overflow-hidden',
        className,
      )}
    >
      {/* Subtle top-left glow line keyed to the team primary color */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, var(--color-primary) 0%, transparent 60%)',
          opacity: 0.6,
        }}
      />

      {/* Header row */}
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
          {label}
        </span>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
            style={{
              background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="text-3xl font-bold text-white tracking-tight leading-none">
        {value}
      </div>

      {/* Trend line */}
      {trend && (
        <p
          className={cn(
            'text-[11px] font-medium',
            trendUp ? 'text-emerald-400' : 'text-gray-600',
          )}
        >
          {trendUp && '↑ '}{trend}
        </p>
      )}
    </div>
  )
}
