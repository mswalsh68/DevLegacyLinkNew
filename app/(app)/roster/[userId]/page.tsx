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

// ─── Helper ───────────────────────────────────────────────────────────────────

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

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 24px' }}>{children}</div>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string
  const { user, isLoading } = useAuth()

  const [player,  setPlayer]  = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

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
        <Button label="← Back to Roster" variant="outline" onClick={() => router.push('/roster')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left column */}
        <div>
          <Section title="Personal Info">
            <Grid>
              <Field label="Height" value={player.heightInches ? `${Math.floor(player.heightInches / 12)}′${player.heightInches % 12}″` : null} />
              <Field label="Weight" value={player.weightLbs ? `${player.weightLbs} lbs` : null} />
              <Field label="Hometown" value={hometown || null} />
              <Field label="High School" value={player.highSchool} />
              <Field label="Major" value={player.major} />
            </Grid>
          </Section>

          <Section title="Contact">
            <Grid>
              <Field label="Phone" value={player.phone} />
              <Field label="Email" value={player.email} />
              <Field label="Instagram" value={player.instagram} />
              <Field label="Twitter / X" value={player.twitter} />
              <Field label="Snapchat" value={player.snapchat} />
            </Grid>
          </Section>

          {player.notes && (
            <Section title="Notes">
              <p style={{ fontSize: 14, color: theme.gray700, margin: 0, lineHeight: 1.6 }}>{player.notes}</p>
            </Section>
          )}
        </div>

        {/* Right column */}
        <div>
          {(player.emergencyContactName || player.emergencyContactPhone) && (
            <Section title="Emergency Contact">
              <Field label="Name"  value={player.emergencyContactName} />
              <Field label="Phone" value={player.emergencyContactPhone} />
            </Section>
          )}

          {(player.parent1Name || player.parent2Name) && (
            <Section title="Parent / Guardian">
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
            </Section>
          )}
        </div>
      </div>
    </>
  )
}
