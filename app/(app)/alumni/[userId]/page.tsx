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

interface EditState {
  phone:               string
  personalEmail:       string
  linkedInUrl:         string
  twitterUrl:          string
  currentEmployer:     string
  currentJobTitle:     string
  currentCity:         string
  currentState:        string
  isDonor:             boolean
  lastDonationDate:    string
  totalDonations:      string
  engagementScore:     string
  communicationConsent: boolean
  yearsOnRoster:       string
  notes:               string
}

function alumniToEditState(a: AlumniRecord): EditState {
  return {
    phone:               a.phone            ?? '',
    personalEmail:       a.personalEmail    ?? '',
    linkedInUrl:         a.linkedInUrl      ?? '',
    twitterUrl:          a.twitterUrl       ?? '',
    currentEmployer:     a.currentEmployer  ?? '',
    currentJobTitle:     a.currentJobTitle  ?? '',
    currentCity:         a.currentCity      ?? '',
    currentState:        a.currentState     ?? '',
    isDonor:             a.isDonor          ?? false,
    lastDonationDate:    a.lastDonationDate ? a.lastDonationDate.slice(0, 10) : '',
    totalDonations:      a.totalDonations   != null ? String(a.totalDonations) : '',
    engagementScore:     a.engagementScore  != null ? String(a.engagementScore) : '',
    communicationConsent: a.communicationConsent ?? false,
    yearsOnRoster:       a.yearsOnRoster    != null ? String(a.yearsOnRoster) : '',
    notes:               a.notes            ?? '',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function EditField({
  label, name, value, onChange, type = 'text', placeholder,
}: {
  label: string
  name: string
  value: string
  onChange: (name: string, value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: theme.gray400, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          fontSize: 14, color: theme.gray900,
          border: `1px solid ${theme.gray200}`, borderRadius: 6,
          padding: '6px 10px', outline: 'none',
          backgroundColor: '#fff',
        }}
      />
    </div>
  )
}

function EditCheckbox({
  label, name, value, onChange,
}: {
  label: string
  name: string
  value: boolean
  onChange: (name: string, value: boolean) => void
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(name, e.target.checked)}
        />
        <span style={{ fontSize: 14, color: theme.gray900 }}>{label}</span>
      </label>
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
  const [isEditing,     setIsEditing]     = useState(false)
  const [editState,     setEditState]     = useState<EditState | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)

  const canEdit = can(user, 'alumni:edit')

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

  function handleEdit() {
    if (!alumni) return
    setEditState(alumniToEditState(alumni))
    setSaveError(null)
    setIsEditing(true)
  }

  function handleCancel() {
    setIsEditing(false)
    setEditState(null)
    setSaveError(null)
  }

  function handleChange(name: string, value: string) {
    setEditState((prev) => prev ? { ...prev, [name]: value } : prev)
  }

  function handleCheckboxChange(name: string, value: boolean) {
    setEditState((prev) => prev ? { ...prev, [name]: value } : prev)
  }

  async function handleSave() {
    if (!editState || !alumni) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/alumni/${userId}`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone:               editState.phone            || null,
          personalEmail:       editState.personalEmail    || null,
          linkedInUrl:         editState.linkedInUrl      || null,
          twitterUrl:          editState.twitterUrl       || null,
          currentEmployer:     editState.currentEmployer  || null,
          currentJobTitle:     editState.currentJobTitle  || null,
          currentCity:         editState.currentCity      || null,
          currentState:        editState.currentState     || null,
          isDonor:             editState.isDonor,
          lastDonationDate:    editState.lastDonationDate || null,
          totalDonations:      editState.totalDonations   !== '' ? Number(editState.totalDonations)   : null,
          engagementScore:     editState.engagementScore  !== '' ? Number(editState.engagementScore)  : null,
          communicationConsent: editState.communicationConsent,
          yearsOnRoster:       editState.yearsOnRoster    !== '' ? Number(editState.yearsOnRoster)    : null,
          notes:               editState.notes            || null,
        }),
      })
      const result = await res.json() as { success: boolean; error?: string }
      if (!result.success) {
        setSaveError(result.error ?? 'Save failed.')
        setSaving(false)
        return
      }
    } catch {
      setSaveError('Network error. Please try again.')
      setSaving(false)
      return
    }
    setSaving(false)
    // Refresh alumni data
    const refresh = await fetch(`/api/alumni/${userId}`, { credentials: 'include' }).then((r) => r.json()) as { success: boolean; data: AlumniRecord; interactions: Interaction[] }
    if (refresh.success) {
      setAlumni(refresh.data)
      setInteractions(refresh.interactions ?? [])
    }
    setIsEditing(false)
    setEditState(null)
  }

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
        <div style={{ display: 'flex', gap: 8 }}>
          {isEditing ? (
            <>
              <Button label={saving ? 'Saving…' : 'Save Changes'} variant="primary" onClick={handleSave} />
              <Button label="Cancel" variant="outline" onClick={handleCancel} />
            </>
          ) : (
            <>
              {canEdit && <Button label="Edit" variant="outline" onClick={handleEdit} />}
              <Button label="← Back to Alumni" variant="outline" onClick={() => router.push('/alumni')} />
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
          {saveError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left column */}
        <div>
          <Section title="Career">
            {isEditing && editState ? (
              <Grid>
                <EditField label="Employer"    name="currentEmployer" value={editState.currentEmployer} onChange={handleChange} />
                <EditField label="Job Title"   name="currentJobTitle" value={editState.currentJobTitle} onChange={handleChange} />
                <EditField label="City"        name="currentCity"     value={editState.currentCity}     onChange={handleChange} />
                <EditField label="State"       name="currentState"    value={editState.currentState}    onChange={handleChange} />
                <EditField label="LinkedIn URL"name="linkedInUrl"     value={editState.linkedInUrl}     onChange={handleChange} />
                <EditField label="Twitter URL" name="twitterUrl"      value={editState.twitterUrl}      onChange={handleChange} />
              </Grid>
            ) : (
              <>
                <Grid>
                  <Field label="Employer"  value={alumni.currentEmployer} />
                  <Field label="Job Title" value={alumni.currentJobTitle} />
                  <Field label="Location"  value={location || null} />
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
              </>
            )}
          </Section>

          <Section title="Contact">
            {isEditing && editState ? (
              <Grid>
                <EditField label="Phone" name="phone"         value={editState.phone}         onChange={handleChange} type="tel" />
                <EditField label="Email" name="personalEmail" value={editState.personalEmail} onChange={handleChange} type="email" />
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                  <EditCheckbox label="Communication Consent" name="communicationConsent" value={editState.communicationConsent} onChange={handleCheckboxChange} />
                </div>
              </Grid>
            ) : (
              <Grid>
                <Field label="Phone" value={alumni.phone} />
                <Field label="Email" value={alumni.personalEmail} />
                <Field label="Communication Consent" value={alumni.communicationConsent} />
              </Grid>
            )}
          </Section>

          <Section title="Notes">
            {isEditing && editState ? (
              <textarea
                value={editState.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  fontSize: 14, color: theme.gray900,
                  border: `1px solid ${theme.gray200}`, borderRadius: 6,
                  padding: '8px 10px', resize: 'vertical', outline: 'none',
                }}
              />
            ) : alumni.notes ? (
              <p style={{ fontSize: 14, color: theme.gray700, margin: 0, lineHeight: 1.6 }}>{alumni.notes}</p>
            ) : (
              <p style={{ fontSize: 13, color: theme.gray400, margin: 0 }}>No notes.</p>
            )}
          </Section>
        </div>

        {/* Right column */}
        <div>
          <Section title="Giving">
            {isEditing && editState ? (
              <Grid>
                <div style={{ marginBottom: 12 }}>
                  <EditCheckbox label="Donor" name="isDonor" value={editState.isDonor} onChange={handleCheckboxChange} />
                </div>
                <EditField label="Total Donations ($)" name="totalDonations"  value={editState.totalDonations}  onChange={handleChange} type="number" />
                <EditField label="Last Donation Date"  name="lastDonationDate"value={editState.lastDonationDate}onChange={handleChange} type="date" />
                <EditField label="Engagement Score"    name="engagementScore" value={editState.engagementScore} onChange={handleChange} type="number" />
                <EditField label="Years on Roster"     name="yearsOnRoster"   value={editState.yearsOnRoster}   onChange={handleChange} type="number" />
              </Grid>
            ) : (
              <Grid>
                <Field label="Donor"            value={alumni.isDonor ? 'Yes' : 'No'} />
                <Field label="Total Donations"  value={alumni.totalDonations != null ? `$${alumni.totalDonations.toLocaleString()}` : null} />
                <Field label="Last Donation"    value={formatDate(alumni.lastDonationDate)} />
                <Field label="Engagement Score" value={alumni.engagementScore} />
                <Field label="Years on Roster"  value={alumni.yearsOnRoster} />
              </Grid>
            )}
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
