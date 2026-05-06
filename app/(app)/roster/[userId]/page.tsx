'use client'

import { useEffect, useState } from 'react'
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
  // Social — always visible
  twitter:       string | null
  instagram:     string | null
  facebook:      string | null
  linkedIn:      string | null
  website:       string | null
  otherLink1:    string | null
  otherLink2:    string | null
  otherLink3:    string | null
  // Contact — all roster viewers
  phone:                   string | null
  emergencyContactName1?:  string | null
  emergencyContactPhone1?: string | null
  emergencyContactEmail1?: string | null
  emergencyContactName2?:  string | null
  emergencyContactPhone2?: string | null
  emergencyContactEmail2?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <h2 style={{ fontSize: 12, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px' }}>{title}</h2>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerDetailPage() {
  const router     = useRouter()
  const params     = useParams()
  const userId     = params.userId as string
  const { user, isLoading } = useAuth()
  const teamConfig = useTeamConfig()

  const [player,  setPlayer]  = useState<PlayerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        {/* Sport rows */}
        {player.sportRows.map((sport) => (
          <Section key={sport.sportId} title={sport.sportName}>
            <Grid>
              <Field label="Jersey #"       value={sport.jerseyNumber} />
              <Field label="Position"       value={sport.positionName} />
              <Field label="Class Year"     value={sport.classYear} />
              <Field label="Seasons Played" value={sport.seasonsPlayed} />
            </Grid>
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
