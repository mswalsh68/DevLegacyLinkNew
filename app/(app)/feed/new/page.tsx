'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
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
  { value: 'sport_specific', label: 'Sport Specific — one sport only'     },
]

const CAN_POST_ROLES = [
  'platform_owner', 'app_admin', 'head_coach',
  'position_coach', 'alumni_director', 'alumni',
]

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

  const [title,        setTitle]        = useState('')
  const [bodyHtml,     setBodyHtml]     = useState('')
  const [audience,     setAudience]     = useState('all_sports')
  const [isPinned,     setIsPinned]     = useState(false)
  const [alsoEmail,    setAlsoEmail]    = useState(false)
  const [emailSubject, setEmailSubject] = useState('')

  // Sport selection — single sport when audience === 'sport_specific'
  const [sports,       setSports]       = useState<SportOption[]>([])
  const [sportId,      setSportId]      = useState<string>('')
  const [sportsLoaded, setSportsLoaded] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const isAlumni = user?.role === 'alumni'
  const canPost  = CAN_POST_ROLES.includes(user?.role ?? '')
                && (!isAlumni || (user?.tierId ?? 1) >= 2)

  // Load sports after access check passes
  useEffect(() => {
    if (!user || !canPost) return

    const endpoint = isAlumni ? '/api/me/sports' : '/api/sports'

    fetch(endpoint, { credentials: 'include' })
      .then(r => r.json())
      .then((data: { success: boolean; data: unknown[] }) => {
        if (!data.success) return
        let list: SportOption[] = []
        if (isAlumni) {
          // /api/me/sports returns { sport_id, name, abbr }
          list = (data.data as { sport_id: number; name: string; abbr: string }[]).map(s => ({
            id:   String(s.sport_id),
            name: s.name,
            abbr: s.abbr,
          }))
        } else {
          list = data.data as SportOption[]
        }
        setSports(list)
        // Auto-select if alumni has exactly one sport
        if (isAlumni && list.length === 1) setSportId(list[0].id)
        setSportsLoaded(true)
      })
      .catch(() => setSportsLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Access guard
  if (isLoading) return null

  if (!CAN_POST_ROLES.includes(user?.role ?? '')) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole="Coach or higher" />
  }

  // Alumni Tier 1 upgrade prompt
  if (isAlumni && (user?.tierId ?? 1) < 2) {
    return (
      <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: '0 24px' }}>
        <div
          style={{
            backgroundColor: 'var(--color-card-bg)',
            border:          '1px solid var(--color-card-border)',
            borderRadius:    'var(--radius-lg)',
            padding:         40,
            boxShadow:       'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.gray900, margin: '0 0 10px 0' }}>
            Upgrade to Post
          </h2>
          <p style={{ fontSize: 14, color: theme.gray500, margin: '0 0 24px 0', lineHeight: 1.6 }}>
            Alumni posting is available on Tier 2 and above. Contact your program administrator to upgrade.
          </p>
          <Button label="Back to Feed" variant="outline" onClick={() => router.push('/feed')} />
        </div>
      </div>
    )
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!bodyHtml.trim()) { setError('Post body is required.'); return }
    if (audience === 'sport_specific' && !sportId) { setError('Select a sport for this post.'); return }
    if (alsoEmail && !emailSubject.trim()) { setError('Email subject is required when sending as email.'); return }

    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/feed', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        title.trim() || undefined,
          bodyHtml,
          audience,
          sportId:      audience === 'sport_specific' ? sportId : undefined,
          isPinned,
          alsoEmail,
          emailSubject: alsoEmail ? emailSubject.trim() : undefined,
        }),
      })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Unknown error')
      router.push('/feed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
      setSubmitting(false)
    }
  }

  const audienceLabel = AUDIENCE_OPTIONS.find(o => o.value === audience)?.label ?? audience
  const selectedSportName = sports.find(s => s.id === sportId)?.name

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
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
            <label
              style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}
            >
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
            <label
              style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}
            >
              Audience
            </label>
            <Select
              value={audience}
              onChange={v => { setAudience(v); if (v === 'all_sports') setSportId('') }}
              options={AUDIENCE_OPTIONS}
            />
          </div>

          {/* Sport picker — only when sport_specific */}
          {audience === 'sport_specific' && (
            <div style={{ marginBottom: 18 }}>
              <label
                style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 8 }}
              >
                Sport
              </label>
              {!sportsLoaded ? (
                <p style={{ fontSize: 13, color: theme.gray400 }}>Loading sports…</p>
              ) : sports.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>
                  No sports available to post to.
                </p>
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

          {/* Options: pin + email */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 18, paddingTop: 4 }}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: theme.gray700 }}
            >
              <input
                type="checkbox"
                checked={isPinned}
                onChange={e => setIsPinned(e.target.checked)}
              />
              Pin to top
            </label>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: theme.gray700 }}
            >
              <input
                type="checkbox"
                checked={alsoEmail}
                onChange={e => setAlsoEmail(e.target.checked)}
              />
              Also send as email
            </label>
          </div>

          {/* Email subject — only when alsoEmail is checked */}
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
              <label
                style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}
              >
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

          {/* Audience confirmation bar */}
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
            <strong>Audience:</strong> {audienceLabel}
            {audience === 'sport_specific' && selectedSportName && (
              <span style={{ marginLeft: 8 }}>· {selectedSportName}</span>
            )}
            {alsoEmail && (
              <span style={{ marginLeft: 12 }}>· will also be sent as email</span>
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
              disabled={audience === 'sport_specific' && sportsLoaded && !sportId}
            />
          </div>
        </div>
      </form>
    </div>
  )
}
