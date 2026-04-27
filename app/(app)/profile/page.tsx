'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import type { TeamConfig } from '@/types'

type TeamItem = TeamConfig & { teamId: number }

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, description, children }: {
  title:        string
  description?: string
  children:     React.ReactNode
}) {
  return (
    <div style={{
      backgroundColor: 'var(--color-card-bg)',
      border:          '1px solid var(--color-card-border)',
      borderRadius:    'var(--radius-lg)',
      overflow:        'hidden',
      marginBottom:    24,
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-card-border)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>{title}</h2>
        {description && (
          <p style={{ fontSize: 13, color: 'var(--color-gray-500)', margin: '4px 0 0' }}>{description}</p>
        )}
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-gray-600)' }}>{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder, disabled }: {
  value:        string
  onChange:     (v: string) => void
  type?:        string
  placeholder?: string
  disabled?:    boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        border:          '1.5px solid var(--color-gray-200)',
        borderRadius:    'var(--radius-sm)',
        padding:         '10px 14px',
        fontSize:        14,
        color:           'var(--color-gray-900)',
        backgroundColor: disabled ? 'var(--color-gray-50)' : 'var(--color-card-bg)',
        outline:         'none',
        width:           '100%',
        boxSizing:       'border-box' as const,
        transition:      'border-color 0.15s',
      }}
      onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)' }}
      onBlur={(e)  => { e.target.style.borderColor = 'var(--color-gray-200)' }}
    />
  )
}

