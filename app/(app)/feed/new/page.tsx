'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { hasFeature } from '@/lib/features'
import { theme } from '@/lib/theme'
import { Alert }    from '@/components/ui/Alert'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { Select }   from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { AccessDenied } from '@/components/ui/AccessDenied'
import { roleLabel } from '@/lib/permissions'

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS = [
  { value: 'all_sports',    label: 'All Sports — everyone in the program' },
  { value: 'sport_specific', label: 'One Sport — single sport only'       },
  { value: 'multi_sport',   label: 'Multiple Sports — pick 2 or more'     },
]

const RECIPIENT_OPTIONS: { value: number | null; label: string; desc: string }[] = [
  { value: null, label: 'Everyone',    desc: 'Roster + alumni' },
  { value: 8,    label: 'Roster only', desc: 'Current players' },
  { value: 7,    label: 'Alumni only', desc: 'Graduated players' },
]

const CAN_POST_ROLES = ['super_admin', 'support_admin', 'client']

// ─── Types ────────────────────────────────────────────────────────────────────

interface SportOption {
  id:   string
  name: string
  abbr: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewPostPage() {
  const router              = useRouter()
  const { user, isLoading } = useAuth()
  const config              = useTeamConfig()
  const recipientOptions    = RECIPIENT_OPTIONS.filter(
    opt => opt.value !== 8 || hasFeature(config.subscriptionTier, 'roster_management'),
  )

  const [title,               setTitle]               = useState('')
  const [bodyHtml,            setBodyHtml]            = useState('')
  const [audience,            setAudience]            = useState('all_sports')
  const [isPinned,            setIsPinned]            = useState(false)
  const [alsoEmail,           setAlsoEmail]           = useState(false)
  const [emailSubject,        setEmailSubject]        = useState('')
  const [targetProgramRoleId, setTargetProgramRoleId] = useState<number | null>(null)

  // Sport selection
  const [sports,          setSports]          = useState<SportOption[]>([])
  const [sportId,         setSportId]         = useState<string>('')          // single sport
  const [selectedSportIds, setSelectedSportIds] = useState<Set<string>>(new Set()) // multi-sport
  const [sportsLoaded,    setSportsLoaded]    = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const canPost = CAN_POST_ROLES.includes(user?.role ?? '')

  useEffect(() => {
    if (!user || !canPost) return
    fetch('/api/sports', { credentials: 'include' })
      .then(r => r.json())
      .then((data: { success: boolean; data: unknown[] }) => {
        if (!data.success) return
        setSports(data.data as SportOption[])
        setSportsLoaded(true)
      })
      .catch(() => setSportsLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (isLoading) return null

  if (!CAN_POST_ROLES.includes(user?.role ?? '')) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole="Support Admin or higher" />
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!bodyHtml.trim()) { setError('Post body is required.'); return }
    if (audience === 'sport_specific' && !sportId) { setError('Select a sport for this post.'); return }
    if (audience === 'multi_sport' && selectedSportIds.size === 0) {
      setError('Select at least one sport for a multi-sport post.'); return
    }
    if (alsoEmail && !emailSubject.trim()) { setError('Email subject is required when sending as email.'); return }

    setError('')
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        title:        title.trim() || undefined,
        bodyHtml,
        audience,
        isPinned,
        alsoEmail,
        emailSubject: alsoEmail ? emailSubject.trim() : undefined,
        targetProgramRoleId: targetProgramRoleId ?? undefined,
      }

      if (audience === 'sport_specific') {
        payload.sportId = sportId
      } else if (audience === 'multi_sport') {
        payload.sportIds = Array.from(selectedSportIds).map(Number)
      }

      const res = await fetch('/api/feed', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
      })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Unknown error')
      router.push('/feed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
      setSubmitting(false)
    }
  }

  // ── Preview labels ─────────────────────────────────────────────────────────

  const audienceLabel = AUDIENCE_OPTIONS.find(o => o.value === audience)?.label ?? audience
  const selectedSportName  = sports.find(s => s.id === sportId)?.name
  const multiSportNames    = sports.filter(s => selectedSportIds.has(s.id)).map(s => s.name)
  const recipientLabel     = recipientOptions.find(o => o.value === targetProgramRoleId)?.label ?? 'Everyone'

