'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { AccessDenied } from '@/components/ui/AccessDenied'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { can, roleLabel, requiredRoleLabel } from '@/lib/permissions'
import { hasFeature, normalizeTier } from '@/lib/features'
import { theme } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MentorPairing {
  id:              number
  status:          string
  createdAt:       string
  respondedAt:     string | null
  sportId:         number | null
  sportName:       string | null
  playerUserId:    number
  playerFirstName: string
  playerLastName:  string
  playerPosition:  string | null
  playerClassYear: number | null
  alumniUserId:    number
  alumniFirstName: string
  alumniLastName:  string
  alumniPosition:  string | null
  adminFirstName:  string
  adminLastName:   string
}

interface PlayerMentor {
  id:                  number
  alumniUserId:        number
  alumniFirstName:     string
  alumniLastName:      string
  sportName:           string | null
  alumniPosition:      string | null
  alumniClassYear:     number | null
  alumniSeasonsPlayed: number | null
  alumniEmail:         string | null
  alumniPhone:         string | null
  acceptedAt:          string | null
}

interface AlumniDashboardRow {
  id:              number
  status:          string
  createdAt:       string
  sportName:       string | null
  playerUserId:    number
  playerFirstName: string
  playerLastName:  string
  playerPosition:  string | null
  playerClassYear: number | null
  playerIsActive:  boolean
}

interface AlumniDashboard {
  pending: AlumniDashboardRow[]
  active:  AlumniDashboardRow[]
  history: AlumniDashboardRow[]
}

// Wizard step state
interface WizardPlayer {
  userId:    number
  firstName: string
  lastName:  string
  position:  string | null
  classYear: number | null
  sportId:   number | null
  sportName: string | null
  email:     string
}

interface WizardAlumni {
  userId:         string
  firstName:      string
  lastName:       string
  position:       string
  graduationYear: number | null
  email:          string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'green' | 'warning' | 'gray' | 'danger' }> = {
    pending:   { label: 'Pending',   variant: 'warning' },
    active:    { label: 'Active',    variant: 'green'   },
    declined:  { label: 'Declined',  variant: 'danger'  },
    cancelled: { label: 'Cancelled', variant: 'gray'    },
  }
  const cfg = map[status] ?? { label: status, variant: 'gray' as const }
  return <Badge label={cfg.label} variant={cfg.variant} />
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-card-bg)',
      border:          '1px solid var(--color-card-border)',
      borderRadius:    12,
      padding:         24,
      boxShadow:       '0 1px 3px rgba(0,0,0,0.06)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 style={{ fontSize: 12, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px' }}>
      {title}
    </h2>
  )
}

// ─── Contact Card (used by both player and alumni views) ─────────────────────

