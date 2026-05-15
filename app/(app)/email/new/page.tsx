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

const CAN_EMAIL_ROLES = ['super_admin', 'support_admin', 'client']

// ─── Types ────────────────────────────────────────────────────────────────────

interface SportOption {
  id:   string
  name: string
  abbr: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewEmailPage() {
  const router              = useRouter()
  const { user, isLoading } = useAuth()
  const config              = useTeamConfig()

  const isAlumni  = user?.programRoleId === 7
  const isTier1   = config.tierId === 1
  // Alumni can't send emails; Tier 1 restricts recipients to alumni only
  const lockedToAlumni = isTier1

  const recipientOptions = RECIPIENT_OPTIONS.filter(opt => {
    if (lockedToAlumni) return opt.value === 7
    return opt.value !== 8 || hasFeature(config.tierId, 'roster_management')
  })

  const [subject,             setSubject]             = useState('')
  const [bodyHtml,            setBodyHtml]            = useState('')
  const [audience,            setAudience]            = useState('all_sports')
  const [postToFeed,          setPostToFeed]          = useState(false)
  const [targetProgramRoleId, setTargetProgramRoleId] = useState<number | null>(lockedToAlumni ? 7 : null)

  // Lock recipient to alumni-only on Tier 1
  useEffect(() => {
    if (lockedToAlumni) setTargetProgramRoleId(7)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTier1])

  // Sport selection
  const [sports,           setSports]           = useState<SportOption[]>([])
  const [sportId,          setSportId]          = useState<string>('')
  const [selectedSportIds, setSelectedSportIds] = useState<Set<string>>(new Set())
  const [sportsLoaded,     setSportsLoaded]     = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const canEmail = CAN_EMAIL_ROLES.includes(user?.role ?? '') && !isAlumni

  useEffect(() => {
    if (!user || !canEmail) return
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

  if (!CAN_EMAIL_ROLES.includes(user?.role ?? '') || isAlumni) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole="Support Admin or higher" />
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

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
    if (!subject.trim())  { setError('Subject is required.'); return }
    if (!bodyHtml.trim()) { setError('Message body is required.'); return }
    if (audience === 'sport_specific' && !sportId) { setError('Select a sport for this email.'); return }
    if (audience === 'multi_sport' && selectedSportIds.size === 0) {
      setError('Select at least one sport for a multi-sport email.'); return
    }

    setError('')
    setSubmitting(true)

    const resolvedSportId  = audience === 'sport_specific' ? sportId : null
    const resolvedSportIds = audience === 'multi_sport' ? Array.from(selectedSportIds).map(Number) : undefined

    try {
      if (postToFeed) {
        // Post to feed with email attached
        const res = await fetch('/api/feed', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            title:               subject,
            bodyHtml,
            audience,
            alsoEmail:           true,
            emailSubject:        subject,
            sportId:             resolvedSportId ?? null,
            sportIds:            resolvedSportIds,
            targetProgramRoleId: targetProgramRoleId ?? undefined,
          }),
        }).then(r => r.json()) as { success: boolean; error?: string }
        if (!res.success) throw new Error(res.error ?? 'Failed to send')
      } else {
        // Email only — create campaign then dispatch
        const campRes = await fetch('/api/campaigns', {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({
            name:           subject,
            targetAudience: toTargetAudience(targetProgramRoleId),
            subjectLine:    subject,
            bodyHtml,
            sportId:        resolvedSportId ?? null,
          }),
        }).then(r => r.json()) as { success: boolean; data?: { id: number }; error?: string }
        if (!campRes.success) throw new Error(campRes.error ?? 'Failed to create campaign')

        const dispatchRes = await fetch(`/api/campaigns/${campRes.data!.id}/dispatch`, {
          method:      'POST',
          credentials: 'include',
        }).then(r => r.json()) as { success: boolean; error?: string }
        if (!dispatchRes.success) throw new Error(dispatchRes.error ?? 'Failed to dispatch campaign')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
      setSubmitting(false)
    }
  }

  // ── Preview labels ─────────────────────────────────────────────────────────

  const selectedSportName = sports.find(s => s.id === sportId)?.name
  const multiSportNames   = sports.filter(s => selectedSportIds.has(s.id)).map(s => s.name)
  const recipientLabel    = recipientOptions.find(o => o.value === targetProgramRoleId)?.label ?? 'Everyone'

  const isSubmitDisabled =
    (audience === 'sport_specific' && sportsLoaded && !sportId) ||
    (audience === 'multi_sport'    && sportsLoaded && selectedSportIds.size === 0)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.gray900, margin: 0 }}>
          Create Email
        </h1>
        <p style={{ fontSize: 14, color: theme.gray500, marginTop: 4 }}>
          Emails are sent immediately to recipients.
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

          {/* Subject */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
              Subject <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <Input value={subject} onChange={setSubject} placeholder="Email subject line..." />
          </div>

          {/* Body */}
          <div style={{ marginBottom: 18 }}>
            <Textarea
              label="Message *"
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Write your message here. Basic HTML is supported: <b>, <i>, <p>, <ul>, <li>, <a>."
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
              {lockedToAlumni && (
                <span style={{ fontWeight: 400, fontSize: 12, color: theme.gray400, marginLeft: 8 }}>
                  (Starter plan — alumni only)
                </span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recipientOptions.map(opt => {
                const active = targetProgramRoleId === opt.value
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => !lockedToAlumni && setTargetProgramRoleId(opt.value)}
                    style={{
                      padding:         '8px 16px',
                      borderRadius:    'var(--radius-md)',
                      border:          `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                      backgroundColor: active ? 'var(--color-primary-light)' : 'var(--color-card-bg)',
                      color:           active ? 'var(--color-primary-dark)' : theme.gray600,
                      fontSize:        13,
                      fontWeight:      active ? 600 : 400,
                      cursor:          lockedToAlumni ? 'default' : 'pointer',
                      transition:      'all 0.15s',
                      textAlign:       'left',
                      opacity:         lockedToAlumni ? 0.85 : 1,
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

          {/* Also post to newsfeed */}
          <div style={{ marginBottom: 18, paddingTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: theme.gray700 }}>
              <input type="checkbox" checked={postToFeed} onChange={e => setPostToFeed(e.target.checked)} />
              Also post to newsfeed
            </label>
          </div>

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
            {audience === 'all_sports'    && 'All Sports'}
            {audience === 'sport_specific' && (selectedSportName ?? 'Select a sport')}
            {audience === 'multi_sport'   && (
              multiSportNames.length > 0
                ? multiSportNames.join(', ')
                : 'Select sports'
            )}
            <span style={{ marginLeft: 10 }}>·</span>
            <strong style={{ marginLeft: 10 }}>Recipients:</strong>{' '}{recipientLabel}
            {postToFeed && (
              <span style={{ marginLeft: 10 }}>· will also post to newsfeed</span>
            )}
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button
              label="Cancel"
              variant="outline"
              onClick={() => router.push('/dashboard')}
            />
            <Button
              label={submitting ? 'Sending…' : (postToFeed ? 'Send Email + Post' : 'Send Email')}
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
