import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'DevLegacyLink — Alumni & Roster Management for Coaching Staffs',
  description:
    'Stay connected with every athlete, long after they leave the field. DevLegacyLink is the all-in-one CRM built for college coaching staffs.',
}

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '🏆',
    title: 'Alumni CRM',
    description:
      'Track every former player — contact info, career updates, interaction history, and giving potential — all in one place.',
  },
  {
    icon: '📋',
    title: 'Roster Management',
    description:
      'Manage your active roster with dynamic positions, academic years, and bulk upload. One-click transfer to alumni when players graduate.',
  },
  {
    icon: '🔔',
    title: 'Interaction Logging',
    description:
      'Log calls, texts, and meetings with alumni so your entire staff stays in sync — no more duplicate outreach.',
  },
  {
    icon: '⚙️',
    title: 'Team Configuration',
    description:
      'Brand it your way. Set your team colors, custom positions, and labels. The platform adapts to your program, not the other way around.',
  },
  {
    icon: '🔒',
    title: 'Role-Based Access',
    description:
      'Global admins, coaches, and staff each get exactly the access they need. JWT auth with per-user session revocation.',
  },
  {
    icon: '📱',
    title: 'Mobile Ready',
    description:
      'Native iOS & Android app built with Expo. Graduate players, log interactions, and view your roster from the sideline.',
  },
]

const STATS = [
  { value: '500+', label: 'Alumni tracked per program' },
  { value: '< 2s', label: 'Average page load' },
  { value: '100%', label: 'Data stays yours' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-blue-50 to-white px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
            Built for coaching staffs
          </span>
          <h1 className="mt-4 text-5xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-6xl">
            Stay connected with every athlete,{' '}
            <span className="text-blue-600">long after they leave the field.</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600">
            DevLegacyLink is the all-in-one alumni CRM and roster management platform
            built specifically for college coaching staffs.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow hover:bg-blue-700"
            >
              Request a Demo
            </Link>
            <Link
              href="/#features"
              className="rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50"
            >
              See Features
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <section className="border-y border-gray-200 bg-white px-6 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 text-center sm:grid-cols-3">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p className="text-4xl font-extrabold text-blue-600">{value}</p>
              <p className="mt-1 text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="bg-gray-50 px-6 py-24 scroll-mt-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              Everything your program needs
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              One platform. Built from the ground up for athletic programs.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-3 text-3xl">{icon}</div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────── */}
      <section className="bg-blue-600 px-6 py-20 text-center text-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold md:text-4xl">
            Ready to build your program&apos;s legacy?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Get a personalized demo. No commitment, no credit card required.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-block rounded-md bg-white px-8 py-3 text-base font-semibold text-blue-600 hover:bg-blue-50"
          >
            Request a Demo
          </Link>
        </div>
      </section>
    </>
  )
}
