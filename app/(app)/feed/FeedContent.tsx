'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { requiredRoleLabel, roleLabel } from '@/lib/permissions'
import { resolvePostTokens } from '@/lib/feedTokens'
import { AUDIENCE_BADGE } from '@/lib/statusMappings'
import { useSafeHtml } from '@/hooks/useSafeHtml'
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
  sportId:       number | null
  sportName:     string | null
  isPinned:      boolean
  isWelcomePost: boolean
  imageUrl:      string | null
  createdBy:     number
  createdByName: string
  publishedAt:   string
  updatedAt:     string | null
  isRead:        boolean
  likeCount:     number
  userHasLiked:  boolean
}

interface FeedContentProps {
  canView:      boolean
  canPost:      boolean
  canDeleteAny: boolean
  canPin:       boolean
  postScope:    'own_sport' | 'any_sport' | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIENCE_LABEL: Record<string, string> = {
  all_sports:     'All Sports',
  sport_specific: 'Sport',
  all:            'All',
  players_only:   'Players',
  alumni_only:    'Alumni',
  by_position:    'By Position',
  by_grad_year:   'By Grad Year',
  custom:         'Custom',
}

const PAGE_SIZE = 20

// ─── FeedCard ─────────────────────────────────────────────────────────────────

function FeedCard({
  post,
  currentUserId,
  canDeleteAny,
  canPin,
  onRead,
  onNavigate,
  onLike,
  onDelete,
  onEdit,
  onPin,
  config,
}: {
  post:          FeedPost
  currentUserId: number
  canDeleteAny:  boolean
  canPin:        boolean
  onRead:        (id: string) => void
  onNavigate:    (id: string) => void
  onLike:        (id: string) => void
  onDelete:      (id: string) => void
  onEdit:        (id: string, newBody: string) => void
  onPin:         (id: string) => void
  config:        TeamConfig
}) {
  const cardRef    = useRef<HTMLDivElement>(null)
  const marked     = useRef(false)
  const [editing,  setEditing]  = useState(false)
  const [editBody, setEditBody] = useState(post.bodyHtml)
  const [saving,   setSaving]   = useState(false)
  const [editErr,  setEditErr]  = useState('')

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
  const safeHtml = useSafeHtml(editing ? editBody : resolvedHtml)

  const resolvedTitle = post.title
    ? (post.isWelcomePost ? resolvePostTokens(post.title, config) : post.title)
    : null

  const isOwner   = post.createdBy === currentUserId
  const canEdit   = isOwner && !post.isWelcomePost
  const canDelete = isOwner || canDeleteAny

  const audienceLabel = post.audience === 'sport_specific' && post.sportName
    ? post.sportName
    : (AUDIENCE_LABEL[post.audience] ?? post.audience)

  const resolvedImageUrl = post.isWelcomePost && post.imageUrl
    ? resolvePostTokens(post.imageUrl, config)
    : null

  async function handleSaveEdit() {
    if (!editBody.trim()) return
    setSaving(true)
    setEditErr('')
    try {
      const res = await fetch(`/api/feed/${post.id}`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ bodyHtml: editBody }),
      })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Failed to save')
      onEdit(post.id, editBody)
      setEditing(false)
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={cardRef}
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border:          `1px solid ${post.isRead ? 'var(--color-card-border)' : 'var(--color-primary)'}`,
        borderRadius:    'var(--radius-lg)',
        overflow:        'hidden',
        position:        'relative',
        boxShadow:       post.isRead ? 'var(--shadow-sm)' : '0 0 0 1px var(--color-primary)',
        transition:      'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {resolvedImageUrl && (
        <div style={{
          backgroundColor: 'var(--color-primary)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         '24px 32px',
          minHeight:       120,
        }}>
          <img
            src={resolvedImageUrl}
            alt={config.teamName}
            style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}
      <div style={{ padding: '20px 24px', position: 'relative' }}>

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {post.isPinned && (
          <span style={{ fontSize: 12, color: 'var(--color-accent-dark)', fontWeight: 700 }}>
            📌 Pinned
          </span>
        )}
        <Badge
          label={audienceLabel}
          variant={AUDIENCE_BADGE[post.audience] ?? 'gray'}
        />
        <span style={{ fontSize: 12, color: theme.gray500 }}>
          {post.createdByName}
        </span>
        <span style={{ fontSize: 12, color: theme.gray400, marginLeft: 'auto' }}>
          {published}
          {post.updatedAt && (
            <span style={{ marginLeft: 6, color: theme.gray400, fontStyle: 'italic' }}>
              · edited
            </span>
          )}
        </span>
      </div>

      {resolvedTitle && !post.isWelcomePost && !editing && (
        <h2 style={{ fontSize: 16, fontWeight: 700, color: theme.gray900, margin: '0 0 12px 0' }}>
          {resolvedTitle}
        </h2>
      )}

      {editing ? (
        <div style={{ marginBottom: 12 }}>
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={6}
            style={{
              width:           '100%',
              padding:         '10px 12px',
              borderRadius:    'var(--radius-md)',
              border:          '1px solid var(--color-card-border)',
              fontSize:        14,
              resize:          'vertical',
              backgroundColor: 'var(--color-card-bg)',
              color:           theme.gray800,
            }}
          />
          {editErr && (
            <p style={{ fontSize: 12, color: theme.danger, marginTop: 4 }}>{editErr}</p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button label={saving ? 'Saving…' : 'Save'} onClick={handleSaveEdit} />
            <Button label="Cancel" variant="outline" onClick={() => { setEditing(false); setEditBody(post.bodyHtml) }} />
          </div>
        </div>
      ) : (
        <div
          className="feed-body"
          style={{ fontSize: 15, lineHeight: 1.7, color: theme.gray800 }}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
        <button
          onClick={() => onLike(post.id)}
          style={{
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            display:    'flex',
            alignItems: 'center',
            gap:        4,
            fontSize:   13,
            color:      post.userHasLiked ? 'var(--color-primary)' : theme.gray400,
            padding:    0,
          }}
          aria-label={post.userHasLiked ? 'Unlike' : 'Like'}
        >
          <span style={{ fontSize: 16 }}>{post.userHasLiked ? '♥' : '♡'}</span>
          {post.likeCount > 0 && <span>{post.likeCount}</span>}
        </button>

        <div style={{ flex: 1 }} />

        {canPin && !post.isPinned && (
          <button
            onClick={() => onPin(post.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: theme.gray400, padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = theme.gray400)}
          >
            📌 Pin
          </button>
        )}

        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: theme.gray400, padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = theme.gray400)}
          >
            Edit
          </button>
        )}

        {canDelete && (
          <button
            onClick={() => {
              if (confirm('Delete this post?')) onDelete(post.id)
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: theme.gray400, padding: 0 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
            onMouseLeave={e => (e.currentTarget.style.color = theme.gray400)}
          >
            Delete
          </button>
        )}

        <button
          onClick={() => onNavigate(post.id)}
          style={{ background: 'none', border: 'none', color: theme.gray400, fontSize: 12, cursor: 'pointer', padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = theme.gray400)}
        >
          View stats →
        </button>
      </div>

      </div>
    </div>
  )
}

