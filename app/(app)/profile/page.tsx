'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import type { TeamConfig } from '@/types'

const ALUMNI_PROGRAM_ROLE_ID = 7

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

  // ── Contact info ─────────────────────────────────────────
  const [phone,          setPhone]          = useState('')
  const [address,        setAddress]        = useState('')
  const [city,           setCity]           = useState('')
  const [stateVal,       setStateVal]       = useState('')
  const [zipcode,        setZipcode]        = useState('')
  const [contactLoading, setContactLoading] = useState(false)
  const [contactSuccess, setContactSuccess] = useState(false)
  const [contactError,   setContactError]   = useState('')

  // ── Social links ─────────────────────────────────────────
  const [twitter,       setTwitter]       = useState('')
  const [instagram,     setInstagram]     = useState('')
  const [facebook,      setFacebook]      = useState('')
  const [linkedIn,      setLinkedIn]      = useState('')
  const [website,       setWebsite]       = useState('')
  const [otherLink1,    setOtherLink1]    = useState('')
  const [otherLink2,    setOtherLink2]    = useState('')
  const [otherLink3,    setOtherLink3]    = useState('')
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialSuccess, setSocialSuccess] = useState(false)
  const [socialError,   setSocialError]   = useState('')

  // ── Community visibility (alumni only) ───────────────────
  const [contactVisible,    setContactVisible]    = useState(true)
  const [visibilityLoading, setVisibilityLoading] = useState(false)
  const [visibilityMsg,     setVisibilityMsg]     = useState('')

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
        setPhone(data?.phone    ?? '')
        setAddress(data?.address ?? '')
        setCity(data?.city       ?? '')
        setStateVal(data?.state  ?? '')
        setZipcode(data?.zipcode ?? '')
        setTwitter(data?.twitter    ?? '')
        setInstagram(data?.instagram ?? '')
        setFacebook(data?.facebook  ?? '')
        setLinkedIn(data?.linkedIn  ?? '')
        setWebsite(data?.website    ?? '')
        setOtherLink1(data?.otherLink1 ?? '')
        setOtherLink2(data?.otherLink2 ?? '')
        setOtherLink3(data?.otherLink3 ?? '')
      })
      .catch(() => {})

    // Fetch teams for preferred team selector
    fetch('/api/teams', { credentials: 'include' })
      .then((r) => r.json())
      .then(({ success, data }) => {
        if (success && Array.isArray(data)) setTeams(data)
      })
      .catch(() => {})

    // Fetch community consent / visibility for alumni
    if (user?.programRoleId === ALUMNI_PROGRAM_ROLE_ID) {
      fetch('/api/community/consent', { credentials: 'include' })
        .then((r) => r.json())
        .then(({ success, data }) => {
          if (success && data) setContactVisible(Boolean(data.contactVisible))
        })
        .catch(() => {})
    }
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
        // Keep localStorage in sync so the next login switch-team uses the new value
        try {
          const raw = localStorage.getItem('cfb_user')
          if (raw) {
            const u = JSON.parse(raw) as Record<string, unknown>
            u.preferredTeamId = teamId
            localStorage.setItem('cfb_user', JSON.stringify(u))
          }
        } catch { /* ignore */ }
        const t = teams.find((t) => t.teamId === teamId)
        setTeamMsg(`Default team set to ${t?.teamName ?? String(teamId)}`)
        setTimeout(() => setTeamMsg(''), 3000)
      }
    } catch { /* ignore */ }
    setSettingTeam(null)
  }

  const handleToggleVisibility = async () => {
    const next = !contactVisible
    setVisibilityLoading(true)
    setVisibilityMsg('')
    try {
      const res = await fetch('/api/profile/visibility', {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ visible: next }),
      })
      if (res.ok) {
        setContactVisible(next)
        setVisibilityMsg(next ? 'Profile visible to community members.' : 'Profile hidden from community members.')
        setTimeout(() => setVisibilityMsg(''), 3000)
      }
    } catch { /* ignore */ }
    setVisibilityLoading(false)
  }

  const handleSaveContact = async () => {
    setContactLoading(true)
    setContactError('')
    setContactSuccess(false)
    try {
      const res  = await fetch('/api/profile/contact', {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone:   phone.trim(),
          address: address.trim(),
          city:    city.trim(),
          state:   stateVal.trim(),
          zipcode: zipcode.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setContactError(json.error ?? 'Failed to save'); return }
      setContactSuccess(true)
      setTimeout(() => setContactSuccess(false), 3000)
    } catch {
      setContactError('Network error — please try again')
    } finally {
      setContactLoading(false)
    }
  }

  const handleSaveSocial = async () => {
    setSocialLoading(true)
    setSocialError('')
    setSocialSuccess(false)
    try {
      const res  = await fetch('/api/profile/social', {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        // Send trimmed value; '' tells the SP to clear the field
        body: JSON.stringify({
          twitter:    twitter.trim(),
          instagram:  instagram.trim(),
          facebook:   facebook.trim(),
          linkedIn:   linkedIn.trim(),
          website:    website.trim(),
          otherLink1: otherLink1.trim(),
          otherLink2: otherLink2.trim(),
          otherLink3: otherLink3.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setSocialError(json.error ?? 'Failed to save'); return }
      setSocialSuccess(true)
      setTimeout(() => setSocialSuccess(false), 3000)
    } catch {
      setSocialError('Network error — please try again')
    } finally {
      setSocialLoading(false)
    }
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, maxWidth: 560 }}>
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

      {/* ── Contact Info ──────────────────────────────────── */}
      <Section title="Contact info" description="Your phone number and address. Visible to team staff.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
          <Field label="Phone number">
            <TextInput value={phone} onChange={setPhone} placeholder="(555) 555-5555" type="tel" />
          </Field>
          <Field label="Street address">
            <TextInput value={address} onChange={setAddress} placeholder="123 Main St" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <Field label="City">
              <TextInput value={city} onChange={setCity} placeholder="City" />
            </Field>
            <Field label="State">
              <TextInput value={stateVal} onChange={setStateVal} placeholder="TX" />
            </Field>
            <Field label="Zip">
              <TextInput value={zipcode} onChange={setZipcode} placeholder="78701" />
            </Field>
          </div>
        </div>
        {contactError   && <p style={{ fontSize: 13, color: 'var(--color-danger)',  marginTop: 12 }}>{contactError}</p>}
        {contactSuccess && <p style={{ fontSize: 13, color: 'var(--color-success)', marginTop: 12 }}>Contact info saved.</p>}
        <div style={{ marginTop: 16 }}>
          <Btn label={contactLoading ? 'Saving…' : 'Save contact info'} onClick={handleSaveContact} disabled={contactLoading} />
        </div>
      </Section>

      {/* ── Social Links ───────────────────────────────────── */}
      <Section title="Social links" description="Add links to your profiles and website. All fields are optional.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
          <Field label="X / Twitter">
            <TextInput value={twitter}   onChange={setTwitter}   placeholder="https://x.com/yourhandle" />
          </Field>
          <Field label="Instagram">
            <TextInput value={instagram} onChange={setInstagram} placeholder="https://instagram.com/yourhandle" />
          </Field>
          <Field label="Facebook">
            <TextInput value={facebook}  onChange={setFacebook}  placeholder="https://facebook.com/yourprofile" />
          </Field>
          <Field label="LinkedIn">
            <TextInput value={linkedIn}  onChange={setLinkedIn}  placeholder="https://linkedin.com/in/yourprofile" />
          </Field>
          <Field label="Personal website">
            <TextInput value={website}   onChange={setWebsite}   placeholder="https://yoursite.com" />
          </Field>
          <div style={{ borderTop: '1px solid var(--color-card-border)', paddingTop: 14 }}>
            <p style={{ fontSize: 12, color: 'var(--color-gray-400)', margin: '0 0 12px' }}>Other links (up to 3)</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TextInput value={otherLink1} onChange={setOtherLink1} placeholder="https://…" />
              <TextInput value={otherLink2} onChange={setOtherLink2} placeholder="https://…" />
              <TextInput value={otherLink3} onChange={setOtherLink3} placeholder="https://…" />
            </div>
          </div>
        </div>
        {socialError   && <p style={{ fontSize: 13, color: 'var(--color-danger)',  marginTop: 12 }}>{socialError}</p>}
        {socialSuccess && <p style={{ fontSize: 13, color: 'var(--color-success)', marginTop: 12 }}>Links saved.</p>}
        <div style={{ marginTop: 16 }}>
          <Btn label={socialLoading ? 'Saving…' : 'Save links'} onClick={handleSaveSocial} disabled={socialLoading} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, maxWidth: 560 }}>
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

      {/* ── Community Visibility (alumni only) ────────────── */}
      {user?.programRoleId === ALUMNI_PROGRAM_ROLE_ID && (
        <Section
          title="Community visibility"
          description="Control whether other verified alumni and staff can see your contact details in the alumni directory."
        >
          {visibilityMsg && (
            <p style={{ fontSize: 13, color: 'var(--color-success)', marginBottom: 12 }}>{visibilityMsg}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              role="switch"
              aria-checked={contactVisible}
              onClick={handleToggleVisibility}
              disabled={visibilityLoading}
              style={{
                position:        'relative',
                width:           44,
                height:          24,
                borderRadius:    12,
                border:          'none',
                backgroundColor: contactVisible ? 'var(--color-primary)' : 'var(--color-gray-300)',
                cursor:          visibilityLoading ? 'default' : 'pointer',
                flexShrink:      0,
                transition:      'background-color 0.2s',
                padding:         0,
              }}
            >
              <span style={{
                position:        'absolute',
                top:             3,
                left:            contactVisible ? 23 : 3,
                width:           18,
                height:          18,
                borderRadius:    '50%',
                backgroundColor: '#fff',
                transition:      'left 0.2s',
                boxShadow:       '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
            <span style={{ fontSize: 14, color: 'var(--color-gray-700)' }}>
              {contactVisible ? 'Visible to community members' : 'Hidden from community members'}
            </span>
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
