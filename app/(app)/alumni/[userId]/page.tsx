'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { Badge }        from '@/components/ui/Badge'
import { Button }       from '@/components/ui/Button'
import { AccessDenied } from '@/components/ui/AccessDenied'
import { can, roleLabel, requiredRoleLabel } from '@/lib/permissions'
import { alumniStatusBadge } from '@/lib/statusMappings'
import { theme } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlumniRecord {
  userId:              string
  firstName:           string
  lastName:            string
  graduationYear:      number | null
  graduationSemester:  string | null
  position:            string
  recruitingClass:     number | null
  personalEmail:       string | null
  phone:               string | null
  linkedInUrl:         string | null
  twitterUrl:          string | null
  currentEmployer:     string | null
  currentJobTitle:     string | null
  currentCity:         string | null
  currentState:        string | null
  isDonor:             boolean
  lastDonationDate:    string | null
  totalDonations:      number | null
  engagementScore:     number | null
  communicationConsent: boolean
  yearsOnRoster:       number | null
  notes:               string | null
  status:              string
}

interface Interaction {
  id:          number
  channel:     string
  summary:     string
  outcome:     string | null
  followUpAt:  string | null
  loggedAt:    string
  loggedBy:    string | null
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid var(--color-card-border)', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16 }}>
      <h2 style={{ fontSize: 12, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px' }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: theme.gray400, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: theme.gray900 }}>{display}</div>
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 24px' }}>{children}</div>
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlumniDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string
  const { user, isLoading } = useAuth()

  const [alumni,        setAlumni]        = useState<AlumniRecord | null>(null)
  const [interactions,  setInteractions]  = useState<Interaction[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)

  useEffect(() => {
    if (!can(user, 'alumni:view')) return
    setLoading(true)
    fetch(`/api/alumni/${userId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res: { success: boolean; data: AlumniRecord; interactions: Interaction[]; error?: string }) => {
        if (!res.success) throw new Error(res.error ?? 'Not found')
        setAlumni(res.data)
        setInteractions(res.interactions ?? [])
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return null
  if (!can(user, 'alumni:view')) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole={requiredRoleLabel('alumni:view')} />
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: theme.gray400 }}>Loading...</div>
  }

  if (error || !alumni) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: theme.gray500, marginBottom: 16 }}>{error ?? 'Alumni record not found.'}</p>
        <Button label="← Back to Alumni" variant="outline" onClick={() => router.push('/alumni')} />
      </div>
    )
  }

  const displayName = `${alumni.firstName} ${alumni.lastName}`
  const location    = [alumni.currentCity, alumni.currentState].filter(Boolean).join(', ')
  const gradLabel   = [alumni.graduationSemester, alumni.graduationYear].filter(Boolean).join(' ')

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Class year bubble */}
          <div style={{
            width: 64, height: 64, borderRadius: 14,
            backgroundColor: 'var(--color-accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-accent-dark)', fontSize: 18, fontWeight: 800, flexShrink: 0,
          }}>
            &apos;{String(alumni.graduationYear ?? '').slice(-2) || '—'}
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.gray900, margin: '0 0 4px', letterSpacing: '-0.4px' }}>
              {displayName}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>{alumni.position}</span>
              {gradLabel && <span style={{ fontSize: 13, color: theme.gray500, textTransform: 'capitalize' }}>· {gradLabel}</span>}
              {alumni.recruitingClass && <span style={{ fontSize: 13, color: theme.gray500 }}>· Class of {alumni.recruitingClass}</span>}
              <Badge label={alumni.status ?? 'active'} variant={alumniStatusBadge(alumni.status ?? 'active')} />
              {alumni.isDonor && <Badge label="Donor" variant="gold" />}
            </div>
          </div>
        </div>
        <Button label="← Back to Alumni" variant="outline" onClick={() => router.push('/alumni')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left column */}
        <div>
          <Section title="Career">
            <Grid>
              <Field label="Employer"   value={alumni.currentEmployer} />
              <Field label="Job Title"  value={alumni.currentJobTitle} />
              <Field label="Location"   value={location || null} />
            </Grid>
            {(alumni.linkedInUrl || alumni.twitterUrl) && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {alumni.linkedInUrl && (
                  <a href={alumni.linkedInUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                    LinkedIn ↗
                  </a>
                )}
                {alumni.twitterUrl && (
                  <a href={alumni.twitterUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                    Twitter / X ↗
                  </a>
                )}
              </div>
            )}
          </Section>

          <Section title="Contact">
            <Grid>
              <Field label="Phone" value={alumni.phone} />
              <Field label="Email" value={alumni.personalEmail} />
              <Field label="Communication Consent" value={alumni.communicationConsent} />
            </Grid>
          </Section>

          {alumni.notes && (
            <Section title="Notes">
              <p style={{ fontSize: 14, color: theme.gray700, margin: 0, lineHeight: 1.6 }}>{alumni.notes}</p>
            </Section>
          )}
        </div>

        {/* Right column */}
        <div>
          <Section title="Giving">
            <Grid>
              <Field label="Donor"             value={alumni.isDonor ? 'Yes' : 'No'} />
              <Field label="Total Donations"   value={alumni.totalDonations != null ? `$${alumni.totalDonations.toLocaleString()}` : null} />
              <Field label="Last Donation"     value={formatDate(alumni.lastDonationDate)} />
              <Field label="Engagement Score"  value={alumni.engagementScore} />
              <Field label="Years on Roster"   value={alumni.yearsOnRoster} />
            </Grid>
          </Section>

          {/* Interactions */}
          {interactions.length > 0 && (
            <Section title={`Interactions (${interactions.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {interactions.map((i) => (
                  <div key={i.id} style={{ backgroundColor: theme.gray50, borderRadius: 8, padding: '10px 14px', border: `1px solid ${theme.gray200}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'capitalize' }}>{i.channel}</span>
                      <span style={{ fontSize: 11, color: theme.gray400 }}>{formatDate(i.loggedAt)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: theme.gray700, margin: 0, lineHeight: 1.5 }}>{i.summary}</p>
                    {i.outcome && <p style={{ fontSize: 12, color: theme.gray500, margin: '4px 0 0' }}>Outcome: {i.outcome}</p>}
                    {i.followUpAt && <p style={{ fontSize: 12, color: theme.gray500, margin: '4px 0 0' }}>Follow up: {formatDate(i.followUpAt)}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  )
}
