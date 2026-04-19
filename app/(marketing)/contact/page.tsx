// Server Component — renders the page shell and embeds the client-side form.
import type { Metadata } from 'next'
import { ContactForm } from '@/components/marketing/ContactForm'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the DevLegacyLink team or request a demo.',
}

const CONTACT_DETAILS = [
  {
    icon: (
      <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    label: 'Email',
    value: 'hello@devlegacylink.com',
  },
  {
    icon: (
      <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Response time',
    value: 'Within 1 business day',
  },
]

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      {/* Header */}
      <div className="mb-14 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 md:text-5xl">
          Get in touch
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Have a question or want to see a demo? We&apos;d love to hear from you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
        {/* Left — contact info */}
        <div className="lg:col-span-2">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">Contact information</h2>

          <div className="space-y-5">
            {CONTACT_DETAILS.map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex-shrink-0">{icon}</div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
                  <p className="mt-0.5 text-sm text-gray-700">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl bg-blue-50 p-6">
            <h3 className="font-semibold text-blue-900">Requesting a demo?</h3>
            <p className="mt-2 text-sm leading-relaxed text-blue-700">
              Include your school name and sport in the message and we&apos;ll tailor
              the demo to your program. Demos are free and take about 20 minutes.
            </p>
          </div>
        </div>

        {/* Right — form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm lg:col-span-3">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">Send us a message</h2>
          <ContactForm />
        </div>
      </div>
    </div>
  )
}
