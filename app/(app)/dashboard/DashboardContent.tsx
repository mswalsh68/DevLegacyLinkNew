'use client'

// Dashboard — polished, fully-themed, responsive.
// All colors come from CSS custom properties set by ThemeProvider.
// No hard-coded hex values outside of rgba() shadows.

import { useEffect, useState } from 'react'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { useAuth }       from '@/providers/AuthProvider'
import { can }           from '@/lib/permissions'
import { AddMembersWizard } from '@/components/app/AddMembersWizard'
import type { UserSession } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedPost {
  id:          string
  title:       string | null
  bodyHtml:    string
  audience:    string
  isPinned:    boolean
  publishedAt: string
  isRead:      boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z#\d]+;/gi, ' ').trim()
}

function relativeTime(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 2)  return 'Just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  <  7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const AUDIENCE_LABEL: Record<string, string> = {
  all:          'All',
  players_only: 'Players',
  alumni_only:  'Alumni',
  by_position:  'By Position',
  by_grad_year: 'By Year',
  custom:       'Custom',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Stat tile — clickable if href provided. */
function MetricTile({
  icon, label, value, loading, href,
}: {
  icon: string; label: string; value: number | string
  loading: boolean; href?: string
}) {
  const inner = (
    <div
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border:          '1px solid var(--color-card-border)',
        borderRadius:    'var(--radius-lg)',
        padding:         '18px 20px',
        boxShadow:       'var(--shadow-sm)',
        display:         'flex',
        alignItems:      'center',
        gap:             14,
        transition:      'box-shadow 0.15s, border-color 0.15s',
      }}
    >
      <div
        style={{
          width:           44,
          height:          44,
          borderRadius:    'var(--radius-md)',
          backgroundColor: 'var(--color-primary-light)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        20,
          flexShrink:      0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-gray-900)', lineHeight: 1 }}>
          {loading ? <span style={{ color: 'var(--color-gray-300)' }}>—</span> : value}
        </div>
        <div
          style={{
            fontSize:      11,
            color:         'var(--color-gray-500)',
            marginTop:     4,
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <a
        href={href}
        style={{ textDecoration: 'none', display: 'block' }}
        onMouseEnter={(e) => {
          const el = e.currentTarget.firstElementChild as HTMLElement | null
          if (el) { el.style.borderColor = 'var(--color-primary)'; el.style.boxShadow = 'var(--shadow-md)' }
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget.firstElementChild as HTMLElement | null
          if (el) { el.style.borderColor = 'var(--color-card-border)'; el.style.boxShadow = 'var(--shadow-sm)' }
        }}
      >
        {inner}
      </a>
    )
  }
  return inner
}

