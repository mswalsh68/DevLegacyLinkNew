'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { Badge }        from '@/components/ui/Badge'
import { Button }       from '@/components/ui/Button'
import { AccessDenied } from '@/components/ui/AccessDenied'
import { can, roleLabel, requiredRoleLabel } from '@/lib/permissions'
import { playerStatusBadge } from '@/lib/statusMappings'
import { theme } from '@/lib/theme'
import { updatePlayer } from '@/app/actions/players'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  userId:       string
  firstName:    string
  lastName:     string
  jerseyNumber: number | null
  position:     string
  academicYear: string
  heightInches: number | null
  weightLbs:    number | null
  homeTown:     string | null
  homeState:    string | null
  highSchool:   string | null
  recruitingClass: number | null
  major:        string | null
  phone:        string | null
  email:        string | null
  instagram:    string | null
  twitter:      string | null
  snapchat:     string | null
  emergencyContactName:  string | null
  emergencyContactPhone: string | null
  parent1Name:  string | null
  parent1Phone: string | null
  parent1Email: string | null
  parent2Name:  string | null
  parent2Phone: string | null
  parent2Email: string | null
  notes:        string | null
  createdAt:    string
}

interface EditState {
  jerseyNumber:          string
  position:              string
  academicYear:          string
  heightInches:          string
  weightLbs:             string
  major:                 string
  phone:                 string
  email:                 string
  instagram:             string
  twitter:               string
  snapchat:              string
  emergencyContactName:  string
  emergencyContactPhone: string
  parent1Name:           string
  parent1Phone:          string
  parent1Email:          string
  parent2Name:           string
  parent2Phone:          string
  parent2Email:          string
  notes:                 string
}

