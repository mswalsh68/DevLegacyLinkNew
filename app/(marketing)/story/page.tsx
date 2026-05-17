import Image from 'next/image'
import Link  from 'next/link'
import Navbar from '../_components/Navbar'
import Footer from '../_components/Footer'

export const metadata = {
  title: 'Our Story | LegacyLink',
  description:
    'Mike Walsh built LegacyLink because he lived the gap — D1 football, state championships, and a broken alumni network. This is the story behind the platform.',
}

export default function StoryPage() {
  return (
    <>
      <Navbar />
      <main className="bg-brand-black">

        {/* ─── SECTION 1 — HERO ─────────────────────────────────────── */}
        <section className="relative min-h-screen flex flex-col justify-end items-center overflow-hidden">
          {/* Background image + gradient */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/tunnel.jpeg"
              alt="Mike Walsh leading his team out of the tunnel"
              fill
              className="object-cover object-top"
              priority
            />
            {/* Top-transparent → bottom-black gradient so text is always readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand-black/30 via-brand-black/65 to-brand-black" />
          </div>

          {/* Content — sits in the dark bottom third */}
          <div className="relative z-10 text-center px-6 max-w-3xl mx-auto pb-28 pt-40">
            <p className="section-label tracking-[0.25em]">THE STORY BEHIND LEGACYLINK</p>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6">
              Built by someone<br />who lived it.
            </h1>
            <p className="text-white/55 text-lg md:text-xl italic leading-relaxed">
              &ldquo;This is where rosters become legacies &mdash; and why that line means everything to me.&rdquo;
            </p>
          </div>
        </section>

        {/* ─── SECTION 2 — PLANT HIGH SCHOOL ───────────────────────── */}
        <section className="py-28 bg-brand-black">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">

              {/* Text — left on desktop, bottom on mobile */}
              <div className="md:order-1 order-2">
                <p className="section-label">PLANT HIGH SCHOOL &mdash; TAMPA, FLORIDA</p>
                <div className="flex flex-col gap-5 text-white/65 text-lg leading-relaxed">
                  <p>
                    I played high school football at Plant High School in Tampa, Florida. In 2006 &mdash;
                    my senior year &mdash; we won the program&apos;s first ever state championship.
                  </p>
                  <p>
                    Those years were some of the best of my life. I made bonds I thought could never
                    be broken. Shared memories I thought would last forever.
                  </p>
                  <p>And they did. But the connections didn&apos;t.</p>
                </div>
              </div>

              {/* Image — right on desktop, top on mobile */}
              <div className="md:order-2 order-1">
                <div className="rounded-sm overflow-hidden border border-white/5 shadow-xl">
                  <Image
                    src="/statechamps.jpeg"
                    alt="Plant High School state championship celebration"
                    width={600}
                    height={400}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION 3 — THE CARABINER ────────────────────────────── */}
        <section className="py-28 bg-brand-dark">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">

              {/* Image — left on desktop, top on mobile */}
              <div className="order-1">
                <div className="rounded-sm overflow-hidden border border-white/5 shadow-xl">
                  <Image
                    src="/link.jpeg"
                    alt="Carabiner engraved: PLANT PANTHERS FOOTBALL — ALWAYS A LINK"
                    width={600}
                    height={600}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>

              {/* Text — right on desktop, bottom on mobile */}
              <div className="order-2">
                <p className="section-label">THE ORIGIN</p>
                <p className="text-white/65 text-lg leading-relaxed mb-8">
                  Every player on that team got one. A carabiner. Engraved with four words.
                </p>

                {/* Brand-origin hero text */}
                <p className="text-5xl md:text-6xl font-black text-gold leading-tight mb-8">
                  &ldquo;ALWAYS A LINK&rdquo;
                </p>

                <div className="flex flex-col gap-4 text-white/65 text-lg leading-relaxed">
                  <p>I still have mine.</p>
                  <p>That&apos;s where the name comes from.</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION 4 — THE BRIDGE (Helmets) ────────────────────── */}
        <section className="py-32 bg-brand-black flex flex-col items-center">
          <div className="w-full max-w-[800px] mx-auto px-6">
            <Image
              src="/helmets.jpeg"
              alt="USF and Plant High School helmets facing each other"
              width={800}
              height={500}
              className="w-full h-auto object-cover rounded-sm"
            />
          </div>
          <p className="text-gold text-2xl md:text-3xl italic font-semibold text-center mt-12 px-6 max-w-xl">
            &ldquo;Two programs. Nine years. One idea.&rdquo;
          </p>
        </section>

        {/* ─── SECTION 5 — USF YEARS ────────────────────────────────── */}
        <section className="py-28 bg-brand-dark">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">

              {/* Image — left on desktop, top on mobile */}
              <div className="order-1">
                <div className="rounded-sm overflow-hidden border border-white/5 shadow-xl">
                  <Image
                    src="/seniornight.jpeg"
                    alt="Mike Walsh on the sideline at USF, helmet in hand"
                    width={600}
                    height={400}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>

              {/* Text — right on desktop, bottom on mobile */}
              <div className="order-2">
                <p className="section-label">UNIVERSITY OF SOUTH FLORIDA &mdash; 2007&ndash;2011</p>
                <div className="flex flex-col gap-5 text-white/65 text-lg leading-relaxed">
                  <p>
                    I went on to play at the University of South Florida from 2007 to 2011. We won
                    games we had no business winning. We went on bowl trips. We led, cried, sweated,
                    and broke bread together.
                  </p>
                  <p>
                    I still keep in touch with a select few teammates. But for the most part, I only
                    see them here and there &mdash; at games, at events, whenever life briefly puts
                    us in the same place.
                  </p>
                  <p>The relationships were real. The system to maintain them never existed.</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION 6 — THE DISCONNECT ───────────────────────────── */}
        <section className="py-32 bg-brand-black">
          <div className="max-w-2xl mx-auto px-6">

            {/* Gut-punch pull quote */}
            <p className="text-white text-4xl md:text-6xl italic font-black leading-tight text-center mb-16">
              &ldquo;But the connections didn&apos;t.&rdquo;
            </p>

            {/* Body copy — left-aligned for readability */}
            <div className="flex flex-col gap-6 text-white/65 text-lg leading-relaxed">
              <p>
                When I graduated, I assumed I&apos;d stay connected to the programs that shaped me.
                What I found instead was private Facebook groups, word-of-mouth texts, and Microsoft
                Forms emailed out by teammates asking everyone to update their contact information.
              </p>
              <p>
                At USF, this was a never-ending cycle. Coaches came and went. Every new staff
                triggered the same mad scramble &mdash; a frantic first spring trying to reconnect
                with alumni, gather contact info that had already been gathered, and rebuild
                relationships that should never have been lost.
              </p>
              <p>
                The connection shouldn&apos;t sever the moment you walk off campus. The memories we
                made as a team should carry forward for the rest of our lives. It shouldn&apos;t
                take a coaching change to remind a program that its alumni exist.
              </p>
            </div>

            {/* Senior Night image — bottom of section */}
            <div className="mt-16">
              <div className="rounded-sm overflow-hidden border border-white/5 shadow-xl">
                <Image
                  src="/seniornight.jpeg"
                  alt="Mike Walsh lined up with teammates on Senior Night, holding commemorative ball"
                  width={700}
                  height={450}
                  className="w-full h-auto object-cover"
                />
              </div>
              <p className="text-white/35 text-sm text-center mt-3 tracking-wide">
                Senior Night, USF &mdash; 2011
              </p>
            </div>

          </div>
        </section>

        {/* ─── SECTION 7 — THE BUILD ────────────────────────────────── */}
        <section className="py-28 bg-brand-dark">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 items-center">

              {/* Text — left on desktop, bottom on mobile */}
              <div className="md:order-1 order-2">
                <p className="section-label">THE SOLUTION</p>
                <div className="flex flex-col gap-5 text-white/65 text-lg leading-relaxed">
                  <p>This is why I built LegacyLink.</p>
                  <p>
                    LegacyLink connects the present with the future. It tracks an athlete from the
                    moment they step on campus, follows them throughout their journey, and continues
                    long after they stop putting on the uniform.
                  </p>
                  <p>
                    Built for every level &mdash; high school, college, D1, NAIA, and club programs.
                    White-labeled for your team. Purpose-built for the way athletic programs
                    actually work.
                  </p>
                </div>
              </div>

              {/* Dashboard screenshot — right on desktop, top on mobile */}
              <div className="md:order-2 order-1">
                <div className="rounded-sm overflow-hidden border border-white/10 shadow-2xl ring-1 ring-white/5">
                  <Image
                    src="/dashboard.jpeg"
                    alt="LegacyLink dashboard with roster and alumni data"
                    width={700}
                    height={450}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION 8 — THE CLOSE ────────────────────────────────── */}
        <section className="py-32 bg-brand-black">
          <div className="max-w-2xl mx-auto px-6 flex flex-col items-center text-center">

            {/* Blockquote with gold left border */}
            <blockquote className="w-full text-left border-l-2 border-gold/40 pl-6 text-white/55 text-lg italic leading-relaxed mb-6">
              <p>
                The name comes from my high school team&apos;s motto:{' '}
                <strong className="text-white not-italic">Always a Link.</strong>
              </p>
              <p className="mt-2">
                That connection &mdash; from first practice to lifelong alumni &mdash; is what
                we&apos;re built to protect.
              </p>
            </blockquote>

            <div className="h-6" />

            {/* Closing statement */}
            <p className="gold-text text-4xl md:text-5xl italic font-black leading-tight">
              &ldquo;This is where rosters become legacies.&rdquo;
            </p>

            {/* Attribution */}
            <p className="text-white text-lg mt-5 font-normal tracking-wide">
              &mdash; Mike Walsh, Founder
            </p>

            <div className="h-10" />

            {/* CTAs — full-width on mobile */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
              <Link href="/" className="btn-gold text-center">
                See the Platform &rarr;
              </Link>
              <Link href="/#contact" className="btn-outline text-center">
                Request a Demo
              </Link>
            </div>

          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
