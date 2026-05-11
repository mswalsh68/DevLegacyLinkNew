'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { Badge }        from '@/components/ui/Badge'
import { Button }       from '@/components/ui/Button'
import { AccessDenied } from '@/components/ui/AccessDenied'
import { can, roleLabel, requiredRoleLabel } from '@/lib/permissions'
import { theme } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SportRow {
  sportId:       number
  sportName:     string
  positionId:    number | null
  positionName:  string | null
  jerseyNumber:  number | null
  classYear:     number | null
  seasonsPlayed: number | null
  programRoleId: number | null
  tierId:        number | null
  levelId:       number | null
}

interface PlayerData {
  userId:        number
  email:         string
  firstName:     string
  lastName:      string
  lastTeamLogin: string | null
  sportRows:     SportRow[]
  twitter:       string | null
  instagram:     string | null
  facebook:      string | null
  linkedIn:      string | null
  website:       string | null
  otherLink1:    string | null
  otherLink2:    string | null
  otherLink3:    string | null
  phone:                   string | null
  emergencyContactName1?:  string | null
  emergencyContactPhone1?: string | null
  emergencyContactEmail1?: string | null
  emergencyContactName2?:  string | null
  emergencyContactPhone2?: string | null
  emergencyContactEmail2?: string | null
}

interface Position {
  positionId: number
  positionName: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 12, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, href }: { label: string; value: string | number | null | undefined; href?: string }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: theme.gray400, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</div>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--color-primary)', wordBreak: 'break-all' }}>{String(value)}</a>
      ) : (
        <div style={{ fontSize: 14, color: theme.gray900 }}>{value}</div>
      )}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="field-grid-3">{children}</div>
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 14,
  border: '1px solid var(--color-card-border)',
  borderRadius: 6,
  backgroundColor: 'var(--color-card-bg)',
  color: theme.gray900,
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: theme.gray400,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 4,
}

// ─── Sport Edit Form ──────────────────────────────────────────────────────────