/** Feed post preview row inside the Recent Feed card. */
function FeedPreviewCard({ post }: { post: FeedPost }) {
  const excerpt = stripHtml(post.bodyHtml)
  const preview = excerpt.length > 110 ? excerpt.slice(0, 110) + '…' : excerpt

  return (
    <a
      href={`/feed/${post.id}`}
      style={{
        display:         'block',
        padding:         '12px 14px',
        borderRadius:    'var(--radius-md)',
        backgroundColor: post.isRead ? 'transparent' : 'var(--color-primary-light)',
        border:          `1px solid ${post.isRead ? 'var(--color-card-border)' : 'var(--color-primary)'}`,
        textDecoration:  'none',
        marginBottom:    8,
        transition:      'background-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {post.title && (
            <div
              style={{
                fontSize:     13,
                fontWeight:   600,
                color:        'var(--color-gray-900)',
                marginBottom: 2,
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {post.isPinned ? '📌 ' : ''}{post.title}
            </div>
          )}
          <div
            style={{
              fontSize:     13,
              color:        'var(--color-gray-600)',
              lineHeight:   1.4,
              whiteSpace:   'nowrap',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {preview || '(No content)'}
          </div>
        </div>
        <div
          style={{
            flexShrink:     0,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'flex-end',
            gap:            4,
          }}
        >
          <span
            style={{
              fontSize:        10,
              fontWeight:      700,
              color:           'var(--color-primary)',
              backgroundColor: 'var(--color-primary-light)',
              padding:         '2px 8px',
              borderRadius:    'var(--radius-full)',
              textTransform:   'uppercase',
              letterSpacing:   '0.06em',
            }}
          >
            {AUDIENCE_LABEL[post.audience] ?? post.audience}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>
            {relativeTime(post.publishedAt)}
          </span>
        </div>
      </div>
    </a>
  )
}

/** White card with a header row (title + optional "View all" link). */
function SectionCard({
  title, icon, href, hrefLabel = 'View all →', children,
}: {
  title: string; icon: string; href?: string; hrefLabel?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border:          '1px solid var(--color-card-border)',
        borderRadius:    'var(--radius-lg)',
        boxShadow:       'var(--shadow-sm)',
        overflow:        'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding:      '14px 20px',
          borderBottom: '1px solid var(--color-card-border)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-gray-900)', letterSpacing: '-0.01em' }}>
            {title}
          </h2>
        </div>
        {href && (
          <a
            href={href}
            style={{ fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}
          >
            {hrefLabel}
          </a>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '16px 20px' }}>
        {children}
      </div>
    </div>
  )
}

/** Primary / accent / ghost action button — full-width. */
function ActionButton({
  icon, label, href, onClick, variant = 'ghost',
}: {
  icon: string; label: string; href?: string
  onClick?: () => void; variant?: 'primary' | 'accent' | 'ghost'
}) {
  const base: React.CSSProperties = {
    display:         'flex',
    alignItems:      'center',
    gap:             10,
    padding:         '11px 16px',
    borderRadius:    'var(--radius-md)',
    fontSize:        14,
    fontWeight:      600,
    textDecoration:  'none',
    cursor:          'pointer',
    width:           '100%',
    transition:      'opacity 0.15s, background-color 0.15s',
    border:          variant === 'ghost' ? '1px solid var(--color-card-border)' : 'none',
    backgroundColor: variant === 'primary' ? 'var(--color-primary)'
      : variant === 'accent' ? 'var(--color-accent)'
      : 'var(--color-card-bg)',
    color: variant === 'primary' ? '#ffffff'
      : variant === 'accent'  ? 'var(--color-gray-900)'
      : 'var(--color-gray-700)',
    boxShadow: variant === 'ghost' ? 'none' : 'var(--shadow-sm)',
  }

  if (href) return <a href={href} style={base}><span>{icon}</span><span>{label}</span></a>
  return (
    <button type="button" onClick={onClick} style={base}>
      <span>{icon}</span><span>{label}</span>
    </button>
  )
}

/** Navigation card — links to a section. */
function NavCard({
  icon, title, description, href,
}: {
  icon: string; title: string; description: string; href: string
}) {
  return (
    <a
      href={href}
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border:          '1px solid var(--color-card-border)',
        borderRadius:    'var(--radius-lg)',
        padding:         24,
        textDecoration:  'none',
        display:         'block',
        boxShadow:       'var(--shadow-sm)',
        transition:      'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)'
        e.currentTarget.style.boxShadow   = 'var(--shadow-md)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-card-border)'
        e.currentTarget.style.boxShadow   = 'var(--shadow-sm)'
      }}
    >
      <div
        style={{
          width:           44,
          height:          44,
          borderRadius:    'var(--radius-md)',
          backgroundColor: 'var(--color-primary)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        20,
          marginBottom:    14,
        }}
      >
        {icon}
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-gray-900)', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-gray-500)', marginTop: 4, marginBottom: 0, lineHeight: 1.5 }}>
        {description}
      </p>
    </a>
  )
}

/** Same visual as NavCard but fires an onClick. */
function NavCardButton({
  icon, title, description, onClick,
}: {
  icon: string; title: string; description: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border:          '1px solid var(--color-card-border)',
        borderRadius:    'var(--radius-lg)',
        padding:         24,
        textAlign:       'left',
        cursor:          'pointer',
        display:         'block',
        width:           '100%',
        boxShadow:       'var(--shadow-sm)',
        transition:      'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)'
        e.currentTarget.style.boxShadow   = 'var(--shadow-md)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-card-border)'
        e.currentTarget.style.boxShadow   = 'var(--shadow-sm)'
      }}
    >
      <div
        style={{
          width:           44,
          height:          44,
          borderRadius:    'var(--radius-md)',
          backgroundColor: 'var(--color-primary)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        20,
          marginBottom:    14,
        }}
      >
        {icon}
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-gray-900)', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--color-gray-500)', marginTop: 4, marginBottom: 0, lineHeight: 1.5 }}>
        {description}
      </p>
    </button>
  )
}

