'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'loading' | 'form' | 'done' | 'error'

interface UserPreview {
  firstName: string
  lastName:  string
  email:     string
}

const inputClass = `
  w-full bg-brand-gray border border-white/10 text-white
  placeholder-white/20 px-4 py-3 rounded-lg text-sm
  focus:outline-none focus:border-[#CFC493]/60 transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed
`.trim()

const labelClass = 'block text-white/60 text-xs uppercase tracking-widest mb-2'

export function SetupContent({ initialToken }: { initialToken: string }) {
  const router = useRouter()

  const [step,     setStep]     = useState<Step>('loading')
  const [preview,  setPreview]  = useState<UserPreview | null>(null)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  // Validate the token on mount
  useEffect(() => {
    if (!initialToken) {
      setStep('error')
      setError('No setup token provided. Please use the link from your invite email.')
      return
    }

    fetch(`/api/setup/${encodeURIComponent(initialToken)}`)
      .then(r => r.json())
      .then(body => {
        if (!body.success) {
          setError(body.error ?? 'This setup link is invalid or has expired.')
          setStep('error')
        } else {
          setPreview(body.data as UserPreview)
          setStep('form')
        }
      })
      .catch(() => {
        setError('Network error. Please try again.')
        setStep('error')
      })
  }, [initialToken])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    try {
      const res  = await fetch('/api/setup/redeem', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: initialToken, password }),
      })
      const body = await res.json()

      if (!res.ok) {
        setError(body.error ?? 'Failed to activate account.')
        setSaving(false)
        return
      }

      setStep('done')
      // Brief pause then redirect to login
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  if (step === 'loading') {
    return (
      <p className="text-center text-white/40 text-sm py-6">Verifying your link…</p>
    )
  }

  if (step === 'error') {
    return (
      <div>
        <div
          className="px-4 py-3 rounded-lg text-sm border mb-5"
          style={{
            backgroundColor: 'rgba(192,57,43,0.15)',
            color:           '#f87171',
            borderColor:     'rgba(192,57,43,0.4)',
          }}
        >
          {error}
        </div>
        <p className="text-center text-xs text-white/30">
          Contact your program administrator for a new setup link.
        </p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-4">✅</div>
        <p className="text-white font-semibold text-base mb-2">Account activated!</p>
        <p className="text-white/50 text-sm">Redirecting you to sign in…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>

      {/* User preview */}
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
          <p className="text-[#CFC493] font-semibold text-sm">
            {preview.firstName} {preview.lastName}
          </p>
          <p className="text-white/50 text-xs mt-0.5">{preview.email}</p>
        </div>
      )}

      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm border"
          style={{
            backgroundColor: 'rgba(192,57,43,0.15)',
            color:           '#f87171',
            borderColor:     'rgba(192,57,43,0.4)',
          }}
        >
          {error}
        </div>
      )}

      <div>
        <label className={labelClass}>New Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          disabled={saving}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Confirm Password</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          required
          disabled={saving}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all mt-2
                   disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: saving ? '#A89C6A' : '#CFC493', color: '#0D0D0D' }}
        onMouseEnter={e => { if (!saving) (e.currentTarget.style.backgroundColor = '#EDEBD1') }}
        onMouseLeave={e => { if (!saving) (e.currentTarget.style.backgroundColor = '#CFC493') }}
      >
        {saving ? 'Activating…' : 'Activate Account'}
      </button>

      <p className="text-center text-xs mt-4 text-white/20">
        Already activated?{' '}
        <a href="/login" className="text-[#CFC493]/60 hover:text-[#CFC493]">
          Sign in
        </a>
      </p>
    </form>
  )
}
