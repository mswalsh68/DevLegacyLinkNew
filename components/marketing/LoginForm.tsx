'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { loginSchema } from '@/lib/validations/auth'

type Status = 'idle' | 'loading'

const inputClass = `
  w-full bg-brand-gray border border-white/10 text-white
  placeholder-white/20 px-4 py-3 rounded-lg text-sm
  focus:outline-none focus:border-[#CFC493]/60 transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed
`.trim()

export function LoginForm() {
  const router = useRouter()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [status,   setStatus]   = useState<Status>('idle')

  const loading = status === 'loading'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    // Client-side validation
    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    setStatus('loading')

    try {
      const res = await fetch('/api/auth/login', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(result.data),
      })

      const body = await res.json()

      if (!res.ok) {
        setError(body.error ?? 'Login failed. Please try again.')
        setStatus('idle')
        return
      }

      // Store decoded user profile for client-side access
      if (body.data?.user) {
        localStorage.setItem('cfb_user', JSON.stringify(body.data.user))
      }

      router.push('/dashboard')
    } catch {
      setError('Network error. Please check your connection and try again.')
      setStatus('idle')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>

      {/* Error banner */}
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

      {/* Email */}
      <div>
        <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@yourprogram.com"
          autoComplete="email"
          required
          disabled={loading}
          className={inputClass}
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••••"
          autoComplete="current-password"
          required
          disabled={loading}
          className={inputClass}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all mt-2
                   disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: loading ? '#A89C6A' : '#CFC493', color: '#0D0D0D' }}
        onMouseEnter={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#EDEBD1') }}
        onMouseLeave={e => { if (!loading) (e.currentTarget.style.backgroundColor = '#CFC493') }}
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

    </form>
  )
}
