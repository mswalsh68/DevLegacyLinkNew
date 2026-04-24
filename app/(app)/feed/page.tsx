'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import DOMPurify from 'isomorphic-dompurify'
import { useAuth } from '@/providers/AuthProvider'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { can, requiredRoleLabel, roleLabel } from '@/lib/permissions'
import { resolvePostTokens } from '@/lib/feedTokens'
import { AUDIENCE_BADGE } from '@/lib/statusMappings'
import { theme } from '@/lib/theme'
import { Alert }        from '@/components/ui/Alert'
import { Badge }        from '@/components/ui/Badge'
import { Button }       from '@/components/ui/Button'
import { AccessDenied } from '@/components/ui/AccessDenied'
import type { TeamConfig } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedPost {
  id:            string
  title:         string | null
  bodyHtml:      string
  audience:      string
  isPinned:      boolean
  isWelcomePost: boolean
  createdBy:     string
  publishedAt:   string
  isRead:        boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIENCE_LABEL: Record<string, string> = {
  all:          'All',
  players_only: 'Players',
  alumni_only:  'Alumni',
  by_position:  'By Position',
  by_grad_year: 'By Grad Year',
  custom:       'Custom',
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['b','i','em','strong','a','p','ul','ol','li','br','h1','h2','h3','span','div'],
  ALLOWED_ATTR: ['href','style','target'],
}

const PAGE_SIZE = 20

// Staff roles that can create posts (matches guardAppWrite on the API)
const CAN_POST_ROLES = ['platform_owner','app_admin','head_coach','position_coach','alumni_director']

// ─── FeedCard ─────────────────────────────────────────────────────────────────

function FeedCard({
  post,
  onRead,
  onNavigate,
  config,
}: {
  post:       FeedPost
  onRead:     (id: string) => void
  onNavigate: (id: string) => void
  config:     TeamConfig
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const marked  = useRef(false)

  // IntersectionObserver: auto-mark as read when 60% visible
  useEffect(() => {
    if (post.isRead || marked.current) return
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !marked.current) {
          marked.current = true
          onRead(post.id)
          observer.disconnect()
        }
      },
      { threshold: 0.6 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [post.id, post.isRead, onRead])

  const published = new Date(post.publishedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const resolvedHtml = post.isWelcomePost
    ? resolvePostTokens(post.bodyHtml, config)
    : post.bodyHtml
  const safeHtml = DOMPurify.sanitize(resolvedHtml, SANITIZE_CONFIG)

  const resolvedTitle = post.title
    ? (post.isWelcomePost ? resolvePostTokens(post.title, config) : post.title)
    : null

  return (
    <div
      ref={cardRef}
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border:          `1px solid ${post.isRead ? 'var(--color-card-border)' : 'var(--color-primary)'}`,
        borderRadius:    'var(--radius-lg)',
        padding:         '20px 24px',
        position:        'relative',
        boxShadow:       post.isRead ? 'var(--shadow-sm)' : '0 0 0 1px var(--color-primary)',
        transition:      'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Unread dot */}
      {!post.isRead && (
        <div
          style={{
            position:        'absolute',
            top:             16,
            right:           16,
            width:           8,
            height:          8,
            borderRadius:    '50%',
            backgroundColor: 'var(--color-primary)',
          }}
        />
      )}

      {/* Meta row: pinned indicator + audience badge + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {post.isPinned && (
          <span style={{ fontSize: 12, color: 'var(--color-accent-dark)', fontWeight: 700 }}>
            📌 Pinned
          </span>
        )}
        <Badge
          label={AUDIENCE_LABEL[post.audience] ?? post.audience}
          variant={AUDIENCE_BADGE[post.audience] ?? 'gray'}
        />
        <span style={{ fontSize: 12, color: theme.gray400, marginLeft: 'auto' }}>
          {published}
        </span>
      </div>

      {/* Title — omitted for welcome posts (body carries the heading) */}
      {resolvedTitle && !post.isWelcomePost && (
        <h2 style={{ fontSize: 16, fontWeight: 700, color: theme.gray900, margin: '0 0 12px 0' }}>
          {resolvedTitle}
        </h2>
      )}

      {/* Rendered body HTML */}
      <div
        className="feed-body"
        style={{ fontSize: 15, lineHeight: 1.7, color: theme.gray800 }}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {/* View stats link */}
      <div style={{ marginTop: 14, textAlign: 'right' }}>
        <button
          onClick={() => onNavigate(post.id)}
          style={{
            background: 'none',
            border:     'none',
            color:      theme.gray400,
            fontSize:   12,
            cursor:     'pointer',
            padding:    0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = theme.gray400)}
        >
          View stats →
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const router          = useRouter()
  const config          = useTeamConfig()
  const { user, isLoading } = useAuth()

  const [posts,   setPosts]   = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)

  const canView = can(user, 'feed:players') || can(user, 'feed:alumni')
  const canPost = CAN_POST_ROLES.includes(user?.role ?? '')

  const fetchFeed = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/feed?page=${p}&pageSize=${PAGE_SIZE}`, { credentials: 'include' })
      const data = await res.json() as { success: boolean; data: FeedPost[]; total: number; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Failed to load feed')
      setPosts(prev => p === 1 ? (data.data ?? []) : [...prev, ...(data.data ?? [])])
      setTotal(data.total ?? 0)
    } catch {
      setError('Failed to load feed.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canView) fetchFeed(1)
  }, [canView, fetchFeed])

  const handleRead = useCallback((postId: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isRead: true } : p))
    fetch(`/api/feed/${postId}/read`, { method: 'POST', credentials: 'include' })
      .catch(() => { /* fire-and-forget */ })
  }, [])

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    fetchFeed(next)
  }

  const hasMore = posts.length < total

  // ── Access control ──────────────────────────────────────────────────────────
  if (isLoading) return null
  if (!canView) {
    return (
      <AccessDenied
        currentRole={roleLabel(user?.role)}
        requiredRole={requiredRoleLabel('feed:players')}
      />
    )
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.gray900, margin: 0 }}>
            {config.teamName} Feed
          </h1>
          <p style={{ fontSize: 14, color: theme.gray500, marginTop: 4 }}>
            {total} {total === 1 ? 'post' : 'posts'}
          </p>
        </div>
        {canPost && (
          <Button label="+ New Post" onClick={() => router.push('/feed/new')} />
        )}
      </div>

      {error && <Alert message={error} variant="error" onClose={() => setError('')} />}

      {/* Post list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: theme.gray400 }}>
            Loading...
          </div>
        ) : posts.length === 0 ? (
          <div
            style={{
              textAlign:       'center',
              padding:         60,
              color:           theme.gray400,
              backgroundColor: 'var(--color-card-bg)',
              borderRadius:    'var(--radius-lg)',
              border:          `1px dashed var(--color-card-border)`,
            }}
          >
            No posts yet.{canPost && ' Use the button above to create the first post.'}
          </div>
        ) : (
          posts.map(post => (
            <FeedCard
              key={post.id}
              post={post}
              onRead={handleRead}
              onNavigate={id => router.push(`/feed/${id}`)}
              config={config}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button
            label="Load More"
            variant="outline"
            onClick={handleLoadMore}
          />
        </div>
      )}
      {loading && posts.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 20, color: theme.gray400, fontSize: 13 }}>
          Loading more...
        </div>
      )}
    </>
  )
}
