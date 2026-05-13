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

          {/* Right — founder story placeholder */}
          <div className="border-2 border-dashed border-white/10 rounded-sm p-12 text-center">
            <h3 className="text-white/30 font-bold text-xl mb-3">Mike&apos;s Story — Coming Soon</h3>
            <p className="text-white/20 text-sm leading-relaxed">
              The founder&apos;s story and the &ldquo;why&rdquo; behind LegacyLink will live here.<br />
              Replace this section with Mike&apos;s narrative when ready.
            </p>
          </div>

        </div>
      </div>
    </section>
  )
}
