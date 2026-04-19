const audiences = [
  {
    title: 'College Athletic Directors',
    subtitle: 'Program-wide visibility',
    desc: 'Oversee every sport under your department from a single dashboard. Track alumni engagement across the entire athletic program, support donor pipeline development, and demonstrate the long-term value of your programs to your institution.',
    bullets: [
      'Department-level reporting across all sports',
      'Alumni engagement and retention metrics',
      'Donor and fundraising pipeline support',
      'Compliance-safe data management',
    ],
    badge: 'College',
  },
  {
    title: 'Head Coaches',
    subtitle: 'Your roster. Your legacy.',
    desc: "From managing your current roster to staying connected with every player who wore your colors, LegacyLink keeps you in the driver's seat. Build a culture that extends beyond the final whistle.",
    bullets: [
      'Full roster management with depth charts',
      'Track alumni by class year and sport',
      'Outreach tools built for coaches, not salespeople',
      'Multi-sport or single-sport access',
    ],
    badge: 'All Levels',
  },
  {
    title: 'High School Programs',
    subtitle: 'Sport-by-sport or school-wide',
    desc: "Whether you're running one program or managing athletics for an entire school, LegacyLink scales with you. Keep track of athletes from freshman year through alumni status — and build a network that gives back to your program.",
    bullets: [
      'Start with one sport, expand school-wide',
      'Track the full HS-to-college-to-alumni journey',
      'Engage local alumni for booster support',
      'Simple setup, no dedicated IT required',
    ],
    badge: 'High School',
  },
]

const sports = [
  'Football','Basketball','Baseball','Softball','Soccer',
  'Lacrosse','Wrestling','Track & Field','Volleyball',
  'Swimming','Tennis','Golf','Cross Country','Hockey',
]

export default function WhoItsFor() {
  return (
    <section id="who" className="py-24 bg-brand-black">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="section-label">Who It&apos;s For</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Built for the People Who<br />
            <span className="gold-text">Build Programs</span>
          </h2>
          <p className="text-white/50 text-lg mt-5 max-w-2xl mx-auto">
            Whether you&apos;re running a D1 athletic department or a high school football program, LegacyLink was made for you.
          </p>
        </div>

        {/* Audience cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {audiences.map((audience) => (
            <div
              key={audience.title}
              className="flex flex-col p-8 rounded-sm bg-brand-dark border border-white/5 hover:border-gold/20 transition-all duration-300"
            >
              <span className="self-start text-xs uppercase tracking-widest font-semibold text-gold border border-gold/30 px-3 py-1 rounded-full mb-5">
                {audience.badge}
              </span>
              <h3 className="text-white font-black text-xl mb-1">{audience.title}</h3>
              <p className="text-gold/70 text-sm font-semibold mb-4">{audience.subtitle}</p>
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

        {/* Sport tags */}
        <div className="mt-16 text-center">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-5">Supported Sports</p>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-white/40 uppercase tracking-widest">
            {sports.map(s => (
              <span key={s} className="border border-white/10 px-3 py-1 rounded-full hover:border-gold/30 hover:text-gold/60 transition-colors cursor-default">
                {s}
              </span>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
