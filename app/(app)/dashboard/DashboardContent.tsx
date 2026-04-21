'use client'

// Dashboard content — matches the original project's light card design.
// White cards on a light page background, team-color accents, no dark shell.

import { useTeamConfig } from '@/providers/ThemeProvider'
import { useAuth } from '@/providers/AuthProvider'

// ─── Quick-access tile (icon + title + description) ───────────────────────────

function NavCard({
  icon,
  title,
  description,
  href,
}: {
  icon: string
  title: string
  description: string
  href: string
}) {
  return (
    <a
      href={href}
      style={{
        backgroundColor: '#fff',
        border:          '1px solid var(--color-card-border)',
        borderRadius:    16,
        padding:         24,
        textDecoration:  'none',
        display:         'block',
        boxShadow:       '0 1px 3px rgba(0,0,0,0.06)',
        transition:      'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)'
        e.currentTarget.style.boxShadow   = '0 4px 12px rgba(0,0,0,0.10)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-card-border)'
        e.currentTarget.style.boxShadow   = '0 1px 3px rgba(0,0,0,0.06)'
      }}
    >
      <div
        style={{
          width:           48,
          height:          48,
          borderRadius:    12,
          backgroundColor: 'var(--color-primary)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        24,
          marginBottom:    16,
        }}
      >
        {icon}
      </div>
      <h2
        style={{
          fontSize:   17,
          fontWeight: 600,
          color:      'var(--color-gray-900)',
          margin:     0,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize:   13,
          color:      'var(--color-gray-500)',
          marginTop:  6,
          marginBottom: 0,
        }}
      >
        {description}
      </p>
    </a>
  )
}

// ─── Config row ───────────────────────────────────────────────────────────────

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        padding:        '10px 0',
        borderBottom:   '1px solid var(--color-gray-100)',
      }}
    >
      <dt style={{ fontSize: 13, color: 'var(--color-gray-500)' }}>{label}</dt>
      <dd style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-gray-900)', margin: 0 }}>
        {value}
      </dd>
    </div>
  )
}

// ─── Quick links ──────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    href:        '/roster',
    icon:        '🏈',
    title:       'Active Roster',
    description: 'Manage current players & jersey numbers',
  },
  {
    href:        '/alumni',
    icon:        '🎓',
    title:       'Alumni',
    description: 'Track graduates and run outreach',
  },
  {
    href:        '/roster/transfer',
    icon:        '↗️',
    title:       'Transfer',
    description: 'Move players to the alumni database',
  },
  {
    href:        '/settings',
    icon:        '⚙️',
    title:       'Settings',
    description: 'Edit team config, colors & positions',
  },
] as const

// ─── Component ────────────────────────────────────────────────────────────────

interface DashboardContentProps {
  role: string
}

export default function DashboardContent({ role }: DashboardContentProps) {
  const config      = useTeamConfig()
  const { user }    = useAuth()
  const displayName = user?.username ?? user?.email ?? 'Coach'
  const roleLabel   = role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <>
      {/* ── Welcome header ── */}
      <h1
        style={{
          fontSize:   24,
          fontWeight: 700,
          color:      'var(--color-gray-900)',
          margin:     0,
        }}
      >
        Welcome back, {displayName}
      </h1>
      <p
        style={{
          fontSize:     14,
          color:        'var(--color-gray-500)',
          marginTop:    4,
          marginBottom: 32,
        }}
      >
        {roleLabel} &middot; {config.teamName}
      </p>

      {/* ── Quick-access cards ── */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap:                 24,
          marginBottom:        40,
        }}
      >
        {QUICK_LINKS.map((link) => (
          <NavCard key={link.href} {...link} />
        ))}
      </div>

      {/* ── Bottom: team config snapshot ── */}
      <div
        style={{
          backgroundColor: '#fff',
          border:          '1px solid var(--color-card-border)',
          borderRadius:    16,
          padding:         24,
          boxShadow:       '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            marginBottom:   16,
          }}
        >
          <h3
            style={{
              fontSize:   16,
              fontWeight: 600,
              color:      'var(--color-gray-900)',
              margin:     0,
            }}
          >
            Team Configuration
          </h3>
          <a
            href="/settings"
            style={{
              fontSize:       13,
              fontWeight:     500,
              color:          'var(--color-primary)',
              textDecoration: 'none',
            }}
          >
            Edit →
          </a>
        </div>

        <dl style={{ margin: 0 }}>
          <ConfigRow label="Team"           value={config.teamName} />
          <ConfigRow label="Sport"          value={config.sport} />
          <ConfigRow label="Level"          value={config.level} />
          <ConfigRow label="Positions"      value={`${config.positions.length} configured`} />
          <ConfigRow label="Academic Years" value={`${config.academicYears.length} configured`} />

          {/* Color swatches */}
          <div
            style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              padding:        '10px 0',
              borderBottom:   '1px solid var(--color-gray-100)',
            }}
          >
            <dt style={{ fontSize: 13, color: 'var(--color-gray-500)' }}>Brand Color</dt>
            <dd style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span
                style={{
                  width:           16,
                  height:          16,
                  borderRadius:    4,
                  backgroundColor: config.primaryColor,
                  flexShrink:      0,
                  border:          '1px solid rgba(0,0,0,0.08)',
                }}
              />
              <span
                style={{
                  fontSize:    12,
                  fontFamily:  'monospace',
                  color:       'var(--color-gray-600)',
                }}
              >
                {config.primaryColor}
              </span>
            </dd>
          </div>

          <div
            style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              padding:        '10px 0',
            }}
          >
            <dt style={{ fontSize: 13, color: 'var(--color-gray-500)' }}>Accent Color</dt>
            <dd style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span
                style={{
                  width:           16,
                  height:          16,
                  borderRadius:    4,
                  backgroundColor: config.accentColor,
                  flexShrink:      0,
                  border:          '1px solid rgba(0,0,0,0.08)',
                }}
              />
              <span
                style={{
                  fontSize:    12,
                  fontFamily:  'monospace',
                  color:       'var(--color-gray-600)',
                }}
              >
                {config.accentColor}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </>
  )
}
