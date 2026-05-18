import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-brand-black border-t border-white/5 py-14">
      <div className="max-w-6xl mx-auto px-6">

        {/* Top row */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-10 mb-12">

          {/* Brand */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo-icon.jpg"
                alt="LegacyLink"
                width={36}
                height={36}
                className="rounded-sm"
              />
              <span className="text-white font-bold text-xl tracking-tight">
                Legacy<span className="gold-text">Link</span>
              </span>
            </div>
            <p className="text-white/30 text-sm max-w-xs leading-relaxed">
              The athletic CRM platform that turns rosters into legacies.
            </p>
          </div>

          {/* Nav columns */}
          <div className="flex flex-wrap gap-12 text-sm">
            <div>
              <h4 className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-4">Platform</h4>
              <ul className="space-y-3">
                <li><a href="/#how-it-works" className="text-white/40 hover:text-gold transition-colors text-xs uppercase tracking-widest font-semibold">How It Works</a></li>
                <li><a href="/#features"    className="text-white/40 hover:text-gold transition-colors text-xs uppercase tracking-widest font-semibold">Features</a></li>
                <li><a href="/#who"         className="text-white/40 hover:text-gold transition-colors text-xs uppercase tracking-widest font-semibold">Who It&apos;s For</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-4">Account</h4>
              <ul className="space-y-3">
                <li><Link href="/login"  className="text-white/40 hover:text-gold transition-colors text-xs uppercase tracking-widest font-semibold">Sign In</Link></li>
                <li><a href="/#contact"  className="text-white/40 hover:text-gold transition-colors text-xs uppercase tracking-widest font-semibold">Request a Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-4">Follow</h4>
              <ul className="space-y-3">
                <li>
                  <a href="https://x.com/LegacyLinkHQ" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-gold transition-colors text-xs uppercase tracking-widest font-semibold">
                    @LegacyLinkHQ
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mb-8" />

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/20">
          <p>&copy; {new Date().getFullYear()} Legacy Link HQ, LLC. All rights reserved.</p>
          <p className="italic gold-text opacity-60">Where Rosters Become Legacies</p>
        </div>

      </div>
    </footer>
  )
}
