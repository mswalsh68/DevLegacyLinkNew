import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for every program size.',
}

const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'Perfect for small programs getting started.',
    features: [
      'Up to 50 alumni records',
      'Full roster management',
      'Interaction logging',
      'Email support',
    ],
    cta: 'Get Started',
    href: '/contact',
    highlighted: false,
  },
  {
    name: 'Program',
    price: '$99',
    period: '/ month',
    description: 'Everything a mid-size program needs to stay connected.',
    features: [
      'Unlimited alumni records',
      'Full roster management',
      'Bulk upload & transfer to alumni',
      'Mobile app (iOS & Android)',
      'Team configuration & branding',
      'Role-based access control',
      'Priority support',
    ],
    cta: 'Request Demo',
    href: '/contact',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For multi-sport departments and enterprise needs.',
    features: [
      'Everything in Program',
      'Multi-sport / multi-team support',
      'SSO / SAML integration',
      'Dedicated account manager',
      'SLA & custom contract',
    ],
    cta: 'Contact Sales',
    href: '/contact',
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <div className="px-6 py-20">
      {/* Header */}
      <div className="mb-14 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 md:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          No per-seat fees. No surprise invoices. Just one flat rate for your program.
        </p>
      </div>

      {/* Plans */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
        {PLANS.map(({ name, price, period, description, features, cta, href, highlighted }) => (
          <div
            key={name}
            className={`flex flex-col rounded-2xl border p-8 ${
              highlighted
                ? 'border-blue-600 bg-blue-600 text-white shadow-xl'
                : 'border-gray-200 bg-white text-gray-900'
            }`}
          >
            <div className="mb-6">
              <p className={`text-xs font-semibold uppercase tracking-wider ${highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                {name}
              </p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-extrabold">{price}</span>
                {period && <span className={`mb-1 text-sm ${highlighted ? 'text-blue-100' : 'text-gray-500'}`}>{period}</span>}
              </div>
              <p className={`mt-2 text-sm ${highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                {description}
              </p>
            </div>

            <ul className="flex-1 space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg className={`mt-0.5 h-4 w-4 flex-shrink-0 ${highlighted ? 'text-blue-200' : 'text-blue-600'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={href}
              className={`mt-8 block rounded-md py-2.5 text-center text-sm font-semibold transition-colors ${
                highlighted
                  ? 'bg-white text-blue-600 hover:bg-blue-50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {cta}
            </Link>
          </div>
        ))}
      </div>

      {/* FAQ nudge */}
      <p className="mt-12 text-center text-sm text-gray-500">
        Questions about pricing?{' '}
        <Link href="/contact" className="text-blue-600 hover:underline">
          Contact us
        </Link>{' '}
        — we&apos;re happy to help.
      </p>
    </div>
  )
}
