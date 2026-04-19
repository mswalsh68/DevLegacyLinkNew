import Image from 'next/image'

const links = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features',     href: '#features' },
  { label: "Who It's For", href: '#who' },
  { label: 'Request Access', href: '#contact' },
]

export default function Footer() {
  return (
    <footer className="bg-brand-black border-t border-white/5 py-14">
      <div className="max-w-6xl mx-auto px-6">

        {/* Top row */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10 mb-12">

          {/* Brand */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo-icon.jpg"
                alt="DevLegacyLink"
                width={36}
                height={36}
                className="rounded-sm"
              />
              <span className="text-white font-bold text-xl tracking-tight">
                Legacy<span className="gold-text">Link</span>
              </span>
            </div>
            <p className="text-white/30 text-sm max-w-xs text-center md:text-left leading-relaxed">
              The athletic CRM platform that turns rosters into legacies.
            </p>
          </div>

          {/* Nav links */}
          <nav className="flex flex-wrap justify-center md:justify-end gap-x-8 gap-y-3 text-sm text-white/40">
            {links.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="hover:text-gold transition-colors uppercase tracking-widest text-xs font-semibold"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mb-8" />

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/20">
          <p>&copy; {new Date().getFullYear()} DevLegacyLink. All rights reserved.</p>
          <p className="italic gold-text opacity-60">Where Rosters Become Legacies</p>
        </div>

      </div>
    </footer>
  )
}
