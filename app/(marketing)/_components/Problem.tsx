export default function Problem() {
  const stats = [
    { value: '85%', label: 'of programs have no formal alumni tracking system' },
    { value: '3x',  label: 'more engagement from alumni who feel connected post-graduation' },
    { value: '0',   label: 'tools built specifically for athletic program alumni outreach' },
  ]

  const painPoints = [
    { icon: '📋', title: 'Rosters reset every year',       desc: 'Graduating athletes disappear from the system the moment they leave.' },
    { icon: '📇', title: 'No central alumni database',     desc: 'Contact info scattered across spreadsheets, email threads, and memory.' },
    { icon: '🔇', title: 'Engagement goes silent',         desc: 'Without a system, outreach is inconsistent and alumni feel forgotten.' },
    { icon: '🧩', title: "Tools weren't built for you",    desc: 'Generic CRMs lack the sport, position, and roster context you actually need.' },
  ]

  return (
    <section className="py-24 bg-brand-dark">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="section-label">The Problem</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Programs Lose Their People<br />
            <span className="gold-text">The Moment They Graduate</span>
          </h2>
        </div>

        {/* Two-column narrative */}
        <div className="grid md:grid-cols-2 gap-12 mb-20 items-center">
          <div className="space-y-6 text-white/60 text-lg leading-relaxed">
            <p>
              Every year, your athletes graduate, transfer, or age out — and most programs
              have no system to stay connected. Contact info lives in a coach&apos;s phone.
              Alumni updates come through word of mouth. Engagement is reactive, not intentional.
            </p>
            <p>
              The result? Programs struggle to build donor pipelines, mentorship networks,
              and community support because the relationships were never maintained in the first place.
            </p>
            <p className="text-white/80 font-semibold">
              Generic CRMs weren&apos;t built for athletics. Spreadsheets don&apos;t scale.
              And doing nothing is no longer an option.
            </p>
          </div>

          {/* Pain points */}
          <div className="space-y-4">
            {painPoints.map(item => (
              <div key={item.title} className="flex gap-4 p-5 rounded-sm bg-brand-black border border-white/5">
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-white font-semibold mb-1">{item.title}</p>
                  <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 rounded-sm overflow-hidden">
          {stats.map(stat => (
            <div key={stat.value} className="bg-brand-black px-8 py-10 text-center">
              <p className="text-5xl font-black gold-text mb-3">{stat.value}</p>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">{stat.label}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