// ─── FeedContent ──────────────────────────────────────────────────────────────

export default function FeedContent({ canView, canPost, canDeleteAny, canPin }: FeedContentProps) {
  const router              = useRouter()
  const config              = useTeamConfig()
  const { user, isLoading } = useAuth()

  const [posts,   setPosts]   = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const [mySport, setMySport] = useState(false)

  const fetchFeed = useCallback(async (p: number, sport: boolean) => {
    setLoading(true)
    try {
      const qs   = `page=${p}&pageSize=${PAGE_SIZE}${sport ? '&mySport=true' : ''}`
      const res  = await fetch(`/api/feed?${qs}`, { credentials: 'include' })
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
    if (canView) fetchFeed(1, mySport)
  }, [canView, mySport, fetchFeed])

  const handleRead = useCallback((postId: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isRead: true } : p))
    fetch(`/api/feed/${postId}/read`, { method: 'POST', credentials: 'include' })
      .catch(() => { /* fire-and-forget */ })
  }, [])

  const handleLike = useCallback((postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const liked = !p.userHasLiked
      return { ...p, userHasLiked: liked, likeCount: p.likeCount + (liked ? 1 : -1) }
    }))
    fetch(`/api/feed/${postId}/like`, { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then((d: { success: boolean; data?: { liked: boolean; likeCount: number } }) => {
        if (d.success && d.data) {
          setPosts(prev => prev.map(p =>
            p.id === postId ? { ...p, userHasLiked: d.data!.liked, likeCount: d.data!.likeCount } : p
          ))
        }
      })
      .catch(() => {
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p
          const reverted = !p.userHasLiked
          return { ...p, userHasLiked: reverted, likeCount: p.likeCount + (reverted ? 1 : -1) }
        }))
      })
  }, [])

  const handleDelete = useCallback((postId: string) => {
    fetch(`/api/feed/${postId}`, { method: 'DELETE', credentials: 'include' })
      .then(r => r.json())
      .then((d: { success: boolean }) => {
        if (d.success) {
          setPosts(prev => prev.filter(p => p.id !== postId))
          setTotal(prev => prev - 1)
        }
      })
      .catch(() => setError('Failed to delete post.'))
  }, [])

  const handleEdit = useCallback((postId: string, newBody: string) => {
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, bodyHtml: newBody, updatedAt: new Date().toISOString() }
        : p
    ))
  }, [])

  const handlePin = useCallback((postId: string) => {
    fetch(`/api/feed/${postId}/pin`, { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then((d: { success: boolean }) => {
        if (d.success) {
          setPosts(prev => prev.map(p => ({ ...p, isPinned: p.id === postId })))
        }
      })
      .catch(() => setError('Failed to pin post.'))
  }, [])

  const handleToggleSport = (sport: boolean) => {
    setMySport(sport)
    setPage(1)
    setPosts([])
  }

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    fetchFeed(next, mySport)
  }

  const hasMore = posts.length < total

  if (isLoading) return null
  if (!canView) {
    return (
      <AccessDenied
        currentRole={roleLabel(user?.role)}
        requiredRole={requiredRoleLabel('feed:view')}
      />
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
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

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid var(--color-card-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', width: 'fit-content' }}>
        {[
          { label: 'All Posts', value: false },
          { label: 'My Sport', value: true  },
        ].map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => handleToggleSport(opt.value)}
            style={{
              padding:         '6px 16px',
              border:          'none',
              borderRight:     opt.value ? 'none' : '1px solid var(--color-card-border)',
              fontSize:        13,
              fontWeight:      mySport === opt.value ? 600 : 400,
              cursor:          'pointer',
              backgroundColor: mySport === opt.value ? 'var(--color-primary)' : 'var(--color-card-bg)',
              color:           mySport === opt.value ? '#fff' : theme.gray600,
              transition:      'background-color 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <Alert message={error} variant="error" onClose={() => setError('')} />}

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
              currentUserId={user?.userId ?? 0}
              canDeleteAny={canDeleteAny}
              canPin={canPin}
              onRead={handleRead}
              onNavigate={id => router.push(`/feed/${id}`)}
              onLike={handleLike}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onPin={handlePin}
              config={config}
            />
          ))
        )}
      </div>

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
