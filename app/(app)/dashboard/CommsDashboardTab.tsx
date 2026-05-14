'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { theme } from '@/lib/theme'
import { Alert, Button, Modal } from '@/components'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CommsDashboardTabProps {
  metricsEndpoint:    string
  sportId?:           number | null
  title:              string
  subtitle:           string
  emailAudience:      string
  emailAudienceLabel: string
  errorMessage:       string
  renderMetrics:      (metrics: unknown, features: string[]) => ReactNode
}

// ─── Create Email Modal ───────────────────────────────────────────────────────

interface CreateEmailModalProps {
  onClose:            () => void
  onSent:             () => void
  emailAudience:      string
  emailAudienceLabel: string
  sportId?:           number | null
}

function CreateEmailModal({ onClose, onSent, emailAudience, emailAudienceLabel, sportId }: CreateEmailModalProps) {
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
            sportId:      sportId ?? null,
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
            sportId:        sportId ?? null,
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
  metricsEndpoint,
  sportId,
  title,
  subtitle,
  emailAudience,
  emailAudienceLabel,
  errorMessage,
  renderMetrics,
}: CommsDashboardTabProps) {
  const router = useRouter()

  const [metrics,    setMetrics]    = useState<unknown>(null)
  const [features,   setFeatures]   = useState<string[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showModal,  setShowModal]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = sportId
        ? `/api${metricsEndpoint}?sportId=${encodeURIComponent(sportId)}`
        : `/api${metricsEndpoint}`
      const res = await fetch(url, { credentials: 'include' }).then(r => r.json())
      setMetrics(res.data)
      setFeatures(res.features_available ?? [])
    } catch {
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [metricsEndpoint, sportId, errorMessage])

  useEffect(() => { load() }, [load])

  const handleSent = () => {
    setShowModal(false)
    setSuccessMsg('Email sent successfully!')
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

      {loading ? (
        <p style={{ color: theme.gray500, padding: '40px 0', textAlign: 'center' }}>Loading…</p>
      ) : (
        metrics && renderMetrics(metrics, features)
      )}

      {showModal && (
        <CreateEmailModal
          onClose={() => setShowModal(false)}
          onSent={handleSent}
          emailAudience={emailAudience}
          emailAudienceLabel={emailAudienceLabel}
          sportId={sportId}
        />
      )}
    </>
  )
}
