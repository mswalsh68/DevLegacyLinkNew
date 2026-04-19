import Image from 'next/image'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-bg.jpg"
          alt="background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-brand-black/75" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto pt-20">
        <Image
          src="/images/logo-stacked.jpg"
          alt="DevLegacyLink"
          width={220}
          height={220}
          className="mx-auto mb-10 rounded-sm"
          priority
        />

        <p className="section-label">The Athletic CRM Platform</p>

        <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6 tracking-tight">
          Where Rosters<br />
          <span className="gold-text">Become Legacies</span>
        </h1>

        <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          The all-in-one CRM built for athletic programs. Manage your active roster, track alumni, and keep your network engaged — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#contact" className="btn-gold">Request Access</a>
          <a href="#how-it-works" className="btn-outline">See How It Works</a>
        </div>

        {/* Sports tags */}
        <div className="mt-14 flex flex-wrap justify-center gap-3 text-xs text-white/30 uppercase tracking-widest">
          {['Football','Basketball','Baseball','Softball','Soccer','Lacrosse','Wrestling','Track & Field','Volleyball','Swimming'].map(s => (
            <span key={s} className="border border-white/10 px-3 py-1 rounded-full">{s}</span>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <svg className="w-5 h-5 text-gold/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  )
}