  const isSubmitDisabled =
    (audience === 'sport_specific' && sportsLoaded && !sportId) ||
    (audience === 'multi_sport'    && sportsLoaded && selectedSportIds.size === 0)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.gray900, margin: 0 }}>
          Create Post
        </h1>
        <p style={{ fontSize: 14, color: theme.gray500, marginTop: 4 }}>
          Posts are published to the team feed immediately.
        </p>
      </div>

      {error && <Alert message={error} variant="error" onClose={() => setError('')} />}

      <form onSubmit={handleSubmit}>
        <div
          style={{
            backgroundColor: 'var(--color-card-bg)',
            border:          `1px solid var(--color-card-border)`,
            borderRadius:    'var(--radius-lg)',
            padding:         28,
            boxShadow:       'var(--shadow-sm)',
          }}
        >

          {/* Title */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
              Title{' '}
              <span style={{ color: theme.gray400, fontWeight: 400 }}>(optional)</span>
            </label>
            <Input value={title} onChange={setTitle} placeholder="Post headline..." />
          </div>

          {/* Body */}
          <div style={{ marginBottom: 18 }}>
            <Textarea
              label="Body *"
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Write your post here. Basic HTML is supported: <b>, <i>, <p>, <ul>, <li>, <a>."
              rows={8}
            />
          </div>

          {/* Audience */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
              Audience
            </label>
            <Select
              value={audience}
              onChange={handleAudienceChange}
              options={AUDIENCE_OPTIONS}
            />
          </div>

          {/* Sport picker — single sport */}
          {audience === 'sport_specific' && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 8 }}>
                Sport
              </label>
              {!sportsLoaded ? (
                <p style={{ fontSize: 13, color: theme.gray400 }}>Loading sports…</p>
              ) : sports.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>No sports available.</p>
              ) : sports.length === 1 ? (
                <p style={{ fontSize: 14, color: theme.gray700 }}>
                  <strong>{sports[0].name}</strong>
                  <span style={{ fontSize: 12, color: theme.gray400, marginLeft: 8 }}>(auto-selected)</span>
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sports.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSportId(s.id)}
                      style={{
                        padding:         '6px 14px',
                        borderRadius:    'var(--radius-full)',
                        border:          `1.5px solid ${sportId === s.id ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                        backgroundColor: sportId === s.id ? 'var(--color-primary-light)' : 'var(--color-card-bg)',
                        color:           sportId === s.id ? 'var(--color-primary-dark)' : theme.gray600,
                        fontSize:        13,
                        fontWeight:      600,
                        cursor:          'pointer',
                        transition:      'all 0.15s',
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sport picker — multi-sport */}
          {audience === 'multi_sport' && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 8 }}>
                Sports{' '}
                <span style={{ color: theme.gray400, fontWeight: 400 }}>
                  ({selectedSportIds.size} selected)
                </span>
              </label>
              {!sportsLoaded ? (
                <p style={{ fontSize: 13, color: theme.gray400 }}>Loading sports…</p>
              ) : sports.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>No sports available.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sports.map(s => {
                    const checked = selectedSportIds.has(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleMultiSport(s.id)}
                        style={{
                          padding:         '6px 14px',
                          borderRadius:    'var(--radius-full)',
                          border:          `1.5px solid ${checked ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                          backgroundColor: checked ? 'var(--color-primary-light)' : 'var(--color-card-bg)',
                          color:           checked ? 'var(--color-primary-dark)' : theme.gray600,
                          fontSize:        13,
                          fontWeight:      600,
                          cursor:          'pointer',
                          transition:      'all 0.15s',
                        }}
                      >
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
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recipientOptions.map(opt => {
                const active = targetProgramRoleId === opt.value
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setTargetProgramRoleId(opt.value)}
                    style={{
                      padding:         '8px 16px',
                      borderRadius:    'var(--radius-md)',
                      border:          `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                      backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-card-bg)',
                      color:           active ? 'var(--color-primary-dark)' : theme.gray600,
                      fontSize:        13,
                      fontWeight:      active ? 600 : 400,
                      cursor:          'pointer',
                      transition:      'all 0.15s',
                      textAlign:       'left',
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

          {/* Options: pin + email */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 18, paddingTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: theme.gray700 }}>
              <input type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} />
              Pin to top
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: theme.gray700 }}>
              <input type="checkbox" checked={alsoEmail} onChange={e => setAlsoEmail(e.target.checked)} />
              Also send as email
            </label>
          </div>

          {/* Email subject */}
          {alsoEmail && (
            <div
              style={{
                marginBottom:    18,
                padding:         16,
                backgroundColor: 'var(--color-gray-50)',
                borderRadius:    'var(--radius-md)',
                border:          `1px solid var(--color-gray-200)`,
              }}
            >
              <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
                Email Subject{' '}
                <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <Input
                value={emailSubject}
                onChange={setEmailSubject}
                placeholder="Subject line for the email..."
              />
              <p style={{ fontSize: 12, color: theme.gray500, marginTop: 6, marginBottom: 0 }}>
                The post body will be sent as the email body with a CAN-SPAM compliant footer.
              </p>
            </div>
          )}

          {/* Preview bar */}
          <div
            style={{
              padding:         '14px 18px',
              backgroundColor: 'var(--color-primary-light)',
              borderRadius:    'var(--radius-md)',
              border:          `1px solid var(--color-primary)`,
              marginBottom:    20,
              fontSize:        13,
              color:           'var(--color-primary-dark)',
            }}
          >
            <strong>Audience:</strong>{' '}
            {audience === 'all_sports' && 'All Sports'}
            {audience === 'sport_specific' && (selectedSportName ?? 'Select a sport')}
            {audience === 'multi_sport' && (
              multiSportNames.length > 0
                ? multiSportNames.join(', ')
                : 'Select sports'
            )}
            <span style={{ marginLeft: 10 }}>·</span>
            <strong style={{ marginLeft: 10 }}>Recipients:</strong>{' '}{recipientLabel}
            {alsoEmail && (
              <span style={{ marginLeft: 10 }}>· will also be sent as email</span>
            )}
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button
              label="Cancel"
              variant="outline"
              onClick={() => router.push('/feed')}
            />
            <Button
              label={submitting ? 'Publishing…' : (alsoEmail ? 'Publish + Send Email' : 'Publish')}
              type="submit"
              loading={submitting}
              disabled={isSubmitDisabled}
            />
          </div>
        </div>
      </form>
    </div>
  )
}
