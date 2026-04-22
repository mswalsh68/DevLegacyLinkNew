'use client'

// Marketing contact form — intentionally uses raw HTML + Tailwind, not the
// app's CSS-var component library, so it stays visually consistent with the
// marketing pages regardless of team theme switches.

import { useState } from 'react'
import { contactSchema, type ContactFormData } from '@/lib/validations/contact'

type FormState = 'idle' | 'loading' | 'success' | 'error'
type FieldErrors = Partial<Record<keyof ContactFormData, string>>

const EMPTY_FORM: ContactFormData = {
  name:         '',
  email:        '',
  organization: '',
  subject:      '',
  message:      '',
}

const inputClass = (hasError?: string) =>
  [
    'w-full rounded-md border px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    'disabled:cursor-not-allowed disabled:bg-gray-50',
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
      : 'border-gray-300 focus:border-gold focus:ring-gold/50',
  ].join(' ')

export function ContactForm() {
  const [form,         setForm]         = useState<ContactFormData>(EMPTY_FORM)
  const [fieldErrors,  setFieldErrors]  = useState<FieldErrors>({})
  const [state,        setState]        = useState<FormState>('idle')
  const [serverError,  setServerError]  = useState<string | null>(null)

  function setField<K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const result = contactSchema.safeParse(form)
    if (!result.success) {
      const errors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ContactFormData
        errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setState('loading')
    try {
      const res  = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(result.data),
      })
      const body = await res.json()
      if (!res.ok) {
        setServerError(body.error ?? 'Something went wrong. Please try again.')
        setState('error')
        return
      }
      setState('success')
      setForm(EMPTY_FORM)
    } catch {
      setServerError('Network error. Please check your connection and try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-8 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-900">Message sent!</h3>
        <p className="mt-2 text-sm text-green-700">We&apos;ll get back to you within 1 business day.</p>
        <button
          onClick={() => setState('idle')}
          className="mt-6 text-sm font-medium text-green-700 hover:underline"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Full name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="cf-name" className="text-sm font-medium text-gray-700">Full name *</label>
          <input
            id="cf-name"
            name="name"
            autoComplete="name"
            placeholder="Jane Smith"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            disabled={state === 'loading'}
            className={inputClass(fieldErrors.name)}
          />
          {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="cf-email" className="text-sm font-medium text-gray-700">Email address *</label>
          <input
            id="cf-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="jane@university.edu"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            disabled={state === 'loading'}
            className={inputClass(fieldErrors.email)}
          />
          {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
        </div>
      </div>

      {/* Organization */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cf-org" className="text-sm font-medium text-gray-700">School / Organization</label>
        <input
          id="cf-org"
          name="organization"
          autoComplete="organization"
          placeholder="University of South Florida"
          value={form.organization ?? ''}
          onChange={(e) => setField('organization', e.target.value)}
          disabled={state === 'loading'}
          className={inputClass(fieldErrors.organization)}
        />
        {fieldErrors.organization && <p className="text-xs text-red-600">{fieldErrors.organization}</p>}
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cf-subject" className="text-sm font-medium text-gray-700">Subject *</label>
        <input
          id="cf-subject"
          name="subject"
          placeholder="I'd like to request a demo"
          value={form.subject}
          onChange={(e) => setField('subject', e.target.value)}
          disabled={state === 'loading'}
          className={inputClass(fieldErrors.subject)}
        />
        {fieldErrors.subject && <p className="text-xs text-red-600">{fieldErrors.subject}</p>}
      </div>

      {/* Message */}
      <div className="flex flex-col gap-1">
        <label htmlFor="cf-message" className="text-sm font-medium text-gray-700">Message *</label>
        <textarea
          id="cf-message"
          name="message"
          rows={5}
          placeholder="Tell us about your program and what you're looking for..."
          value={form.message}
          onChange={(e) => setField('message', e.target.value)}
          disabled={state === 'loading'}
          className={inputClass(fieldErrors.message)}
        />
        {fieldErrors.message && <p className="text-xs text-red-600">{fieldErrors.message}</p>}
      </div>

      {/* Server error */}
      {state === 'error' && serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={state === 'loading'}
        className="btn-gold w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === 'loading' ? 'Sending…' : 'Send Message'}
      </button>

      <p className="text-center text-xs text-gray-400">
        We typically respond within 1 business day.
      </p>
    </form>
  )
}
