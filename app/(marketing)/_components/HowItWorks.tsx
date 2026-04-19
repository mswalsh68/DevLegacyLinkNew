export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Build Your Active Roster',
      desc: 'Import your current athletes by sport, position, class year, and contact info. LegacyLink becomes your single source of truth for every active player.',
      tag: 'Active Roster',
    },
    {
      number: '02',
      title: 'Track Transitions Automatically',
      desc: 'When an athlete graduates, transfers, or completes their eligibility, they move seamlessly into your alumni database — no data lost, no manual work.',
      tag: 'Roster → Alumni',
    },
    {
      number: '03',
      title: 'Engage Your Alumni Network',
      desc: 'Send targeted outreach by sport, graduation year, or program. Keep alumni informed, involved, and invested in the program they helped build.',
      tag: 'Alumni CRM',
    },
    {
      number: '04',
      title: 'Grow Your Legacy',
      desc: "Turn alumni engagement into mentorship, donations, recruiting support, and community. Your roster doesn't end at graduation — it just changes roles.",
      tag: 'Ongoing Engagement',
    },
  ]

  const flow = ['Active Roster', '→', 'Transfer / Graduate', '→', 'Alumni Database', '→', 'Engaged Network']

  return (
    <section id="how-it-works" className="py-24 bg-brand-black">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-20">
          <p className="section-label">How It Works</p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            One Platform. The Full<br />
            <span className="gold-text">Athlete Lifecycle.</span>
          </h2>
          <p className="text-white/50 text-lg mt-5 max-w-2xl mx-auto">
            LegacyLink is designed around how athletic programs actually work — from the first day on the roster to decades after graduation.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-10 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="relative flex flex-col items-start md:items-center text-left md:text-center">
                <div className="w-20 h-20 rounded-sm bg-brand-dark border border-gold/30 flex items-center justify-center mb-6 flex-shrink-0 z-10">
                  <span className="text-2xl font-black gold-text">{step.number}</span>
                </div>
                <span className="text-xs uppercase tracking-widest text-gold/70 font-semibold mb-3 border border-gold/20 px-3 py-1 rounded-full">
                  {step.tag}
                </span>
                <h3 className="text-white font-bold text-lg mb-3">{step.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Flow diagram */}
        <div className="mt-20 flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
          {flow.map((item, i) => (
            item === '→'
              ? <span key={i} className="text-gold/40 text-xl">→</span>
              : <span key={i} className="bg-brand-dark border border-white/10 text-white/70 px-5 py-2 rounded-sm">{item}</span>
          ))}
        </div>

      </div>
    </section>
  )
}