function Btn({ label, onClick, disabled, variant = 'primary' }: {
  label:    string
  onClick:  () => void
  disabled?: boolean
  variant?:  'primary' | 'danger-outline'
}) {
  const isPrimary = variant === 'primary'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:         '9px 18px',
        borderRadius:    'var(--radius-sm)',
        border:          isPrimary ? 'none' : '1.5px solid var(--color-danger)',
        backgroundColor: isPrimary ? 'var(--color-primary)' : 'transparent',
        color:           isPrimary ? '#fff' : 'var(--color-danger)',
        fontSize:        13,
        fontWeight:      600,
        cursor:          disabled ? 'default' : 'pointer',
        opacity:         disabled ? 0.6 : 1,
        transition:      'opacity 0.15s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router           = useRouter()
  const { user, clearSession } = useAuth()

  // ── Profile fields ────────────────────────────────────────
  const [firstName,   setFirstName]   = useState('')
  const [lastName,    setLastName]    = useState('')
  const [email,       setEmail]       = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [nameError,   setNameError]   = useState('')

  // ── Email change ──────────────────────────────────────────
  const [emailPassword, setEmailPassword] = useState('')
  const [newEmail,      setNewEmail]      = useState('')
  const [emailLoading,  setEmailLoading]  = useState(false)
  const [emailError,    setEmailError]    = useState('')

  // ── Password change ───────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError,   setPwError]   = useState('')

  // ── Teams / preferred team ────────────────────────────────
  const [teams,       setTeams]       = useState<TeamItem[]>([])
  const [preferredId, setPreferredId] = useState<number | null>(null)
  const [settingTeam, setSettingTeam] = useState<number | null>(null)
  const [teamMsg,     setTeamMsg]     = useState('')

  // ── Load on mount ─────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setFirstName(user.username?.split(' ')[0] ?? '')
      setLastName(user.username?.split(' ').slice(1).join(' ') ?? '')
      setEmail(user.email ?? '')
      setPreferredId(user.preferredTeamId ?? null)
    }

    // Fetch full profile from server (has email + contact info)
    fetch('/api/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then(({ data }) => {
        if (data?.email)     setEmail(data.email)
        if (data?.firstName) setFirstName(data.firstName)
        if (data?.lastName)  setLastName(data.lastName)
      })
      .catch(() => {})

    // Fetch teams for preferred team selector
    fetch('/api/teams', { credentials: 'include' })
      .then((r) => r.json())
      .then(({ success, data }) => {
        if (success && Array.isArray(data)) setTeams(data)
      })
      .catch(() => {})
  }, [user])

  // ── Handlers ──────────────────────────────────────────────

  const handleSaveName = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('First and last name are required')
      return
    }
    setNameLoading(true)
    setNameError('')
    setNameSuccess(false)
    try {
      const res  = await fetch('/api/profile', {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setNameError(json.error ?? 'Failed to save'); return }
      // Update localStorage so AppNav avatar reflects the change
      try {
        const raw = localStorage.getItem('cfb_user')
        if (raw) {
          const parsed = JSON.parse(raw)
          parsed.username = `${firstName.trim()} ${lastName.trim()}`
          localStorage.setItem('cfb_user', JSON.stringify(parsed))
        }
      } catch { /* ignore */ }
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 3000)
    } catch {
      setNameError('Network error — please try again')
    } finally {
      setNameLoading(false)
    }
  }

  const handleChangeEmail = async () => {
    if (!newEmail.trim() || !emailPassword) {
      setEmailError('New email and current password are required')
      return
    }
    setEmailLoading(true)
    setEmailError('')
    try {
      const res  = await fetch('/api/profile/email', {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ newEmail: newEmail.trim(), currentPassword: emailPassword }),
      })
      const json = await res.json()
      if (!res.ok) { setEmailError(json.error ?? 'Failed to update email'); return }
      clearSession()
      router.push('/login?message=email-changed')
    } catch {
      setEmailError('Network error — please try again')
    } finally {
      setEmailLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setPwError('All password fields are required')
      return
    }
    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match')
      return
    }
    setPwLoading(true)
    setPwError('')
    try {
      const res  = await fetch('/api/profile/password', {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const json = await res.json()
      if (!res.ok) { setPwError(json.error ?? 'Failed to update password'); return }
      clearSession()
      router.push('/login?message=password-changed')
    } catch {
      setPwError('Network error — please try again')
    } finally {
      setPwLoading(false)
    }
  }

  const handleSetDefault = async (teamId: number) => {
    if (settingTeam !== null || teamId === preferredId) return
    setSettingTeam(teamId)
    setTeamMsg('')
    try {
      const res = await fetch('/api/auth/preferred-team', {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ teamId }),
      })
      if (res.ok) {
        setPreferredId(teamId)
        const t = teams.find((t) => t.teamId === teamId)
        setTeamMsg(`Default team set to ${t?.teamName ?? String(teamId)}`)
        setTimeout(() => setTeamMsg(''), 3000)
      }
    } catch { /* ignore */ }
    setSettingTeam(null)
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ')
  const initials    = firstName[0] && lastName[0]
    ? (firstName[0] + lastName[0]).toUpperCase()
    : (user?.username?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 0' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
        <div style={{
          width:           72,
          height:          72,
          borderRadius:    '50%',
          backgroundColor: 'var(--color-primary)',
          color:           '#fff',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        28,
          fontWeight:      700,
          flexShrink:      0,
        }}>
          {initials}
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>
            {displayName || 'My Profile'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-gray-500)', margin: '4px 0 0' }}>{email}</p>
        </div>
      </div>

      {/* ── Profile Info ──────────────────────────────────── */}
      <Section title="Profile" description="Update your display name.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 560 }}>
          <Field label="First name">
            <TextInput value={firstName} onChange={setFirstName} />
          </Field>
          <Field label="Last name">
            <TextInput value={lastName} onChange={setLastName} />
          </Field>
        </div>
        {nameError   && <p style={{ fontSize: 13, color: 'var(--color-danger)',  marginTop: 10 }}>{nameError}</p>}
        {nameSuccess && <p style={{ fontSize: 13, color: 'var(--color-success)', marginTop: 10 }}>Name saved.</p>}
        <div style={{ marginTop: 16 }}>
          <Btn label={nameLoading ? 'Saving…' : 'Save name'} onClick={handleSaveName} disabled={nameLoading} />
        </div>
      </Section>

      {/* ── Email ──────────────────────────────────────────── */}
      <Section
        title="Email address"
        description="Changing your email will sign you out. You'll log back in with the new address."
      >
        <p style={{ fontSize: 13, color: 'var(--color-gray-500)', margin: '0 0 16px' }}>
          Current email: <strong style={{ color: 'var(--color-gray-800)' }}>{email || '…'}</strong>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 560 }}>
          <Field label="New email address">
            <TextInput
              type="email"
              value={newEmail}
              onChange={setNewEmail}
              placeholder="new@example.com"
            />
          </Field>
          <Field label="Current password (to confirm)">
            <TextInput
              type="password"
              value={emailPassword}
              onChange={setEmailPassword}
              placeholder="••••••••"
            />
          </Field>
        </div>
        {emailError && <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 10 }}>{emailError}</p>}
        <div style={{ marginTop: 16 }}>
          <Btn label={emailLoading ? 'Updating…' : 'Update email'} onClick={handleChangeEmail} disabled={emailLoading} />
        </div>
      </Section>

      {/* ── Password ───────────────────────────────────────── */}
      <Section title="Password" description="Changing your password will sign you out of all devices.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
          <Field label="Current password">
            <TextInput type="password" value={currentPw} onChange={setCurrentPw} placeholder="••••••••" />
          </Field>
          <Field label="New password">
            <TextInput type="password" value={newPw}     onChange={setNewPw}     placeholder="Min. 8 characters" />
          </Field>
          <Field label="Confirm new password">
            <TextInput type="password" value={confirmPw} onChange={setConfirmPw} placeholder="••••••••" />
          </Field>
        </div>
        {pwError && <p style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 10 }}>{pwError}</p>}
        <div style={{ marginTop: 16 }}>
          <Btn label={pwLoading ? 'Updating…' : 'Update password'} onClick={handleChangePassword} disabled={pwLoading} />
        </div>
      </Section>

      {/* ── Default Team ───────────────────────────────────── */}
      {teams.length > 1 && (
        <Section
          title="Default team on login"
          description="The team you'll land in each time you log in."
        >
          {teamMsg && (
            <p style={{ fontSize: 13, color: 'var(--color-success)', marginBottom: 12 }}>{teamMsg}</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
            {teams.map((t) => {
              const isPreferred = t.teamId === preferredId
              const isSetting   = settingTeam === t.teamId
              return (
                <div
                  key={t.teamId}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'space-between',
                    padding:         '12px 16px',
                    borderRadius:    'var(--radius-md)',
                    border:          `1.5px solid ${isPreferred ? 'var(--color-primary)' : 'var(--color-card-border)'}`,
                    backgroundColor: isPreferred ? 'var(--color-primary-light)' : 'var(--color-card-bg)',
                    transition:      'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      width:            10,
                      height:           10,
                      borderRadius:     '50%',
                      background:       t.primaryColor,
                      flexShrink:       0,
                      border:           '1px solid rgba(0,0,0,0.1)',
                    }} />
                    <span>
                      <strong style={{ fontSize: 14, color: 'var(--color-gray-900)' }}>{t.teamName}</strong>
                      <span style={{ fontSize: 13, color: 'var(--color-gray-500)', marginLeft: 8 }}>{t.sport}</span>
                    </span>
                  </span>
                  <button
                    onClick={() => handleSetDefault(t.teamId)}
                    disabled={isSetting || isPreferred}
                    title={isPreferred ? 'Current default' : 'Set as default'}
                    style={{
                      background:  'none',
                      border:      'none',
                      cursor:      isPreferred ? 'default' : 'pointer',
                      fontSize:    18,
                      color:       isPreferred ? '#f59e0b' : 'var(--color-gray-300)',
                      transition:  'color 0.15s',
                      padding:     '2px 4px',
                    }}
                    onMouseEnter={(e) => { if (!isPreferred) (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b' }}
                    onMouseLeave={(e) => { if (!isPreferred) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-gray-300)' }}
                  >
                    {isSetting ? '…' : '★'}
                  </button>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Sign Out ───────────────────────────────────────── */}
      <Section title="Sign out" description="Sign out of your current session.">
        <Btn
          label="Sign out"
          onClick={() => {
            fetch('/api/auth', { method: 'DELETE', credentials: 'include' })
              .catch(() => {})
              .finally(() => {
                clearSession()
                router.push('/login')
              })
          }}
          variant="danger-outline"
        />
      </Section>
    </div>
  )
}
