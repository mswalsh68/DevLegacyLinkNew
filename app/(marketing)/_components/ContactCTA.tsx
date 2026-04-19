'use client'

import { useState } from 'react'
import Image from 'next/image'

type Status = 'idle' | 'submitting' | 'success' | 'error'

const ROLES = [
  'Athletic Director',
  'Head Coach',
  'Assistant Coach',
  'Sport Administrator',
  'Booster / Alumni',
  'Other',
]

export default function ContactCTA() {
  const [form, setForm] = useState({ name: '', email: '', role: '', program: '' })
  const [status, setStatus] = useState<Status>('idle')

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email) return
    setStatus('submitting')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         form.name,
          email:        form.email,
          organization: form.program,
          subject:      `Access Request — ${form.role || 'Not specified'}`,
          message:      `Role: ${form.role || 'Not specified'}\nProgram: ${form.program || 'Not specified'}`,
        }),
      })
      if (!res.ok) throw new Error('Request failed')
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="py-24 bg-brand-dark relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gold/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="/images/logo-stacked.jpg"
            alt="DevLegacyLink"
            width={100}
            height={100}
            className="rounded-sm opacity-90"
          />
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <p className="section-label">Early Access</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-5">
            Be First in Line.<br />
            <span className="gold-text">Shape the Platform.</span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto leading-relaxed">
            LegacyLink is in early access. Request a demo or join the waitlist — and get direct input into the features that matter most to your program.
          </p>
        </div>

        {/* Success state */}
        {status === 'success' ? (
          <div className="text-center py-14 border border-gold/20 rounded-sm bg-brand-black">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-white font-black text-2xl mb-3">You&apos;re on the list.</h3>
            <p className="text-white/50 text-lg">
              We&apos;ll be in touch soon, {form.name.split(' ')[0]}. Your program&apos;s legacy starts here.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-brand-black border border-white/5 rounded-sm p-8 md:p-12 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  className="w-full bg-brand-dark border border-white/10 text-white placeholder-white/20 px-4 py-3 rounded-sm focus:outline-none focus:border-gold/50 transition-colors text-sm"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  className="w-full bg-brand-dark border border-white/10 text-white placeholder-white/20 px-4 py-3 rounded-sm focus:outline-none focus:border-gold/50 transition-colors text-sm"
                  placeholder="john@university.edu"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">Your Role</label>
                <select
                  value={form.role}
                  onChange={e => update('role', e.target.value)}
                  className="w-full bg-brand-dark border border-white/10 text-white px-4 py-3 rounded-sm focus:outline-none focus:border-gold/50 transition-colors text-sm appearance-none"
                >
                  <option value="">Select a role...</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">Program / School</label>
                <input
                  type="text"
                  value={form.program}
                  onChange={e => update('program', e.target.value)}
                  className="w-full bg-brand-dark border border-white/10 text-white placeholder-white/20 px-4 py-3 rounded-sm focus:outline-none focus:border-gold/50 transition-colors text-sm"
                  placeholder="University of South Florida"
                />
              </div>
            </div>

            {status === 'error' && (
              <p className="text-red-400 text-sm">Something went wrong. Please try again.</p>
            )}

            <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="btn-gold w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {status === 'submitting' ? 'Sending...' : 'Request Access'}
              </button>
              <p className="text-white/30 text-xs text-center sm:text-left">
                No spam. No obligation. Early access only.
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