function SportEditForm({
  sport,
  userId,
  onSaved,
  onCancel,
}: {
  sport:    SportRow
  userId:   string
  onSaved:  (updated: Partial<SportRow>) => void
  onCancel: () => void
}) {
  const [positions,     setPositions]     = useState<Position[]>([])
  const [positionId,    setPositionId]    = useState<string>(sport.positionId != null ? String(sport.positionId) : '')
  const [jerseyNumber,  setJerseyNumber]  = useState<string>(sport.jerseyNumber  != null ? String(sport.jerseyNumber)  : '')
  const [classYear,     setClassYear]     = useState<string>(sport.classYear     != null ? String(sport.classYear)     : '')
  const [seasonsPlayed, setSeasonsPlayed] = useState<string>(sport.seasonsPlayed != null ? String(sport.seasonsPlayed) : '')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  useEffect(() => {
    fetch(`/api/sports/${sport.sportId}/positions`, { credentials: 'include' })
      .then(r => r.json())
      .then((json) => {
        if (Array.isArray(json.data)) setPositions(json.data)
        else console.error('[positions fetch] unexpected response:', json)
      })
      .catch((err) => console.error('[positions fetch] error:', err))
  }, [sport.sportId])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/players/${userId}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sportId:      sport.sportId,
          positionId:   positionId    !== '' ? Number(positionId)    : null,
          jerseyNumber: jerseyNumber  !== '' ? Number(jerseyNumber)  : null,
          classYear:    classYear     !== '' ? Number(classYear)     : null,
          seasonsPlayed:seasonsPlayed !== '' ? Number(seasonsPlayed) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) { setError(json.error ?? 'Failed to save'); return }

      const pos = positions.find(p => p.positionId === Number(positionId))
      onSaved({
        positionId:    positionId    !== '' ? Number(positionId)    : null,
        positionName:  pos?.positionName ?? sport.positionName,
        jerseyNumber:  jerseyNumber  !== '' ? Number(jerseyNumber)  : null,
        classYear:     classYear     !== '' ? Number(classYear)     : null,
        seasonsPlayed: seasonsPlayed !== '' ? Number(seasonsPlayed) : null,
      })
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Position</label>
          <select value={positionId} onChange={e => setPositionId(e.target.value)} style={inputStyle}>
            <option value="">— None —</option>
            {positions.map(p => (
              <option key={p.positionId} value={p.positionId}>{p.positionName}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Jersey #</label>
          <input
            type="number" min={0} max={99}
            value={jerseyNumber}
            onChange={e => setJerseyNumber(e.target.value)}
            placeholder="—"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Class Year</label>
          <input
            type="number" min={1900} max={2100}
            value={classYear}
            onChange={e => setClassYear(e.target.value)}
            placeholder="—"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Seasons Played</label>
          <input
            type="number" min={0} max={99}
            value={seasonsPlayed}
            onChange={e => setSeasonsPlayed(e.target.value)}
            placeholder="—"
            style={inputStyle}
          />
        </div>
      </div>
      {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button label={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={saving} />
        <Button label="Cancel" variant="outline" onClick={onCancel} disabled={saving} />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerDetailPage() {
  const router     = useRouter()
  const params     = useParams()
  const userId     = params.userId as string
  const { user, isLoading } = useAuth()
  const teamConfig = useTeamConfig()

  const [player,      setPlayer]      = useState<PlayerData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [editingSport, setEditingSport] = useState<number | null>(null) // sportId being edited

  const canManage = can(user, 'roster:manage')

  useEffect(() => {
    if (!can(user, 'roster:view')) return
    setLoading(true)
    fetch(`/api/players/${userId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res: { success: boolean; data: PlayerData; error?: string }) => {
        if (!res.success) throw new Error(res.error ?? 'Not found')
        setPlayer(res.data)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSportSaved = useCallback((sportId: number, updated: Partial<SportRow>) => {
    setPlayer(prev => {
      if (!prev) return prev
      return {
        ...prev,
        sportRows: prev.sportRows.map(r => r.sportId === sportId ? { ...r, ...updated } : r),
      }
    })
    setEditingSport(null)
  }, [])

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
  const primarySport = player.sportRows[0]

  const socialLinks = [
    { label: 'X / Twitter', value: player.twitter },
    { label: 'Instagram',   value: player.instagram },
    { label: 'Facebook',    value: player.facebook },
    { label: 'LinkedIn',    value: player.linkedIn },
    { label: 'Website',     value: player.website },
    { label: 'Other',       value: player.otherLink1 },
    { label: 'Other',       value: player.otherLink2 },
    { label: 'Other',       value: player.otherLink3 },
  ].filter(l => l.value)

  const hasEmergency = player.emergencyContactName1 || player.emergencyContactName2

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 14,
            backgroundColor: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 22, fontWeight: 800, flexShrink: 0,
          }}>
            {primarySport?.jerseyNumber ?? '—'}
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.gray900, margin: '0 0 4px', letterSpacing: '-0.4px' }}>
              {displayName}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {primarySport?.positionName && (
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>{primarySport.positionName}</span>
              )}
              {primarySport?.classYear && (
                <span style={{ fontSize: 13, color: theme.gray500 }}>· Class of {primarySport.classYear}</span>
              )}
              <Badge label="active" variant="green" />
            </div>
          </div>
        </div>
        <Button label="← Back to Roster" variant="outline" onClick={() => router.push('/roster')} />
      </div>

      <div className="detail-grid-2">
        {/* Sport rows */}
        {player.sportRows.map((sport) => (
          <Section
            key={sport.sportId}
            title={sport.sportName}
            action={canManage && editingSport !== sport.sportId ? (
              <button
                onClick={() => setEditingSport(sport.sportId)}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Edit
              </button>
            ) : undefined}
          >
            {editingSport === sport.sportId ? (
              <SportEditForm
                sport={sport}
                userId={userId}
                onSaved={(updated) => handleSportSaved(sport.sportId, updated)}
                onCancel={() => setEditingSport(null)}
              />
            ) : (
              <Grid>
                <Field label="Jersey #"       value={sport.jerseyNumber} />
                <Field label="Position"       value={sport.positionName} />
                <Field label="Class Year"     value={sport.classYear} />
                <Field label="Seasons Played" value={sport.seasonsPlayed} />
              </Grid>
            )}
          </Section>
        ))}

        {/* Contact — visible to all roster viewers */}
        {(player.phone || player.email) && (
          <Section title="Contact">
            <Field label="Phone" value={player.phone} />
            <Field label="Email" value={player.email} />
          </Section>
        )}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <Section title="Social &amp; Links">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {socialLinks.map((l, i) => (
                <Field key={i} label={l.label} value={l.value} href={l.value ?? undefined} />
              ))}
            </div>
          </Section>
        )}

        {/* Emergency contact — managers only */}
        {canManage && (
          <Section title="Emergency Contact">
            {hasEmergency ? (
              <>
                {player.emergencyContactName1 && (
                  <div style={{ marginBottom: 12 }}>
                    <Field label="Name"  value={player.emergencyContactName1} />
                    <Field label="Phone" value={player.emergencyContactPhone1} />
                    <Field label="Email" value={player.emergencyContactEmail1} />
                  </div>
                )}
                {player.emergencyContactName2 && (
                  <div>
                    <Field label="Name"  value={player.emergencyContactName2} />
                    <Field label="Phone" value={player.emergencyContactPhone2} />
                    <Field label="Email" value={player.emergencyContactEmail2} />
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13, color: theme.gray400, margin: 0 }}>None on file.</p>
            )}
          </Section>
        )}
      </div>
    </>
  )
}
