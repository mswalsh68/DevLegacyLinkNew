'use client'

import Link from 'next/link'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { useAuth } from '@/providers/AuthProvider'
import { MetricCard } from '@/components/app/MetricCard'

// ─── Static placeholder data (replace with real API calls in Phase 3) ─────────

const METRICS = [
  {
    label:   'Total Players',
    value:   '—',
    trend:   'Connect roster API',
    trendUp: false,
    icon:    '🏈',
  },
  {
    label:   'Active Alumni',
    value:   '—',
    trend:   'Connect alumni API',
    trendUp: false,
    icon:    '🎓',
  },
  {
    label:   'Campaigns Sent',
    value:   '—',
    trend:   'Connect comms API',
    trendUp: false,
    icon:    '📬',
  },
  {
    label:   'Avg Open Rate',
    value:   '—',
    trend:   'Connect analytics',
    trendUp: false,
    icon:    '📊',
  },
] as const

const QUICK_LINKS = [
  {
    href:        '/roster',
    label:       'Roster',
    description: 'Manage active players & jersey numbers',
    icon:        '🏈',
  },
  {
    href:        '/alumni',
    label:       'Alumni',
    description: 'Track graduates and run outreach',
    icon:        '🎓',
  },
  {
    href:        '/roster/transfer',
    label:       'Transfer',
    description: 'Move players to the alumni database',
    icon:        '↗️',
  },
  {
    href:        '/settings',
    label:       'Settings',
    description: 'Edit team config, colors & positions',
    icon:        '⚙️',
  },
] as const

const ACTIVITY_PLACEHOLDER = [
  { label: 'Dashboard initialized',    time: 'Just now', type: 'system'  },
  { label: 'Team config loaded',        time: 'Just now', type: 'config'  },
  { label: 'Awaiting roster data',      time: '—',        type: 'pending' },
  { label: 'Awaiting alumni data',      time: '—',        type: 'pending' },
  { label: 'Awaiting campaign history', time: '—',        type: 'pending' },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface DashboardContentProps {
  role: string
}

export default function DashboardContent({ role }: DashboardContentProps) {
  const config = useTeamConfig()
  const { user } = useAuth()

  const displayName  = user?.username ?? 'Coach'
  const roleLabel    = role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="max-w-6xl mx-auto space-y-10">

      {/* ── Welcome header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome back,{' '}
            <span style={{ color: 'var(--color-accent)' }}>{displayName}</span>
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {config.teamName}&nbsp;&middot;&nbsp;{config.sport}&nbsp;&middot;&nbsp;{config.level}&nbsp;&middot;&nbsp;{roleLabel}
          </p>
        </div>

        {/* Live team-color swatch */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-white/[0.07] bg-[#1A1A1A] flex-shrink-0">
          <span
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: config.primaryColor }}
          />
          <span className="text-xs text-gray-400">{config.teamName}</span>
        </div>
      </div>

      {/* ── Metric cards ── */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
          Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {METRICS.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>
      </section>

      {/* ── Quick access ── */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group block rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-5 hover:border-white/20 hover:bg-[#1F1F1F] transition-all duration-150"
            >
              {/* Icon bubble */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-4 flex-shrink-0"
                style={{
                  background:
                    'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                }}
              >
                {link.icon}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-[#D4AF5A] transition-colors">
                {link.label}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Bottom row: team config snapshot + activity feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Team config card */}
        <section className="rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-white">Team Configuration</h3>
            <Link
              href="/settings"
              className="text-xs font-medium transition-colors"
              style={{ color: 'var(--color-accent)' }}
            >
              Edit →
            </Link>
          </div>

          <dl className="space-y-3">
            {[
              ['Team',           config.teamName],
              ['Sport',          config.sport],
              ['Level',          config.level],
              ['Positions',      `${config.positions.length} configured`],
              ['Academic Years', `${config.academicYears.length} configured`],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between">
                <dt className="text-xs text-gray-600">{label}</dt>
                <dd className="text-xs font-medium text-gray-300">{val}</dd>
              </div>
            ))}

            {/* Brand color row */}
            <div className="flex items-center justify-between">
              <dt className="text-xs text-gray-600">Brand Color</dt>
              <dd className="flex items-center gap-1.5">
                <span
                  className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: config.primaryColor }}
                />
                <span className="text-xs font-mono text-gray-400">
                  {config.primaryColor}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-xs text-gray-600">Accent Color</dt>
              <dd className="flex items-center gap-1.5">
                <span
                  className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: config.accentColor }}
                />
                <span className="text-xs font-mono text-gray-400">
                  {config.accentColor}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        {/* Recent activity */}
        <section className="rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-white mb-5">Recent Activity</h3>

          <ul className="space-y-3 flex-1">
            {ACTIVITY_PLACEHOLDER.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      item.type === 'pending'
                        ? '#374151'
                        : 'var(--color-primary)',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={
                      item.type === 'pending'
                        ? 'text-xs text-gray-600'
                        : 'text-xs text-gray-300'
                    }
                  >
                    {item.label}
                  </p>
                  <p className="text-[10px] text-gray-700 mt-0.5">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-5 pt-4 border-t border-white/[0.06] text-[11px] text-gray-700">
            Activity will populate as you use the platform.
          </p>
        </section>

      </div>
    </div>
  )
}
