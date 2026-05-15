'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { theme } from '@/lib/theme'
import { Alert, Button, Modal } from '@/components'
import { Select } from '@/components/ui/Select'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { hasFeature } from '@/lib/features'

// ─── Constants (mirrors Create Post page) ─────────────────────────────────────

const AUDIENCE_OPTIONS = [
  { value: 'all_sports',    label: 'All Sports — everyone in the program' },
  { value: 'sport_specific', label: 'One Sport — single sport only'       },
  { value: 'multi_sport',   label: 'Multiple Sports — pick 2 or more'     },
]

const RECIPIENT_OPTIONS: { value: number | null; label: string; desc: string }[] = [
  { value: null, label: 'Everyone',    desc: 'Alumni + roster' },
  { value: 7,    label: 'Alumni only', desc: 'Graduated players' },
  { value: 8,    label: 'Roster only', desc: 'Current players' },
]

interface SportOption { id: string; name: string; abbr: string }

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
  onClose: () => void
  onSent:  () => void
}

function CreateEmailModal({ onClose, onSent }: CreateEmailModalProps) {
  const config    = useTeamConfig()
  const isTier1   = config.tierId === 1
  const canRoster = hasFeature(config.tierId, 'roster_management')

  const recipientOptions = RECIPIENT_OPTIONS.filter(opt => {
    if (isTier1)    return opt.value === 7
    if (!canRoster) return opt.value !== 8
    return true
  })

  const [recipient,        setRecipient]        = useState<number | null>(isTier1 ? 7 : null)
  const [audience,         setAudience]         = useState('all_sports')
  const [sportId,          setSportId]          = useState<string>('')
  const [selectedSportIds, setSelectedSportIds] = useState<Set<string>>(new Set())
  const [sports,           setSports]           = useState<SportOption[]>([])
  const [sportsLoaded,     setSportsLoaded]     = useState(false)
  const [subject,          setSubject]          = useState('')
  const [body,             setBody]             = useState('')
  const [postToFeed,       setPostToFeed]       = useState(true)
  const [submitting,       setSubmitting]       = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sports', { credentials: 'include' })
      .then(r => r.json())
      .then((d: { success: boolean; data: unknown[] }) => { setSports(d.data as SportOption[]); setSportsLoaded(true) })
      .catch(() => setSportsLoaded(true))
  }, [])

  const handleAudienceChange = (v: string) => {
    setAudience(v)
    setSportId('')
    setSelectedSportIds(new Set())
  }

  const toggleMultiSport = (id: string) => {
    setSelectedSportIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    if (!subject.trim()) { setError('Subject is required'); return }
    if (!body.trim())    { setError('Message body is required'); return }
    if (audience === 'sport_specific' && !sportId) { setError('Select a sport.'); return }
    if (audience === 'multi_sport' && selectedSportIds.size === 0) { setError('Select at least one sport.'); return }
    setSubmitting(true)
    setError(null)

    const resolvedSportId    = audience === 'sport_specific' ? sportId : null
    const resolvedSportIds   = audience === 'multi_sport' ? Array.from(selectedSportIds).map(Number) : undefined

    try {
      if (postToFeed) {
        const res = await fetch('/api/feed', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            title:               subject,
            bodyHtml:            body,
            audience,
            alsoEmail:           true,
            emailSubject:        subject,
            sportId:             resolvedSportId ?? null,
            sportIds:            resolvedSportIds,
            targetProgramRoleId: recipient,
          }),
        }).then(r => r.json())
        if (!res.success) throw new Error(res.error ?? 'Failed to send')
      } else {
        const campRes = await fetch('/api/campaigns', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            name:           subject,
            targetAudience: toTargetAudience(recipient),
            subjectLine:    subject,
            bodyHtml:       body,
            sportId:        resolvedSportId ?? null,
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
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSubmitting(false)
    }
  }

  // Preview labels
  const audienceLabel      = AUDIENCE_OPTIONS.find(o => o.value === audience)?.label ?? audience
  const selectedSportName  = sports.find(s => s.id === sportId)?.name
  const multiSportNames    = sports.filter(s => selectedSportIds.has(s.id)).map(s => s.name)
  const recipientLabel     = recipientOptions.find(o => o.value === recipient)?.label ?? 'Everyone'
  const isSubmitDisabled   =
    (audience === 'sport_specific' && sportsLoaded && !sportId) ||
    (audience === 'multi_sport'    && sportsLoaded && selectedSportIds.size === 0)

  const sportBtnStyle = (active: boolean) => ({
    padding:         '6px 14px',
    borderRadius:    'var(--radius-full)',
    border:          `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
    backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-card-bg)',
    color:           active ? 'var(--color-primary-dark)' : theme.gray600,
    fontSize:        13,
    fontWeight:      600 as const,
    cursor:          'pointer' as const,
    transition:      'all 0.15s',
  })

  return (
    <Modal title="Create Email" onClose={onClose} size="lg">
      {error && <div style={{ marginBottom: 16 }}><Alert variant="error" message={error} /></div>}

      {/* Subject */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
          Subject <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Email subject line..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: theme.radiusSm, border: `1px solid ${theme.cardBorder}`, fontSize: 14, color: theme.gray900, boxSizing: 'border-box' }}
        />
      </div>

      {/* Body */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
          Message <span style={{ color: 'var(--color-danger)' }}>*</span>{' '}
          <span style={{ fontWeight: 400, color: theme.gray400 }}>(HTML supported)</span>
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write your message here. Basic HTML is supported: <b>, <i>, <p>, <ul>, <li>, <a>."
          rows={8}
          style={{ width: '100%', padding: '10px 12px', borderRadius: theme.radiusSm, border: `1px solid ${theme.cardBorder}`, fontSize: 13, color: theme.gray900, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {/* Audience */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
          Audience
        </label>
        <Select value={audience} onChange={handleAudienceChange} options={AUDIENCE_OPTIONS} />
      </div>

      {/* Sport picker — single */}
      {audience === 'sport_specific' && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 8 }}>Sport</label>
          {!sportsLoaded ? (
            <p style={{ fontSize: 13, color: theme.gray400 }}>Loading sports…</p>
          ) : sports.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>No sports available.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sports.map(s => (
                <button key={s.id} type="button" onClick={() => setSportId(s.id)} style={sportBtnStyle(sportId === s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sport picker — multi */}
      {audience === 'multi_sport' && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 8 }}>
            Sports <span style={{ fontWeight: 400, color: theme.gray400 }}>({selectedSportIds.size} selected)</span>
          </label>
          {!sportsLoaded ? (
            <p style={{ fontSize: 13, color: theme.gray400 }}>Loading sports…</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sports.map(s => {
                const checked = selectedSportIds.has(s.id)
                return (
                  <button key={s.id} type="button" onClick={() => toggleMultiSport(s.id)} style={sportBtnStyle(checked)}>
                    {checked ? '✓ ' : ''}{s.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Recipients */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 8 }}>
          Recipients
          {isTier1 && <span style={{ fontWeight: 400, fontSize: 12, color: theme.gray400, marginLeft: 8 }}>(Starter plan — alumni only)</span>}
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
                <div style={{ fontSize: 11, color: active ? 'var(--color-primary-dark)' : theme.gray400, marginTop: 2 }}>{opt.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Also post to newsfeed */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 18, fontSize: 14, color: theme.gray700 }}>
        <input type="checkbox" checked={postToFeed} onChange={e => setPostToFeed(e.target.checked)} style={{ width: 16, height: 16, accentColor: theme.primary }} />
        Also post to newsfeed
      </label>

      {/* Preview bar */}
      <div style={{
        padding:         '14px 18px',
        backgroundColor: 'var(--color-primary-light)',
        borderRadius:    'var(--radius-md)',
        border:          `1px solid var(--color-primary)`,
        marginBottom:    20,
        fontSize:        13,
        color:           'var(--color-primary-dark)',
      }}>
        <strong>Audience:</strong>{' '}
        {audience === 'all_sports'    && 'All Sports'}
        {audience === 'sport_specific' && (selectedSportName ?? 'Select a sport')}
        {audience === 'multi_sport'   && (multiSportNames.length > 0 ? multiSportNames.join(', ') : 'Select sports')}
        <span style={{ marginLeft: 10 }}>·</span>
        <strong style={{ marginLeft: 10 }}>Recipients:</strong>{' '}{recipientLabel}
        {postToFeed && <span style={{ marginLeft: 10 }}>· will also post to newsfeed</span>}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <Button label="Cancel"                                  variant="secondary" onClick={onClose}    disabled={submitting} />
        <Button label={submitting ? 'Sending…' : 'Send Email'}  onClick={handleSend} disabled={submitting || isSubmitDisabled} />
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
        />
      )}
    </>
  )
}
