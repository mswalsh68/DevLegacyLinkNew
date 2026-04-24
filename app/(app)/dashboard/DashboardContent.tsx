'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { useAuth } from '@/providers/AuthProvider'
import { can } from '@/lib/permissions'
import { hasFeature, normalizeTier } from '@/lib/features'
import { theme } from '@/lib/theme'
import { AddMembersWizard } from '@/components/app/AddMembersWizard'
import AllEngagementTab from './AllEngagementTab'
import AlumniTab from './AlumniTab'
import PlayerTab from './PlayerTab'

// ─── Sport option type (mirrors SportOption from procedures.ts) ────────────────

interface SportOption {
  id:   string
  name: string
  abbr: string
}

// ─── Quick-access nav tile ─────────────────────────────────────────────────────
// Compact row: 36px icon + title. Used in the admin tiles grid.

function NavTile({ icon, title, href, onClick }: {
  icon:     string
  title:    string
  href?:    string
  onClick?: () => void
}) {
  const router = useRouter()
  return (
    <button
      onClick={() => (onClick ? onClick() : router.push(href ?? '/'))}
      style={{
        backgroundColor: theme.cardBg,
        border:          `1px solid ${theme.cardBorder}`,
        borderRadius:    12,
        padding:         '16px 20px',
        textAlign:       'left',
        cursor:          'pointer',
        boxShadow:       theme.shadowSm,
        transition:      'border-color 0.15s',
        display:         'flex',
        alignItems:      'center',
        gap:             12,
        width:           '100%',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = theme.primary)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = theme.cardBorder)}
    >
      <div style={{
        width:           36,
        height:          36,
        borderRadius:    8,
        backgroundColor: theme.primaryLight,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontSize:        18,
        flexShrink:      0,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 15, fontWeight: 600, color: theme.gray900 }}>{title}</span>
    </button>
  )
}

// ─── Non-admin module card ─────────────────────────────────────────────────────
// Larger card with 48px icon + title + description.

function NavCard({ icon, title, description, href, hoverColor = theme.primary }: {
  icon:        string
  title:       string
  description: string
  href:        string
  hoverColor?: string
}) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push(href)}
      style={{
        backgroundColor: theme.cardBg,
        border:          `1px solid ${theme.cardBorder}`,
        borderRadius:    16,
        padding:         24,
        textAlign:       'left',
        cursor:          'pointer',
        boxShadow:       theme.shadowSm,
        transition:      'border-color 0.15s',
        width:           '100%',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = hoverColor)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = theme.cardBorder)}
    >
      <div style={{
        width:           48,
        height:          48,
        borderRadius:    12,
        backgroundColor: theme.primary,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontSize:        24,
        marginBottom:    16,
      }}>
        {icon}
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: theme.gray900, margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 13, color: theme.gray500, marginTop: 6, marginBottom: 0 }}>{description}</p>
    </button>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type TabId = 'all' | 'alumni' | 'players'

