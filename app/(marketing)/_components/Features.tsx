function TierBadge({ tier }: { tier: 'all' | 'pro' | 'elite' }) {
  if (tier === 'elite') return (
    <span className="text-xs font-bold uppercase tracking-wider gold-text border border-gold/30 px-3 py-1 rounded-full">
      Elite Only
    </span>
  )
  if (tier === 'pro') return (
    <span className="text-xs font-bold uppercase tracking-wider text-blue-400 border border-blue-400/30 px-3 py-1 rounded-full">
      Pro &amp; Elite
    </span>
  )
  return (
    <span className="text-xs font-bold uppercase tracking-wider text-white/40 border border-white/10 px-3 py-1 rounded-full">
      All Plans
    </span>
  )
}

const features: { icon: string; title: string; desc: string; tier: 'all' | 'pro' | 'elite' }[] = [
  {
    icon: '🏈',
    title: 'Active Roster Management',
    desc: "Organize athletes by sport, position, class year, jersey number, and eligibility status. Always know who's on your roster and where they stand.",
    tier: 'all',
  },
  {
    icon: '🎓',
    title: 'Alumni Directory & CRM',
    desc: 'Every athlete who ever wore your colors, preserved. Track careers, locations, donor status, and engagement — long after they graduate.',
    tier: 'all',
  },
  {
    icon: '🔁',
    title: 'One-Click Roster-to-Alumni Transition',
    desc: "When an athlete's eligibility ends, they move seamlessly into your alumni database. Zero data lost. Zero manual entry.",
    tier: 'all',
  },
  {
    icon: '📰',
    title: 'Program News Feed',
    desc: 'A community hub for your entire program. Post announcements, updates, and news — targeted to your full network, roster only, or alumni only. Filter by sport or broadcast to all.',
    tier: 'all',
  },
  {
    icon: '📧',
    title: 'Mass Email Communications',
    desc: 'Send targeted emails to your entire network or filtered segments — by sport, class year, status, or donor flag. Purpose-built for athletic administrators, not marketers.',
    tier: 'pro',
  },
  {
    icon: '📊',
    title: 'Engagement Analytics',
    desc: "See who's opening messages, who's engaged, and who's gone dark. Understand where your network stands and where to focus your outreach.",
    tier: 'pro',
  },
  {
    icon: '🤝',
    title: 'Admin-Facilitated Mentor Program',
    desc: 'Connect current players with alumni mentors — by sport, position, or background. Admins create and manage pairings. Track responses and active connections in one view.',
    tier: 'elite',
  },
  {
    icon: '🎨',
    title: 'White-Label Custom Theming',
    desc: 'Your colors. Your logo. Your brand. Every portal is fully white-labeled to your program — six hex values control the complete visual experience.',
    tier: 'all',
  },
  {
    icon: '👥',
    title: 'Multi-Sport Staff Management',
    desc: 'Manage coaches, administrators, and alumni directors across every sport in your program. Role-based access ensures everyone sees exactly what they need.',
    tier: 'all',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-24 bg-brand-dark">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="section-label">Features</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Built for athletics.<br />
            <span className="gold-text">Not adapted from a generic CRM.</span>
          </h2>
          <p className="text-white/50 text-lg mt-5 max-w-2xl mx-auto">
            Every feature was designed around the way coaches, administrators, and athletes actually work — at every level.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-7 rounded-sm bg-brand-black border border-white/5 hover:border-gold/30 transition-all duration-300 flex flex-col"
            >
              <div className="text-3xl mb-5">{feature.icon}</div>
              <h3 className="text-white font-bold text-lg mb-3">{feature.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-5 flex-1">{feature.desc}</p>
              <TierBadge tier={feature.tier} />
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
