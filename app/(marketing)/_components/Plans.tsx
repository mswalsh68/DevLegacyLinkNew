const plans = [
  {
    level:    'High School & Club',
    name:     'Starter',
    tagline:  'Alumni management, built in.',
    price:    '$299',
    period:   'per month',
    features: [
      'Alumni directory & CRM',
      'Program news feed',
      'White-label custom theming',
      'Multi-sport support',
      'Role-based staff access',
      'Dedicated database',
    ],
    featured: false,
    ctaLabel: 'Request a Demo',
  },
  {
    level:    'College Programs',
    name:     'Pro',
    tagline:  'Roster + alumni + comms.',
    price:    '$599',
    period:   'per month',
    features: [
      'Everything in Starter',
      'Active roster management',
      'One-click roster-to-alumni transition',
      'Mass email communications',
      'Engagement analytics',
      'Multi-sport department support',
    ],
    featured: true,
    ctaLabel: 'Request a Demo',
  },
  {
    level:    'D1 Programs',
    name:     'Elite',
    tagline:  'The full platform. No limits.',
    price:    '$999',
    period:   'per month',
    features: [
      'Everything in Pro',
      'Admin-facilitated mentor program',
      'Player-to-alumni pairings',
      'Advanced department analytics',
      'Priority support',
      'Enterprise available',
    ],
    featured: false,
    ctaLabel: 'Request a Demo',
  },
]

export default function Plans() {
  return (
    <section id="plans" className="py-24 bg-brand-dark">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="section-label">Plans &amp; Pricing</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Simple pricing.<br />
            <span className="gold-text">Every level covered.</span>
          </h2>
          <p className="text-white/50 text-lg mt-5 leading-relaxed">
            No surprise fees. No feature paywalls that matter. Pick the plan that fits your program — upgrade anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-sm p-8 border ${
                plan.featured
                  ? 'bg-brand-black border-gold/30'
                  : 'bg-brand-black border-white/5'
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-widest gold-text mb-2">{plan.level}</p>
              <h3 className="text-white font-black text-2xl mb-1">{plan.name}</h3>
              <p className="text-white/40 text-sm mb-6">{plan.tagline}</p>
              <p className="text-white font-black text-4xl tracking-tight leading-none mb-1">{plan.price}</p>
              <p className="text-white/30 text-sm mb-8">{plan.period}</p>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/50">
                    <svg className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className={plan.featured ? 'btn-gold text-center' : 'btn-outline text-center'}
              >
                {plan.ctaLabel}
              </a>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
