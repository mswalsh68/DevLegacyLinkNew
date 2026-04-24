'use client'

// Dashboard content — matches the original project's light card design.
// White cards on a light page background, team-color accents, no dark shell.

import { useState } from 'react'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { useAuth } from '@/providers/AuthProvider'
import { AddMembersWizard } from '@/components/app/AddMembersWizard'

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
        backgroundColor: 'var(--color-card-bg)',
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

// ─── Button tile (opens modal — same visual as NavCard but a <button>) ────────

function ButtonCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon:        string
  title:       string
  description: string
  onClick:     () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border:          '1px solid var(--color-card-border)',
        borderRadius:    16,
        padding:         24,
        textAlign:       'left',
        cursor:          'pointer',
        display:         'block',
        width:           '100%',
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
      <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-gray-900)', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-gray-500)', marginTop: 6, marginBottom: 0 }}>
        {description}
      </p>
    </button>
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
    href:        '/feed',
    icon:        '📢',
    title:       'Team Feed',
    description: 'Post announcements to players and alumni',
  },
] as const

const ADMIN_LINKS = [
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

  const [wizardOpen, setWizardOpen] = useState(false)

  const isAdmin = ['global_admin', 'platform_owner', 'app_admin'].includes(user?.role ?? '')

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
        {isAdmin && ADMIN_LINKS.map((link) => (
          <NavCard key={link.href} {...link} />
        ))}
        <ButtonCard
          icon="➕"
          title="Add Members"
          description="Create players, alumni, or staff — one at a time, in bulk, or via invite link"
          onClick={() => setWizardOpen(true)}
        />
      </div>

      {/* ── Add Members Wizard ── */}

      {user?.currentTeamId && user?.appDb && (
        <AddMembersWizard
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          teamId={user.currentTeamId}
          teamName={config.teamName}
          sport={config.sport}
          positions={config.positions}
          academicYears={config.academicYears}
          userId={user.userId}
          appDb={user.appDb}
        />
      )}

    </>
  )
}