// ─── Stat row inside the Engagement card ─────────────────────────────────────

function StatRow({
  label, value, loading, accentColor,
}: {
  label: string; value: number; loading: boolean; accentColor?: string
}) {
  return (
    <div
      style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        padding:        '6px 0',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--color-gray-600)' }}>{label}</span>
      <span
        style={{
          fontSize:   16,
          fontWeight: 700,
          color:      accentColor ?? 'var(--color-primary)',
        }}
      >
        {loading ? <span style={{ color: 'var(--color-gray-300)' }}>—</span> : value}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DashboardContentProps {
  role: string
}

export default function DashboardContent({ role }: DashboardContentProps) {
  const config   = useTeamConfig()
  const { user } = useAuth()

  const [wizardOpen,      setWizardOpen]      = useState(false)
  const [metricsLoading,  setMetricsLoading]  = useState(true)
  const [feedLoading,     setFeedLoading]      = useState(true)
  const [rosterCount,     setRosterCount]      = useState(0)
  const [alumniCount,     setAlumniCount]      = useState(0)
  const [recentPosts,     setRecentPosts]      = useState<FeedPost[]>([])
  const [unreadCount,     setUnreadCount]      = useState(0)

  // ── Derived display values ──────────────────────────────────────────────────
  const userAny     = user as unknown as Record<string, string | undefined>
  const firstName   = userAny?.firstName ?? null
  const displayName = firstName ?? user?.username ?? user?.email?.split('@')[0] ?? 'Coach'
  const roleLabel   = role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  // ── Permission flags ────────────────────────────────────────────────────────
  const canViewRoster  = can(user, 'roster:view')
  const canEditRoster  = can(user, 'roster:edit')
  const canViewAlumni  = can(user, 'alumni:view')
  const canTransfer    = can(user, 'roster:transfer')
  const canFeedPlayers = can(user, 'feed:players')
  const canFeedAlumni  = can(user, 'feed:alumni')
  const canSeeFeed     = canFeedPlayers || canFeedAlumni
  const canPost        = canSeeFeed   // staff + players + alumni can view; staff can create
  const canSettings    = can(user, 'settings:view')
  const isStaff        = canViewRoster || canViewAlumni

  const canCreatePost  = ['platform_owner','app_admin','head_coach','position_coach','alumni_director']
    .includes(user?.role ?? '')

  // ── Fetch roster + alumni counts ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    const fetches: Promise<void>[] = []

    if (canViewRoster) {
      fetches.push(
        fetch('/api/players?pageSize=1', { credentials: 'include' })
          .then((r) => r.json())
          .then((res: { total?: number }) => { if (res.total != null) setRosterCount(res.total) })
          .catch(() => {}),
      )
    }

    if (canViewAlumni) {
      fetches.push(
        fetch('/api/alumni?pageSize=1', { credentials: 'include' })
          .then((r) => r.json())
          .then((res: { total?: number }) => { if (res.total != null) setAlumniCount(res.total) })
          .catch(() => {}),
      )
    }

    Promise.allSettled(fetches).finally(() => setMetricsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId])

  // ── Fetch recent feed ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !canSeeFeed) {
      setFeedLoading(false)
      return
    }

    fetch('/api/feed?pageSize=5', { credentials: 'include' })
      .then((r) => r.json())
      .then((res: { success: boolean; data?: FeedPost[] }) => {
        if (res.success && Array.isArray(res.data)) {
          setRecentPosts(res.data.slice(0, 5))
          setUnreadCount(res.data.filter((p) => !p.isRead).length)
        }
      })
      .catch(() => {})
      .finally(() => setFeedLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, canSeeFeed])

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Responsive grid classes ── */}
      <style>{`
        .db-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
          gap: 16px;
        }
        .db-main {
          display: grid;
          grid-template-columns: 1fr 272px;
          gap: 24px;
          align-items: start;
        }
        .db-nav {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 20px;
        }
        @media (max-width: 1023px) {
          .db-main { grid-template-columns: 1fr; }
        }
        @media (max-width: 639px) {
          .db-metrics { grid-template-columns: 1fr 1fr; gap: 12px; }
          .db-nav     { grid-template-columns: 1fr 1fr; gap: 14px; }
        }
        @media (max-width: 399px) {
          .db-metrics { grid-template-columns: 1fr; }
          .db-nav     { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Hero banner ────────────────────────────────────────────────────── */}
      <div
        style={{
          background:    'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
          borderRadius:  'var(--radius-xl)',
          padding:       '28px 32px',
          marginBottom:  28,
          display:       'flex',
          alignItems:    'center',
          justifyContent:'space-between',
          gap:           16,
          flexWrap:      'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>
            Welcome back, {displayName}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 8, marginBottom: 0 }}>
            <span
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                padding:         '2px 10px',
                borderRadius:    'var(--radius-full)',
                marginRight:     8,
                fontWeight:      500,
              }}
            >
              {roleLabel}
            </span>
            {config.teamName}
          </p>
        </div>
        {config.logoUrl && (
          <img
            src={config.logoUrl}
            alt={config.teamName}
            style={{ height: 56, width: 'auto', objectFit: 'contain', opacity: 0.88, flexShrink: 0 }}
          />
        )}
      </div>

      {/* ── Metric tiles ───────────────────────────────────────────────────── */}
      {isStaff && (
        <div className="db-metrics" style={{ marginBottom: 28 }}>
          {canViewRoster && (
            <MetricTile
              icon="🏈"
              label="Active Roster"
              value={rosterCount}
              loading={metricsLoading}
              href="/roster"
            />
          )}
          {canViewAlumni && (
            <MetricTile
              icon="🎓"
              label="Alumni"
              value={alumniCount}
              loading={metricsLoading}
              href="/alumni"
            />
          )}
          {canSeeFeed && (
            <MetricTile
              icon="📢"
              label="Recent Posts"
              value={recentPosts.length}
              loading={feedLoading}
              href="/feed"
            />
          )}
          {canSeeFeed && (
            <MetricTile
              icon="🔔"
              label="Unread"
              value={unreadCount}
              loading={feedLoading}
              href="/feed"
            />
          )}
        </div>
      )}

      {/* ── Main two-column layout ─────────────────────────────────────────── */}
      <div className="db-main" style={{ marginBottom: 28 }}>

        {/* Left column: Recent Feed */}
        {canSeeFeed ? (
          <SectionCard title="Recent Feed" icon="📢" href="/feed" hrefLabel="View all →">
            {feedLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-gray-400)', fontSize: 14 }}>
                Loading…
              </div>
            ) : recentPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 14, color: 'var(--color-gray-500)', marginBottom: 12 }}>
                  No posts yet.
                </div>
                {canCreatePost && (
                  <a
                    href="/feed/new"
                    style={{
                      display:         'inline-block',
                      padding:         '9px 20px',
                      backgroundColor: 'var(--color-primary)',
                      color:           '#fff',
                      borderRadius:    'var(--radius-md)',
                      textDecoration:  'none',
                      fontSize:        14,
                      fontWeight:      600,
                    }}
                  >
                    Create First Post →
                  </a>
                )}
              </div>
            ) : (
              recentPosts.map((post) => <FeedPreviewCard key={post.id} post={post} />)
            )}
          </SectionCard>
        ) : (
          <SectionCard title="Your Feed" icon="📢" href="/feed" hrefLabel="Open feed →">
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-gray-600)', lineHeight: 1.6 }}>
              Stay connected with {config.teamName}. View announcements, updates,
              and messages from your coaches.
            </p>
            <a
              href="/feed"
              style={{
                display:         'inline-block',
                marginTop:       16,
                padding:         '10px 22px',
                backgroundColor: 'var(--color-primary)',
                color:           '#fff',
                borderRadius:    'var(--radius-md)',
                textDecoration:  'none',
                fontSize:        14,
                fontWeight:      600,
              }}
            >
              View Feed →
            </a>
          </SectionCard>
        )}

        {/* Right column: Quick Actions + Engagement */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Quick Actions */}
          <SectionCard title="Quick Actions" icon="⚡">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {canCreatePost && (
                <ActionButton icon="✏️" label="New Post" href="/feed/new" variant="primary" />
              )}
              {canCreatePost && (
                <ActionButton icon="📧" label="Create Email Campaign" href="/feed/new" variant="accent" />
              )}
              {isStaff && user?.currentTeamId && user?.appDb && (
                <ActionButton
                  icon="➕"
                  label="Add Members"
                  onClick={() => setWizardOpen(true)}
                  variant="ghost"
                />
              )}
              {canTransfer && (
                <ActionButton icon="🎓" label="Transfer to Alumni" href="/roster/transfer" variant="ghost" />
              )}
              {canViewRoster && !canCreatePost && (
                <ActionButton icon="📋" label="View Roster" href="/roster" variant="primary" />
              )}
              {canViewAlumni && !canCreatePost && (
                <ActionButton icon="🎓" label="View Alumni" href="/alumni" variant="ghost" />
              )}
            </div>
          </SectionCard>

          {/* Alumni Engagement */}
          {canViewAlumni && (
            <SectionCard title="Alumni Engagement" icon="🎓" href="/alumni" hrefLabel="View →">
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize:        36,
                    fontWeight:      800,
                    color:           'var(--color-accent-dark)',
                    lineHeight:      1,
                  }}
                >
                  {metricsLoading ? '—' : alumniCount}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Alumni in network
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--color-card-border)', paddingTop: 12 }}>
                <p style={{ fontSize: 13, color: 'var(--color-gray-500)', margin: 0, lineHeight: 1.5 }}>
                  Track interactions, log outreach, and manage your alumni network.
                </p>
              </div>
            </SectionCard>
          )}

          {/* Player Communications */}
          {canViewRoster && (
            <SectionCard title="Player Communications" icon="💬" href="/roster" hrefLabel="View →">
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize:   36,
                    fontWeight: 800,
                    color:      'var(--color-primary)',
                    lineHeight: 1,
                  }}
                >
                  {metricsLoading ? '—' : rosterCount}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Active players
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--color-card-border)', paddingTop: 12 }}>
                <p style={{ fontSize: 13, color: 'var(--color-gray-500)', margin: 0, lineHeight: 1.5 }}>
                  {canCreatePost
                    ? 'Send posts and announcements to your current roster.'
                    : 'View and manage the current active roster.'}
                </p>
              </div>
            </SectionCard>
          )}

        </div>
      </div>

      {/* ── Navigation cards row ───────────────────────────────────────────── */}
      <div className="db-nav">
        {canViewRoster && (
          <NavCard
            href="/roster"
            icon="🏈"
            title={config.rosterLabel ?? 'Active Roster'}
            description="Manage current players, positions & jersey numbers"
          />
        )}
        {canViewAlumni && (
          <NavCard
            href="/alumni"
            icon="🎓"
            title={config.alumniLabel ?? 'Alumni'}
            description="Track graduates and manage alumni outreach"
          />
        )}
        {canSeeFeed && (
          <NavCard
            href="/feed"
            icon="📢"
            title="Team Feed"
            description="View and post announcements to players and alumni"
          />
        )}
        {canSettings && (
          <NavCard
            href="/settings"
            icon="⚙️"
            title="Settings"
            description="Edit team config, branding colors & roster positions"
          />
        )}
        {isStaff && user?.currentTeamId && user?.appDb && (
          <NavCardButton
            icon="➕"
            title="Add Members"
            description="Add players, alumni, or staff — one at a time or in bulk"
            onClick={() => setWizardOpen(true)}
          />
        )}
      </div>

      {/* ── Add Members Wizard ────────────────────────────────────────────── */}
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