function MentorContactCard({ name, position, classYear, seasonsPlayed, email, phone, sportName }: {
  name:          string
  position:      string | null
  classYear:     number | null
  seasonsPlayed: number | null
  email:         string | null
  phone:         string | null
  sportName:     string | null
}) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          backgroundColor: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 20, fontWeight: 800, flexShrink: 0,
        }}>
          {name[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: theme.gray900 }}>{name}</div>
          {sportName && <div style={{ fontSize: 13, color: theme.gray500 }}>{sportName}</div>}
        </div>
      </div>
      {position    && <div style={{ fontSize: 13, color: theme.gray600, marginBottom: 4 }}>Position: <strong>{position}</strong></div>}
      {classYear   && <div style={{ fontSize: 13, color: theme.gray600, marginBottom: 4 }}>Class of {classYear}</div>}
      {seasonsPlayed != null && <div style={{ fontSize: 13, color: theme.gray600, marginBottom: 12 }}>{seasonsPlayed} season{seasonsPlayed !== 1 ? 's' : ''} played</div>}
      {(email || phone) && (
        <div style={{ borderTop: `1px solid ${theme.gray200}`, paddingTop: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {email && (
            <a href={`mailto:${email}`} style={{ fontSize: 14, color: 'var(--color-primary)', textDecoration: 'none' }}>
              {email}
            </a>
          )}
          {phone && (
            <a href={`tel:${phone}`} style={{ fontSize: 14, color: 'var(--color-primary)', textDecoration: 'none' }}>
              {phone}
            </a>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Create Pairing Wizard ────────────────────────────────────────────────────

function CreatePairingWizard({
  onClose,
  onCreated,
  teamName,
  coachName,
}: {
  onClose:   () => void
  onCreated: () => void
  teamName:  string
  coachName: string
}) {
  const [step,          setStep]          = useState<1 | 2 | 3>(1)
  const [players,       setPlayers]       = useState<WizardPlayer[]>([])
  const [alumni,        setAlumni]        = useState<WizardAlumni[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<WizardPlayer | null>(null)
  const [selectedAlumni, setSelectedAlumni] = useState<WizardAlumni | null>(null)
  const [playerSearch,  setPlayerSearch]  = useState('')
  const [alumniSearch,  setAlumniSearch]  = useState('')
  const [loadingP,      setLoadingP]      = useState(false)
  const [loadingA,      setLoadingA]      = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [saveError,     setSaveError]     = useState<string | null>(null)

  useEffect(() => {
    setLoadingP(true)
    const params = new URLSearchParams({ pageSize: '200' })
    if (playerSearch) params.set('search', playerSearch)
    fetch(`/api/players?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setPlayers((res.data as Record<string, unknown>[]).map(p => ({
            userId:    Number(p.userId),
            firstName: p.firstName as string,
            lastName:  p.lastName  as string,
            email:     p.email     as string,
            position:  (p.position ?? p.positionName) as string | null,
            classYear: (p.classYear as number | null) ?? null,
            sportId:   (p.sportId  as number | null) ?? null,
            sportName: (p.sportName as string | null) ?? null,
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingP(false))
  }, [playerSearch])

  useEffect(() => {
    if (step !== 2) return
    setLoadingA(true)
    const params = new URLSearchParams({ pageSize: '200' })
    if (alumniSearch) params.set('search', alumniSearch)
    fetch(`/api/alumni?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setAlumni((res.data as Record<string, unknown>[]).map(a => ({
            userId:         String(a.userId),
            firstName:      a.firstName      as string,
            lastName:       a.lastName       as string,
            email:          a.email          as string,
            position:       (a.position      as string) ?? '',
            graduationYear: (a.graduationYear as number | null) ?? null,
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingA(false))
  }, [step, alumniSearch])

  async function handleCreate() {
    if (!selectedPlayer || !selectedAlumni) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/mentor/pairings', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerUserId:    selectedPlayer.userId,
          alumniUserId:    Number(selectedAlumni.userId),
          sportId:         selectedPlayer.sportId,
          // Email context — wizard has all this info
          playerFirstName: selectedPlayer.firstName,
          playerLastName:  selectedPlayer.lastName,
          playerPosition:  selectedPlayer.position,
          playerClassYear: selectedPlayer.classYear,
          alumniEmail:     selectedAlumni.email,
          alumniFirstName: selectedAlumni.firstName,
          teamName,
          coachName,
        }),
      })
      const json = await res.json() as { success: boolean; error?: string }
      if (!json.success) { setSaveError(json.error ?? 'Failed to create pairing.'); setSaving(false); return }
      onCreated()
    } catch {
      setSaveError('Network error. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        backgroundColor: 'var(--color-card-bg)',
        borderRadius: 16, padding: 32,
        width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.gray900, margin: 0 }}>Create Pairing</h2>
            <p style={{ fontSize: 13, color: theme.gray500, margin: '4px 0 0' }}>
              Step {step} of 3 — {step === 1 ? 'Select Player' : step === 2 ? 'Select Alumni' : 'Confirm'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: theme.gray400, padding: 4 }}>✕</button>
        </div>

        {/* Step 1: Select Player */}
        {step === 1 && (
          <>
            <input
              type="text"
              placeholder="Search players..."
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: `1px solid ${theme.gray200}`, fontSize: 14, marginBottom: 12, backgroundColor: 'var(--color-card-bg)', color: theme.gray900 }}
            />
            {loadingP ? (
              <p style={{ textAlign: 'center', color: theme.gray400, padding: 24 }}>Loading...</p>
            ) : players.length === 0 ? (
              <p style={{ textAlign: 'center', color: theme.gray400, padding: 24 }}>No players found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                {players.map(p => (
                  <button
                    key={p.userId}
                    onClick={() => setSelectedPlayer(p)}
                    style={{
                      textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${selectedPlayer?.userId === p.userId ? 'var(--color-primary)' : theme.gray200}`,
                      backgroundColor: selectedPlayer?.userId === p.userId ? 'var(--color-primary-light)' : 'transparent',
                      transition: 'border-color 0.1s',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: theme.gray900 }}>{p.firstName} {p.lastName}</div>
                    <div style={{ fontSize: 12, color: theme.gray500, marginTop: 2 }}>
                      {[p.position, p.classYear ? `Class of ${p.classYear}` : null, p.sportName].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 8 }}>
              <Button label="Cancel" variant="outline" onClick={onClose} />
              <Button label="Next: Select Alumni →" variant="primary" onClick={() => setStep(2)} />
            </div>
          </>
        )}

        {/* Step 2: Select Alumni */}
        {step === 2 && (
          <>
            {selectedPlayer && (
              <div style={{ background: theme.gray50, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: theme.gray700 }}>
                Player: <strong>{selectedPlayer.firstName} {selectedPlayer.lastName}</strong>
                {selectedPlayer.position && ` · ${selectedPlayer.position}`}
              </div>
            )}
            <input
              type="text"
              placeholder="Search alumni..."
              value={alumniSearch}
              onChange={e => setAlumniSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: `1px solid ${theme.gray200}`, fontSize: 14, marginBottom: 12, backgroundColor: 'var(--color-card-bg)', color: theme.gray900 }}
            />
            {loadingA ? (
              <p style={{ textAlign: 'center', color: theme.gray400, padding: 24 }}>Loading...</p>
            ) : alumni.length === 0 ? (
              <p style={{ textAlign: 'center', color: theme.gray400, padding: 24 }}>No alumni found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                {alumni.map(a => (
                  <button
                    key={a.userId}
                    onClick={() => setSelectedAlumni(a)}
                    style={{
                      textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${selectedAlumni?.userId === a.userId ? 'var(--color-primary)' : theme.gray200}`,
                      backgroundColor: selectedAlumni?.userId === a.userId ? 'var(--color-primary-light)' : 'transparent',
                      transition: 'border-color 0.1s',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: theme.gray900 }}>{a.firstName} {a.lastName}</div>
                    <div style={{ fontSize: 12, color: theme.gray500, marginTop: 2 }}>
                      {[a.position, a.graduationYear ? `Class of ${a.graduationYear}` : null].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 8 }}>
              <Button label="← Back" variant="outline" onClick={() => setStep(1)} />
              <Button label="Next: Confirm →" variant="primary" onClick={() => setStep(3)} />
            </div>
          </>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedPlayer && selectedAlumni && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div style={{ background: theme.gray50, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme.gray400, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Player</div>
                <div style={{ fontWeight: 700, color: theme.gray900, fontSize: 16 }}>{selectedPlayer.firstName} {selectedPlayer.lastName}</div>
                <div style={{ fontSize: 13, color: theme.gray500, marginTop: 2 }}>
                  {[selectedPlayer.position, selectedPlayer.classYear ? `Class of ${selectedPlayer.classYear}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ textAlign: 'center', color: theme.gray400, fontSize: 18 }}>↕</div>
              <div style={{ background: theme.gray50, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme.gray400, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Alumni Mentor</div>
                <div style={{ fontWeight: 700, color: theme.gray900, fontSize: 16 }}>{selectedAlumni.firstName} {selectedAlumni.lastName}</div>
                <div style={{ fontSize: 13, color: theme.gray500, marginTop: 2 }}>
                  {[selectedAlumni.position, selectedAlumni.graduationYear ? `Class of ${selectedAlumni.graduationYear}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: theme.gray500, marginBottom: 20 }}>
              An invitation will be sent to {selectedAlumni.firstName} to accept or decline. The player will not be notified until the alumni accepts.
            </p>
            {saveError && (
              <div style={{ background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: 'var(--color-danger)', fontSize: 13 }}>
                {saveError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <Button label="← Back" variant="outline" onClick={() => setStep(2)} />
              <Button label={saving ? 'Sending…' : 'Create Pairing'} variant="primary" onClick={handleCreate} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Admin View ───────────────────────────────────────────────────────────────

function AdminMentorView({ teamName, coachName }: { teamName: string; coachName: string }) {
  const [pairings,     setPairings]     = useState<MentorPairing[]>([])
  const [loading,      setLoading]      = useState(true)
  const [wizardOpen,   setWizardOpen]   = useState(false)
  const [cancelling,   setCancelling]   = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/mentor/pairings', { credentials: 'include' })
      .then(r => r.json())
      .then(res => { if (res.success) setPairings(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCancel(id: number) {
    if (!confirm('Cancel this pending pairing? The alumni will be notified.')) return
    setCancelling(id)
    await fetch(`/api/mentor/pairings/${id}`, { method: 'DELETE', credentials: 'include' })
    setCancelling(null)
    load()
  }

  const pending   = pairings.filter(p => p.status === 'pending')
  const active    = pairings.filter(p => p.status === 'active')
  const declined  = pairings.filter(p => p.status === 'declined')
  const cancelled = pairings.filter(p => p.status === 'cancelled')

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.gray900, margin: '0 0 4px', letterSpacing: '-0.4px' }}>Mentor Program</h1>
          <p style={{ fontSize: 14, color: theme.gray500, margin: 0 }}>Connect current players with alumni mentors.</p>
        </div>
        <Button label="+ Create Pairing" variant="primary" onClick={() => setWizardOpen(true)} />
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 80, color: theme.gray400 }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Status board */}
          {([
            { label: 'Pending',   items: pending,   showCancel: true  },
            { label: 'Active',    items: active,    showCancel: false },
            { label: 'Declined',  items: declined,  showCancel: false },
            { label: 'Cancelled', items: cancelled, showCancel: false },
          ] as const).map(section => section.items.length > 0 && (
            <div key={section.label}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: theme.gray700, marginBottom: 12 }}>
                {section.label} <span style={{ color: theme.gray400, fontWeight: 400 }}>({section.items.length})</span>
              </h2>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: theme.gray50, borderBottom: `1px solid ${theme.gray200}` }}>
                      {['Player', 'Alumni', 'Sport', 'Created', 'Responded', 'Status', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((p, i) => (
                      <tr key={p.id} style={{ borderTop: i > 0 ? `1px solid ${theme.gray100}` : undefined }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: theme.gray900 }}>{p.playerFirstName} {p.playerLastName}</div>
                          {p.playerPosition && <div style={{ fontSize: 12, color: theme.gray500 }}>{p.playerPosition}</div>}
                          {p.playerClassYear && <div style={{ fontSize: 12, color: theme.gray500 }}>Class of {p.playerClassYear}</div>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: theme.gray900 }}>{p.alumniFirstName} {p.alumniLastName}</div>
                          {p.alumniPosition && <div style={{ fontSize: 12, color: theme.gray500 }}>{p.alumniPosition}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: theme.gray600 }}>{p.sportName ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: theme.gray600, whiteSpace: 'nowrap' }}>{formatDate(p.createdAt)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: theme.gray600, whiteSpace: 'nowrap' }}>{formatDate(p.respondedAt)}</td>
                        <td style={{ padding: '12px 16px' }}><StatusBadge status={p.status} /></td>
                        <td style={{ padding: '12px 16px' }}>
                          {section.showCancel && (
                            <button
                              onClick={() => handleCancel(p.id)}
                              disabled={cancelling === p.id}
                              style={{ fontSize: 12, fontWeight: 600, color: theme.gray500, background: 'none', border: `1px solid ${theme.gray200}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                            >
                              {cancelling === p.id ? '…' : 'Cancel'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          ))}

          {pairings.length === 0 && (
            <div style={{ textAlign: 'center', padding: 80, color: theme.gray400 }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>No pairings yet.</p>
              <p style={{ fontSize: 13 }}>Create a pairing to connect a current player with an alumni mentor.</p>
            </div>
          )}
        </div>
      )}

      {wizardOpen && (
        <CreatePairingWizard
          teamName={teamName}
          coachName={coachName}
          onClose={() => setWizardOpen(false)}
          onCreated={() => { setWizardOpen(false); load() }}
        />
      )}
    </>
  )
}

// ─── Player View ──────────────────────────────────────────────────────────────

function PlayerMentorView() {
  const [mentors,  setMentors]  = useState<PlayerMentor[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch('/api/mentor/player', { credentials: 'include' })
      .then(r => r.json())
      .then(res => { if (res.success) setMentors(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.gray900, margin: '0 0 4px', letterSpacing: '-0.4px' }}>Mentor</h1>
      <p style={{ fontSize: 14, color: theme.gray500, margin: '0 0 28px' }}>Your coaching staff may connect you with a program alumni as a mentor.</p>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 80, color: theme.gray400 }}>Loading...</p>
      ) : mentors.length === 0 ? (
        <Card>
          <p style={{ fontSize: 14, color: theme.gray500, margin: 0, textAlign: 'center', padding: 24 }}>
            No mentor assigned yet. Your coaching staff will let you know when one is connected.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {mentors.map(m => (
            <MentorContactCard
              key={m.id}
              name={`${m.alumniFirstName} ${m.alumniLastName}`}
              position={m.alumniPosition}
              classYear={m.alumniClassYear}
              seasonsPlayed={m.alumniSeasonsPlayed}
              email={m.alumniEmail}
              phone={m.alumniPhone}
              sportName={m.sportName}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ─── Alumni View ──────────────────────────────────────────────────────────────

function AlumniMentoringView({ teamName }: { teamName: string }) {
  const [dashboard, setDashboard] = useState<AlumniDashboard | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [responding, setResponding] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/mentor/alumni', { credentials: 'include' })
      .then(r => r.json())
      .then(res => { if (res.success) setDashboard(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRespond(pairingId: number, response: 'active' | 'declined') {
    setResponding(pairingId)
    await fetch(`/api/mentor/requests/${pairingId}`, {
      method:      'PATCH',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ response, teamName }),
    })
    setResponding(null)
    load()
  }

  return (
    <>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: theme.gray900, margin: '0 0 4px', letterSpacing: '-0.4px' }}>Mentoring</h1>
      <p style={{ fontSize: 14, color: theme.gray500, margin: '0 0 28px' }}>Give back to the program by mentoring current players.</p>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 80, color: theme.gray400 }}>Loading...</p>
      ) : !dashboard ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Pending requests */}
          {dashboard.pending.length > 0 && (
            <div>
              <SectionHeader title={`Requests (${dashboard.pending.length})`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {dashboard.pending.map(r => (
                  <Card key={r.id}>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, color: theme.gray500, marginBottom: 8 }}>
                        Your coaching staff has selected you as a potential mentor for:
                      </div>
                      <div style={{ fontWeight: 700, color: theme.gray900, fontSize: 16 }}>{r.playerFirstName} {r.playerLastName}</div>
                      <div style={{ fontSize: 13, color: theme.gray500, marginTop: 2 }}>
                        {[r.playerPosition, r.playerClassYear ? `Class of ${r.playerClassYear}` : null, r.sportName].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Button
                        label={responding === r.id ? 'Saving…' : 'Accept'}
                        variant="primary"
                        onClick={() => handleRespond(r.id, 'active')}
                      />
                      <Button
                        label={responding === r.id ? '…' : 'Decline'}
                        variant="outline"
                        onClick={() => handleRespond(r.id, 'declined')}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Active mentees */}
          {dashboard.active.length > 0 && (
            <div>
              <SectionHeader title={`Current Mentees (${dashboard.active.length})`} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {dashboard.active.map(r => (
                  <Card key={r.id}>
                    <div style={{ fontWeight: 700, color: theme.gray900, fontSize: 16, marginBottom: 4 }}>{r.playerFirstName} {r.playerLastName}</div>
                    <div style={{ fontSize: 13, color: theme.gray500 }}>
                      {[r.playerPosition, r.playerClassYear ? `Class of ${r.playerClassYear}` : null, r.sportName].filter(Boolean).join(' · ')}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {dashboard.history.length > 0 && (
            <div>
              <SectionHeader title={`Mentoring History (${dashboard.history.length})`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dashboard.history.map(r => (
                  <div key={r.id} style={{ padding: '12px 16px', borderRadius: 8, border: `1px solid ${theme.gray200}`, backgroundColor: theme.gray50 }}>
                    <div style={{ fontWeight: 600, color: theme.gray900 }}>{r.playerFirstName} {r.playerLastName}</div>
                    <div style={{ fontSize: 12, color: theme.gray500, marginTop: 2 }}>
                      {[r.playerPosition, r.playerClassYear ? `Class of ${r.playerClassYear}` : null, r.sportName].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dashboard.pending.length === 0 && dashboard.active.length === 0 && dashboard.history.length === 0 && (
            <Card>
              <p style={{ fontSize: 14, color: theme.gray500, margin: 0, textAlign: 'center', padding: 24 }}>
                No mentoring activity yet. Your coaching staff will reach out when they have a player they'd like you to connect with.
              </p>
            </Card>
          )}
        </div>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MentorPage() {
  const { user, isLoading } = useAuth()
  const config = useTeamConfig()
  const tier   = normalizeTier(config.subscriptionTier ?? 'starter')

  if (isLoading) return null

  if (!hasFeature(tier, 'mentor_program')) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ fontSize: 16, color: theme.gray500 }}>The Mentor Program is available on the Elite plan.</p>
      </div>
    )
  }

  const programRoleId = user?.programRoleId
  const isStaff   = !programRoleId || (programRoleId >= 1 && programRoleId <= 6)
  const isPlayer  = programRoleId === 8
  const isAlumni  = programRoleId === 7

  if (!isStaff && !isPlayer && !isAlumni) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole={requiredRoleLabel('roster:view')} />
  }

  const teamName  = config.teamName ?? 'Your Program'
  const userAny   = user as unknown as Record<string, string | undefined>
  const coachName = [userAny?.firstName, userAny?.lastName].filter(Boolean).join(' ') || user?.email || 'Your Coach'

  if (isStaff)  return <AdminMentorView teamName={teamName} coachName={coachName} />
  if (isPlayer) return <PlayerMentorView />
  if (isAlumni) return <AlumniMentoringView teamName={teamName} />
  return null
}
