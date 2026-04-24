'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { theme } from '@/lib/theme'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { resolvePostTokens } from '@/lib/feedTokens'
import { Alert, Badge, Button, Modal } from '@/components'
import { AUDIENCE_LABEL, STATUS_COLOR, audienceBadgeVariant, fmt } from '@/lib/dashboard-helpers'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface Campaign {
  id:              string
  name:            string
  targetAudience:  string
  status:          string
  sentCount:       number
  respondedCount:  number
  responseRatePct: number
  createdAt:       string
}

export interface FeedPost {
  id:          string
  title:       string | null
  audience:    string
  publishedAt: string
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CommsDashboardTabProps {
  campaignAudiences:  readonly string[]
  postAudiences:      readonly string[]
  metricsEndpoint:    string
  sportId?:           string | null
  title:              string
  subtitle:           string
  emailAudience:      string
  emailAudienceLabel: string
  emptyCampaignsText: string
  emptyPostsText:     string
  errorMessage:       string
  renderMetrics:      (metrics: unknown, features: string[]) => ReactNode
}

// ─── Create Email Modal ───────────────────────────────────────────────────────

interface CreateEmailModalProps {
  onClose:            () => void
  onSent:             () => void
  emailAudience:      string
  emailAudienceLabel: string
}

function CreateEmailModal({ onClose, onSent, emailAudience, emailAudienceLabel }: CreateEmailModalProps) {
  const [subject,    setSubject]    = useState('')
  const [body,       setBody]       = useState('')
  const [postToFeed, setPostToFeed] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const handleSend = async () => {
    if (!subject.trim()) { setError('Subject is required'); return }
    if (!body.trim())    { setError('Email body is required'); return }
    setSubmitting(true)
    setError(null)

    try {
      if (postToFeed) {
        // Post to feed with email dispatch
        const res = await fetch('/api/feed', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            title:        subject,
            bodyHtml:     body,
            audience:     emailAudience,
            alsoEmail:    true,
            emailSubject: subject,
          }),
        }).then(r => r.json())
        if (!res.success) throw new Error(res.error ?? 'Failed to send')
      } else {
        // Create campaign then dispatch
        const campRes = await fetch('/api/campaigns', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            name:           subject,
            targetAudience: emailAudience,
            subjectLine:    subject,
            bodyHtml:       body,
          }),
        }).then(r => r.json())
        if (!campRes.success) throw new Error(campRes.error ?? 'Failed to create campaign')

        const dispatchRes = await fetch(`/api/campaigns/${campRes.data.id}/dispatch`, {
          method:      'POST',
          credentials: 'include',
        }).then(r => r.json())
        if (!dispatchRes.success) throw new Error(dispatchRes.error ?? 'Failed to dispatch campaign')
      }
      onSent()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Create Email" onClose={onClose} size="md">
      <p style={{ fontSize: 13, color: theme.gray500, marginBottom: 20, marginTop: -8 }}>
        Audience pre-set to <strong>{emailAudienceLabel}</strong>
      </p>

      {error && <div style={{ marginBottom: 16 }}><Alert variant="error" message={error} /></div>}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.gray700, marginBottom: 6 }}>Subject</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Email subject line"
          style={{ width: '100%', padding: '10px 12px', borderRadius: theme.radiusSm, border: `1px solid ${theme.cardBorder}`, fontSize: 14, color: theme.gray900, boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.gray700, marginBottom: 6 }}>
          Message <span style={{ fontWeight: 400, color: theme.gray400 }}>(HTML supported)</span>
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="<p>Hello {firstName},</p><p>...</p>"
          rows={10}
          style={{ width: '100%', padding: '10px 12px', borderRadius: theme.radiusSm, border: `1px solid ${theme.cardBorder}`, fontSize: 13, color: theme.gray900, resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 24 }}>
        <input type="checkbox" checked={postToFeed} onChange={e => setPostToFeed(e.target.checked)} style={{ width: 16, height: 16, accentColor: theme.primary }} />
        <span style={{ fontSize: 14, color: theme.gray700 }}>Also post to newsfeed</span>
      </label>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <Button label="Cancel"                                    variant="secondary" onClick={onClose} disabled={submitting} />
        <Button label={submitting ? 'Sending…' : 'Send Email'}    onClick={handleSend} disabled={submitting} />
      </div>
    </Modal>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CommsDashboardTab({
  campaignAudiences,
  postAudiences,
  metricsEndpoint,
  sportId,
  title,
  subtitle,
  emailAudience,
  emailAudienceLabel,
  emptyCampaignsText,
  emptyPostsText,
  errorMessage,
  renderMetrics,
}: CommsDashboardTabProps) {
  const router = useRouter()
  const config = useTeamConfig()

  const [metrics,       setMetrics]       = useState<unknown>(null)
  const [features,      setFeatures]      = useState<string[]>([])
  const [campaigns,     setCampaigns]     = useState<Campaign[]>([])
  const [posts,         setPosts]         = useState<FeedPost[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [successMsg,    setSuccessMsg]    = useState<string | null>(null)
  const [showModal,     setShowModal]     = useState(false)
  const [campaignsOpen, setCampaignsOpen] = useState(true)
  const [postsOpen,     setPostsOpen]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const metricsUrl = sportId
        ? `/api${metricsEndpoint}?sportId=${encodeURIComponent(sportId)}`
        : `/api${metricsEndpoint}`
      const [metricsRes, campRes, feedRes] = await Promise.all([
        fetch(metricsUrl,                    { credentials: 'include' }).then(r => r.json()),
        fetch('/api/campaigns',              { credentials: 'include' }).then(r => r.json()),
        fetch('/api/feed?page=1&pageSize=50', { credentials: 'include' }).then(r => r.json()),
      ])

      setMetrics(metricsRes.data)
      setFeatures(metricsRes.features_available ?? [])

      const allCamps: Campaign[] = campRes.data ?? []
      setCampaigns(allCamps.filter(c => campaignAudiences.includes(c.targetAudience)))

      const allPosts: FeedPost[] = (feedRes.data ?? [])
        .filter((p: FeedPost) => postAudiences.includes(p.audience))
        .map((p: FeedPost) => ({
          ...p,
          title: p.title ? resolvePostTokens(p.title, config) : null,
        }))
      setPosts(allPosts)
    } catch {
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [config, metricsEndpoint, sportId, campaignAudiences, postAudiences, errorMessage])

  useEffect(() => { load() }, [load])

  const handleSent = () => {
    setShowModal(false)
    setSuccessMsg('Email sent successfully!')
    load()
    setTimeout(() => setSuccessMsg(null), 4000)
  }

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.gray900, margin: 0 }}>{title}</h2>
          <p style={{ fontSize: 13, color: theme.gray500, marginTop: 2 }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button label="+ New Post"     onClick={() => router.push('/feed/new')} />
          <Button label="+ Create Email" onClick={() => setShowModal(true)} />
        </div>
      </div>

      {successMsg && <div style={{ marginBottom: 16 }}><Alert variant="success" message={successMsg} /></div>}
      {error      && <div style={{ marginBottom: 16 }}><Alert variant="error"   message={error}      /></div>}

      {/* ── Metric cards ── */}
      {!loading && metrics && renderMetrics(metrics, features)}

      {loading ? (
        <p style={{ color: theme.gray500, padding: '40px 0', textAlign: 'center' }}>Loading…</p>
      ) : (
        <>
          {/* ── Email Campaigns ── */}
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => setCampaignsOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px 0', width: '100%', textAlign: 'left' }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: theme.gray900 }}>Email Campaigns</span>
              <span style={{ fontSize: 12, fontWeight: 700, backgroundColor: theme.primaryLight, color: theme.primaryDark, borderRadius: 20, padding: '2px 8px' }}>{campaigns.length}</span>
              <span style={{ marginLeft: 'auto', fontSize: 18, color: theme.gray400, lineHeight: 1 }}>{campaignsOpen ? '▾' : '▸'}</span>
            </button>
            {campaignsOpen && (
              campaigns.length === 0 ? (
                <p style={{ color: theme.gray400, fontSize: 14, margin: 0 }}>{emptyCampaignsText}</p>
              ) : (
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.cardBorder}`, backgroundColor: theme.gray50 }}>
                        {['Subject / Name', 'Audience', 'Status', 'Sent', 'Responded', 'Rate', 'Date'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: theme.gray600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c, i) => (
                        <tr
                          key={c.id}
                          onClick={() => router.push(`/alumni/campaigns/${c.id}`)}
                          style={{ borderBottom: i < campaigns.length - 1 ? `1px solid ${theme.cardBorder}` : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = theme.gray50)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '12px 16px', color: theme.gray900, fontWeight: 500 }}>{c.name}</td>
                          <td style={{ padding: '12px 16px' }}><Badge label={AUDIENCE_LABEL[c.targetAudience] ?? c.targetAudience} variant="primary" /></td>
                          <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[c.status] ?? theme.gray500, textTransform: 'capitalize' }}>{c.status}</span></td>
                          <td style={{ padding: '12px 16px', color: theme.gray700 }}>{c.sentCount ?? 0}</td>
                          <td style={{ padding: '12px 16px', color: theme.gray700 }}>{c.respondedCount ?? 0}</td>
                          <td style={{ padding: '12px 16px', color: theme.gray700, fontWeight: 500 }}>{c.responseRatePct ?? 0}%</td>
                          <td style={{ padding: '12px 16px', color: theme.gray500 }}>{fmt(c.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* ── Feed Posts ── */}
          <div>
            <button
              onClick={() => setPostsOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 12px 0', width: '100%', textAlign: 'left' }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: theme.gray900 }}>Feed Posts</span>
              <span style={{ fontSize: 12, fontWeight: 700, backgroundColor: theme.primaryLight, color: theme.primaryDark, borderRadius: 20, padding: '2px 8px' }}>{posts.length}</span>
              <span style={{ marginLeft: 'auto', fontSize: 18, color: theme.gray400, lineHeight: 1 }}>{postsOpen ? '▾' : '▸'}</span>
            </button>
            {postsOpen && (
              posts.length === 0 ? (
                <p style={{ color: theme.gray400, fontSize: 14, margin: 0 }}>{emptyPostsText}</p>
              ) : (
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.cardBorder}`, backgroundColor: theme.gray50 }}>
                        {['Title', 'Audience', 'Date'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: theme.gray600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map((p, i) => (
                        <tr
                          key={p.id}
                          onClick={() => router.push(`/feed/${p.id}`)}
                          style={{ borderBottom: i < posts.length - 1 ? `1px solid ${theme.cardBorder}` : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = theme.gray50)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '12px 16px', color: theme.gray900, fontWeight: 500 }}>{p.title ?? '(no title)'}</td>
                          <td style={{ padding: '12px 16px' }}><Badge label={AUDIENCE_LABEL[p.audience] ?? p.audience} variant={audienceBadgeVariant(p.audience)} /></td>
                          <td style={{ padding: '12px 16px', color: theme.gray500 }}>{fmt(p.publishedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </>
      )}

      {showModal && (
        <CreateEmailModal
          onClose={() => setShowModal(false)}
          onSent={handleSent}
          emailAudience={emailAudience}
          emailAudienceLabel={emailAudienceLabel}
        />
      )}
    </>
  )
}
