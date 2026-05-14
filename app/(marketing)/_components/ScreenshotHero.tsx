export default function ScreenshotHero() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6 flex flex-col items-center text-center">
        <p className="section-label" style={{ color: '#888' }}>The Platform</p>
        <h2 className="text-4xl md:text-5xl font-black leading-tight mb-4" style={{ color: '#0a0a0a' }}>
          Everything in one place.<br />Built for how programs actually work.
        </h2>
        <p className="text-lg max-w-2xl mx-auto mb-12 leading-relaxed" style={{ color: '#555' }}>
          From roster to alumni to staff to communications — your entire athletic program managed from a single, purpose-built dashboard.
        </p>

        {/* ★ SCREENSHOT: Image 1 — Admin Dashboard */}
        <div className="w-full max-w-5xl rounded-xl overflow-hidden border border-black/10" style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.15)' }}>
          <img src="/dashboard.jpeg" alt="Admin Dashboard" className="w-full h-auto block" />
        </div>
      </div>
    </section>
  )
}
