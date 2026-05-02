'use client'

// JoinContent — client component for the /join self-signup flow.
// Step 1: Enter invite code → validate → show team preview card.
// Step 2: Choose login (existing account), signup (new account), or
//         claim (admin pre-created account — just set a password).
// Step 3: Submit → redirect to /pending or /dashboard.

import { useState, type FormEvent } from 'react'

type Step = 'code' | 'form' | 'submitting'
type FormMode = 'signup' | 'login' | 'claim'

interface TeamPreview {
  teamName: string
  sport:    string
  role:     string
}

const inputClass = `
  w-full bg-brand-gray border border-white/10 text-white
  placeholder-white/20 px-4 py-3 rounded-lg text-sm
  focus:outline-none focus:border-[#CFC493]/60 transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed
`.trim()

const labelClass = 'block text-white/60 text-xs uppercase tracking-widest mb-2'

export function JoinContent({ initialCode }: { initialCode: string }) {
  const [step,      setStep]      = useState<Step>(initialCode ? 'code' : 'code')
  const [code,      setCode]      = useState(initialCode)
  const [preview,   setPreview]   = useState<TeamPreview | null>(null)
  const [mode,      setMode]      = useState<FormMode>('signup')
  const [error,     setError]     = useState('')
  const [checking,  setChecking]  = useState(false)

  // Form fields
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')

  const loading = step === 'submitting'

  // ── Step 1: validate code ─────────────────────────────────────────────────
  async function handleCheckCode(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!code.trim()) { setError('Please enter an invite code.'); return }

    setChecking(true)
    try {
      const res  = await fetch(`/api/invite/${encodeURIComponent(code.trim())}`)
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Invalid invite code.'); return }
      setPreview(body.data as TeamPreview)
      setStep('form')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  // ── Step 2: submit request ────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent, overrideMode?: FormMode) {
    e.preventDefault()
    setError('')

    const effectiveMode = overrideMode ?? mode

    if (!email) { setError('Email is required.'); return }
    if (!password) { setError('Password is required.'); return }
    if (effectiveMode === 'signup' && (!firstName || !lastName)) {
      setError('First and last name are required.')
      return
    }
    if ((effectiveMode === 'signup' || effectiveMode === 'claim') && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setStep('submitting')

    const body: Record<string, string> = { token: code.trim(), mode: effectiveMode, email, password }
    if (effectiveMode === 'signup') {
      body.firstName = firstName
      body.lastName  = lastName
    }

    try {
      const res  = await fetch('/api/invite/request', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        // 409 EMAIL_EXISTS during signup → this is an admin-pre-created account.
        // Silently switch to claim mode so the user just sets a password.
        if (res.status === 409 && effectiveMode === 'signup') {
          setMode('claim')
          setStep('form')
          setError('')
          return
        }

        setError(data.error ?? 'Submission failed. Please try again.')
        setStep('form')
        return
      }

      // Store user in localStorage (same pattern as LoginForm)
      if (data.data?.user) {
        localStorage.setItem('cfb_user', JSON.stringify(data.data.user))
      }

      // Use redirect field from response — claim mode goes to /dashboard if
      // the user already has team access, otherwise /pending.
      window.location.href = data.redirect ?? '/pending'
    } catch {
      setError('Network error. Please try again.')
      setStep('form')
    }
  }

  // ── Render: code entry ────────────────────────────────────────────────────
  if (step === 'code') {
    return (
      <form onSubmit={handleCheckCode} className="space-y-5" noValidate>
        {error && <ErrorBanner message={error} />}

        <div>
          <label className={labelClass}>Invite Code</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Paste your invite code"
            disabled={checking}
            className={inputClass}
            autoFocus={!initialCode}
          />
        </div>

        <SubmitButton loading={checking} label="Check Code" loadingLabel="Checking…" />

        <p className="text-center text-xs mt-4 text-white/20">
          Already have an account?{' '}
          <a href="/login" className="text-[#CFC493]/60 hover:text-[#CFC493]">
            Sign in
          </a>
        </p>
      </form>
    )
  }

  // ── Render: form (login or signup) ────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Team preview card */}
      {preview && (
        <div
          style={{
            backgroundColor: 'rgba(207,196,147,0.08)',
            border:          '1px solid rgba(207,196,147,0.25)',
            borderRadius:    8,
            padding:         '12px 16px',
            marginBottom:    4,
          }}
        >
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            You&apos;re joining
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>
            {preview.teamName}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(207,196,147,0.7)', margin: '2px 0 0' }}>
            {preview.sport} · {preview.role}
          </p>
        </div>
      )}

      {/* Claim mode banner */}
      {mode === 'claim' && (
        <div
          style={{
            padding:         '10px 14px',
            borderRadius:    8,
            fontSize:        13,
            backgroundColor: 'rgba(207,196,147,0.10)',
            color:           '#CFC493',
            border:          '1px solid rgba(207,196,147,0.30)',
          }}
        >
          Your account was pre-created by your program. Just set a password to activate it.
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* Mode toggle — hidden in claim mode */}
      {mode !== 'claim' && (
        <div style={{ display: 'flex', gap: 8 }}>
          {(['signup', 'login'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex:            1,
                padding:         '8px 0',
                borderRadius:    6,
                fontSize:        12,
                fontWeight:      600,
                cursor:          'pointer',
                border:          '1px solid rgba(255,255,255,0.12)',
                backgroundColor: mode === m ? 'rgba(207,196,147,0.15)' : 'transparent',
                color:           mode === m ? '#CFC493' : 'rgba(255,255,255,0.4)',
                transition:      'all 0.15s',
              }}
            >
              {m === 'signup' ? 'New Account' : 'Existing Account'}
            </button>
          ))}
        </div>
      )}

      {/* Signup-only fields */}
      {mode === 'signup' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className={labelClass}>First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Jane"
              disabled={loading}
              className={inputClass}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className={labelClass}>Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Smith"
              disabled={loading}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@yourprogram.com"
          autoComplete="email"
          disabled={loading}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••••"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          disabled={loading}
          className={inputClass}
        />
        {(mode === 'signup' || mode === 'claim') && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
            Minimum 8 characters
          </p>
        )}
      </div>

      <SubmitButton
        loading={loading}
        label={
          mode === 'claim'  ? 'Activate Account' :
          mode === 'signup' ? 'Request Access' :
                              'Sign In & Request Access'
        }
        loadingLabel="Submitting…"
      />

      <button
        type="button"
        onClick={() => { setStep('code'); setPreview(null); setError('') }}
        style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer', marginTop: 4 }}
      >
        ← Use a different code
      </button>
    </form>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        padding:         '10px 14px',
        borderRadius:    8,
        fontSize:        13,
        backgroundColor: 'rgba(192,57,43,0.15)',
        color:           '#f87171',
        border:          '1px solid rgba(192,57,43,0.4)',
      }}
    >
      {message}
    </div>
  )
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ backgroundColor: loading ? '#A89C6A' : '#CFC493', color: '#0D0D0D' }}
      onMouseEnter={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#EDEBD1') }}
      onMouseLeave={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#CFC493') }}
    >
      {loading ? loadingLabel : label}
    </button>
  )
}
