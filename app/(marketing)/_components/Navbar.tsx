'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-black/90 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Image src="/images/logo-icon.jpg" alt="DevLegacyLink" width={36} height={36} className="rounded-sm" />
          <span className="text-white font-bold text-lg tracking-tight">
            Legacy<span className="gold-text">Link</span>
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <a href="#how-it-works" className="hover:text-gold transition-colors">How It Works</a>
          <a href="#features"     className="hover:text-gold transition-colors">Features</a>
          <a href="#who"          className="hover:text-gold transition-colors">Who It&apos;s For</a>
          <a href="#contact"      className="btn-gold text-xs py-2 px-5">Request Access</a>
          <Link href="/login"     className="text-white/50 hover:text-white transition-colors text-xs uppercase tracking-widest">Sign In</Link>
        </div>

        {/* Mobile burger */}
        <button className="md:hidden text-white/70" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-brand-dark border-t border-white/5 px-6 py-4 flex flex-col gap-4 text-sm text-white/70">
          <a href="#how-it-works" onClick={() => setOpen(false)} className="hover:text-gold">How It Works</a>
          <a href="#features"     onClick={() => setOpen(false)} className="hover:text-gold">Features</a>
          <a href="#who"          onClick={() => setOpen(false)} className="hover:text-gold">Who It&apos;s For</a>
          <a href="#contact"      onClick={() => setOpen(false)} className="btn-gold text-center text-xs py-3">Request Access</a>
          <Link href="/login" onClick={() => setOpen(false)} className="text-white/40 hover:text-white/70 text-xs uppercase tracking-widest text-center">Sign In</Link>
        </div>
      )}
    </nav>
  )
}
