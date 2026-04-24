'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DOMPurify from 'isomorphic-dompurify'
import { useAuth } from '@/providers/AuthProvider'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { resolvePostTokens } from '@/lib/feedTokens'
import { AUDIENCE_BADGE } from '@/lib/statusMappings'
import { theme } from '@/lib/theme'
import { Alert }  from '@/components/ui/Alert'
import { Badge }  from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedPost {
  id:            string
  title:         string | null
  bodyHtml:      string
  audience:      string
  isPinned:      boolean
  isWelcomePost: boolean
  campaignId:    string | null
  createdBy:     string
  publishedAt:   string
  isRead:        boolean
}

interface ReadStats {
  totalEligible:      number
  totalRead:          number
  readThroughRatePct: number
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

const CAN_POST_ROLES = ['platform_owner','app_admin','head_coach','position_coach','alumni_director']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedPostPage() {
  const { id }          = useParams<{ id: string }>()
  const router          = useRouter()
  const config          = useTeamConfig()
  const { user }        = useAuth()

  const [post,     setPost]     = useState<FeedPost | null>(null)
  const [stats,    setStats]    = useState<ReadStats | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [canWrite, setCanWrite] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/feed/${id}`, { credentials: 'include' })
        const data = await res.json() as { success: boolean; data: FeedPost; error?: string }
        if (!data.success) { setError('Post not found.'); return }
        setPost(data.data)

        // Mark as read (fire-and-forget)
        fetch(`/api/feed/${id}/read`, { method: 'POST', credentials: 'include' }).catch(() => {})

        // Load read stats — only available to writers; 403 means the user is read-only
        if (CAN_POST_ROLES.includes(user?.role ?? '')) {
          try {
            const statsRes  = await fetch(`/api/feed/${id}/stats`, { credentials: 'include' })
            const statsData = await statsRes.json() as { success: boolean; data: ReadStats }
            if (statsData.success) {
              setStats(statsData.data)
              setCanWrite(true)
            }
          } catch { /* not a writer */ }
        }
      } catch {
        setError('Failed to load post.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user?.role]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading / error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: theme.gray400 }}>
        Loading...
      </div>
    )
  }

  if (error || !post) {
    return (
      <>
        <Alert message={error || 'Post not found.'} variant="error" />
        <div style={{ marginTop: 16 }}>
          <Button label="← Back to Feed" variant="outline" onClick={() => router.push('/feed')} />
        </div>
      </>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const published = new Date(post.publishedAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const resolvedHtml = post.isWelcomePost
    ? resolvePostTokens(post.bodyHtml, config)
    : post.bodyHtml
  const safeHtml = DOMPurify.sanitize(resolvedHtml, SANITIZE_CONFIG)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Back button */}
      <div style={{ marginBottom: 16 }}>
        <Button
          label="← Feed"
          variant="outline"
          onClick={() => router.push('/feed')}
        />
      </div>

      {/* Post card */}
      <div
        style={{
          backgroundColor: 'var(--color-card-bg)',
          border:          `1px solid var(--color-card-border)`,
          borderRadius:    'var(--radius-lg)',
          padding:         '28px 32px',
          boxShadow:       'var(--shadow-sm)',
        }}
      >
        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {post.isPinned && (
            <span style={{ fontSize: 12, color: 'var(--color-accent-dark)', fontWeight: 700 }}>
              📌 Pinned
            </span>
          )}
          <Badge
            label={AUDIENCE_LABEL[post.audience] ?? post.audience}
            variant={AUDIENCE_BADGE[post.audience] ?? 'gray'}
          />
          <span style={{ fontSize: 13, color: theme.gray400, marginLeft: 'auto' }}>
            {published}
          </span>
        </div>

        {/* Title */}
        {post.title && (
          <h1 style={{ fontSize: 22, fontWeight: 700, color: theme.gray900, margin: '0 0 16px 0' }}>
            {post.isWelcomePost ? resolvePostTokens(post.title, config) : post.title}
          </h1>
        )}

        {/* Body */}
        <div
          className="feed-body"
          style={{ fontSize: 15, lineHeight: 1.7, color: theme.gray800 }}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>

      {/* Read stats — writers only */}
      {canWrite && stats && (
        <div
          style={{
            marginTop:       20,
            backgroundColor: 'var(--color-card-bg)',
            border:          `1px solid var(--color-card-border)`,
            borderRadius:    'var(--radius-lg)',
            padding:         '20px 28px',
            boxShadow:       'var(--shadow-sm)',
          }}
        >
          <h3
            style={{
              fontSize:      12,
              fontWeight:    700,
              color:         theme.gray500,
              margin:        '0 0 14px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Read Stats
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: 'Eligible',     value: stats.totalEligible },
              { label: 'Read',         value: stats.totalRead },
              { label: 'Read-Through', value: `${stats.readThroughRatePct}%` },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: theme.gray500, marginTop: 2 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