function TabBar({ active, showAlumni, onChange }: {
  active:     TabId
  showAlumni: boolean
  onChange:   (t: TabId) => void
}) {
  const tabStyle = (id: TabId): CSSProperties => ({
    padding:         '10px 20px',
    fontSize:        14,
    fontWeight:      600,
    cursor:          'pointer',
    border:          'none',
    borderBottom:    `2px solid ${active === id ? theme.primary : 'transparent'}`,
    backgroundColor: 'transparent',
    color:           active === id ? theme.primary : theme.gray500,
    transition:      'color 0.15s, border-color 0.15s',
    whiteSpace:      'nowrap',
  })

  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${theme.gray200}`, marginBottom: 24, gap: 4, overflowX: 'auto' }}>
      <button style={tabStyle('all')} onClick={() => onChange('all')}>
        📊 All Engagement
      </button>
      {showAlumni && (
        <button style={tabStyle('alumni')} onClick={() => onChange('alumni')}>
          🎓 Alumni Engagement
        </button>
      )}
      <button style={tabStyle('players')} onClick={() => onChange('players')}>
        🏈 Player Communications
      </button>
    </div>
  )
}

// ─── Sport Dropdown ───────────────────────────────────────────────────────────

function SportDropdown({ sports, value, onChange }: {
  sports:   SportOption[]
  value:    string | null
  onChange: (id: string | null) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: theme.gray700 }}>Viewing:</span>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        style={{
          padding:         '6px 32px 6px 12px',
          borderRadius:    theme.radiusSm,
          border:          `1px solid ${theme.cardBorder}`,
          backgroundColor: theme.cardBg,
          fontSize:        14,
          color:           theme.gray900,
          cursor:          'pointer',
          fontWeight:      500,
          appearance:      'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat:   'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
      >
        <option value="">All Sports</option>
        {sports.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading } = useAuth()
  const config       = useTeamConfig()
  const tier         = normalizeTier(config.subscriptionTier ?? 'starter')

  const [wizardOpen, setWizardOpen] = useState(false)
  const [sports,     setSports]     = useState<SportOption[]>([])
  const [sportId,    setSportId]    = useState<string | null>(null)

  // ── Permission flags ──────────────────────────────────────────────────────
  const canViewRoster = can(user, 'roster:view')
  const canViewAlumni = can(user, 'alumni:view')
  const canSeeFeed    = can(user, 'feed:players') || can(user, 'feed:alumni')
  const canSettings   = can(user, 'settings:view')

  // Staff = anyone who can view roster or alumni (coaches, alumni directors, etc.)
  const isStaff = canViewRoster || canViewAlumni

  // Whether the alumni comms tab is available for this tenant tier AND user role
  const alumniTabVisible = hasFeature(tier, 'alumni_dashboard') && canViewAlumni

  // ── Load sports (only for staff) ─────────────────────────────────────────
  useEffect(() => {
    if (!isStaff) return
    fetch('/api/sports', { credentials: 'include' })
      .then(r => r.json())
      .then(res => {
        if (res.success) setSports(res.data ?? [])
      })
      .catch(() => { /* non-fatal */ })
  }, [isStaff])

  // Show sport dropdown only when user has access to 2+ sports
  const showSportFilter = sports.length > 1

  // ── Tab state (URL-persisted) ─────────────────────────────────────────────
  const tabParam = searchParams.get('tab') as TabId | null
  const validTab: TabId =
    tabParam === 'alumni'   && alumniTabVisible ? 'alumni'
    : tabParam === 'players'                    ? 'players'
    : tabParam === 'all'                        ? 'all'
    : 'all'   // default: All Engagement

  const [activeTab, setActiveTab] = useState<TabId>(validTab)

  const changeTab = (t: TabId) => {
    setActiveTab(t)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', t)
    router.replace(`/dashboard?${params.toString()}`, { scroll: false })
  }

  // ── Derived display values ────────────────────────────────────────────────
  const userAny     = user as unknown as Record<string, string | undefined>
  const displayName = userAny?.firstName ?? user?.username ?? user?.email?.split('@')[0] ?? 'Coach'
  const roleDisplay = (user?.role ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  // Prevent flicker
  if (isLoading) return null
  if (!user)     return null

  return (
    <>
      {/* ── Welcome ── */}
      <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.gray900, margin: 0 }}>
        Welcome back, {displayName}
      </h1>
      <p style={{ fontSize: 14, color: theme.gray500, marginTop: 4, marginBottom: 28 }}>
        {roleDisplay}
      </p>

      {isStaff ? (
        <>
          {/* ── Quick-access tiles ── */}
          <div style={{
            display:               'grid',
            gridTemplateColumns:   'repeat(auto-fill, minmax(180px, 1fr))',
            gap:                   12,
            marginBottom:          36,
          }}>
            {canViewRoster && (
              <NavTile href="/roster"  icon="🏈" title={config.rosterLabel ?? 'Active Roster'} />
            )}
            {canViewAlumni && (
              <NavTile href="/alumni"  icon="🎓" title={config.alumniLabel ?? 'Alumni'} />
            )}
            {canSettings && (
              <NavTile href="/settings" icon="⚙️" title="Team Settings" />
            )}
            {canSeeFeed && (
              <NavTile href="/feed"    icon="📬" title="Feed" />
            )}
            {isStaff && user.currentTeamId && user.appDb && (
              <NavTile icon="➕" title="Add Member" onClick={() => setWizardOpen(true)} />
            )}
          </div>

          {/* ── Communications tab bar ── */}
          <TabBar active={activeTab} showAlumni={alumniTabVisible} onChange={changeTab} />

          {/* ── Sport filter dropdown (shown when user has 2+ sports) ── */}
          {showSportFilter && (
            <SportDropdown sports={sports} value={sportId} onChange={setSportId} />
          )}

          {/* ── Active tab content ── */}
          {activeTab === 'all'    && <AllEngagementTab sportId={sportId} />}
          {activeTab === 'alumni' && <AlumniTab        sportId={sportId} />}
          {activeTab === 'players'&& <PlayerTab        sportId={sportId} />}
        </>
      ) : (
        /* ── Non-staff: module access cards ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
          {canViewRoster && (
            <NavCard
              href="/roster"
              icon="🏈"
              title={config.rosterLabel ?? 'Active Roster'}
              description="View current players"
              hoverColor={theme.primary}
            />
          )}
          {can(user, 'feed:players') && (
            <NavCard
              href="/feed"
              icon="📬"
              title="Team Feed"
              description="View announcements and messages from your coaches"
              hoverColor={theme.primary}
            />
          )}
          {can(user, 'feed:alumni') && (
            <NavCard
              href="/feed"
              icon="🎓"
              title="Alumni Feed"
              description="Stay connected with alumni news and outreach"
              hoverColor={theme.accent}
            />
          )}
        </div>
      )}

      {/* ── Add Member Wizard ── */}
      {user.currentTeamId && user.appDb && (
        <AddMembersWizard
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          teamId={user.currentTeamId}
          teamName={config.teamName}
          sport={config.sport}
          sports={sports}
          positions={config.positions}
          academicYears={config.academicYears}
          userId={user.userId}
          appDb={user.appDb}
        />
      )}
    </>
  )
}
