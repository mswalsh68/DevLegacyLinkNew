'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { theme } from '@/lib/theme'
import { Alert, Button, Modal } from '@/components'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { hasFeature } from '@/lib/features'

// ─── Recipient options (mirrors Create Post page) ─────────────────────────────

const RECIPIENT_OPTIONS: { value: number | null; label: string; desc: string }[] = [
  { value: null, label: 'Everyone',    desc: 'Alumni + roster' },
  { value: 7,    label: 'Alumni only', desc: 'Graduated players' },
  { value: 8,    label: 'Roster only', desc: 'Current players' },
]

// Map targetProgramRoleId → targetAudience string for the campaigns API
function toTargetAudience(roleId: number | null): string {
  if (roleId === 7) return 'alumni_only'
  if (roleId === 8) return 'players_only'
  return 'all'
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CommsDashboardTabProps {
  metricsEndpoint: string
  sportId?:        number | null
  title:           string
  subtitle:        string
  errorMessage:    string
  renderMetrics:   (metrics: unknown, features: string[]) => ReactNode
}

// ─── Create Email Modal ───────────────────────────────────────────────────────

interface CreateEmailModalProps {
  onClose:  () => void
  onSent:   () => void
  sportId?: number | null
}

function CreateEmailModal({ onClose, onSent, sportId }: CreateEmailModalProps) {
  const config   = useTeamConfig()
  const isTier1  = config.tierId === 1
  const canRoster = hasFeature(config.tierId, 'roster_management')

  const recipientOptions = RECIPIENT_OPTIONS.filter(opt => {
    if (isTier1)    return opt.value === 7          // Tier 1: alumni only
    if (!canRoster) return opt.value !== 8          // no roster feature: hide roster
    return true
  })

  const [recipient,  setRecipient]  = useState<number | null>(isTier1 ? 7 : null)
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
        // Post to feed with email dispatch — audience is always all_sports (sport scope),
        // recipient controls who sees it via targetProgramRoleId
        const res = await fetch('/api/feed', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            title:               subject,
            bodyHtml:            body,
            audience:            sportId ? 'sport_specific' : 'all_sports',
            alsoEmail:           true,
            emailSubject:        subject,
            sportId:             sportId ?? null,
            targetProgramRoleId: recipient,
          }),
        }).then(r => r.json())
        if (!res.success) throw new Error(res.error ?? 'Failed to send')
      } else {
        // Email-only campaign — create then dispatch
        const campRes = await fetch('/api/campaigns', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            name:           subject,
            targetAudience: toTargetAudience(recipient),
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
      {error && <div style={{ marginBottom: 16 }}><Alert variant="error" message={error} /></div>}

      {/* Recipients */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.gray700, marginBottom: 8 }}>
          Recipients
          {isTier1 && (
            <span style={{ fontWeight: 400, fontSize: 12, color: theme.gray400, marginLeft: 8 }}>
              (Starter plan — alumni only)
            </span>
          )}
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {recipientOptions.map(opt => {
            const active = recipient === opt.value
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => !isTier1 && setRecipient(opt.value)}
                style={{
                  padding:         '8px 16px',
                  borderRadius:    'var(--radius-md)',
                  border:          `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                  backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-card-bg)',
                  color:           active ? 'var(--color-primary-dark)' : theme.gray600,
                  fontSize:        13,
                  fontWeight:      active ? 600 : 400,
                  cursor:          isTier1 ? 'default' : 'pointer',
                  transition:      'all 0.15s',
                  textAlign:       'left',
                  opacity:         isTier1 ? 0.85 : 1,
                }}
              >
                <div style={{ fontWeight: 600 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: active ? 'var(--color-primary-dark)' : theme.gray400, marginTop: 2 }}>
                  {opt.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

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
        <Button label="Cancel"                                  variant="secondary" onClick={onClose} disabled={submitting} />
        <Button label={submitting ? 'Sending…' : 'Send Email'}  onClick={handleSend} disabled={submitting} />
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
          sportId={sportId}
        />
      )}
    </>
  )
}
