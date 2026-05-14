function TierBadge({ tier }: { tier: 'all' | 'elite' }) {
  if (tier === 'elite') return (
    <span className="text-xs font-bold uppercase tracking-wider gold-text border border-gold/30 px-3 py-1 rounded-full">
      Elite Only
    </span>
  )
  return (
    <span className="text-xs font-bold uppercase tracking-wider text-white/40 border border-white/10 px-3 py-1 rounded-full">
      All Plans
    </span>
  )
}

const screenshots = [
  {
    row: 1,
    cards: [
      {
        img: '/newsfeed.png',
        alt: 'Program News Feed',
        title: 'Program News Feed',
        desc: 'Post to your entire network or target roster-only and alumni-only audiences. Filter by sport or broadcast to all.',
        tier: 'all' as const,
      },
      {
        img: '/mentor.png',
        alt: 'Mentor Program',
        title: 'Admin-Facilitated Mentor Program',
        desc: 'Connect current players with alumni mentors. Track pairings, responses, and active connections — managed by your staff.',
        tier: 'elite' as const,
      },
    ],
  },
  {
    row: 2,
    cards: [
      {
        img: '/team-settings.png',
        alt: 'Team Settings / White-Label Theming',
        title: 'White-Label Custom Theming',
        desc: 'Six hex values control your full portal color theme. Your brand, your colors, your platform — built for your program.',
        tier: 'all' as const,
      },
      {
        img: '/alumni-profile.png',
        alt: 'Alumni Profile',
        title: 'Every Player. Every Season. Preserved.',
        desc: 'Jersey number. Position. Class year. Seasons played. Every detail — saved from the day they first stepped on the field.',
        tier: 'all' as const,
      },
    ],
  },
]

export default function Screenshots() {
  return (
    <section id="screenshots" className="py-24 bg-brand-dark">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="section-label">The Product</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            See it in action.
          </h2>
          <p className="text-white/50 text-lg mt-5 leading-relaxed">
            A real platform built for real programs. Clean, fast, and purpose-built for the way athletic administrators actually work.
          </p>
        </div>

        <div className="space-y-6">
          {screenshots.map(({ row, cards }) => (
            <div key={row} className="grid md:grid-cols-2 gap-6">
              {cards.map(card => (
                <div key={card.title} className="rounded-sm bg-brand-black border border-white/5 overflow-hidden">
                  <img src={card.img} alt={card.alt} className="w-full h-auto block" />
                  <div className="p-6 border-t border-white/5">
                    <h4 className="text-white font-bold text-base mb-2">{card.title}</h4>
                    <p className="text-white/50 text-sm leading-relaxed mb-4">{card.desc}</p>
                    <TierBadge tier={card.tier} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