function playerToEditState(p: Player): EditState {
  return {
    jerseyNumber:          p.jerseyNumber  != null ? String(p.jerseyNumber)  : '',
    position:              p.position      ?? '',
    academicYear:          p.academicYear  ?? '',
    heightInches:          p.heightInches  != null ? String(p.heightInches)  : '',
    weightLbs:             p.weightLbs     != null ? String(p.weightLbs)     : '',
    major:                 p.major         ?? '',
    phone:                 p.phone         ?? '',
    email:                 p.email         ?? '',
    instagram:             p.instagram     ?? '',
    twitter:               p.twitter       ?? '',
    snapchat:              p.snapchat      ?? '',
    emergencyContactName:  p.emergencyContactName  ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
    parent1Name:           p.parent1Name   ?? '',
    parent1Phone:          p.parent1Phone  ?? '',
    parent1Email:          p.parent1Email  ?? '',
    parent2Name:           p.parent2Name   ?? '',
    parent2Phone:          p.parent2Phone  ?? '',
    parent2Email:          p.parent2Email  ?? '',
    notes:                 p.notes         ?? '',
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

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: theme.gray400, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: theme.gray900 }}>{value}</div>
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

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 24px' }}>{children}</div>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string
  const { user, isLoading } = useAuth()

  const [player,    setPlayer]    = useState<Player | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const canEdit = can(user, 'roster:edit')

  useEffect(() => {
    if (!can(user, 'roster:view')) return
    setLoading(true)
    fetch(`/api/players/${userId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res: { success: boolean; data: Player; error?: string }) => {
        if (!res.success) throw new Error(res.error ?? 'Not found')
        setPlayer(res.data)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleEdit() {
    if (!player) return
    setEditState(playerToEditState(player))
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

  async function handleSave() {
    if (!editState || !player || !user?.appDb) return
    setSaving(true)
    setSaveError(null)
    const result = await updatePlayer(user.appDb, {
      userId,
      updatedBy:             user.userId,
      jerseyNumber:          editState.jerseyNumber  !== '' ? Number(editState.jerseyNumber)  : undefined,
      position:              editState.position      || undefined,
      academicYear:          editState.academicYear  || undefined,
      heightInches:          editState.heightInches  !== '' ? Number(editState.heightInches)  : undefined,
      weightLbs:             editState.weightLbs     !== '' ? Number(editState.weightLbs)     : undefined,
      major:                 editState.major         || undefined,
      phone:                 editState.phone         || undefined,
      email:                 editState.email         || undefined,
      instagram:             editState.instagram     || undefined,
      twitter:               editState.twitter       || undefined,
      snapchat:              editState.snapchat      || undefined,
      emergencyContactName:  editState.emergencyContactName  || undefined,
      emergencyContactPhone: editState.emergencyContactPhone || undefined,
      parent1Name:           editState.parent1Name   || undefined,
      parent1Phone:          editState.parent1Phone  || undefined,
      parent1Email:          editState.parent1Email  || undefined,
      parent2Name:           editState.parent2Name   || undefined,
      parent2Phone:          editState.parent2Phone  || undefined,
      parent2Email:          editState.parent2Email  || undefined,
      notes:                 editState.notes         || undefined,
      requestingUserId:      user.userId,
      requestingUserRole:    user.role,
    })
    setSaving(false)
    if (!result.success) {
      setSaveError(result.error ?? 'Save failed.')
      return
    }
    // Refresh player data
    const res = await fetch(`/api/players/${userId}`, { credentials: 'include' }).then((r) => r.json()) as { success: boolean; data: Player }
    if (res.success) setPlayer(res.data)
    setIsEditing(false)
    setEditState(null)
  }

  if (isLoading) return null
  if (!can(user, 'roster:view')) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole={requiredRoleLabel('roster:view')} />
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: theme.gray400 }}>Loading...</div>
  }

  if (error || !player) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: theme.gray500, marginBottom: 16 }}>{error ?? 'Player not found.'}</p>
        <Button label="← Back to Roster" variant="outline" onClick={() => router.push('/roster')} />
      </div>
    )
  }

  const displayName = `${player.firstName} ${player.lastName}`
  const hometown    = [player.homeTown, player.homeState].filter(Boolean).join(', ')

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Jersey bubble */}
          <div style={{
            width: 64, height: 64, borderRadius: 14,
            backgroundColor: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 22, fontWeight: 800, flexShrink: 0,
          }}>
            {player.jerseyNumber ?? '—'}
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.gray900, margin: '0 0 4px', letterSpacing: '-0.4px' }}>
              {displayName}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>{player.position}</span>
              {player.academicYear && <span style={{ fontSize: 13, color: theme.gray500 }}>· {player.academicYear}</span>}
              {player.recruitingClass && <span style={{ fontSize: 13, color: theme.gray500 }}>· Class of {player.recruitingClass}</span>}
              <Badge label="active" variant={playerStatusBadge('active')} />
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
              <Button label="← Back to Roster" variant="outline" onClick={() => router.push('/roster')} />
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
          <Section title="Personal Info">
            {isEditing && editState ? (
              <Grid>
                <EditField label="Jersey #"     name="jerseyNumber" value={editState.jerseyNumber} onChange={handleChange} type="number" />
                <EditField label="Position"     name="position"     value={editState.position}     onChange={handleChange} />
                <EditField label="Year"         name="academicYear" value={editState.academicYear} onChange={handleChange} />
                <EditField label="Height (in)"  name="heightInches" value={editState.heightInches} onChange={handleChange} type="number" placeholder="e.g. 73" />
                <EditField label="Weight (lbs)" name="weightLbs"    value={editState.weightLbs}    onChange={handleChange} type="number" />
                <EditField label="Major"        name="major"        value={editState.major}        onChange={handleChange} />
              </Grid>
            ) : (
              <Grid>
                <Field label="Height"     value={player.heightInches ? `${Math.floor(player.heightInches / 12)}′${player.heightInches % 12}″` : null} />
                <Field label="Weight"     value={player.weightLbs ? `${player.weightLbs} lbs` : null} />
                <Field label="Hometown"   value={hometown || null} />
                <Field label="High School"value={player.highSchool} />
                <Field label="Major"      value={player.major} />
              </Grid>
            )}
          </Section>

          <Section title="Contact">
            {isEditing && editState ? (
              <Grid>
                <EditField label="Phone"       name="phone"     value={editState.phone}     onChange={handleChange} type="tel" />
                <EditField label="Email"       name="email"     value={editState.email}     onChange={handleChange} type="email" />
                <EditField label="Instagram"   name="instagram" value={editState.instagram} onChange={handleChange} />
                <EditField label="Twitter / X" name="twitter"   value={editState.twitter}   onChange={handleChange} />
                <EditField label="Snapchat"    name="snapchat"  value={editState.snapchat}  onChange={handleChange} />
              </Grid>
            ) : (
              <Grid>
                <Field label="Phone"       value={player.phone} />
                <Field label="Email"       value={player.email} />
                <Field label="Instagram"   value={player.instagram} />
                <Field label="Twitter / X" value={player.twitter} />
                <Field label="Snapchat"    value={player.snapchat} />
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
            ) : player.notes ? (
              <p style={{ fontSize: 14, color: theme.gray700, margin: 0, lineHeight: 1.6 }}>{player.notes}</p>
            ) : (
              <p style={{ fontSize: 13, color: theme.gray400, margin: 0 }}>No notes.</p>
            )}
          </Section>
        </div>

        {/* Right column */}
        <div>
          <Section title="Emergency Contact">
            {isEditing && editState ? (
              <>
                <EditField label="Name"  name="emergencyContactName"  value={editState.emergencyContactName}  onChange={handleChange} />
                <EditField label="Phone" name="emergencyContactPhone" value={editState.emergencyContactPhone} onChange={handleChange} type="tel" />
              </>
            ) : (
              <>
                <Field label="Name"  value={player.emergencyContactName} />
                <Field label="Phone" value={player.emergencyContactPhone} />
                {!player.emergencyContactName && !player.emergencyContactPhone && (
                  <p style={{ fontSize: 13, color: theme.gray400, margin: 0 }}>None on file.</p>
                )}
              </>
            )}
          </Section>

          <Section title="Parent / Guardian">
            {isEditing && editState ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, marginBottom: 6 }}>Parent 1</div>
                <Grid>
                  <EditField label="Name"  name="parent1Name"  value={editState.parent1Name}  onChange={handleChange} />
                  <EditField label="Phone" name="parent1Phone" value={editState.parent1Phone} onChange={handleChange} type="tel" />
                  <EditField label="Email" name="parent1Email" value={editState.parent1Email} onChange={handleChange} type="email" />
                </Grid>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, margin: '12px 0 6px' }}>Parent 2</div>
                <Grid>
                  <EditField label="Name"  name="parent2Name"  value={editState.parent2Name}  onChange={handleChange} />
                  <EditField label="Phone" name="parent2Phone" value={editState.parent2Phone} onChange={handleChange} type="tel" />
                  <EditField label="Email" name="parent2Email" value={editState.parent2Email} onChange={handleChange} type="email" />
                </Grid>
              </>
            ) : (
              <>
                {player.parent1Name && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, marginBottom: 6 }}>Parent 1</div>
                    <Grid>
                      <Field label="Name"  value={player.parent1Name} />
                      <Field label="Phone" value={player.parent1Phone} />
                      <Field label="Email" value={player.parent1Email} />
                    </Grid>
                  </div>
                )}
                {player.parent2Name && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.gray700, marginBottom: 6 }}>Parent 2</div>
                    <Grid>
                      <Field label="Name"  value={player.parent2Name} />
                      <Field label="Phone" value={player.parent2Phone} />
                      <Field label="Email" value={player.parent2Email} />
                    </Grid>
                  </div>
                )}
                {!player.parent1Name && !player.parent2Name && (
                  <p style={{ fontSize: 13, color: theme.gray400, margin: 0 }}>None on file.</p>
                )}
              </>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}
