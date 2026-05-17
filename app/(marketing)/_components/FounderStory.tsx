import Link from 'next/link'

export default function FounderStory() {
  return (
    <section id="founder" className="py-24 bg-brand-black">
      <div className="max-w-3xl mx-auto px-6">

        <p className="section-label">THE STORY BEHIND LEGACYLINK</p>

        <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-8">
          Built by someone who lived it.
        </h2>

        <div className="flex flex-col gap-5 text-white/70 text-lg leading-relaxed mb-8">
          <p>
            I played D1 football at USF. Years after graduation, my program was still tracking
            alumni through Google Forms and survey links.
          </p>
          <p>
            Then a coaching change hit. New staff, no alumni relationships, no institutional
            memory. I watched a program lose its entire network overnight.
          </p>
          <p>
            I built LegacyLink because I was standing in that gap myself &mdash; and so was
            every program I talked to.
          </p>
        </div>

        <p className="text-white/50 text-base leading-relaxed border-l-2 border-gold/40 pl-5 italic mb-8">
          The name comes from my high school team&apos;s motto:{' '}
          <span className="gold-text not-italic font-semibold">Always a Link.</span>{' '}
          That connection &mdash; from first practice to lifelong alumni &mdash; is what
          we&apos;re built to protect.
        </p>

        <Link href="/story" className="btn-outline inline-block">
          Read the Full Story &rarr;
        </Link>

      </div>
    </section>
  )
}
