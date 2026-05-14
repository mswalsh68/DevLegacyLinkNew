export default function FounderStory() {
  return (
    <section id="founder" className="py-24 bg-brand-black">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left — label + headline + photo placeholder */}
          <div>
            <p className="section-label">The Story Behind LegacyLink</p>
            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-8">
              Built by someone<br />who lived it.
            </h2>

            {/* ★ PHOTO: Mike Walsh founder photo — to be added */}
            <div className="w-full rounded-sm overflow-hidden bg-brand-dark border border-white/5 flex flex-col items-center justify-center gap-3 py-24">
              <span className="text-xs font-bold uppercase tracking-widest text-white/20">Photo</span>
              <span className="text-base font-semibold text-white/10">Mike Walsh</span>
            </div>
          </div>

          {/* Right — founder story */}
          <div className="flex flex-col gap-6">
            <p className="text-white/70 text-lg leading-relaxed">
              I played D1 football at USF. Years after graduation, my program was still tracking alumni through Google Forms and survey links.
            </p>
            <p className="text-white/70 text-lg leading-relaxed">
              Then a coaching change hit. New staff, no alumni relationships, no institutional memory. Every transition reset engagement to zero. I watched a program lose its entire network overnight.
            </p>
            <p className="text-white/70 text-lg leading-relaxed">
              I looked at every tool on the market. The existing platforms own the active roster. Nobody owned what comes next.
            </p>
            <p className="text-white/70 text-lg leading-relaxed">
              I built LegacyLink because I was standing in that gap myself — and so was every program I talked to.
            </p>
            <p className="text-white/50 text-base leading-relaxed border-l-2 border-gold/40 pl-5 italic">
              The name comes from my high school team&apos;s motto: <span className="gold-text not-italic font-semibold">Always a Link.</span> That connection — from first practice to lifelong alumni — is what we&apos;re built to protect.
            </p>
          </div>

        </div>
      </div>
    </section>
  )
}
