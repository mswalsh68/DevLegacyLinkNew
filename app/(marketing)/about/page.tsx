import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description: 'Why we built DevLegacyLink and who it\'s for.',
}

const VALUES = [
  {
    title: 'Built by coaches, for coaches',
    body: 'DevLegacyLink was born out of the frustration of managing alumni relationships through spreadsheets and fragmented systems. Every feature is designed around how coaching staffs actually work.',
  },
  {
    title: 'Your data, your control',
    body: 'We never sell or share your roster or alumni data. Your program\'s information lives in your database — not ours. Full export available at any time.',
  },
  {
    title: 'Simple by design',
    body: 'We cut features that aren\'t useful and polish the ones that are. A coach should be able to log an alumni interaction in under 30 seconds.',
  },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      {/* Header */}
      <div className="mb-16 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 md:text-5xl">
          About DevLegacyLink
        </h1>
        <p className="mt-5 text-xl text-gray-600">
          We built the platform we always wished existed.
        </p>
      </div>

      {/* Mission */}
      <section className="mb-16">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">Our mission</h2>
        <p className="text-lg leading-relaxed text-gray-600">
          Athletic programs invest years developing student-athletes — but most have no
          reliable system for staying connected after graduation. DevLegacyLink gives
          coaching staffs the tools to maintain those relationships for life: tracking
          alumni careers, logging outreach, and managing their active roster all in
          one place.
        </p>
      </section>

      {/* Values */}
      <section className="mb-16">
        <h2 className="mb-8 text-2xl font-bold text-gray-900">What we believe</h2>
        <div className="space-y-8">
          {VALUES.map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
              <p className="text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-xl bg-blue-600 p-10 text-center text-white">
        <h2 className="text-2xl font-bold">Want to see it in action?</h2>
        <p className="mt-2 text-blue-100">Schedule a 20-minute demo with our team.</p>
        <Link
          href="/contact"
          className="mt-6 inline-block rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
        >
          Request a Demo
        </Link>
      </section>
    </div>
  )
}
