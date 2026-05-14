const audiences = [
  {
    level: 'High School · Starter Plan',
    title: 'High School Programs',
    tagline: 'Sport-by-sport or school-wide.',
    desc: 'Whether you\'re running one program or managing athletics for an entire school, LegacyLink gives you the alumni tools and community engagement that used to be reserved for college programs.',
    bullets: [
      'Alumni directory and engagement — core feature at Starter',
      'Program news feed for your full network',
      'Start with one sport, expand school-wide',
      'Build a local booster and alumni network that gives back',
    ],
  },
  {
    level: 'College · Pro Plan',
    title: 'College Programs',
    tagline: 'D1 through NAIA. Every level counts.',
    desc: 'Competitors start at D1 and stop there. LegacyLink was built for the programs they ignore — D2, D3, NAIA, and junior colleges — with full roster and alumni management at a price that fits your budget.',
    bullets: [
      'Full roster + alumni CRM — both included on Pro',
      'Mass email communications to your entire network',
      'Multi-sport support across your department',
      'Donor pipeline tracking built into every alumni record',
    ],
  },
  {
    level: 'D1 Programs · Elite Plan',
    title: 'D1 Athletic Departments',
    tagline: 'The full platform. No limits.',
    desc: 'Department-wide visibility, admin-facilitated mentorship, advanced analytics, and the full feature set — built for programs where alumni engagement directly impacts recruiting, fundraising, and legacy.',
    bullets: [
      'Admin-facilitated mentor program — alumni to current players',
      'Department-level reporting across all sports',
      'Full engagement analytics — who\'s active, who\'s dark',
      'Dedicated database — your data is yours, fully isolated',
    ],
  },
]

export default function WhoItsFor() {
  return (
    <section id="who" className="py-24 bg-brand-black">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="section-label">Who It&apos;s For</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Built for every level.<br />
            <span className="gold-text">Not just the ones with big budgets.</span>
          </h2>
        </div>

        {/* Audience cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {audiences.map((audience) => (
            <div
              key={audience.title}
              className="flex flex-col p-8 rounded-sm bg-brand-dark border border-white/5 hover:border-gold/20 transition-all duration-300"
            >
              <span className="self-start text-xs uppercase tracking-widest font-semibold text-gold border border-gold/30 px-3 py-1 rounded-full mb-5">
                {audience.level}
              </span>
              <h3 className="text-white font-black text-xl mb-1">{audience.title}</h3>
              <p className="text-gold/70 text-sm font-semibold mb-4">{audience.tagline}</p>
              <p className="text-white/50 text-sm leading-relaxed mb-6">{audience.desc}</p>
              <ul className="mt-auto space-y-3">
                {audience.bullets.map(bullet => (
                  <li key={bullet} className="flex items-start gap-3 text-sm text-white/60">
                    <svg className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
