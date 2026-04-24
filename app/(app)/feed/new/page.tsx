'use client'

import { type FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { useTeamConfig } from '@/providers/ThemeProvider'
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
  { value: 'all',          label: 'Everyone (players + alumni)' },
  { value: 'players_only', label: 'Current Players only'        },
  { value: 'alumni_only',  label: 'Alumni only'                 },
  { value: 'by_position',  label: 'By Position'                 },
  { value: 'by_grad_year', label: 'By Graduation Year'          },
  { value: 'custom',       label: 'Custom filter'               },
]

const GRAD_YEAR_OPTIONS = Array.from({ length: 30 }, (_, i) => {
  const y = new Date().getFullYear() - i
  return { value: String(y), label: String(y) }
})

// Only staff roles can create posts
const CAN_POST_ROLES = ['platform_owner','app_admin','head_coach','position_coach','alumni_director']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewPostPage() {
  const router          = useRouter()
  const config          = useTeamConfig()
  const { user, isLoading } = useAuth()

  const [title,        setTitle]        = useState('')
  const [bodyHtml,     setBodyHtml]     = useState('')
  const [audience,     setAudience]     = useState('all')
  const [isPinned,     setIsPinned]     = useState(false)
  const [alsoEmail,    setAlsoEmail]    = useState(false)
  const [emailSubject, setEmailSubject] = useState('')

  // Audience sub-filters
  const [selPositions, setSelPositions] = useState<string[]>([])
  const [selGradYears, setSelGradYears] = useState<string[]>([])
  const [customPos,    setCustomPos]    = useState('')
  const [customYear,   setCustomYear]   = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const POSITION_OPTIONS = config.positions.map(p => ({ value: p, label: p }))

  // Access guard
  if (isLoading) return null
  if (!CAN_POST_ROLES.includes(user?.role ?? '')) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole="Coach or higher" />
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function buildAudienceJson(): Record<string, unknown> | undefined {
    if (audience === 'by_position' && selPositions.length > 0)
      return { positions: selPositions }
    if (audience === 'by_grad_year' && selGradYears.length > 0)
      return { gradYears: selGradYears.map(Number) }
    if (audience === 'custom') {
      const obj: Record<string, unknown> = {}
      if (customPos)  obj.position = customPos
      if (customYear) obj.gradYear = Number(customYear)
      return Object.keys(obj).length > 0 ? obj : undefined
    }
    return undefined
  }

  function togglePosition(p: string) {
    setSelPositions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function toggleGradYear(y: string) {
    setSelGradYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!bodyHtml.trim()) { setError('Post body is required.'); return }
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
          audienceJson: buildAudienceJson(),
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
            <Select value={audience} onChange={setAudience} options={AUDIENCE_OPTIONS} />
          </div>

          {/* Position multi-select */}
          {audience === 'by_position' && POSITION_OPTIONS.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label
                style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 8 }}
              >
                Select Positions
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {POSITION_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePosition(p.value)}
                    style={{
                      padding:         '6px 14px',
                      borderRadius:    'var(--radius-full)',
                      border:          `1.5px solid ${selPositions.includes(p.value) ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                      backgroundColor: selPositions.includes(p.value) ? 'var(--color-primary-light)' : 'var(--color-card-bg)',
                      color:           selPositions.includes(p.value) ? 'var(--color-primary-dark)' : theme.gray600,
                      fontSize:        13,
                      fontWeight:      600,
                      cursor:          'pointer',
                      transition:      'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grad year multi-select */}
          {audience === 'by_grad_year' && (
            <div style={{ marginBottom: 18 }}>
              <label
                style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 8 }}
              >
                Select Graduation Years
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {GRAD_YEAR_OPTIONS.slice(0, 20).map(y => (
                  <button
                    key={y.value}
                    type="button"
                    onClick={() => toggleGradYear(y.value)}
                    style={{
                      padding:         '6px 14px',
                      borderRadius:    'var(--radius-full)',
                      border:          `1.5px solid ${selGradYears.includes(y.value) ? 'var(--color-primary)' : 'var(--color-gray-200)'}`,
                      backgroundColor: selGradYears.includes(y.value) ? 'var(--color-primary-light)' : 'var(--color-card-bg)',
                      color:           selGradYears.includes(y.value) ? 'var(--color-primary-dark)' : theme.gray600,
                      fontSize:        13,
                      fontWeight:      600,
                      cursor:          'pointer',
                      transition:      'all 0.15s',
                    }}
                  >
                    {y.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom audience filters */}
          {audience === 'custom' && (
            <div style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: theme.gray500, display: 'block', marginBottom: 4 }}>
                  Position (optional)
                </label>
                <Select
                  value={customPos}
                  onChange={setCustomPos}
                  options={[{ value: '', label: 'Any' }, ...POSITION_OPTIONS]}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: theme.gray500, display: 'block', marginBottom: 4 }}>
                  Grad Year (optional)
                </label>
                <Select
                  value={customYear}
                  onChange={setCustomYear}
                  options={[{ value: '', label: 'Any' }, ...GRAD_YEAR_OPTIONS.slice(0, 20)]}
                />
              </div>
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

          {/* Audience confirmation */}
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
            {alsoEmail && (
              <span style={{ marginLeft: 12 }}>· will also be sent as email</span>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button
              label="Cancel"
              variant="outline"
              onClick={() => router.push('/feed')}
            />
            <Button
              label={submitting ? 'Publishing...' : (alsoEmail ? 'Publish + Send Email' : 'Publish')}
              type="submit"
              loading={submitting}
            />
          </div>
        </div>
      </form>
    </div>
  )
}
