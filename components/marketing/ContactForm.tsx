'use client'

import { useState } from 'react'
import { contactSchema, type ContactFormData } from '@/lib/validations/contact'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

type FormState = 'idle' | 'loading' | 'success' | 'error'

type FieldErrors = Partial<Record<keyof ContactFormData, string>>

const EMPTY_FORM: ContactFormData = {
  name: '',
  email: '',
  organization: '',
  subject: '',
  message: '',
}

export function ContactForm() {
  const [form, setForm] = useState<ContactFormData>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [state, setState] = useState<FormState>('idle')
  const [serverError, setServerError] = useState<string | null>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Clear field error on change
    if (fieldErrors[name as keyof ContactFormData]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    // Client-side validation
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
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
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
        <p className="mt-2 text-sm text-green-700">
          We&apos;ll get back to you within 1 business day.
        </p>
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
        <Input
          id="name"
          name="name"
          label="Full name *"
          placeholder="Jane Smith"
          autoComplete="name"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
          disabled={state === 'loading'}
        />
        <Input
          id="email"
          name="email"
          type="email"
          label="Email address *"
          placeholder="jane@university.edu"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={fieldErrors.email}
          disabled={state === 'loading'}
        />
      </div>

      <Input
        id="organization"
        name="organization"
        label="School / Organization"
        placeholder="University of South Florida"
        autoComplete="organization"
        value={form.organization}
        onChange={handleChange}
        error={fieldErrors.organization}
        disabled={state === 'loading'}
      />

      <Input
        id="subject"
        name="subject"
        label="Subject *"
        placeholder="I'd like to request a demo"
        value={form.subject}
        onChange={handleChange}
        error={fieldErrors.subject}
        disabled={state === 'loading'}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="message" className="text-sm font-medium text-gray-700">
          Message *
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder="Tell us about your program and what you're looking for..."
          value={form.message}
          onChange={handleChange}
          disabled={state === 'loading'}
          className={`rounded-md border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
            focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
            disabled:cursor-not-allowed disabled:bg-gray-50
            ${fieldErrors.message ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
        />
        {fieldErrors.message && (
          <p className="text-xs text-red-600">{fieldErrors.message}</p>
        )}
      </div>

      {state === 'error' && serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        isLoading={state === 'loading'}
        className="w-full"
      >
        Send Message
      </Button>

      <p className="text-center text-xs text-gray-400">
        We typically respond within 1 business day.
      </p>
    </form>
  )
}
